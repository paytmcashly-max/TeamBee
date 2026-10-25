const express = require('express');
const router = express.Router();
const BillingController = require('../controllers/billingController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/status', authenticateToken, BillingController.status);
router.post('/create-order', authenticateToken, requireRole('ADMIN'), BillingController.createOrder);

// Webhook is called by Razorpay, not by a logged-in user — it is
// authenticated by signature verification inside the controller.
router.post('/webhook', BillingController.webhook);

module.exports = router;
