const db = require('../db');
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

    // Admin & Staff: full customer list with active subscription count
    const result = await db.query(
      `SELECT c.*, 
              COUNT(DISTINCT s.id) as subscription_count,
              COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) as active_subscriptions
       FROM customers c
       LEFT JOIN subscriptions s ON c.id = s.customer_id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );

    return res.json({ success: true, customers: result.rows });
  } catch (err) {
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
  const { companyName, contactName, email, phone, billingAddress, gstNumber } = req.body;

  if (!companyName || !contactName || !email) {
    return res.status(400).json({ success: false, message: 'Company name, contact name, and email are required.' });
  }

  try {
    const existing = await db.query('SELECT id FROM customers WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'A customer with this email already exists.' });
    }

    const result = await db.query(
      `INSERT INTO customers (company_name, contact_name, email, phone, billing_address, gst_number)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyName.trim(), contactName.trim(), email.trim().toLowerCase(), phone || null, billingAddress || null, gstNumber || null]
    );

    const newCustomer = result.rows[0];

    recordAuditLog(req, {
      action: 'CREATE_CUSTOMER',
      entityType: 'customers',
      entityId: newCustomer.id,
      newValues: { companyName: newCustomer.company_name, email: newCustomer.email }
    });

    return res.status(201).json({ success: true, customer: newCustomer });
  } catch (err) {
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
