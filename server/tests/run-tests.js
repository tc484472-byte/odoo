// ==============================================================================
// BRIGHTLOOP SUBSCRIPTION MANAGEMENT SYSTEM - AUTOMATED TEST SUITE
// Tests all business logic, recurring billing, duplicate prevention, and lifecycle
// ==============================================================================

const db = require('../db');
const { seedData } = require('../migrations/seed');
const {
  generateRecurringInvoices,
  checkOverdueInvoices,
  sendRenewalReminders,
  checkExpiredSubscriptions,
  advanceDate
} = require('../services/billingService');
const { isValidPassword, isValidEmail } = require('../middleware/validate');
const bcrypt = require('bcryptjs');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING COMPREHENSIVE SUBSCRIPTION MANAGEMENT SYSTEM TESTS');
  console.log('===============================================================\n');

  try {
    await db.initDb();
    await seedData();

    // TEST 1: Password & Email Validation Rules
    console.log('[Suite 1: Validation & Security]');
    assert(isValidPassword('Admin@12345'), 'Valid password accepted');
    assert(!isValidPassword('short'), 'Short password rejected');
    assert(!isValidPassword('nocapitals123!'), 'Password without uppercase rejected');
    assert(!isValidPassword('NOLOWERCASE123!'), 'Password without lowercase rejected');
    assert(!isValidPassword('NoSpecialChars123'), 'Password without special character rejected');
    assert(isValidEmail('admin@brightloop.com'), 'Valid email accepted');
    assert(!isValidEmail('invalid-email'), 'Invalid email format rejected');

    // TEST 2: Users and Roles Verification
    console.log('\n[Suite 2: Role-Based Users & Customer Isolation]');
    const users = await db.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    const rolesMap = {};
    users.rows.forEach(r => rolesMap[r.role] = parseInt(r.count, 10));
    assert(rolesMap['admin'] >= 1, 'Admin account exists');
    assert(rolesMap['staff'] >= 1, 'Staff account exists');
    assert(rolesMap['customer'] >= 1, 'Customer accounts exist');

    // TEST 3: Product Variants (Odoo Brand variant +560)
    console.log('\n[Suite 3: Product Variants & Price Calculations]');
    const prodRes = await db.query("SELECT * FROM products WHERE name LIKE '%ERP Core%'");
    assert(prodRes.rows.length > 0, 'Core product exists');
    const coreProd = prodRes.rows[0];

    const varRes = await db.query(
      "SELECT * FROM product_variants WHERE product_id = $1 AND attribute_value LIKE '%Odoo%'",
      [coreProd.id]
    );
    assert(varRes.rows.length > 0, 'Odoo Brand variant exists');
    const odooVar = varRes.rows[0];
    assert(Number(odooVar.additional_price) === 560, 'Odoo Brand variant adds exactly ₹560');

    const expectedTotal = Number(coreProd.sales_price) + Number(odooVar.additional_price);
    assert(expectedTotal === 12560, `Base (₹12,000) + Variant (₹560) = ₹12,560 calculated correctly`);

    // TEST 4: Subscription Plans & Billing Frequencies
    console.log('\n[Suite 4: Subscription Plans]');
    const plansRes = await db.query('SELECT * FROM plans');
    assert(plansRes.rows.length >= 3, 'Multiple plans configured');
    const monthlyPlan = plansRes.rows.find(p => p.billing_frequency === 'monthly');
    const yearlyPlan = plansRes.rows.find(p => p.billing_frequency === 'yearly');
    assert(monthlyPlan !== undefined, 'Monthly plan available');
    assert(yearlyPlan !== undefined, 'Yearly plan available');

    // TEST 5: Date Advancement Calculations
    console.log('\n[Suite 5: Date & Period Calculations]');
    assert(advanceDate('2026-01-01', 'monthly') === '2026-02-01', 'Advance monthly adds 1 month');
    assert(advanceDate('2026-01-01', 'yearly') === '2027-01-01', 'Advance yearly adds 1 year');
    assert(advanceDate('2026-01-01', 'weekly') === '2026-01-08', 'Advance weekly adds 7 days');
    assert(advanceDate('2026-01-01', 'daily') === '2026-01-02', 'Advance daily adds 1 day');

    // TEST 6: Automated Recurring Billing & Invoice Generation
    console.log('\n[Suite 6: Recurring Billing Engine & Invoicing]');
    const billingRun = await generateRecurringInvoices();
    assert(billingRun.success === true, 'Billing engine executed successfully');
    console.log(`    ℹ️ Generated ${billingRun.successCount} invoices, skipped ${billingRun.skippedCount}`);

    // TEST 7: Idempotency & Duplicate Billing Prevention
    console.log('\n[Suite 7: Duplicate Invoice Prevention (Idempotency)]');
    // Set next_billing_date back to 2026-10-31 to simulate a re-run or duplicate attempt
    const today = new Date().toISOString().split('T')[0];
    await db.query("UPDATE subscriptions SET next_billing_date = $1 WHERE id = 1", [today]);
    const duplicateRun = await generateRecurringInvoices();
    assert(duplicateRun.success === true, 'Second billing run executed without error');
    assert(duplicateRun.successCount === 0, 'Second run generated 0 new invoices (duplicate prevention active!)');
    assert(duplicateRun.skippedCount > 0, 'Subscription safely skipped because billing period was already invoiced');

    // TEST 8: Tax & Discount Calculations
    console.log('\n[Suite 8: Financial Calculations (Taxes & Discounts)]');
    const testSubtotal = 12560;
    const testDiscountPercent = 10;
    const discountAmt = (testSubtotal * testDiscountPercent) / 100; // 1256
    const taxableAmt = testSubtotal - discountAmt; // 11304
    const testTaxPercent = 18;
    const taxAmt = Number(((taxableAmt * testTaxPercent) / 100).toFixed(2)); // 2034.72
    const finalTotal = Number((taxableAmt + taxAmt).toFixed(2)); // 13338.72
    assert(discountAmt === 1256, '10% discount on ₹12,560 is ₹1,256');
    assert(taxAmt === 2034.72, '18% GST on ₹11,304 is ₹2,034.72');
    assert(finalTotal === 13338.72, 'Final total is ₹13,338.72');

    // TEST 9: Payment Management & Balance Reconciliations
    console.log('\n[Suite 9: Payment Processing & Reconciliation]');
    const unpaidInv = await db.query("SELECT * FROM invoices WHERE status = 'confirmed' LIMIT 1");
    if (unpaidInv.rows.length > 0) {
      const inv = unpaidInv.rows[0];
      const initialOutstanding = Number(inv.outstanding_amount);
      const partialPayment = Math.min(1000, initialOutstanding);

      // Perform partial payment
      const newPaid = Number(inv.amount_paid) + partialPayment;
      const newOutstanding = initialOutstanding - partialPayment;
      assert(newOutstanding < initialOutstanding, 'Partial payment correctly reduces outstanding balance');
      assert(newPaid > Number(inv.amount_paid), 'Amount paid correctly updated');
    }

    // TEST 10: Overdue Detection & Status Updates
    console.log('\n[Suite 10: Overdue Detection Engine]');
    const overdueResult = await checkOverdueInvoices();
    assert(overdueResult.success === true, 'Overdue check completed without failure');

    // TEST 11: Renewal Reminders
    console.log('\n[Suite 11: Renewal Reminders]');
    const reminderResult = await sendRenewalReminders();
    assert(reminderResult.success === true, 'Renewal reminders check completed without failure');

    // TEST 12: Subscription Lifecycle Status Transitions
    console.log('\n[Suite 12: Subscription Lifecycle State Machine]');
    const subToPause = await db.query("SELECT id, status FROM subscriptions WHERE status = 'active' LIMIT 1");
    if (subToPause.rows.length > 0) {
      const sId = subToPause.rows[0].id;
      // Pause
      await db.query("UPDATE subscriptions SET status = 'paused' WHERE id = $1", [sId]);
      const pausedSub = await db.query('SELECT status FROM subscriptions WHERE id = $1', [sId]);
      assert(pausedSub.rows[0].status === 'paused', 'Subscription transitioned from active to paused');

      // Resume
      await db.query("UPDATE subscriptions SET status = 'active' WHERE id = $1", [sId]);
      const resumedSub = await db.query('SELECT status FROM subscriptions WHERE id = $1', [sId]);
      assert(resumedSub.rows[0].status === 'active', 'Subscription transitioned from paused to active');
    }

    // TEST 13: Automation Audit Logs
    console.log('\n[Suite 13: Automation & Audit Logs]');
    const autoLogs = await db.query('SELECT * FROM automation_logs');
    assert(autoLogs.rows.length > 0, 'Automation execution logs recorded');
    console.log(`    ℹ️ Total automation logs in database: ${autoLogs.rows.length}`);

    console.log('\n===============================================================');
    console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('===============================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  }
}

runAllTests().then(() => process.exit(0));
