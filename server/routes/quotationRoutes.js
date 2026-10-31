const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, quotationController.getQuotations);
router.get('/:id', authenticateToken, quotationController.getQuotationById);
router.post('/', authenticateToken, authorizeRoles('admin', 'staff'), quotationController.createQuotation);
router.post('/:id/confirm', authenticateToken, authorizeRoles('admin', 'staff'), quotationController.confirmQuotation);

module.exports = router;
