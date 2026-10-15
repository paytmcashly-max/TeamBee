const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhookController');

// Meta Cloud API Webhook handshake
router.get('/', WebhookController.verify);

// Meta Cloud API Webhook payload ingestion
router.post('/', WebhookController.ingest);

module.exports = router;
