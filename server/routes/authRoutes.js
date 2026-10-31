const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validatePasswordMiddleware, validateEmailMiddleware } = require('../middleware/validate');

router.post('/register', validateEmailMiddleware, validatePasswordMiddleware, authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', validatePasswordMiddleware, authController.resetPassword);

module.exports = router;
