const cron = require('node-cron');
const {
  generateRecurringInvoices,
  checkOverdueInvoices,
  sendRenewalReminders,
  checkExpiredSubscriptions
} = require('../services/billingService');

function startScheduledJobs() {
  console.log('[Scheduler] Initializing node-cron background automation jobs (Asia/Kolkata)...');

  // Daily at 00:05 AM IST: Run automated recurring billing
  cron.schedule('5 0 * * *', async () => {
    console.log('[Scheduler Cron] Executing daily recurring billing task...');
    try {
      await generateRecurringInvoices();
    } catch (err) {
      console.error('[Scheduler Cron Error - Recurring Billing]:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Daily at 00:30 AM IST: Check overdue invoices
  cron.schedule('30 0 * * *', async () => {
    console.log('[Scheduler Cron] Executing daily overdue invoices check...');
    try {
      await checkOverdueInvoices();
    } catch (err) {
      console.error('[Scheduler Cron Error - Overdue Check]:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Daily at 09:00 AM IST: Send renewal reminders
  cron.schedule('0 9 * * *', async () => {
    console.log('[Scheduler Cron] Executing daily renewal reminders task...');
    try {
      await sendRenewalReminders();
    } catch (err) {
      console.error('[Scheduler Cron Error - Renewal Reminders]:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Daily at 01:00 AM IST: Check expired subscriptions
  cron.schedule('0 1 * * *', async () => {
    console.log('[Scheduler Cron] Executing daily subscription expiry detection...');
    try {
      await checkExpiredSubscriptions();
    } catch (err) {
      console.error('[Scheduler Cron Error - Subscription Expiry]:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('[Scheduler] All background cron jobs registered successfully.');
}

module.exports = {
  startScheduledJobs
};
