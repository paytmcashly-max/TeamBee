const WebhookParserService = require('../services/webhookParserService');
const prisma = require('../db/prisma');

class WebhookController {
  /**
   * GET /webhook: Meta Cloud API Webhook Verification Handshake
   * Meta sends hub.mode, hub.verify_token, and hub.challenge
   */
  static async verify(req, res) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log(`[Webhook Handshake Attempt]: mode=${mode}, token=${token}`);

      if (mode && token) {
        if (mode === 'subscribe') {
          // Check if token matches any tenant's webhook_verify_token or default env
          const tenant = await prisma.tenant.findFirst({
            where: {
              webhookVerifyToken: token,
            },
          });

          const defaultVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'chatflow_webhook_verify_token_2026';

          if (tenant || token === defaultVerifyToken) {
            console.log('✅ [Webhook Handshake Verified]: Challenge accepted');
            return res.status(200).send(challenge);
          } else {
            console.warn(`❌ [Webhook Handshake Denied]: Token mismatch for token: ${token}`);
            return res.status(403).json({ error: 'Verification token mismatch' });
          }
        }
      }

      return res.status(400).json({ error: 'Missing hub.mode or hub.verify_token' });
    } catch (error) {
      console.error('[Webhook Verification Error]:', error);
      return res.status(500).json({ error: 'Internal server error during handshake' });
    }
  }

  /**
   * POST /webhook: Ingest live WhatsApp Cloud API payloads
   */
  static async ingest(req, res) {
    // Respond HTTP 200 immediately to prevent Meta webhook retries
    res.status(200).send('EVENT_RECEIVED');

    try {
      const payload = req.body;
      const signature = req.headers['x-hub-signature-256'];

      // Process asynchronously in background
      const result = await WebhookParserService.processWebhookPayload(payload);
      if (!result.success) {
        console.warn('[Webhook Ingestion Notice]:', result.reason);
      } else {
        console.log(
          `[Webhook Ingested]: ${result.results.processedMessages} message(s), ${result.results.processedStatuses} status update(s)`
        );
      }
    } catch (error) {
      console.error('[Webhook Ingestion Error]:', error);
    }
  }
}

module.exports = WebhookController;
