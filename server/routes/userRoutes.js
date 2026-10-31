const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Admin only: view users, create admin or staff accounts, toggle status
router.get('/', authenticateToken, authorizeRoles('admin'), userController.getUsers);
router.post('/', authenticateToken, authorizeRoles('admin'), userController.createUser);
router.post('/staff', authenticateToken, authorizeRoles('admin'), userController.createUser);
router.patch('/:id/status', authenticateToken, authorizeRoles('admin'), userController.toggleUserStatus);

module.exports = router;
