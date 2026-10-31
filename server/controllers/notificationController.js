const db = require('../db');

// List notifications for current user/customer
async function getNotifications(req, res) {
  try {
    const isCustomer = req.user.role === 'customer';
    let queryText = 'SELECT * FROM notifications';
    const params = [];

    if (isCustomer) {
      queryText += ' WHERE customer_id = $1 OR user_id = $2';
      params.push(req.user.customerId || 0, req.user.id);
    } else {
      // Staff / Admin see recent system and alert notifications
      queryText += ' WHERE user_id = $1 OR user_id IS NULL';
      params.push(req.user.id);
    }

    queryText += ' ORDER BY created_at DESC LIMIT 50';

    const result = await db.query(queryText, params);
    const unreadCount = result.rows.filter(n => !n.is_read).length;

    return res.json({
      success: true,
      notifications: result.rows,
      unreadCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Mark a single notification as read
async function markAsRead(req, res) {
  const { id } = req.params;
  try {
    await db.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Mark all notifications for the user as read
async function markAllAsRead(req, res) {
  try {
    const isCustomer = req.user.role === 'customer';
    if (isCustomer) {
      await db.query(
        'UPDATE notifications SET is_read = true WHERE customer_id = $1 OR user_id = $2',
        [req.user.customerId || 0, req.user.id]
      );
    } else {
      await db.query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 OR user_id IS NULL',
        [req.user.id]
      );
    }
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};
