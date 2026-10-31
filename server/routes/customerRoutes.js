const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, customerController.getCustomers);
router.get('/:id', authenticateToken, customerController.getCustomerById);
router.post('/', authenticateToken, authorizeRoles('admin', 'staff'), customerController.createCustomer);
router.put('/:id', authenticateToken, customerController.updateCustomer);

module.exports = router;
