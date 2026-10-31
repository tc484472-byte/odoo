const db = require('../db');
const { sendEmail } = require('./emailService');

// Helper to advance date by billing frequency
function advanceDate(dateStr, frequency) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];

  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d.toISOString().split('T')[0];
}

// Helper to add days
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Generate unique invoice number: INV-YYYY-XXXX
async function generateInvoiceNumber(client) {
  const currentYear = new Date().getFullYear();
  const res = await (client || db).query(
    `SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE $1`,
    [`INV-${currentYear}-%`]
  );
  const count = parseInt(res.rows[0].count, 10) + 1;
  const padded = String(count).padStart(4, '0');
  return `INV-${currentYear}-${padded}`;
}

// 1. AUTOMATIC RECURRING BILLING ENGINE
async function generateRecurringInvoices({ dryRun = false } = {}) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[Billing Service] Starting recurring billing run for date: ${today}`);

  let processedCount = 0;
  let successCount = 0;
  let skippedCount = 0;
  let errors = [];

  try {
    // Find active subscriptions eligible for billing
    const subsResult = await db.query(
      `SELECT s.*, 
              c.company_name, c.contact_name, c.email as customer_email, c.billing_address, c.gst_number,
              p.name as plan_name, p.auto_close
       FROM subscriptions s
       JOIN customers c ON s.customer_id = c.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'active'
         AND s.next_billing_date <= $1
         AND (s.expiry_date IS NULL OR s.expiry_date >= $1)
       ORDER BY s.id ASC`,
      [today]
    );

    const eligibleSubs = subsResult.rows;
    console.log(`[Billing Service] Found ${eligibleSubs.length} subscriptions due for billing.`);

    for (const sub of eligibleSubs) {
      processedCount++;
      const billingPeriodStart = sub.next_billing_date;
      const billingPeriodEnd = advanceDate(billingPeriodStart, sub.billing_frequency);

      // Check if invoice already generated for this billing period (Idempotency check)
      const existingInv = await db.query(
        `SELECT id, invoice_number FROM invoices 
         WHERE subscription_id = $1 AND billing_period_start = $2`,
        [sub.id, billingPeriodStart]
      );

      if (existingInv.rows.length > 0) {
        console.log(`[Billing Service] Invoice already exists (${existingInv.rows[0].invoice_number}) for Sub #${sub.id} period ${billingPeriodStart}. Skipping.`);
        skippedCount++;
        continue;
      }

      if (dryRun) {
        successCount++;
        continue;
      }

      // Begin atomic database transaction for invoice generation
      const client = await db.getClient();
      try {
        await client.query('BEGIN');

        // Fetch subscription line items
        const itemsResult = await client.query(
          `SELECT si.*, p.name as product_name, pv.variant_name, pv.attribute_value
           FROM subscription_items si
           JOIN products p ON si.product_id = p.id
           LEFT JOIN product_variants pv ON si.variant_id = pv.id
           WHERE si.subscription_id = $1`,
          [sub.id]
        );

        let items = itemsResult.rows;

        // If no line items configured, create one fallback line item from subscription total
        if (items.length === 0) {
          items = [{
            product_id: null,
            variant_id: null,
            description: `${sub.plan_name} Recurring Subscription`,
            quantity: sub.quantity || 1,
            unit_price: sub.unit_price || 0,
            subtotal: Number(sub.unit_price || 0) * Number(sub.quantity || 1),
            discount_amount: sub.discount_amount || 0,
            tax_amount: sub.tax_amount || 0,
            total_price: sub.total_amount || 0,
          }];
        }

        // Calculate totals
        let subtotal = 0;
        let discountTotal = Number(sub.discount_amount) || 0;
        let taxTotal = Number(sub.tax_amount) || 0;

        items.forEach(item => {
          subtotal += Number(item.unit_price) * Number(item.quantity);
        });

        const totalAmount = Number((subtotal - discountTotal + taxTotal).toFixed(2));
        const dueDate = addDays(today, 15); // Net 15 default
        const invoiceNumber = await generateInvoiceNumber(client);

        // 1. Insert Invoice
        const invResult = await client.query(
          `INSERT INTO invoices (
            invoice_number, subscription_id, customer_id, invoice_date,
            billing_period_start, billing_period_end, due_date,
            subtotal, discount_amount, tax_amount, total_amount,
            amount_paid, outstanding_amount, status, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id`,
          [
            invoiceNumber, sub.id, sub.customer_id, today,
            billingPeriodStart, billingPeriodEnd, dueDate,
            subtotal.toFixed(2), discountTotal.toFixed(2), taxTotal.toFixed(2), totalAmount.toFixed(2),
            0.00, totalAmount.toFixed(2), 'confirmed', `Recurring billing for ${sub.subscription_number}`
          ]
        );

        const invoiceId = invResult.rows[0].id;

        // 2. Insert Invoice Line Items
        for (const item of items) {
          const itemSubtotal = Number(item.unit_price) * Number(item.quantity);
          await client.query(
            `INSERT INTO invoice_items (
              invoice_id, product_id, variant_id, description,
              quantity, unit_price, subtotal, discount_amount, tax_amount, total_price
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              invoiceId,
              item.product_id || null,
              item.variant_id || null,
              item.description || item.product_name || 'Subscription item',
              item.quantity,
              item.unit_price,
              itemSubtotal.toFixed(2),
              item.discount_amount || 0.00,
              item.tax_amount || 0.00,
              item.total_price || itemSubtotal.toFixed(2)
            ]
          );
        }

        // 3. Advance Next Billing Date
        const nextBillingDate = advanceDate(sub.next_billing_date, sub.billing_frequency);
        await client.query(
          `UPDATE subscriptions 
           SET next_billing_date = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [nextBillingDate, sub.id]
        );

        // Commit transaction
        await client.query('COMMIT');
        client.release();

        successCount++;
        console.log(`[Billing Service] Generated invoice ${invoiceNumber} for Sub #${sub.id}. Next billing set to ${nextBillingDate}.`);

        // Record customer notification
        await db.query(
          `INSERT INTO notifications (customer_id, title, message, type, email_sent)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sub.customer_id,
            `New Invoice Generated: ${invoiceNumber}`,
            `Invoice ${invoiceNumber} for ₹${totalAmount.toFixed(2)} has been generated for your ${sub.plan_name} subscription. Due date is ${dueDate}.`,
            'invoice_generated',
            true
          ]
        );

        // Async Email Notification
        sendEmail({
          to: sub.customer_email,
          subject: `Invoice ${invoiceNumber} from Brightloop Software`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0c87eb;">Brightloop Software</h2>
              <p>Dear ${sub.contact_name || sub.company_name},</p>
              <p>Your subscription invoice <strong>${invoiceNumber}</strong> has been generated.</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p><strong>Plan:</strong> ${sub.plan_name}</p>
                <p><strong>Billing Period:</strong> ${billingPeriodStart} to ${billingPeriodEnd}</p>
                <p><strong>Amount Due:</strong> ₹${totalAmount.toFixed(2)}</p>
                <p><strong>Due Date:</strong> ${dueDate}</p>
              </div>
              <p>You can view and settle this invoice via the Customer Portal.</p>
              <p>Best regards,<br/>Brightloop Software Billing Team</p>
            </div>
          `
        }).catch(e => console.error('[Email Notification Error]:', e.message));

      } catch (txnError) {
        await client.query('ROLLBACK');
        client.release();
        console.error(`[Billing Service Error on Sub #${sub.id}]:`, txnError.message);
        errors.push({ subscriptionId: sub.id, error: txnError.message });
      }
    }

    // Record automation log
    const logStatus = errors.length === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failure');
    const details = `Processed: ${processedCount}, Invoices Generated: ${successCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`;
    await db.query(
      `INSERT INTO automation_logs (job_name, status, processed_count, details, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      ['DAILY_RECURRING_BILLING', logStatus, successCount, details, errors.length > 0 ? JSON.stringify(errors) : null]
    );

    return {
      success: true,
      processedCount,
      successCount,
      skippedCount,
      errorsCount: errors.length,
      errors
    };

  } catch (err) {
    console.error('[Billing Service Critical Failure]:', err.message);
    await db.query(
      `INSERT INTO automation_logs (job_name, status, processed_count, details, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      ['DAILY_RECURRING_BILLING', 'failure', 0, 'Critical billing service error', err.message]
    );
    throw err;
  }
}

