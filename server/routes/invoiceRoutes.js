const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, invoiceController.getInvoices);
router.get('/:id', authenticateToken, invoiceController.getInvoiceById);
router.post('/', authenticateToken, authorizeRoles('admin', 'staff'), invoiceController.createInvoice);
router.patch('/:id/status', authenticateToken, authorizeRoles('admin', 'staff'), invoiceController.updateInvoiceStatus);

module.exports = router;
