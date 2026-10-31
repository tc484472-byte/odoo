const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, productController.getProducts);
router.post('/', authenticateToken, authorizeRoles('admin'), productController.createProduct);
router.put('/:id', authenticateToken, authorizeRoles('admin'), productController.updateProduct);
router.post('/:productId/variants', authenticateToken, authorizeRoles('admin'), productController.addVariant);

module.exports = router;
