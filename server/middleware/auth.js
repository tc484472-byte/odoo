const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop_super_secret_jwt_key_2026_odoo_hackathon';

// Authenticate JWT Token
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user record from DB
    const result = await db.query(
      'SELECT id, email, full_name, role, phone, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found or deleted.' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account is deactivated.' });
    }

    // If customer, fetch associated customer record
    if (user.role === 'customer') {
      const custResult = await db.query(
        'SELECT id, company_name, contact_name FROM customers WHERE user_id = $1 OR email = $2 LIMIT 1',
        [user.id, user.email]
      );
      if (custResult.rows.length > 0) {
        user.customerId = custResult.rows[0].id;
        user.companyName = custResult.rows[0].company_name;
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}

// Authorize User Roles
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of the following roles: [${allowedRoles.join(', ')}]. Your role is '${req.user.role}'.`
      });
    }

    next();
  };
}

// Verify Cron Secret or Admin Role (for Automation Endpoints)
function authorizeCronOrAdmin(req, res, next) {
  const cronKey = req.headers['x-cron-key'];
  const serverCronSecret = process.env.CRON_SECRET || 'brightloop_cron_secret_hackathon_2026';

  if (cronKey && cronKey === serverCronSecret) {
    return next();
  }

  // Otherwise check admin JWT
  authenticateToken(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access or valid CRON secret required.' });
  });
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizeCronOrAdmin,
};
