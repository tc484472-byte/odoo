const db = require('../db');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const customerController = require('../controllers/customerController');
const billingService = require('../services/billingService');

async function runVerification() {
  console.log('=== STARTING VERIFICATION OF REPORTED ISSUES ===\n');
  await db.initDb();

  let passed = 0;
  let failed = 0;

  // Helper mock req/res
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

  // -------------------------------------------------------------
  // TEST 1: Customer Creation & Storage
  // -------------------------------------------------------------
  console.log('--- TEST 1: Customer Creation & Storage ---');
  try {
    const adminUser = { id: 1, email: 'admin@brightloop.io', role: 'admin' };
    const { req: createCustReq, res: createCustRes } = mockReqRes(
      {
        companyName: 'Acme Test Corp',
        contactName: 'Wile E. Coyote',
        email: `coyote_${Date.now()}@acme.com`,
        phone: '+91 9876543210',
        billingAddress: 'Desert Highway 66, Arizona',
        gstNumber: '29ABCDE1234F1Z5',
        password: 'Customer@Secure123'
      },
      {},
      {},
      adminUser
    );

    await customerController.createCustomer(createCustReq, createCustRes);
    const createData = createCustRes.getData();

    if (createCustRes.getStatusCode() === 201 && createData?.success && createData.customer?.id) {
      console.log(`[PASS] Customer created successfully with ID: ${createData.customer.id}, Company: ${createData.customer.company_name}`);
      passed++;
    } else {
      throw new Error(`Customer creation failed: status ${createCustRes.getStatusCode()}, data: ${JSON.stringify(createData)}`);
    }

    // Now verify customer is retrieved in getCustomers list
    const { req: listReq, res: listRes } = mockReqRes({}, {}, {}, adminUser);
    await customerController.getCustomers(listReq, listRes);
    const listData = listRes.getData();
    const found = listData.customers.find(c => c.company_name === 'Acme Test Corp');
    if (found) {
      console.log(`[PASS] Customer retrieved from database in customer directory. Verified!`);
      passed++;
    } else {
      throw new Error('Created customer not found in getCustomers query');
    }
  } catch (err) {
    console.error('[FAIL] Test 1 Error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TEST 2: Create Another Admin Account & Authenticate
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Create Another Administrator Account ---');
  try {
    const adminUser = { id: 1, email: 'admin@brightloop.io', role: 'admin' };
    const newAdminEmail = `superadmin_${Date.now()}@brightloop.io`;
    const newAdminPassword = 'AdminPassword@2026';

    const { req: createAdminReq, res: createAdminRes } = mockReqRes(
      {
        fullName: 'Secondary System Administrator',
        email: newAdminEmail,
        phone: '+91 9998887776',
        password: newAdminPassword,
        role: 'admin'
      },
      {},
      {},
      adminUser
    );

    await userController.createUser(createAdminReq, createAdminRes);
    const adminData = createAdminRes.getData();

    if (createAdminRes.getStatusCode() === 201 && adminData?.success && adminData.user?.role === 'admin') {
      console.log(`[PASS] New Administrator created: ID=${adminData.user.id}, Role=${adminData.user.role}, Email=${adminData.user.email}`);
      passed++;
    } else {
      throw new Error(`Admin creation failed: status ${createAdminRes.getStatusCode()}, data: ${JSON.stringify(adminData)}`);
    }

    // Verify the new Admin can log in
    const { req: loginReq, res: loginRes } = mockReqRes({
      email: newAdminEmail,
      password: newAdminPassword
    });

    await authController.login(loginReq, loginRes);
    const loginData = loginRes.getData();

    if (loginRes.getStatusCode() === 200 && loginData?.success && loginData.user?.role === 'admin' && loginData.token) {
      console.log(`[PASS] New Administrator logged in successfully with JWT token and role="admin". Verified!`);
      passed++;
    } else {
      throw new Error(`New Admin login failed: status ${loginRes.getStatusCode()}, data: ${JSON.stringify(loginData)}`);
    }
  } catch (err) {
    console.error('[FAIL] Test 2 Error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TEST 3: Automation Hub Expiry Check
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Automation Hub Check Expired Subscriptions ---');
  try {
    const result = await billingService.checkExpiredSubscriptions();
    console.log(`[PASS] checkExpiredSubscriptions() executed cleanly without error. Found: ${result.count} expired subscriptions.`);
    passed++;
  } catch (err) {
    console.error('[FAIL] Test 3 Error:', err.message);
    failed++;
  }

  console.log(`\n=== VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
