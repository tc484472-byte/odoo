const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, planController.getPlans);
router.post('/', authenticateToken, authorizeRoles('admin'), planController.createPlan);
router.put('/:id', authenticateToken, authorizeRoles('admin'), planController.updatePlan);

module.exports = router;
