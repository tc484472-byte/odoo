const db = require('../db');
const { recordAuditLog } = require('../middleware/audit');

// List Discounts
async function getDiscounts(req, res) {
  try {
    const result = await db.query(
      `SELECT d.*, 
              p.name as product_name, pl.name as plan_name
       FROM discount_rules d
       LEFT JOIN products p ON d.applicable_product_id = p.id
       LEFT JOIN plans pl ON d.applicable_plan_id = pl.id
       ORDER BY d.created_at DESC`
    );
    return res.json({ success: true, discounts: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Discount Rule (Admin Only)
async function createDiscount(req, res) {
  const {
    name, code, discountType, discountValue,
    minQuantity, minOrderValue, applicableScope,
    applicableProductId, applicablePlanId, startDate, endDate, maxUsageLimit
  } = req.body;

  if (!name || !code || discountValue === undefined) {
    return res.status(400).json({ success: false, message: 'Name, code, and discount value are required.' });
  }

  if (Number(discountValue) < 0) {
    return res.status(400).json({ success: false, message: 'Discount value cannot be negative.' });
  }

  try {
    const existing = await db.query('SELECT id FROM discount_rules WHERE UPPER(code) = $1', [code.trim().toUpperCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'A discount with this coupon code already exists.' });
    }

    const result = await db.query(
      `INSERT INTO discount_rules (
        name, code, discount_type, discount_value, min_quantity, min_order_value,
        applicable_scope, applicable_product_id, applicable_plan_id, start_date, end_date, max_usage_limit, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true) RETURNING *`,
      [
        name.trim(),
        code.trim().toUpperCase(),
        discountType || 'percentage',
        Number(discountValue),
        Number(minQuantity || 0),
        Number(minOrderValue || 0),
        applicableScope || 'all',
        applicableProductId || null,
        applicablePlanId || null,
        startDate || null,
        endDate || null,
        maxUsageLimit ? Number(maxUsageLimit) : null
      ]
    );

    const discount = result.rows[0];

    recordAuditLog(req, {
      action: 'CREATE_DISCOUNT',
      entityType: 'discount_rules',
      entityId: discount.id,
      newValues: { code: discount.code, value: discount.discount_value, type: discount.discount_type }
    });

    return res.status(201).json({ success: true, discount });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Validate Discount Code
async function validateDiscountCode(req, res) {
  const { code, orderAmount = 0, quantity = 1, planId, productId } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Discount code is required.' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.query(
      `SELECT * FROM discount_rules WHERE UPPER(code) = $1 AND is_active = true`,
      [code.trim().toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive discount code.' });
    }

    const rule = result.rows[0];

    // Date validation
    if (rule.start_date && rule.start_date > today) {
      return res.status(400).json({ success: false, message: 'This discount offer has not started yet.' });
    }
    if (rule.end_date && rule.end_date < today) {
      return res.status(400).json({ success: false, message: 'This discount code has expired.' });
    }

    // Usage limit validation
    if (rule.max_usage_limit && rule.current_usage_count >= rule.max_usage_limit) {
      return res.status(400).json({ success: false, message: 'This discount offer has reached its maximum usage limit.' });
    }

    // Minimum order value validation
    if (Number(orderAmount) < Number(rule.min_order_value)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ₹${rule.min_order_value} required for this discount.`
      });
    }

    // Minimum quantity validation
    if (Number(quantity) < Number(rule.min_quantity)) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase quantity of ${rule.min_quantity} required for this discount.`
      });
    }

    // Scope validation
    if (rule.applicable_scope === 'plan' && planId && Number(rule.applicable_plan_id) !== Number(planId)) {
      return res.status(400).json({ success: false, message: 'This discount does not apply to the selected plan.' });
    }
    if (rule.applicable_scope === 'product' && productId && Number(rule.applicable_product_id) !== Number(productId)) {
      return res.status(400).json({ success: false, message: 'This discount does not apply to the selected product.' });
    }

    // Calculate applied discount
    let calculatedDiscount = 0;
    if (rule.discount_type === 'percentage') {
      calculatedDiscount = (Number(orderAmount) * Number(rule.discount_value)) / 100;
    } else {
      calculatedDiscount = Math.min(Number(orderAmount), Number(rule.discount_value));
    }

    return res.json({
      success: true,
      valid: true,
      discountRule: rule,
      calculatedDiscount: Number(calculatedDiscount.toFixed(2))
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Toggle Discount Status
async function toggleDiscount(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;
  try {
    const result = await db.query(
      `UPDATE discount_rules SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [isActive, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Discount not found.' });
    return res.json({ success: true, discount: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getDiscounts,
  createDiscount,
  validateDiscountCode,
  toggleDiscount
};
