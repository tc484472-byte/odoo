const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, paymentController.getPayments);
router.post('/', authenticateToken, authorizeRoles('admin', 'staff'), paymentController.recordPayment);

module.exports = router;
