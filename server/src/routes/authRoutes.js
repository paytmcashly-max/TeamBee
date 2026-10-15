const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/login', AuthController.login);
router.post('/register-tenant', AuthController.registerTenant);
router.get('/me', authenticateToken, AuthController.getMe);

module.exports = router;
