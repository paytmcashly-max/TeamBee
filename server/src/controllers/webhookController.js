const crypto = require('crypto');
const WebhookParserService = require('../services/webhookParserService');
const prisma = require('../db/prisma');
const { decryptSecret, hashSecret } = require('../services/credentialCrypto');

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

       if (mode === 'subscribe' && typeof token === 'string' && typeof challenge === 'string' && challenge.length <= 2048) {
         const tenant = await prisma.tenant.findFirst({
           where: {
             OR: [
               { webhookVerifyTokenHash: hashSecret(token) },
               { webhookVerifyToken: token },
             ],
           },
         });
         const configuredGlobalToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
         const globalTokenMatches = configuredGlobalToken && timingSafeEqualStrings(token, configuredGlobalToken);

         if (tenant || globalTokenMatches) {
           console.log('[Webhook Handshake Verified]: Challenge accepted');
           return res.status(200).send(challenge);
         }

         return res.status(403).json({ error: 'Verification token mismatch' });
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
    try {
      const payload = req.body;
      const signature = req.headers['x-hub-signature-256'];
      const isAuthentic = await WebhookController.verifyRequest(payload, req.rawBody, signature);
      if (!isAuthentic) {
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }

       const payloadHash = crypto.createHash('sha256').update(req.rawBody).digest('hex');
       const tenants = await Promise.all(payload.entry.map((entry) => WebhookParserService.resolveTenant(entry)));
       const tenantIds = [...new Set(tenants.filter(Boolean).map((tenant) => tenant.id))];
       const event = await prisma.webhookEvent.upsert({
         where: { payloadHash },
         update: {},
         create: {
           payloadHash,
           payload: JSON.stringify(payload),
           tenantId: tenantIds.length === 1 ? tenantIds[0] : null,
         },
       });

      // A valid Meta request is acknowledged only after durable persistence.
      res.status(200).send('EVENT_RECEIVED');

      setImmediate(() => WebhookParserService.processStoredWebhookEvent(event.id)
        .then((result) => {
          if (!result?.success) console.warn('[Webhook Ingestion Notice]:', result?.reason);
        })
        .catch((error) => console.error('[Webhook Ingestion Error]:', error)));
      } catch (error) {
       console.error('[Webhook Ingestion Error]:', error);
       if (!res.headersSent) {
         return res.status(400).json({ success: false, error: 'Invalid webhook request' });
       }
     }
  }

  static async verifyRequest(payload, rawBody, signature) {
    if (!rawBody || !payload || !Array.isArray(payload.entry) || payload.entry.length === 0) return false;

    const tenants = await Promise.all(payload.entry.map((entry) => WebhookParserService.resolveTenant(entry)));
    if (tenants.some((tenant) => !tenant)) return false;

    const configuredGlobalSecret = process.env.META_APP_SECRET || process.env.APP_SECRET;
    if (configuredGlobalSecret) {
      return WebhookParserService.verifySignature(rawBody, signature, configuredGlobalSecret);
    }

    const tenantSecrets = [...new Set(tenants.map((tenant) => decryptSecret(tenant.appSecret)).filter(Boolean))];
    return tenantSecrets.length === 1 && WebhookParserService.verifySignature(rawBody, signature, tenantSecrets[0]);
  }
}

function timingSafeEqualStrings(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = WebhookController;
