const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, paymentController.getPayments);
router.post('/', authenticateToken, authorizeRoles('admin', 'staff'), paymentController.recordPayment);

// Razorpay Self-Service & Renewal endpoints
router.post('/razorpay/order', authenticateToken, paymentController.createRazorpayOrder);
router.post('/razorpay/verify', authenticateToken, paymentController.verifyRazorpayPayment);

module.exports = router;
