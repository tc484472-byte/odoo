const db = require('../db');
const { generateInvoiceNumber, advanceDate } = require('../services/billingService');
const { recordAuditLog } = require('../middleware/audit');

// List Invoices
async function getInvoices(req, res) {
  try {
    let queryText = `
      SELECT i.*, 
             c.company_name, c.contact_name, c.email as customer_email,
             s.subscription_number, p.name as plan_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      LEFT JOIN plans p ON s.plan_id = p.id
    `;
    const params = [];

    // Customer isolation
    if (req.user.role === 'customer') {
      queryText += ' WHERE i.customer_id = $1';
      params.push(req.user.customerId);
    }

    queryText += ' ORDER BY i.invoice_date DESC, i.id DESC';

    const result = await db.query(queryText, params);
    return res.json({ success: true, invoices: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get Invoice by ID + Line Items + Payments
async function getInvoiceById(req, res) {
  const { id } = req.params;

  try {
    const invRes = await db.query(
      `SELECT i.*, 
              c.company_name, c.contact_name, c.email as customer_email, 
              c.phone as customer_phone, c.billing_address, c.gst_number,
              s.subscription_number, p.name as plan_name
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       LEFT JOIN subscriptions s ON i.subscription_id = s.id
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE i.id = $1`,
      [id]
    );

    if (invRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoice = invRes.rows[0];

    // Customer isolation check
    if (req.user.role === 'customer' && Number(invoice.customer_id) !== Number(req.user.customerId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another customer invoice.' });
    }

    // Line items
    const itemsRes = await db.query(
      `SELECT ii.*, p.name as product_name, pv.variant_name, pv.attribute_value
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       LEFT JOIN product_variants pv ON ii.variant_id = pv.id
       WHERE ii.invoice_id = $1`,
      [id]
    );

    // Payments recorded against this invoice
    const paymentsRes = await db.query(
      `SELECT pay.*, u.full_name as recorded_by_name
       FROM payments pay
       LEFT JOIN users u ON pay.recorded_by = u.id
       WHERE pay.invoice_id = $1
       ORDER BY pay.payment_date DESC, pay.id DESC`,
      [id]
    );

    return res.json({
      success: true,
      invoice,
      items: itemsRes.rows,
      payments: paymentsRes.rows
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Manual Invoice (Staff / Admin)
async function createInvoice(req, res) {
  const {
    customerId, subscriptionId, invoiceDate, dueDate,
    billingPeriodStart, billingPeriodEnd, items,
    discountAmount = 0, taxAmount = 0, notes
  } = req.body;

  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Customer and invoice items are required.' });
  }

  const today = invoiceDate || new Date().toISOString().split('T')[0];
  const due = dueDate || advanceDate(today, 'weekly');
  const periodStart = billingPeriodStart || today;
  const periodEnd = billingPeriodEnd || advanceDate(periodStart, 'monthly');

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Prevent duplicate billing for same subscription and period if subscription attached
    if (subscriptionId) {
      const existing = await client.query(
        'SELECT id, invoice_number FROM invoices WHERE subscription_id = $1 AND billing_period_start = $2',
        [subscriptionId, periodStart]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          message: `An invoice (${existing.rows[0].invoice_number}) already exists for this subscription and billing period.`
        });
      }
    }

    let subtotal = 0;
    for (const it of items) {
      subtotal += Number(it.unitPrice || 0) * Number(it.quantity || 1);
    }

    const discount = Math.min(subtotal, Math.max(0, Number(discountAmount)));
    const tax = Math.max(0, Number(taxAmount));
    const totalAmount = Number((subtotal - discount + tax).toFixed(2));
    const invoiceNumber = await generateInvoiceNumber(client);

    const invRes = await client.query(
      `INSERT INTO invoices (
        invoice_number, subscription_id, customer_id, invoice_date,
        billing_period_start, billing_period_end, due_date,
        subtotal, discount_amount, tax_amount, total_amount,
        amount_paid, outstanding_amount, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0.00, $12, 'confirmed', $13)
      RETURNING *`,
      [
        invoiceNumber, subscriptionId || null, customerId, today,
        periodStart, periodEnd, due,
        subtotal.toFixed(2), discount.toFixed(2), tax.toFixed(2), totalAmount.toFixed(2),
        totalAmount.toFixed(2), notes || null
      ]
    );

    const invoice = invRes.rows[0];

    // Insert items
    for (const it of items) {
      const lineSubtotal = Number(it.unitPrice || 0) * Number(it.quantity || 1);
      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, variant_id, description,
          quantity, unit_price, subtotal, discount_amount, tax_amount, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0.00, 0.00, $8)`,
        [
          invoice.id,
          it.productId || null,
          it.variantId || null,
          it.description || 'Service line item',
          Number(it.quantity || 1),
          Number(it.unitPrice || 0),
          lineSubtotal.toFixed(2),
          lineSubtotal.toFixed(2)
        ]
      );
    }

    await client.query('COMMIT');
    client.release();

    recordAuditLog(req, {
      action: 'CREATE_INVOICE',
      entityType: 'invoices',
      entityId: invoice.id,
      newValues: { invoiceNumber, total: totalAmount }
    });

    return res.status(201).json({ success: true, invoice });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Update invoice status (e.g. Confirm, Cancel)
async function updateInvoiceStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // 'confirmed', 'cancelled'

  const validStatuses = ['draft', 'confirmed', 'paid', 'overdue', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid invoice status.' });
  }

  try {
    const invRes = await db.query('SELECT * FROM invoices WHERE id = $1', [id]);
    if (invRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const currentInv = invRes.rows[0];
    if (currentInv.status === 'paid' && status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a paid invoice.' });
    }

    const updated = await db.query(
      `UPDATE invoices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );

    recordAuditLog(req, {
      action: 'UPDATE_INVOICE_STATUS',
      entityType: 'invoices',
      entityId: id,
      oldValues: { status: currentInv.status },
      newValues: { status }
    });

    return res.json({ success: true, invoice: updated.rows[0] });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoiceStatus
};
