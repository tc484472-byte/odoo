const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, discountController.getDiscounts);
router.post('/validate', authenticateToken, discountController.validateDiscountCode);
router.post('/', authenticateToken, authorizeRoles('admin'), discountController.createDiscount);
router.patch('/:id/status', authenticateToken, authorizeRoles('admin'), discountController.toggleDiscount);

module.exports = router;
