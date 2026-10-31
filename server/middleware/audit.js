const db = require('../db');

// Audit logger middleware / helper
async function recordAuditLog(req, { action, entityType, entityId, oldValues = null, newValues = null }) {
  try {
    const userId = req && req.user ? req.user.id : null;
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'internal';

    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress
      ]
    );
  } catch (err) {
    console.error('[Audit Log Error]:', err.message);
  }
}

module.exports = {
  recordAuditLog
};
