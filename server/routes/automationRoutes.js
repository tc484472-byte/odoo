const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { authorizeCronOrAdmin, authenticateToken, authorizeRoles } = require('../middleware/auth');

// Can be triggered by Admin or External Cron scheduler (GitHub Actions) with X-Cron-Key
router.post('/run-billing', authorizeCronOrAdmin, automationController.runBilling);
router.post('/overdue-check', authorizeCronOrAdmin, automationController.runOverdueCheck);
router.post('/renewal-reminders', authorizeCronOrAdmin, automationController.runRenewalReminders);
router.post('/expiry-check', authorizeCronOrAdmin, automationController.runExpiryCheck);

// Automation execution logs (Admin only)
router.get('/logs', authenticateToken, authorizeRoles('admin'), automationController.getAutomationLogs);

module.exports = router;
