const db = require('../db');
const { recordAuditLog } = require('../middleware/audit');

// List Taxes
async function getTaxes(req, res) {
  try {
    const result = await db.query('SELECT * FROM tax_rules ORDER BY rate_percent ASC');
    return res.json({ success: true, taxes: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Tax Rule (Admin Only)
async function createTax(req, res) {
  const { name, ratePercent, description, applicableScope } = req.body;

  if (!name || ratePercent === undefined) {
    return res.status(400).json({ success: false, message: 'Tax name and rate percentage are required.' });
  }

  if (Number(ratePercent) < 0) {
    return res.status(400).json({ success: false, message: 'Tax rate cannot be negative.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO tax_rules (name, rate_percent, description, applicable_scope, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [name.trim(), Number(ratePercent), description || null, applicableScope || 'all']
    );

    const tax = result.rows[0];

    recordAuditLog(req, {
      action: 'CREATE_TAX',
      entityType: 'tax_rules',
      entityId: tax.id,
      newValues: { name: tax.name, rate: tax.rate_percent }
    });

    return res.status(201).json({ success: true, tax });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Toggle Tax Rule (Admin Only)
async function toggleTax(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;
  try {
    const result = await db.query(
      `UPDATE tax_rules SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [isActive, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Tax rule not found.' });
    return res.json({ success: true, tax: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getTaxes,
  createTax,
  toggleTax
};
