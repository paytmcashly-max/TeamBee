'use strict';

const express = require('express');
const router = express.Router();
const CommerceController = require('../controllers/commerceController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/products', authenticateToken, CommerceController.listProducts);
router.post('/products', authenticateToken, CommerceController.saveProduct);
router.delete('/products/:id', authenticateToken, CommerceController.deleteProduct);

router.get('/settings', authenticateToken, CommerceController.getSettings);
router.put('/settings', authenticateToken, CommerceController.updateSettings);

router.post('/payment-link', authenticateToken, CommerceController.generatePaymentLink);
router.post('/send-product/:chatId', authenticateToken, CommerceController.sendProductToChat);
router.post('/send-payment/:chatId', authenticateToken, CommerceController.sendPaymentRequest);

module.exports = router;
