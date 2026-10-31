const db = require('../db');
const paymentController = require('../controllers/paymentController');
const notificationController = require('../controllers/notificationController');
const subscriptionController = require('../controllers/subscriptionController');
const planController = require('../controllers/planController');

function mockReqRes(body = {}, params = {}, query = {}, user = {}) {
  let statusCode = 200;
  let responseData = null;

  const req = {
    body,
    params,
    query,
    user,
    headers: {},
    ip: '127.0.0.1'
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };

  return { req, res };
}

async function runRazorpayTest() {
  console.log('=== STARTING RAZORPAY & CUSTOMER WORKFLOW TEST ===\n');
  await db.initDb();

  // Find customer user and linked customer record
  const custUserResult = await db.query("SELECT * FROM users WHERE role = 'customer' LIMIT 1");
  if (!custUserResult.rows.length) {
    throw new Error('No customer user found in seed DB');
  }
  const custUser = custUserResult.rows[0];
  console.log(`1. Using customer user: ID=${custUser.id}, Email=${custUser.email}`);

  // Fetch plans
  const { req: planReq, res: planRes } = mockReqRes({}, {}, {}, custUser);
  await planController.getPlans(planReq, planRes);
  const planData = planRes.getData();
  const plans = planData.plans || planData;
  if (!plans || !plans.length) {
    throw new Error('No plans found');
  }
  const plan = plans[0];
  console.log(`2. Fetched plans. Selected plan "${plan.name}" (ID: ${plan.id}, Price: ₹${plan.price})`);

  // Step 3: Create Razorpay Order
  console.log('3. Testing createRazorpayOrder...');
  const { req: orderReq, res: orderRes } = mockReqRes(
    {
      plan_id: plan.id,
      seats: 2,
      promo_code: 'WELCOME10',
      billing_interval: 'month'
    },
    {},
    {},
    custUser
  );
  await paymentController.createRazorpayOrder(orderReq, orderRes);
  if (orderRes.getStatusCode() !== 200) {
    throw new Error(`createRazorpayOrder failed with status ${orderRes.getStatusCode()}: ${JSON.stringify(orderRes.getData())}`);
  }
  const orderData = orderRes.getData();
  console.log('   Order created successfully:', {
    order_id: orderData.order_id,
    amount_in_paise: orderData.amount,
    currency: orderData.currency,
    breakdown: orderData.breakdown
  });

  // Step 4: Verify Razorpay Payment (New Subscription Provisioning)
  console.log('4. Testing verifyRazorpayPayment (New Subscription)...');
  const { req: verifyReq, res: verifyRes } = mockReqRes(
    {
      razorpay_order_id: orderData.order_id,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'test_signature_mock',
      plan_id: plan.id,
      seats: 2,
      notes: { channel: 'portal_checkout' }
    },
    {},
    {},
    custUser
  );
  await paymentController.verifyRazorpayPayment(verifyReq, verifyRes);
  if (verifyRes.getStatusCode() !== 201) {
    throw new Error(`verifyRazorpayPayment failed with status ${verifyRes.getStatusCode()}: ${JSON.stringify(verifyRes.getData())}`);
  }
  const verifyData = verifyRes.getData();
  const createdSub = verifyData.subscription;
  const createdInv = verifyData.invoice;
  console.log('   Payment verified and subscription created:', {
    subscription_id: createdSub.id,
    subscription_number: createdSub.subscription_number,
    status: createdSub.status,
    invoice_number: createdInv ? createdInv.invoice_number : null,
    invoice_status: createdInv ? createdInv.status : null
  });

  // Step 5: Test Customer Notifications
  console.log('5. Testing Notifications for Customer...');
  const { req: notifReq, res: notifRes } = mockReqRes({}, {}, {}, custUser);
  await notificationController.getNotifications(notifReq, notifRes);
  const notifData = notifRes.getData();
  console.log(`   Customer has ${notifData.notifications.length} notifications (${notifData.unreadCount} unread).`);
  if (notifData.notifications.length > 0) {
    const firstNotif = notifData.notifications[0];
    const { req: readReq, res: readRes } = mockReqRes({}, { id: firstNotif.id }, {}, custUser);
    await notificationController.markAsRead(readReq, readRes);
    console.log(`   Marked notification ${firstNotif.id} as read: Status = ${readRes.getStatusCode()}`);
  }

  // Step 6: Test Customer Permitted Subscription Actions (Pause / Resume)
  console.log('6. Testing Customer Subscription Status Transitions...');
  const { req: pauseReq, res: pauseRes } = mockReqRes({ status: 'paused' }, { id: createdSub.id }, {}, custUser);
  await subscriptionController.updateSubscriptionStatus(pauseReq, pauseRes);
  const pauseData = pauseRes.getData();
  if (pauseRes.getStatusCode() !== 200 || !pauseData.subscription || pauseData.subscription.status !== 'paused') {
    throw new Error(`Customer pause failed: ${pauseRes.getStatusCode()} ${JSON.stringify(pauseData)}`);
  }
  console.log('   6a. Subscription paused successfully: Status = paused');

  const { req: resumeReq, res: resumeRes } = mockReqRes({ status: 'active' }, { id: createdSub.id }, {}, custUser);
  await subscriptionController.updateSubscriptionStatus(resumeReq, resumeRes);
  const resumeData = resumeRes.getData();
  if (resumeRes.getStatusCode() !== 200 || !resumeData.subscription || resumeData.subscription.status !== 'active') {
    throw new Error(`Customer resume failed: ${resumeRes.getStatusCode()} ${JSON.stringify(resumeData)}`);
  }
  console.log('   6b. Subscription resumed successfully: Status = active');

  // Step 7: Test Razorpay Renewal Flow
  console.log('7. Testing Customer Razorpay Renewal Flow...');
  const { req: renewOrderReq, res: renewOrderRes } = mockReqRes(
    {
      isRenewal: true,
      subscription_id: createdSub.id
    },
    {},
    {},
    custUser
  );
  await paymentController.createRazorpayOrder(renewOrderReq, renewOrderRes);
  if (renewOrderRes.getStatusCode() !== 200) {
    throw new Error(`Renewal order creation failed: ${renewOrderRes.getStatusCode()}`);
  }
  const renewOrderData = renewOrderRes.getData();
  console.log('   7a. Renewal Order created:', renewOrderData.order_id, 'Amount:', renewOrderData.amount);

  const { req: renewVerifyReq, res: renewVerifyRes } = mockReqRes(
    {
      isRenewal: true,
      subscription_id: createdSub.id,
      razorpay_order_id: renewOrderData.order_id,
      razorpay_payment_id: `pay_renew_${Date.now()}`,
      razorpay_signature: 'test_renewal_sig'
    },
    {},
    {},
    custUser
  );
  await paymentController.verifyRazorpayPayment(renewVerifyReq, renewVerifyRes);
  if (renewVerifyRes.getStatusCode() !== 200) {
    throw new Error(`Renewal verification failed: ${renewVerifyRes.getStatusCode()} ${JSON.stringify(renewVerifyRes.getData())}`);
  }
  const renewVerifyData = renewVerifyRes.getData();
  console.log('   7b. Renewal confirmed & extended:', {
    subscription_id: renewVerifyData.subscription.id,
    new_next_billing_date: renewVerifyData.subscription.next_billing_date,
    renewal_invoice_number: renewVerifyData.invoice ? renewVerifyData.invoice.invoice_number : null
  });

  console.log('\n=== ALL RAZORPAY AND CUSTOMER SELF-SERVICE TESTS PASSED! ===');
  process.exit(0);
}

runRazorpayTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
