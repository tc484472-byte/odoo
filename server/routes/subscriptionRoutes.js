const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, subscriptionController.getSubscriptions);
router.get('/:id', authenticateToken, subscriptionController.getSubscriptionById);
router.post('/', authenticateToken, authorizeRoles('admin', 'staff'), subscriptionController.createSubscription);
router.post('/:id/status', authenticateToken, authorizeRoles('admin', 'staff'), subscriptionController.updateSubscriptionStatus);

module.exports = router;
