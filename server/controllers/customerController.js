const db = require('../db');
const bcrypt = require('bcryptjs');
const { recordAuditLog } = require('../middleware/audit');

// List customers
async function getCustomers(req, res) {
  try {
    // If customer role, only return their own record
    if (req.user.role === 'customer') {
      const result = await db.query(
        'SELECT * FROM customers WHERE id = $1 OR user_id = $2',
        [req.user.customerId, req.user.id]
      );
      return res.json({ success: true, customers: result.rows });
    }

    // Admin & Staff: fetch all customers with active subscription counts
    const custRes = await db.query('SELECT * FROM customers ORDER BY created_at DESC');
    const subsRes = await db.query('SELECT customer_id, status FROM subscriptions');

    const subCountMap = {};
    const activeSubCountMap = {};
    subsRes.rows.forEach(s => {
      const cId = s.customer_id;
      subCountMap[cId] = (subCountMap[cId] || 0) + 1;
      if (s.status === 'active') {
        activeSubCountMap[cId] = (activeSubCountMap[cId] || 0) + 1;
      }
    });

    const customers = custRes.rows.map(c => ({
      ...c,
      subscription_count: subCountMap[c.id] || 0,
      active_subscriptions: activeSubCountMap[c.id] || 0
    }));

    return res.json({ success: true, customers });
  } catch (err) {
    console.error('[getCustomers Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get customer by ID
async function getCustomerById(req, res) {
  const { id } = req.params;

  // Strict customer isolation check
  if (req.user.role === 'customer') {
    if (Number(id) !== Number(req.user.customerId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another customer record.' });
    }
  }

  try {
    const custRes = await db.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (custRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const customer = custRes.rows[0];

    // Fetch related active subscriptions and recent invoices
    const subsRes = await db.query(
      `SELECT s.*, p.name as plan_name 
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.customer_id = $1 ORDER BY s.created_at DESC`,
      [id]
    );

    const invRes = await db.query(
      `SELECT * FROM invoices WHERE customer_id = $1 ORDER BY invoice_date DESC LIMIT 10`,
      [id]
    );

    return res.json({
      success: true,
      customer,
      subscriptions: subsRes.rows,
      recentInvoices: invRes.rows
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Customer (Staff / Admin)
async function createCustomer(req, res) {
  const { companyName, contactName, email, phone, billingAddress, gstNumber, password } = req.body;

  if (!companyName || !contactName || !email) {
    return res.status(400).json({ success: false, message: 'Company name, contact name, and email are required.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Check existing customer
    const existing = await client.query('SELECT id FROM customers WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ success: false, message: 'A customer with this email already exists.' });
    }

    // 2. Check or create linked user account
    let userId = null;
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
    } else {
      const pass = password && password.length >= 8 ? password : 'Customer@12345';
      const hash = await bcrypt.hash(pass, 10);
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, phone)
         VALUES ($1, $2, $3, 'customer', $4) RETURNING id`,
        [email.trim().toLowerCase(), hash, contactName.trim(), phone || null]
      );
      userId = userRes.rows[0].id;
    }

    // 3. Insert customer record linked to user
    const result = await client.query(
      `INSERT INTO customers (user_id, company_name, contact_name, email, phone, billing_address, gst_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, companyName.trim(), contactName.trim(), email.trim().toLowerCase(), phone || null, billingAddress || null, gstNumber || null]
    );

    const newCustomer = result.rows[0];

    await client.query('COMMIT');
    client.release();

    recordAuditLog(req, {
      action: 'CREATE_CUSTOMER',
      entityType: 'customers',
      entityId: newCustomer.id,
      newValues: { companyName: newCustomer.company_name, email: newCustomer.email }
    });

    return res.status(201).json({
      success: true,
      message: 'Customer stored and account created successfully.',
      customer: newCustomer
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('[createCustomer Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Update Customer (Staff / Admin)
async function updateCustomer(req, res) {
  const { id } = req.params;
  const { companyName, contactName, phone, billingAddress, gstNumber } = req.body;

  // Strict customer isolation check
  if (req.user.role === 'customer' && Number(id) !== Number(req.user.customerId)) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

  try {
    const result = await db.query(
      `UPDATE customers
       SET company_name = COALESCE($1, company_name),
           contact_name = COALESCE($2, contact_name),
           phone = COALESCE($3, phone),
           billing_address = COALESCE($4, billing_address),
           gst_number = COALESCE($5, gst_number),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [companyName, contactName, phone, billingAddress, gstNumber, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    return res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer
};
