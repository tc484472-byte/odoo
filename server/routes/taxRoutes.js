const express = require('express');
const router = express.Router();
const taxController = require('../controllers/taxController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, taxController.getTaxes);
router.post('/', authenticateToken, authorizeRoles('admin'), taxController.createTax);
router.patch('/:id/status', authenticateToken, authorizeRoles('admin'), taxController.toggleTax);

module.exports = router;
