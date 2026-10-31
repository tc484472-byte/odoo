const db = require('../db');
const { recordAuditLog } = require('../middleware/audit');

// Generate unique payment number: PAY-YYYY-XXXX
async function generatePaymentNumber(client) {
  const year = new Date().getFullYear();
  const res = await (client || db).query(
    `SELECT COUNT(*) FROM payments WHERE payment_number LIKE $1`,
    [`PAY-${year}-%`]
  );
  const count = parseInt(res.rows[0].count, 10) + 1;
  return `PAY-${year}-${String(count).padStart(4, '0')}`;
}

// List Payments
async function getPayments(req, res) {
  try {
    let queryText = `
      SELECT p.*, 
             i.invoice_number, i.total_amount as invoice_total,
             c.company_name, c.contact_name,
             u.full_name as recorded_by_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.recorded_by = u.id
    `;
    const params = [];

    // Customer isolation
    if (req.user.role === 'customer') {
      queryText += ' WHERE p.customer_id = $1';
      params.push(req.user.customerId);
    }

    queryText += ' ORDER BY p.payment_date DESC, p.id DESC';

    const result = await db.query(queryText, params);
    return res.json({ success: true, payments: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Record Payment (Staff / Admin)
async function recordPayment(req, res) {
  const { invoiceId, amount, paymentMethod, paymentDate, transactionReference, notes } = req.body;

  if (!invoiceId || !amount || !paymentMethod) {
    return res.status(400).json({ success: false, message: 'Invoice, amount, and payment method are required.' });
  }

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
  }

  const validMethods = ['cash', 'upi', 'bank_transfer', 'card', 'other'];
  if (!validMethods.includes(paymentMethod.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Payment method must be one of: cash, upi, bank_transfer, card, other.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Fetch invoice with row lock
    const invRes = await client.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoice = invRes.rows[0];

    if (invoice.status === 'paid') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ success: false, message: 'This invoice has already been fully paid.' });
    }

    if (invoice.status === 'cancelled') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ success: false, message: 'Cannot record payment for a cancelled invoice.' });
    }

    const currentOutstanding = Number(invoice.outstanding_amount);
    if (paymentAmount > currentOutstanding) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds outstanding invoice balance of ₹${currentOutstanding.toFixed(2)}.`
      });
    }

    const newAmountPaid = Number(invoice.amount_paid) + paymentAmount;
    const newOutstanding = Number(Math.max(0, currentOutstanding - paymentAmount).toFixed(2));
    const newStatus = newOutstanding <= 0.01 ? 'paid' : 'confirmed';

    const pDate = paymentDate || new Date().toISOString().split('T')[0];
    const paymentNumber = await generatePaymentNumber(client);

    // 1. Record payment
    const payRes = await client.query(
      `INSERT INTO payments (
        payment_number, invoice_id, customer_id, amount,
        payment_method, payment_date, transaction_reference, notes, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        paymentNumber, invoice.id, invoice.customer_id, paymentAmount.toFixed(2),
        paymentMethod.toLowerCase(), pDate, transactionReference || null, notes || null, req.user.id
      ]
    );

    const payment = payRes.rows[0];

    // 2. Update invoice balances and status
    await client.query(
      `UPDATE invoices 
       SET amount_paid = $1, outstanding_amount = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [newAmountPaid.toFixed(2), newOutstanding.toFixed(2), newStatus, invoice.id]
    );

    await client.query('COMMIT');
    client.release();

    // Create Notification for Customer
    await db.query(
      `INSERT INTO notifications (customer_id, title, message, type)
       VALUES ($1, $2, $3, $4)`,
      [
        invoice.customer_id,
        `Payment Received: ₹${paymentAmount.toFixed(2)}`,
        `Payment ${paymentNumber} of ₹${paymentAmount.toFixed(2)} recorded for invoice ${invoice.invoice_number}. Remaining outstanding: ₹${newOutstanding.toFixed(2)}.`,
        'payment_received'
      ]
    );

    recordAuditLog(req, {
      action: 'RECORD_PAYMENT',
      entityType: 'payments',
      entityId: payment.id,
      newValues: { paymentNumber, amount: paymentAmount, invoiceId: invoice.id, newStatus }
    });

    return res.status(201).json({
      success: true,
      message: newStatus === 'paid' ? 'Payment recorded! Invoice is now fully paid.' : 'Partial payment recorded successfully.',
      payment,
      updatedInvoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amountPaid: newAmountPaid.toFixed(2),
        outstandingAmount: newOutstanding.toFixed(2),
        status: newStatus
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getPayments,
  recordPayment
};
