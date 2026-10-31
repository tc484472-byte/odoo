const bcrypt = require('bcryptjs');
const db = require('../db');
const { isValidPassword, isValidEmail } = require('../middleware/validate');
const { recordAuditLog } = require('../middleware/audit');

// List all team users (Admin only)
async function getUsers(req, res) {
  const { role } = req.query;
  try {
    let queryText = 'SELECT id, email, full_name, role, phone, is_active, created_at FROM users';
    const params = [];
    if (role) {
      queryText += ' WHERE role = $1';
      params.push(role);
    } else {
      // Default: return admin & staff
      queryText += " WHERE role IN ('admin', 'staff')";
    }
    queryText += ' ORDER BY role ASC, created_at DESC';

    const result = await db.query(queryText, params);
    return res.json({ success: true, users: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Internal User (Admin or Staff) - Admin Only
async function createUser(req, res) {
  const { email, password, fullName, phone, role = 'staff' } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ success: false, message: 'Full name, email, and password are required.' });
  }

  const userRole = role.toLowerCase() === 'admin' ? 'admin' : 'staff';

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
    });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'User with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, phone, is_active, created_at`,
      [email.trim().toLowerCase(), passwordHash, fullName.trim(), userRole, phone || null]
    );

    const newUser = result.rows[0];

    recordAuditLog(req, {
      action: userRole === 'admin' ? 'CREATE_ADMIN' : 'CREATE_STAFF',
      entityType: 'users',
      entityId: newUser.id,
      newValues: { email: newUser.email, fullName: newUser.full_name, role: userRole }
    });

    return res.status(201).json({
      success: true,
      message: `${userRole === 'admin' ? 'Administrator' : 'Staff member'} account created successfully.`,
      user: newUser,
      staff: newUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Toggle user activation status (Admin only)
async function toggleUserStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const userRes = await db.query('SELECT id, role, is_active FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetUser = userRes.rows[0];
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own administrator account.' });
    }

    const updated = await db.query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, is_active',
      [isActive, id]
    );

    recordAuditLog(req, {
      action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entityType: 'users',
      entityId: id,
      newValues: { is_active: isActive }
    });

    return res.json({ success: true, message: `User status updated.`, user: updated.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getUsers,
  createUser,
  createStaff: createUser, // backward compatibility
  toggleUserStatus
};
