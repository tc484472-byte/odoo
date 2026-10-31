const db = require('../db');
const { recordAuditLog } = require('../middleware/audit');

// List Plans
async function getPlans(req, res) {
  try {
    const plansRes = await db.query('SELECT * FROM plans ORDER BY name ASC');
    const subsRes = await db.query("SELECT plan_id FROM subscriptions WHERE status = 'active'");

    const subCountMap = {};
    subsRes.rows.forEach(s => {
      subCountMap[s.plan_id] = (subCountMap[s.plan_id] || 0) + 1;
    });

    const plans = plansRes.rows.map(p => ({
      ...p,
      subscriber_count: subCountMap[p.id] || 0
    }));

    return res.json({ success: true, plans });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Plan (Admin Only)
async function createPlan(req, res) {
  const {
    name, description, price, billingFrequency,
    minQuantity, startDate, endDate, autoClose, allowPause, allowRenew
  } = req.body;

  if (!name || price === undefined || !billingFrequency) {
    return res.status(400).json({ success: false, message: 'Plan name, price, and billing frequency are required.' });
  }

  const validFreqs = ['daily', 'weekly', 'monthly', 'yearly'];
  if (!validFreqs.includes(billingFrequency.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Billing frequency must be one of: daily, weekly, monthly, yearly.' });
  }

  if (Number(price) < 0) {
    return res.status(400).json({ success: false, message: 'Price cannot be negative.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO plans (
        name, description, price, billing_frequency, min_quantity,
        start_date, end_date, auto_close, allow_pause, allow_renew, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true) RETURNING *`,
      [
        name.trim(),
        description || null,
        Number(price),
        billingFrequency.toLowerCase(),
        Number(minQuantity || 1),
        startDate || null,
        endDate || null,
        autoClose === true,
        allowPause !== false,
        allowRenew !== false
      ]
    );

    const plan = result.rows[0];

    recordAuditLog(req, {
      action: 'CREATE_PLAN',
      entityType: 'plans',
      entityId: plan.id,
      newValues: { name: plan.name, price: plan.price, frequency: plan.billing_frequency }
    });

    return res.status(201).json({ success: true, plan });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Update Plan (Admin Only)
async function updatePlan(req, res) {
  const { id } = req.params;
  const {
    name, description, price, billingFrequency,
    minQuantity, startDate, endDate, autoClose, allowPause, allowRenew, isActive
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE plans
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           billing_frequency = COALESCE($4, billing_frequency),
           min_quantity = COALESCE($5, min_quantity),
           start_date = COALESCE($6, start_date),
           end_date = COALESCE($7, end_date),
           auto_close = COALESCE($8, auto_close),
           allow_pause = COALESCE($9, allow_pause),
           allow_renew = COALESCE($10, allow_renew),
           is_active = COALESCE($11, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 RETURNING *`,
      [
        name, description, price, billingFrequency,
        minQuantity, startDate, endDate, autoClose, allowPause, allowRenew, isActive,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }

    return res.json({ success: true, plan: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getPlans,
  createPlan,
  updatePlan
};
