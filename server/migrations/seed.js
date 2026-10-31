const bcrypt = require('bcryptjs');
const db = require('../db');

async function seedData() {
  console.log('[Seed] Seeding realistic Brightloop Software demonstration data...');

  // 1. Password Hashes (Min 8 chars, uppercase, lowercase, special char)
  const adminPass = await bcrypt.hash('Admin@12345', 10);
  const staffPass = await bcrypt.hash('Staff@12345', 10);
  const custPass = await bcrypt.hash('Customer@12345', 10);

  // Check if users already seeded
  const existingUsers = await db.query('SELECT COUNT(*) FROM users');
  if (parseInt(existingUsers.rows[0].count, 10) > 0) {
    console.log('[Seed] Database already contains records. Skipping seed.');
    return;
  }

  // 2. Insert Users
  const u1 = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ['admin@brightloop.com', adminPass, 'Sarah Vance (Admin)', 'admin', '+91 98765 43210']
  );
  const adminId = u1.rows[0].id;

  const u2 = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ['staff@brightloop.com', staffPass, 'Liam Miller (Sales & Ops Staff)', 'staff', '+91 98765 43211']
  );
  const staffId = u2.rows[0].id;

  const u3 = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ['acme@corp.com', custPass, 'John Doe (Acme Corp)', 'customer', '+91 98765 43212']
  );
  const custUser1Id = u3.rows[0].id;

  const u4 = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ['techstart@io.com', custPass, 'Sarah Jenkins (TechStart Inc)', 'customer', '+91 98765 43213']
  );
  const custUser2Id = u4.rows[0].id;

  const u5 = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ['retailhub@shop.com', custPass, 'David Kumar (RetailHub Ltd)', 'customer', '+91 98765 43214']
  );
  const custUser3Id = u5.rows[0].id;

  // 3. Insert Customers
  const c1 = await db.query(
    `INSERT INTO customers (user_id, company_name, contact_name, email, phone, billing_address, gst_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [custUser1Id, 'Acme Corp Pvt Ltd', 'John Doe', 'acme@corp.com', '+91 98765 43212', '101 Cyber City, Sector 29, Gurugram, Haryana', '27AABCU9603R1ZM']
  );
  const cust1Id = c1.rows[0].id;

  const c2 = await db.query(
    `INSERT INTO customers (user_id, company_name, contact_name, email, phone, billing_address, gst_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [custUser2Id, 'TechStart Technologies', 'Sarah Jenkins', 'techstart@io.com', '+91 98765 43213', '404 MG Road, Bengaluru, Karnataka', '29AABCU9603R1ZN']
  );
  const cust2Id = c2.rows[0].id;

  const c3 = await db.query(
    `INSERT INTO customers (user_id, company_name, contact_name, email, phone, billing_address, gst_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [custUser3Id, 'RetailHub Logistics', 'David Kumar', 'retailhub@shop.com', '+91 98765 43214', '77 Linking Road, Bandra West, Mumbai, Maharashtra', '27AABCU9603R1ZP']
  );
  const cust3Id = c3.rows[0].id;

  // 4. Products & Variants
  const p1 = await db.query(
    `INSERT INTO products (name, product_type, sales_price, cost_price, notes, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    ['Brightloop ERP Core', 'service', 12000.00, 3000.00, 'All-in-one ERP suite with CRM, Inventory, and Sales modules', true]
  );
  const prod1Id = p1.rows[0].id;

  // Product Variants (Includes Odoo Brand variant +560 from hackathon challenge!)
  const v1 = await db.query(
    `INSERT INTO product_variants (product_id, variant_name, attribute_value, additional_price, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [prod1Id, 'Brand', 'Standard Brightloop UI', 0.00, true]
  );
  const v2 = await db.query(
    `INSERT INTO product_variants (product_id, variant_name, attribute_value, additional_price, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [prod1Id, 'Brand', 'Odoo Integrated Brand Suite', 560.00, true]
  );
  const vOdooId = v2.rows[0].id;

  const p2 = await db.query(
    `INSERT INTO products (name, product_type, sales_price, cost_price, notes, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    ['Cloud Dedicated Hosting & Daily Backups', 'service', 2500.00, 800.00, 'High availability cloud infrastructure with automated snapshots', true]
  );
  const prod2Id = p2.rows[0].id;

  const p3 = await db.query(
    `INSERT INTO products (name, product_type, sales_price, cost_price, notes, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    ['Advanced Financial & AI Forecasting', 'service', 4000.00, 1000.00, 'Predictive revenue forecasting and recurring cashflow analytics', true]
  );
  const prod3Id = p3.rows[0].id;

  const p4 = await db.query(
    `INSERT INTO products (name, product_type, sales_price, cost_price, notes, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    ['24/7 SLA Priority Dedicated Support', 'service', 1800.00, 500.00, '15-minute response SLA for production incidents', true]
  );
  const prod4Id = p4.rows[0].id;

  // 5. Subscription Plans
  const pl1 = await db.query(
    `INSERT INTO plans (name, description, price, billing_frequency, min_quantity, start_date, end_date, auto_close, allow_pause, allow_renew, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    ['Standard Business Monthly', 'Complete monthly subscription covering ERP Core & Standard Support', 12000.00, 'monthly', 1, '2026-01-01', '2027-12-31', false, true, true, true]
  );
  const plan1Id = pl1.rows[0].id;

  const pl2 = await db.query(
    `INSERT INTO plans (name, description, price, billing_frequency, min_quantity, start_date, end_date, auto_close, allow_pause, allow_renew, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    ['Enterprise Growth Suite (Monthly)', 'Includes ERP Core, Cloud Dedicated Hosting, and AI Suite', 18500.00, 'monthly', 1, '2026-01-01', '2027-12-31', false, true, true, true]
  );
  const plan2Id = pl2.rows[0].id;

  const pl3 = await db.query(
    `INSERT INTO plans (name, description, price, billing_frequency, min_quantity, start_date, end_date, auto_close, allow_pause, allow_renew, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    ['Enterprise Annual Contract', 'Annual prepaid contract with complete features and dedicated account manager', 180000.00, 'yearly', 1, '2026-01-01', '2027-12-31', false, true, true, true]
  );
  const plan3Id = pl3.rows[0].id;

  // 6. Tax Rules
  const t1 = await db.query(
    `INSERT INTO tax_rules (name, rate_percent, description, applicable_scope, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ['GST 18%', 18.00, 'Standard GST on Cloud Software and IT services', 'all', true]
  );
  const taxGst18 = t1.rows[0].id;

  await db.query(
    `INSERT INTO tax_rules (name, rate_percent, description, applicable_scope, is_active)
     VALUES ($1, $2, $3, $4, $5)`,
    ['GST 12%', 12.00, 'Concessional IT service rate', 'service', true]
  );

  // 7. Discount Rules
  const d1 = await db.query(
    `INSERT INTO discount_rules (name, code, discount_type, discount_value, min_quantity, min_order_value, applicable_scope, start_date, end_date, max_usage_limit, current_usage_count, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    ['Volume High Growth 10%', 'VOL10', 'percentage', 10.00, 1, 10000.00, 'all', '2026-01-01', '2027-12-31', 100, 2, true]
  );

  const d2 = await db.query(
    `INSERT INTO discount_rules (name, code, discount_type, discount_value, min_quantity, min_order_value, applicable_scope, start_date, end_date, max_usage_limit, current_usage_count, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    ['Startup Voucher ₹1500 Off', 'STARTUP1500', 'fixed', 1500.00, 1, 5000.00, 'all', '2026-01-01', '2027-12-31', 50, 1, true]
  );

  // Today's date reference
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const expiringSoon = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
  const pastDue = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  // 8. Subscriptions
  // Subscription 1: Due for billing today! (Demonstrates automated & manual recurring billing)
  const s1 = await db.query(
    `INSERT INTO subscriptions (
      subscription_number, customer_id, plan_id, status, start_date, expiry_date,
      next_billing_date, billing_frequency, quantity, unit_price, discount_amount, tax_amount, total_amount, payment_terms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
    [
      'SUB-2026-0001', cust1Id, plan1Id, 'active', '2026-01-01', '2027-01-01',
      today, 'monthly', 1, 12560.00, 1256.00, 2034.72, 13338.72, 'Net 15'
    ]
  );
  const sub1Id = s1.rows[0].id;

  await db.query(
    `INSERT INTO subscription_items (subscription_id, product_id, variant_id, description, quantity, unit_price, discount_amount, tax_amount, total_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [sub1Id, prod1Id, vOdooId, 'Brightloop ERP Core (Odoo Integrated Brand Suite)', 1, 12560.00, 1256.00, 2034.72, 13338.72]
  );

  // Subscription 2: Enterprise Contract (TechStart Inc) - Active, billing in 25 days
  const s2 = await db.query(
    `INSERT INTO subscriptions (
      subscription_number, customer_id, plan_id, status, start_date, expiry_date,
      next_billing_date, billing_frequency, quantity, unit_price, discount_amount, tax_amount, total_amount, payment_terms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
    [
      'SUB-2026-0002', cust2Id, plan3Id, 'active', '2026-02-01', '2027-02-01',
      nextMonth, 'yearly', 1, 180000.00, 18000.00, 29160.00, 191160.00, 'Immediate'
    ]
  );

  // Subscription 3: Expiring in 4 days (Demonstrates automated renewal reminders!)
  const s3 = await db.query(
    `INSERT INTO subscriptions (
      subscription_number, customer_id, plan_id, status, start_date, expiry_date,
      next_billing_date, billing_frequency, quantity, unit_price, discount_amount, tax_amount, total_amount, payment_terms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
    [
      'SUB-2026-0003', cust3Id, plan2Id, 'active', '2025-11-01', expiringSoon,
      expiringSoon, 'monthly', 1, 18500.00, 0.00, 3330.00, 21830.00, 'Net 30'
    ]
  );

  // Subscription 4: Paused Subscription (Demonstrates lifecycle: pause/resume)
  await db.query(
    `INSERT INTO subscriptions (
      subscription_number, customer_id, plan_id, status, start_date, expiry_date,
      next_billing_date, billing_frequency, quantity, unit_price, discount_amount, tax_amount, total_amount, payment_terms, pause_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      'SUB-2026-0004', cust1Id, plan1Id, 'paused', '2026-01-15', '2027-01-15',
      nextMonth, 'monthly', 1, 12000.00, 0.00, 2160.00, 14160.00, 'Immediate', today
    ]
  );

  // 9. Quotations (Demonstrates quote creation and confirmation into subscription)
  const q1 = await db.query(
    `INSERT INTO quotations (
      quotation_number, customer_id, plan_id, status, valid_until,
      subtotal, discount_amount, tax_amount, total_amount, terms, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [
      'QT-2026-001', cust2Id, plan2Id, 'draft', nextMonth,
      21000.00, 2100.00, 3402.00, 22302.00, 'Standard 30-day payment term upon invoice confirmation.', 'Includes cloud backup & SLA', staffId
    ]
  );
  const qId = q1.rows[0].id;

  await db.query(
    `INSERT INTO quotation_items (quotation_id, product_id, variant_id, description, quantity, unit_price, discount_amount, tax_amount, total_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [qId, prod1Id, vOdooId, 'Brightloop ERP Core (Odoo Brand)', 1, 12560.00, 1256.00, 2034.72, 13338.72]
  );

  // 10. Invoices (Draft, Confirmed, Paid, and Overdue scenarios)
  // Invoice 1: Fully Paid Invoice (Acme Corp)
  const inv1 = await db.query(
    `INSERT INTO invoices (
      invoice_number, subscription_id, customer_id, invoice_date, billing_period_start, billing_period_end,
      due_date, subtotal, discount_amount, tax_amount, total_amount, amount_paid, outstanding_amount, status, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
    [
      'INV-2026-0001', sub1Id, cust1Id, lastMonth, lastMonth, today,
      lastMonth, 12560.00, 1256.00, 2034.72, 13338.72, 13338.72, 0.00, 'paid', 'Monthly Recurring Billing - Acme Corp'
    ]
  );
  const inv1Id = inv1.rows[0].id;

  await db.query(
    `INSERT INTO invoice_items (invoice_id, product_id, variant_id, description, quantity, unit_price, subtotal, discount_amount, tax_amount, total_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [inv1Id, prod1Id, vOdooId, 'Brightloop ERP Core (Odoo Integrated Brand Suite)', 1, 12560.00, 12560.00, 1256.00, 2034.72, 13338.72]
  );

  // Record Payment for Invoice 1
  await db.query(
    `INSERT INTO payments (
      payment_number, invoice_id, customer_id, amount, payment_method, payment_date, transaction_reference, notes, recorded_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      'PAY-2026-0001', inv1Id, cust1Id, 13338.72, 'upi', lastMonth, 'UPI/AXIS/987162534', 'Full settlement received via UPI', staffId
    ]
  );

  // Invoice 2: Partially Paid Invoice (TechStart)
  const inv2 = await db.query(
    `INSERT INTO invoices (
      invoice_number, subscription_id, customer_id, invoice_date, billing_period_start, billing_period_end,
      due_date, subtotal, discount_amount, tax_amount, total_amount, amount_paid, outstanding_amount, status, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
    [
      'INV-2026-0002', null, cust2Id, pastDue, pastDue, nextMonth,
      today, 25000.00, 2500.00, 4050.00, 26550.00, 15000.00, 11550.00, 'confirmed', 'Onboarding & Migration Services'
    ]
  );
  const inv2Id = inv2.rows[0].id;

  await db.query(
    `INSERT INTO payments (
      payment_number, invoice_id, customer_id, amount, payment_method, payment_date, transaction_reference, notes, recorded_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      'PAY-2026-0002', inv2Id, cust2Id, 15000.00, 'bank_transfer', pastDue, 'NEFT/HDFC/882736192', 'Advance installment received', staffId
    ]
  );

  // Invoice 3: Overdue Invoice (RetailHub Ltd)
  await db.query(
    `INSERT INTO invoices (
      invoice_number, subscription_id, customer_id, invoice_date, billing_period_start, billing_period_end,
      due_date, subtotal, discount_amount, tax_amount, total_amount, amount_paid, outstanding_amount, status, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      'INV-2026-0003', null, cust3Id, pastDue, pastDue, today,
      pastDue, 18500.00, 0.00, 3330.00, 21830.00, 0.00, 21830.00, 'overdue', 'Software license subscription overdue'
    ]
  );

  // 11. Initial Notifications
  await db.query(
    `INSERT INTO notifications (user_id, customer_id, title, message, type, is_read, email_sent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [custUser1Id, cust1Id, 'Invoice Paid Successfully', 'Invoice INV-2026-0001 for ₹13,338.72 has been marked as fully paid.', 'payment_received', false, true]
  );

  await db.query(
    `INSERT INTO notifications (user_id, customer_id, title, message, type, is_read, email_sent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [custUser3Id, cust3Id, 'Subscription Renewal Notice', 'Your subscription SUB-2026-0003 is set to renew in 4 days. Please review payment terms.', 'renewal_reminder', false, true]
  );

  // 12. Automation Log Sample
  await db.query(
    `INSERT INTO automation_logs (job_name, status, processed_count, details)
     VALUES ($1, $2, $3, $4)`,
    ['DAILY_RECURRING_BILLING', 'success', 1, 'Initial system sync completed. 1 subscription ready for next billing cycle.']
  );

  console.log('[Seed] Brightloop Software demonstration seed data populated successfully!');
}

if (require.main === module) {
  db.initDb()
    .then(() => seedData())
    .then(() => {
      console.log('Seeding finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

module.exports = { seedData };
