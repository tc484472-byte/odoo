const db = require('../db');
const { recordAuditLog } = require('../middleware/audit');
const razorpayService = require('../services/razorpayService');
const { advanceDate, generateInvoiceNumber } = require('../services/billingService');

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
      params.push(req.user.customerId || 0);
    }

    queryText += ' ORDER BY p.payment_date DESC, p.id DESC';

    const result = await db.query(queryText, params);
    return res.json({ success: true, payments: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Record Payment Manually (Staff / Admin)
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

// -------------------------------------------------------------
// RAZORPAY INTEGRATION ENDPOINTS
// -------------------------------------------------------------

// 1. Create Razorpay Order
async function createRazorpayOrder(req, res) {
  const planId = req.body.planId || req.body.plan_id;
  const variantId = req.body.variantId || req.body.variant_id;
  const quantity = req.body.quantity || req.body.seats || 1;
  const discountCode = req.body.discountCode || req.body.promo_code || req.body.discount_code;
  const isRenewal = req.body.isRenewal || req.body.is_renewal || false;
  const subscriptionId = req.body.subscriptionId || req.body.subscription_id;

  try {
    let total = 0;
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    let description = '';

    if (isRenewal) {
      if (!subscriptionId) {
        return res.status(400).json({ success: false, message: 'Subscription ID is required for renewal.' });
      }
      const subRes = await db.query(
        `SELECT s.*, p.name as plan_name FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.id = $1`,
        [subscriptionId]
      );
      if (subRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Subscription not found.' });
      }
      const sub = subRes.rows[0];
      total = Number(sub.total_amount);
      subtotal = Number(sub.unit_price) * Number(sub.quantity);
      discountAmount = Number(sub.discount_amount);
      taxAmount = Number(sub.tax_amount);
      description = `Renewal for ${sub.subscription_number} (${sub.plan_name})`;
    } else {
      if (!planId) {
        return res.status(400).json({ success: false, message: 'Plan ID is required.' });
      }

      const planRes = await db.query('SELECT * FROM plans WHERE id = $1', [planId]);
      if (planRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Plan not found.' });
      }
      const plan = planRes.rows[0];

      let baseUnitPrice = Number(plan.price);
      let variantPrice = 0;
      if (variantId) {
        const varRes = await db.query('SELECT * FROM product_variants WHERE id = $1', [variantId]);
        if (varRes.rows.length > 0) {
          variantPrice = Number(varRes.rows[0].additional_price);
        }
      }

      const unitPrice = baseUnitPrice + variantPrice;
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      subtotal = unitPrice * qty;

      // Check discount
      if (discountCode && discountCode.trim() !== '') {
        const discRes = await db.query(
          `SELECT * FROM discount_rules WHERE UPPER(code) = $1 AND is_active = true`,
          [discountCode.trim().toUpperCase()]
        );
        if (discRes.rows.length > 0) {
          const disc = discRes.rows[0];
          if (disc.discount_type === 'percentage') {
            discountAmount = Number((subtotal * (Number(disc.discount_value) / 100)).toFixed(2));
          } else {
            discountAmount = Math.min(subtotal, Number(disc.discount_value));
          }
        }
      }

      const taxableAmount = Math.max(0, subtotal - discountAmount);
      // 18% standard GST
      taxAmount = Number((taxableAmount * 0.18).toFixed(2));
      total = Number((taxableAmount + taxAmount).toFixed(2));
      description = `Subscription to ${plan.name} (${qty} seat${qty > 1 ? 's' : ''})`;
    }

    const receipt = `rcpt_${Date.now()}`;
    const orderData = await razorpayService.createOrder({
      amount: total,
      currency: 'INR',
      receipt,
      notes: {
        userId: req.user.id,
        isRenewal: String(isRenewal),
        subscriptionId: String(subscriptionId || '')
      }
    });

    return res.json({
      success: true,
      orderId: orderData.orderId,
      order_id: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: orderData.keyId,
      key_id: orderData.keyId,
      isSimulated: orderData.isSimulated,
      calculatedTotal: total,
      breakdown: {
        subtotal: Number(subtotal.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        total
      },
      description
    });

  } catch (err) {
    console.error('[createRazorpayOrder Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Verify Razorpay Payment and Activate/Renew Subscription
async function verifyRazorpayPayment(req, res) {
  const razorpay_order_id = req.body.razorpay_order_id || req.body.orderId || req.body.order_id;
  const razorpay_payment_id = req.body.razorpay_payment_id || req.body.paymentId || req.body.payment_id;
  const razorpay_signature = req.body.razorpay_signature || req.body.signature;
  const planId = req.body.planId || req.body.plan_id;
  const variantId = req.body.variantId || req.body.variant_id;
  const quantity = req.body.quantity || req.body.seats || 1;
  const discountCode = req.body.discountCode || req.body.promo_code || req.body.discount_code;
  const isRenewal = req.body.isRenewal || req.body.is_renewal || false;
  const subscriptionId = req.body.subscriptionId || req.body.subscription_id;

  if (!razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({ success: false, message: 'Order ID and Payment ID are required.' });
  }

  const isValid = razorpayService.verifySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature
  });

  if (!isValid) {
    return res.status(400).json({ success: false, message: 'Razorpay payment signature verification failed.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Resolve Customer ID
    let customerId = req.user.customerId;
    if (!customerId) {
      const custCheck = await client.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (custCheck.rows.length > 0) {
        customerId = custCheck.rows[0].id;
      } else {
        // Auto-provision customer profile for self-service customer
        const userRes = await client.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const u = userRes.rows[0];
        const newCustRes = await client.query(
          `INSERT INTO customers (user_id, company_name, contact_name, email, phone)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [u.id, u.full_name, u.full_name, u.email, u.phone || null]
        );
        customerId = newCustRes.rows[0].id;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Case A: Renewal of Existing Subscription
    if (isRenewal && subscriptionId) {
      const subRes = await client.query(
        `SELECT s.*, p.name as plan_name, p.billing_frequency 
         FROM subscriptions s 
         JOIN plans p ON s.plan_id = p.id 
         WHERE s.id = $1`,
        [subscriptionId]
      );

      if (subRes.rows.length === 0) {
        throw new Error('Subscription to renew was not found.');
      }

      const sub = subRes.rows[0];
      const newNextBilling = advanceDate(sub.next_billing_date, sub.billing_frequency);
      const newExpiry = sub.expiry_date ? advanceDate(sub.expiry_date, sub.billing_frequency) : advanceDate(todayStr, 'yearly');

      // Update subscription dates
      const updatedSubRes = await client.query(
        `UPDATE subscriptions 
         SET next_billing_date = $1, expiry_date = $2, status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [newNextBilling, newExpiry, sub.id]
      );

      // Generate renewal invoice marked as paid
      const invNumber = await generateInvoiceNumber(client);
      const totalAmount = Number(sub.total_amount);
      const invRes = await client.query(
        `INSERT INTO invoices (
          invoice_number, subscription_id, customer_id, invoice_date,
          billing_period_start, billing_period_end, due_date,
          subtotal, discount_amount, tax_amount, total_amount,
          amount_paid, outstanding_amount, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'paid', $14)
        RETURNING *`,
        [
          invNumber, sub.id, customerId, todayStr,
          sub.next_billing_date, newNextBilling, todayStr,
          sub.unit_price * sub.quantity, sub.discount_amount, sub.tax_amount, totalAmount,
          totalAmount, 0.00, `Automated Razorpay Renewal: ${razorpay_payment_id}`
        ]
      );

      const invoice = invRes.rows[0];
      const payNumber = await generatePaymentNumber(client);

      // Record payment
      await client.query(
        `INSERT INTO payments (
          payment_number, invoice_id, customer_id, amount,
          payment_method, payment_date, transaction_reference, notes, recorded_by
        ) VALUES ($1, $2, $3, $4, 'upi', $5, $6, $7, $8)`,
        [
          payNumber, invoice.id, customerId, totalAmount,
          todayStr, razorpay_payment_id, 'Online Razorpay Renewal Checkout', req.user.id
        ]
      );

      // Add Notification
      await client.query(
        `INSERT INTO notifications (customer_id, title, message, type)
         VALUES ($1, $2, $3, 'payment_received')`,
        [
          customerId,
          `Subscription Renewed: ${sub.subscription_number}`,
          `Your subscription ${sub.subscription_number} (${sub.plan_name}) has been renewed until ${newExpiry} via Razorpay (Txn: ${razorpay_payment_id}).`
        ]
      );

      await client.query('COMMIT');
      client.release();

      recordAuditLog(req, {
        action: 'RENEW_SUBSCRIPTION_RAZORPAY',
        entityType: 'subscriptions',
        entityId: sub.id,
        newValues: { paymentId: razorpay_payment_id, newExpiry, totalAmount }
      });

      return res.status(200).json({
        success: true,
        message: `Subscription ${sub.subscription_number} renewed successfully!`,
        subscriptionNumber: sub.subscription_number,
        invoiceNumber: invNumber,
        newExpiryDate: newExpiry,
        subscription: updatedSubRes.rows[0],
        invoice
      });
    }

    // Case B: Brand New Subscription Purchase
    const planRes = await client.query('SELECT * FROM plans WHERE id = $1', [planId]);
    if (planRes.rows.length === 0) {
      throw new Error('Plan not found.');
    }
    const plan = planRes.rows[0];

    let basePrice = Number(plan.price);
    let variantPrice = 0;
    let variantName = '';

    if (variantId) {
      const vRes = await client.query('SELECT * FROM product_variants WHERE id = $1', [variantId]);
      if (vRes.rows.length > 0) {
        variantPrice = Number(vRes.rows[0].additional_price);
        variantName = ` - ${vRes.rows[0].variant_name} (${vRes.rows[0].attribute_value})`;
      }
    }

    const unitPrice = basePrice + variantPrice;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const subtotal = unitPrice * qty;

    let discountAmount = 0;
    if (discountCode) {
      const dRes = await client.query(
        'SELECT * FROM discount_rules WHERE UPPER(code) = $1 AND is_active = true',
        [discountCode.trim().toUpperCase()]
      );
      if (dRes.rows.length > 0) {
        const d = dRes.rows[0];
        if (d.discount_type === 'percentage') {
          discountAmount = Number((subtotal * (Number(d.discount_value) / 100)).toFixed(2));
        } else {
          discountAmount = Math.min(subtotal, Number(d.discount_value));
        }
      }
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Number((taxableAmount * 0.18).toFixed(2));
    const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

    const year = new Date().getFullYear();
    const countRes = await client.query('SELECT COUNT(*) FROM subscriptions WHERE subscription_number LIKE $1', [`SUB-${year}-%`]);
    const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
    const subNumber = `SUB-${year}-${String(nextSeq).padStart(4, '0')}`;

    const nextBillingDate = advanceDate(todayStr, plan.billing_frequency);
    const expiryDate = advanceDate(todayStr, 'yearly');

    // 2. Insert Subscription
    const subRes = await client.query(
      `INSERT INTO subscriptions (
        subscription_number, customer_id, plan_id, status,
        start_date, expiry_date, next_billing_date, billing_frequency,
        quantity, unit_price, discount_amount, tax_amount, total_amount, payment_terms
      ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Razorpay Online')
      RETURNING *`,
      [
        subNumber, customerId, plan.id,
        todayStr, expiryDate, nextBillingDate, plan.billing_frequency,
        qty, unitPrice, discountAmount, taxAmount, totalAmount
      ]
    );

    const subscription = subRes.rows[0];

    // 3. Generate Paid Invoice
    const invNumber = await generateInvoiceNumber(client);
    const invRes = await client.query(
      `INSERT INTO invoices (
        invoice_number, subscription_id, customer_id, invoice_date,
        billing_period_start, billing_period_end, due_date,
        subtotal, discount_amount, tax_amount, total_amount,
        amount_paid, outstanding_amount, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0.00, 'paid', $13)
      RETURNING *`,
      [
        invNumber, subscription.id, customerId, todayStr,
        todayStr, nextBillingDate, todayStr,
        subtotal, discountAmount, taxAmount, totalAmount,
        totalAmount, `Paid via Razorpay: ${razorpay_payment_id}`
      ]
    );

    const invoice = invRes.rows[0];

    // 4. Record Payment
    const payNumber = await generatePaymentNumber(client);
    await client.query(
      `INSERT INTO payments (
        payment_number, invoice_id, customer_id, amount,
        payment_method, payment_date, transaction_reference, notes, recorded_by
      ) VALUES ($1, $2, $3, $4, 'upi', $5, $6, 'Razorpay Self-Service Checkout', $7)`,
      [
        payNumber, invoice.id, customerId, totalAmount,
        todayStr, razorpay_payment_id, req.user.id
      ]
    );

    // 5. Add Notification
    await client.query(
      `INSERT INTO notifications (customer_id, title, message, type)
       VALUES ($1, $2, $3, 'invoice_generated')`,
      [
        customerId,
        `Subscription Activated: ${subNumber}`,
        `Your subscription ${subNumber} to ${plan.name}${variantName} is now active! Invoice ${invNumber} of ₹${totalAmount.toFixed(2)} has been paid via Razorpay.`
      ]
    );

    await client.query('COMMIT');
    client.release();

    recordAuditLog(req, {
      action: 'SUBSCRIBE_RAZORPAY',
      entityType: 'subscriptions',
      entityId: subscription.id,
      newValues: { subscriptionNumber: subNumber, totalAmount, paymentId: razorpay_payment_id }
    });

    return res.status(201).json({
      success: true,
      message: `Subscription ${subNumber} successfully activated!`,
      subscriptionNumber: subNumber,
      invoiceNumber: invNumber,
      subscription
    });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('[verifyRazorpayPayment Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getPayments,
  recordPayment,
  createRazorpayOrder,
  verifyRazorpayPayment
};
