const db = require('../db');
const { advanceDate } = require('../services/billingService');
const { recordAuditLog } = require('../middleware/audit');

// Generate unique quotation number: QT-YYYY-XXXX
async function generateQuotationNumber(client) {
  const year = new Date().getFullYear();
  const res = await (client || db).query(
    `SELECT COUNT(*) FROM quotations WHERE quotation_number LIKE $1`,
    [`QT-${year}-%`]
  );
  const count = parseInt(res.rows[0].count, 10) + 1;
  return `QT-${year}-${String(count).padStart(3, '0')}`;
}

// Generate unique subscription number: SUB-YYYY-XXXX
async function generateSubscriptionNumber(client) {
  const year = new Date().getFullYear();
  const res = await (client || db).query(
    `SELECT COUNT(*) FROM subscriptions WHERE subscription_number LIKE $1`,
    [`SUB-${year}-%`]
  );
  const count = parseInt(res.rows[0].count, 10) + 1;
  return `SUB-${year}-${String(count).padStart(4, '0')}`;
}

// List Quotations
async function getQuotations(req, res) {
  try {
    let queryText = `
      SELECT q.*, c.company_name, c.contact_name, c.email as customer_email,
             p.name as plan_name, u.full_name as creator_name
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      LEFT JOIN plans p ON q.plan_id = p.id
      LEFT JOIN users u ON q.created_by = u.id
    `;
    const params = [];

    // Customer isolation
    if (req.user.role === 'customer') {
      queryText += ' WHERE q.customer_id = $1';
      params.push(req.user.customerId);
    }

    queryText += ' ORDER BY q.created_at DESC';

    const result = await db.query(queryText, params);
    return res.json({ success: true, quotations: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get Quotation by ID + Items
async function getQuotationById(req, res) {
  const { id } = req.params;
  try {
    const qRes = await db.query(
      `SELECT q.*, c.company_name, c.contact_name, c.email as customer_email, c.billing_address, c.gst_number,
              p.name as plan_name, p.billing_frequency, u.full_name as creator_name
       FROM quotations q
       JOIN customers c ON q.customer_id = c.id
       LEFT JOIN plans p ON q.plan_id = p.id
       LEFT JOIN users u ON q.created_by = u.id
       WHERE q.id = $1`,
      [id]
    );

    if (qRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    const quotation = qRes.rows[0];

    // Customer isolation check
    if (req.user.role === 'customer' && Number(quotation.customer_id) !== Number(req.user.customerId)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const itemsRes = await db.query(
      `SELECT qi.*, pr.name as product_name, pv.variant_name, pv.attribute_value
       FROM quotation_items qi
       JOIN products pr ON qi.product_id = pr.id
       LEFT JOIN product_variants pv ON qi.variant_id = pv.id
       WHERE qi.quotation_id = $1`,
      [id]
    );

    return res.json({
      success: true,
      quotation,
      items: itemsRes.rows
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Quotation (Staff / Admin)
async function createQuotation(req, res) {
  const {
    customerId, planId, validUntil, items,
    discountAmount = 0, taxPercent = 18, terms, notes
  } = req.body;

  if (!customerId || !validUntil || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Customer, validity date, and quotation items are required.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Calculate subtotal from line items
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.productId]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product with ID ${item.productId} not found.`);
      }
      const product = prodRes.rows[0];

      let unitPrice = Number(product.sales_price);

      // Check variant price addition
      let variantDesc = '';
      if (item.variantId) {
        const varRes = await client.query('SELECT * FROM product_variants WHERE id = $1', [item.variantId]);
        if (varRes.rows.length > 0) {
          const variant = varRes.rows[0];
          unitPrice += Number(variant.additional_price);
          variantDesc = ` (${variant.variant_name}: ${variant.attribute_value})`;
        }
      }

      const qty = Math.max(1, Number(item.quantity || 1));
      const lineSubtotal = unitPrice * qty;
      subtotal += lineSubtotal;

      processedItems.push({
        productId: item.productId,
        variantId: item.variantId || null,
        description: (item.description || product.name) + variantDesc,
        quantity: qty,
        unitPrice,
        lineSubtotal
      });
    }

    const discount = Math.min(subtotal, Math.max(0, Number(discountAmount)));
    const taxableAmount = Math.max(0, subtotal - discount);
    const taxAmount = Number(((taxableAmount * Number(taxPercent)) / 100).toFixed(2));
    const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

    const quotationNumber = await generateQuotationNumber(client);

    const qRes = await client.query(
      `INSERT INTO quotations (
        quotation_number, customer_id, plan_id, status, valid_until,
        subtotal, discount_amount, tax_amount, total_amount, terms, notes, created_by
      ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        quotationNumber, customerId, planId || null, validUntil,
        subtotal.toFixed(2), discount.toFixed(2), taxAmount.toFixed(2), totalAmount.toFixed(2),
        terms || 'Standard 30-day payment terms.', notes || null, req.user.id
      ]
    );

    const quotation = qRes.rows[0];

    // Insert line items
    for (const pItem of processedItems) {
      await client.query(
        `INSERT INTO quotation_items (
          quotation_id, product_id, variant_id, description,
          quantity, unit_price, discount_amount, tax_amount, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          quotation.id,
          pItem.productId,
          pItem.variantId,
          pItem.description,
          pItem.quantity,
          pItem.unitPrice.toFixed(2),
          0.00,
          0.00,
          pItem.lineSubtotal.toFixed(2)
        ]
      );
    }

    await client.query('COMMIT');
    client.release();

    recordAuditLog(req, {
      action: 'CREATE_QUOTATION',
      entityType: 'quotations',
      entityId: quotation.id,
      newValues: { number: quotationNumber, total: totalAmount }
    });

    return res.status(201).json({ success: true, quotation });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Confirm Quotation -> Automatically Turns Quote into Subscription!
async function confirmQuotation(req, res) {
  const { id } = req.params;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const qRes = await client.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (qRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    const quotation = qRes.rows[0];
    if (quotation.status === 'confirmed') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ success: false, message: 'This quotation has already been confirmed.' });
    }

    // Mark quotation confirmed
    await client.query(
      `UPDATE quotations SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Fetch plan details
    let planId = quotation.plan_id;
    let billingFrequency = 'monthly';
    if (planId) {
      const planRes = await client.query('SELECT * FROM plans WHERE id = $1', [planId]);
      if (planRes.rows.length > 0) {
        billingFrequency = planRes.rows[0].billing_frequency;
      }
    } else {
      // If no plan attached to quote, assign default first active plan
      const defaultPlanRes = await client.query('SELECT id, billing_frequency FROM plans WHERE is_active = true LIMIT 1');
      if (defaultPlanRes.rows.length > 0) {
        planId = defaultPlanRes.rows[0].id;
        billingFrequency = defaultPlanRes.rows[0].billing_frequency;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const expiryDate = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]; // 1 year default
    const subNumber = await generateSubscriptionNumber(client);

    // Create Subscription from Quotation
    const subRes = await client.query(
      `INSERT INTO subscriptions (
        subscription_number, customer_id, plan_id, quotation_id,
        status, start_date, expiry_date, next_billing_date,
        billing_frequency, quantity, unit_price, discount_amount, tax_amount, total_amount, payment_terms
      ) VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, 1, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        subNumber,
        quotation.customer_id,
        planId,
        quotation.id,
        today,
        expiryDate,
        today, // Due immediately for initial billing
        billingFrequency,
        quotation.subtotal,
        quotation.discount_amount,
        quotation.tax_amount,
        quotation.total_amount,
        quotation.terms || 'Immediate'
      ]
    );

    const subscription = subRes.rows[0];

    // Copy quotation items to subscription items
    const qItemsRes = await client.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [id]);
    for (const qItem of qItemsRes.rows) {
      await client.query(
        `INSERT INTO subscription_items (
          subscription_id, product_id, variant_id, description,
          quantity, unit_price, discount_amount, tax_amount, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          subscription.id,
          qItem.product_id,
          qItem.variant_id,
          qItem.description,
          qItem.quantity,
          qItem.unit_price,
          qItem.discount_amount,
          qItem.tax_amount,
          qItem.total_price
        ]
      );
    }

    await client.query('COMMIT');
    client.release();

    recordAuditLog(req, {
      action: 'CONFIRM_QUOTATION_TO_SUBSCRIPTION',
      entityType: 'subscriptions',
      entityId: subscription.id,
      newValues: { quotationId: id, subscriptionNumber: subNumber }
    });

    return res.json({
      success: true,
      message: `Quotation confirmed successfully! Created Subscription ${subNumber}.`,
      quotation: { ...quotation, status: 'confirmed' },
      subscription
    });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotation,
  confirmQuotation
};
