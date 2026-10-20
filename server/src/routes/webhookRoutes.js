const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhookController');
const { webhookLimiter } = require('../middleware/rateLimit');

// Meta Cloud API Webhook handshake
router.get('/', WebhookController.verify);

// Meta Cloud API Webhook payload ingestion
router.post('/', webhookLimiter, WebhookController.ingest);

module.exports = router;
