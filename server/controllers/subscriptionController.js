const db = require('../db');
const { advanceDate } = require('../services/billingService');
const { recordAuditLog } = require('../middleware/audit');

// List Subscriptions
async function getSubscriptions(req, res) {
  try {
    let queryText = `
      SELECT s.*, 
             c.company_name, c.contact_name, c.email as customer_email,
             p.name as plan_name, p.allow_pause, p.allow_renew
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      JOIN plans p ON s.plan_id = p.id
    `;
    const params = [];

    // Customer isolation: customers only see their own subscriptions
    if (req.user.role === 'customer') {
      queryText += ' WHERE s.customer_id = $1';
      params.push(req.user.customerId || 0);
    }

    queryText += ' ORDER BY s.created_at DESC';

    const result = await db.query(queryText, params);
    return res.json({ success: true, subscriptions: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get Subscription by ID + Line Items + Invoice History
async function getSubscriptionById(req, res) {
  const { id } = req.params;

  try {
    const subRes = await db.query(
      `SELECT s.*, 
              c.company_name, c.contact_name, c.email as customer_email, c.billing_address, c.gst_number,
              p.name as plan_name, p.description as plan_description, p.allow_pause, p.allow_renew
       FROM subscriptions s
       JOIN customers c ON s.customer_id = c.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.id = $1`,
      [id]
    );

    if (subRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    const subscription = subRes.rows[0];

    // Customer isolation check
    if (req.user.role === 'customer' && Number(subscription.customer_id) !== Number(req.user.customerId)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    // Line items
    const itemsRes = await db.query(
      `SELECT si.*, pr.name as product_name, pv.variant_name, pv.attribute_value
       FROM subscription_items si
       JOIN products pr ON si.product_id = pr.id
       LEFT JOIN product_variants pv ON si.variant_id = pv.id
       WHERE si.subscription_id = $1`,
      [id]
    );

    // Invoices generated for this subscription
    const invoicesRes = await db.query(
      `SELECT id, invoice_number, invoice_date, billing_period_start, billing_period_end,
              total_amount, amount_paid, outstanding_amount, status
       FROM invoices
       WHERE subscription_id = $1
       ORDER BY invoice_date DESC`,
      [id]
    );

    return res.json({
      success: true,
      subscription,
      items: itemsRes.rows,
      invoices: invoicesRes.rows
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Subscription Directly (Staff / Admin)
async function createSubscription(req, res) {
  const {
    customerId, planId, startDate, expiryDate,
    billingFrequency, quantity = 1, paymentTerms = 'Immediate',
    items = []
  } = req.body;

  if (!customerId || !planId || !startDate) {
    return res.status(400).json({ success: false, message: 'Customer, plan, and start date are required.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Fetch plan details
    const planRes = await client.query('SELECT * FROM plans WHERE id = $1', [planId]);
    if (planRes.rows.length === 0) {
      throw new Error('Plan not found.');
    }
    const plan = planRes.rows[0];

    const freq = billingFrequency || plan.billing_frequency;
    const year = new Date().getFullYear();
    const countRes = await client.query('SELECT COUNT(*) FROM subscriptions WHERE subscription_number LIKE $1', [`SUB-${year}-%`]);
    const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
    const subNumber = `SUB-${year}-${String(nextSeq).padStart(4, '0')}`;

    // Calculate line items if passed, else use plan price
    let unitPrice = Number(plan.price);
    let totalAmount = unitPrice * Number(quantity);

    const subRes = await client.query(
      `INSERT INTO subscriptions (
        subscription_number, customer_id, plan_id, status,
        start_date, expiry_date, next_billing_date,
        billing_frequency, quantity, unit_price, discount_amount,
        tax_amount, total_amount, payment_terms
      ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, 0.00, 0.00, $10, $11)
      RETURNING *`,
      [
        subNumber,
        customerId,
        planId,
        startDate,
        expiryDate || advanceDate(startDate, 'yearly'),
        startDate, // Due immediately for initial invoice
        freq,
        Number(quantity),
        unitPrice.toFixed(2),
        totalAmount.toFixed(2),
        paymentTerms
      ]
    );

    const subscription = subRes.rows[0];

    // If items provided, insert into subscription_items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO subscription_items (
            subscription_id, product_id, variant_id, description,
            quantity, unit_price, discount_amount, tax_amount, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            subscription.id,
            item.productId,
            item.variantId || null,
            item.description || 'Subscription Product',
            Number(item.quantity || 1),
            Number(item.unitPrice || 0),
            0.00,
            0.00,
            (Number(item.unitPrice || 0) * Number(item.quantity || 1)).toFixed(2)
          ]
        );
      }
    }

    await client.query('COMMIT');
    client.release();

    recordAuditLog(req, {
      action: 'CREATE_SUBSCRIPTION',
      entityType: 'subscriptions',
      entityId: subscription.id,
      newValues: { number: subNumber, customerId }
    });

    return res.status(201).json({ success: true, subscription });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Update Subscription Status (Lifecycle: activate, pause, resume, renew, close)
async function updateSubscriptionStatus(req, res) {
  const { id } = req.params;
  const rawAction = (req.body.action || req.body.status || '').toLowerCase();
  const action = rawAction === 'paused' ? 'pause' : (rawAction === 'active' ? 'resume' : rawAction);
  const { newExpiryDate } = req.body;

  const today = new Date().toISOString().split('T')[0];

  try {
    const subRes = await db.query(
      `SELECT s.*, p.allow_pause, p.allow_renew 
       FROM subscriptions s 
       JOIN plans p ON s.plan_id = p.id 
       WHERE s.id = $1`,
      [id]
    );

    if (subRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    const sub = subRes.rows[0];

    // Customer isolation check
    let effectiveCustId = req.user.customerId;
    if (!effectiveCustId && req.user.id) {
      const custLookup = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (custLookup.rows.length > 0) {
        effectiveCustId = custLookup.rows[0].id;
      }
    }

    if (req.user.role === 'customer' && Number(sub.customer_id) !== Number(effectiveCustId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify another customer subscription.' });
    }

    let newStatus = sub.status;
    let updateFields = [];
    const params = [id];

    switch (action) {
      case 'activate':
        if (sub.status === 'closed') {
          return res.status(400).json({ success: false, message: 'Cannot activate a permanently closed subscription.' });
        }
        newStatus = 'active';
        updateFields.push(`status = 'active'`);
        break;

      case 'pause':
        if (!sub.allow_pause) {
          return res.status(400).json({ success: false, message: 'The plan attached to this subscription does not permit pausing.' });
        }
        if (sub.status !== 'active') {
          return res.status(400).json({ success: false, message: `Only active subscriptions can be paused. Current status: ${sub.status}.` });
        }
        newStatus = 'paused';
        updateFields.push(`status = 'paused'`, `pause_date = '${today}'`);
        break;

      case 'resume':
        if (sub.status !== 'paused') {
          return res.status(400).json({ success: false, message: `Only paused subscriptions can be resumed. Current status: ${sub.status}.` });
        }
        newStatus = 'active';
        updateFields.push(`status = 'active'`, `resume_date = '${today}'`);
        break;

      case 'renew':
        if (!sub.allow_renew) {
          return res.status(400).json({ success: false, message: 'This subscription plan does not allow renewal.' });
        }
        const extendedExpiry = newExpiryDate || advanceDate(sub.expiry_date || today, 'yearly');
        newStatus = 'active';
        updateFields.push(`status = 'active'`, `expiry_date = '${extendedExpiry}'`);
        break;

      case 'close':
        newStatus = 'closed';
        updateFields.push(`status = 'closed'`);
        break;

      default:
        return res.status(400).json({ success: false, message: `Unknown lifecycle action: '${action}'. Valid actions: activate, pause, resume, renew, close.` });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const updatedRes = await db.query(
      `UPDATE subscriptions SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    recordAuditLog(req, {
      action: `SUBSCRIPTION_${action.toUpperCase()}`,
      entityType: 'subscriptions',
      entityId: id,
      oldValues: { status: sub.status },
      newValues: { status: newStatus }
    });

    return res.json({
      success: true,
      message: `Subscription successfully transitioned from '${sub.status}' to '${newStatus}'.`,
      subscription: updatedRes.rows[0]
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscriptionStatus
};
