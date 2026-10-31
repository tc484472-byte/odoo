const db = require('../db');
const {
  generateRecurringInvoices,
  checkOverdueInvoices,
  sendRenewalReminders,
  checkExpiredSubscriptions
} = require('../services/billingService');

// Run Recurring Billing on Demand
async function runBilling(req, res) {
  try {
    const result = await generateRecurringInvoices();
    return res.json({
      success: true,
      message: `Billing job completed. Processed: ${result.processedCount}, Invoices created: ${result.successCount}, Skipped: ${result.skippedCount}.`,
      result
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Billing execution failed: ' + err.message });
  }
}

// Run Overdue Check on Demand
async function runOverdueCheck(req, res) {
  try {
    const result = await checkOverdueInvoices();
    return res.json({
      success: true,
      message: `Overdue check completed. ${result.count} invoices updated to overdue status.`,
      result
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Overdue check failed: ' + err.message });
  }
}

// Run Renewal Reminders on Demand
async function runRenewalReminders(req, res) {
  try {
    const result = await sendRenewalReminders();
    return res.json({
      success: true,
      message: `Renewal reminder job completed. Sent ${result.count} reminders.`,
      result
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Renewal reminder check failed: ' + err.message });
  }
}

// Run Expiry Check on Demand
async function runExpiryCheck(req, res) {
  try {
    const result = await checkExpiredSubscriptions();
    return res.json({
      success: true,
      message: `Subscription expiry check completed. ${result.count} subscriptions updated.`,
      result
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Expiry check failed: ' + err.message });
  }
}

// Get Automation Logs
async function getAutomationLogs(req, res) {
  try {
    const logsRes = await db.query(
      `SELECT * FROM automation_logs ORDER BY executed_at DESC LIMIT 50`
    );
    return res.json({ success: true, logs: logsRes.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  runBilling,
  runOverdueCheck,
  runRenewalReminders,
  runExpiryCheck,
  getAutomationLogs
};
