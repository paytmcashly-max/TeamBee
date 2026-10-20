const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authLimiter, registrationLimiter } = require('../middleware/rateLimit');

router.post('/login', authLimiter, AuthController.login);
router.post('/register-tenant', registrationLimiter, AuthController.registerTenant);
router.get('/me', authenticateToken, AuthController.getMe);
router.post('/logout', AuthController.logout);

module.exports = router;