// 2. OVERDUE INVOICE DETECTION
async function checkOverdueInvoices() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[Overdue Check] Scanning for overdue unpaid invoices at ${today}...`);

  try {
    const overdueRes = await db.query(
      `UPDATE invoices
       SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'confirmed'
         AND due_date < $1
         AND outstanding_amount > 0
       RETURNING id, invoice_number, customer_id, outstanding_amount, due_date`,
      [today]
    );

    const updated = overdueRes.rows;
    console.log(`[Overdue Check] Marked ${updated.length} invoices as overdue.`);

    for (const inv of updated) {
      await db.query(
        `INSERT INTO notifications (customer_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          inv.customer_id,
          `Overdue Notice: Invoice ${inv.invoice_number}`,
          `Your invoice ${inv.invoice_number} of ₹${inv.outstanding_amount} was due on ${inv.due_date} and is now overdue. Please clear the outstanding balance.`,
          'overdue_notice'
        ]
      );
    }

    await db.query(
      `INSERT INTO automation_logs (job_name, status, processed_count, details)
       VALUES ($1, $2, $3, $4)`,
      ['OVERDUE_INVOICE_DETECTION', 'success', updated.length, `Detected and updated ${updated.length} overdue invoices.`]
    );

    return { success: true, count: updated.length, invoices: updated };
  } catch (err) {
    console.error('[Overdue Check Error]:', err.message);
    await db.query(
      `INSERT INTO automation_logs (job_name, status, processed_count, details, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      ['OVERDUE_INVOICE_DETECTION', 'failure', 0, 'Error during overdue check', err.message]
    );
    throw err;
  }
}

// 3. RENEWAL REMINDER ENGINE (7 Days Prior)
async function sendRenewalReminders() {
  const today = new Date();
  const reminderHorizon = new Date();
  reminderHorizon.setDate(today.getDate() + 7);
  const horizonDateStr = reminderHorizon.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  console.log(`[Renewal Reminders] Scanning subscriptions expiring between ${todayStr} and ${horizonDateStr}...`);

  try {
    const expiringSubs = await db.query(
      `SELECT s.*, c.company_name, c.contact_name, c.email as customer_email, p.name as plan_name
       FROM subscriptions s
       JOIN customers c ON s.customer_id = c.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'active'
         AND s.expiry_date >= $1
         AND s.expiry_date <= $2`,
      [todayStr, horizonDateStr]
    );

    let sentCount = 0;
    for (const sub of expiringSubs.rows) {
      // Check duplicate reminder sent within last 7 days
      const existingReminder = await db.query(
        `SELECT id FROM notifications
         WHERE customer_id = $1 
           AND type = 'renewal_reminder'
           AND title LIKE $2
           AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'`,
        [sub.customer_id, `%${sub.subscription_number}%`]
      );

      if (existingReminder.rows.length > 0) {
        continue;
      }

      await db.query(
        `INSERT INTO notifications (customer_id, title, message, type, email_sent)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          sub.customer_id,
          `Upcoming Renewal: Subscription ${sub.subscription_number}`,
          `Your subscription ${sub.subscription_number} (${sub.plan_name}) will renew/expire on ${sub.expiry_date}. Ensure payment details are up-to-date.`,
          'renewal_reminder',
          true
        ]
      );

      sendEmail({
        to: sub.customer_email,
        subject: `Renewal Reminder: Subscription ${sub.subscription_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0c87eb;">Brightloop Software</h2>
            <p>Dear ${sub.contact_name || sub.company_name},</p>
            <p>This is a reminder that your subscription <strong>${sub.subscription_number}</strong> for <strong>${sub.plan_name}</strong> is scheduled to renew/expire on <strong>${sub.expiry_date}</strong>.</p>
            <p>No action is needed if you are on automated recurring billing.</p>
            <p>Best regards,<br/>Brightloop Customer Success</p>
          </div>
        `
      }).catch(e => console.error('[Renewal Email Error]:', e.message));

      sentCount++;
    }

    await db.query(
      `INSERT INTO automation_logs (job_name, status, processed_count, details)
       VALUES ($1, $2, $3, $4)`,
      ['RENEWAL_REMINDERS', 'success', sentCount, `Sent ${sentCount} renewal reminder notices.`]
    );

    return { success: true, count: sentCount };
  } catch (err) {
    console.error('[Renewal Reminders Error]:', err.message);
    throw err;
  }
}

// 4. SUBSCRIPTION EXPIRY DETECTION
async function checkExpiredSubscriptions() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const expiredRes = await db.query(
      `UPDATE subscriptions s
       SET status = CASE WHEN p.auto_close = true THEN 'closed' ELSE 'expired' END,
           updated_at = CURRENT_TIMESTAMP
       FROM plans p
       WHERE s.plan_id = p.id
         AND s.status = 'active'
         AND s.expiry_date < $1
       RETURNING s.id, s.subscription_number, s.status`,
      [today]
    );

    console.log(`[Expiry Detection] Updated ${expiredRes.rows.length} expired subscriptions.`);
    return { success: true, count: expiredRes.rows.length, expired: expiredRes.rows };
  } catch (err) {
    console.error('[Expiry Detection Error]:', err.message);
    throw err;
  }
}

module.exports = {
  generateRecurringInvoices,
  checkOverdueInvoices,
  sendRenewalReminders,
  checkExpiredSubscriptions,
  advanceDate,
  generateInvoiceNumber,
};
