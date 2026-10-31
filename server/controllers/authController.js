const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { isValidPassword, isValidEmail } = require('../middleware/validate');
const { sendEmail } = require('../services/emailService');
const { recordAuditLog } = require('../middleware/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop_super_secret_jwt_key_2026_odoo_hackathon';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Register Customer (Self Sign-up)
async function register(req, res) {
  const { email, password, fullName, companyName, phone, billingAddress, gstNumber } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ success: false, message: 'Full name, email, and password are required.' });
  }

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
    // Check if email already registered
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Always force role 'customer' for public registration (Privilege escalation protection)
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, phone)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role`,
        [email.trim().toLowerCase(), passwordHash, fullName.trim(), 'customer', phone || null]
      );
      const user = userRes.rows[0];

      // Create linked customer entity
      const custRes = await client.query(
        `INSERT INTO customers (user_id, company_name, contact_name, email, phone, billing_address, gst_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, company_name`,
        [
          user.id,
          companyName ? companyName.trim() : fullName.trim(),
          fullName.trim(),
          email.trim().toLowerCase(),
          phone || null,
          billingAddress || null,
          gstNumber || null
        ]
      );
      const customer = custRes.rows[0];

      await client.query('COMMIT');
      client.release();

      // Issue JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, customerId: customer.id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      recordAuditLog(req, {
        action: 'USER_REGISTER',
        entityType: 'users',
        entityId: user.id,
        newValues: { email: user.email, role: user.role }
      });

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully.',
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          customerId: customer.id,
          companyName: customer.company_name
        }
      });

    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }

  } catch (err) {
    console.error('[Register Error]:', err);
    return res.status(500).json({ success: false, message: 'Registration failed: ' + err.message });
  }
}

// Login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const userRes = await db.query(
      `SELECT id, email, password_hash, full_name, role, phone, is_active FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Get linked customer ID if customer
    let customerId = null;
    let companyName = null;
    if (user.role === 'customer') {
      const custRes = await db.query(
        'SELECT id, company_name FROM customers WHERE user_id = $1 OR email = $2 LIMIT 1',
        [user.id, user.email]
      );
      if (custRes.rows.length > 0) {
        customerId = custRes.rows[0].id;
        companyName = custRes.rows[0].company_name;
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, customerId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    recordAuditLog(req, {
      action: 'USER_LOGIN',
      entityType: 'users',
      entityId: user.id
    });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        phone: user.phone,
        customerId,
        companyName
      }
    });

  } catch (err) {
    console.error('[Login Error]:', err);
    return res.status(500).json({ success: false, message: 'Login failed: ' + err.message });
  }
}

// Current User Profile (Me)
async function getMe(req, res) {
  return res.json({
    success: true,
    user: req.user
  });
}

// Forgot Password
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }

  try {
    const userRes = await db.query('SELECT id, email, full_name FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userRes.rows.length === 0) {
      // Don't leak user existence for security, return success
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been dispatched.'
      });
    }

    const user = userRes.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, resetToken, expiresAt]
    );

    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request - Brightloop Software',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2 style="color: #0c87eb;">Brightloop Software</h2>
          <p>Hello ${user.full_name},</p>
          <p>You requested to reset your password. Click the link below to set a new password:</p>
          <p style="margin: 20px 0;"><a href="${resetLink}" style="background-color: #0c87eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>Or paste this link into your browser: <br/><code>${resetLink}</code></p>
          <p>This link expires in 1 hour. If you did not request this, please ignore this email.</p>
        </div>
      `
    });

    return res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been dispatched.',
      // Providing token in dev mode response for direct demoing without external email access
      devResetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined
    });

  } catch (err) {
    console.error('[Forgot Password Error]:', err);
    return res.status(500).json({ success: false, message: 'Error processing password reset request.' });
  }
}

// Reset Password
async function resetPassword(req, res) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
  }

  if (!isValidPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
    });
  }

  try {
    const tokenRes = await db.query(
      `SELECT prt.*, u.email 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token.' });
    }

    const resetRecord = tokenRes.rows[0];
    const newHash = await bcrypt.hash(newPassword, 10);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newHash, resetRecord.user_id]
      );

      await client.query(
        'UPDATE password_reset_tokens SET used = true WHERE id = $1',
        [resetRecord.id]
      );

      await client.query('COMMIT');
      client.release();

      return res.json({
        success: true,
        message: 'Password reset successful! You can now log in with your new password.'
      });

    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }

  } catch (err) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({ success: false, message: 'Password reset failed: ' + err.message });
  }
}

module.exports = {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword
};
