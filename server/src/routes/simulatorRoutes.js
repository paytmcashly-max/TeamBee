const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const WebhookParserService = require('../services/webhookParserService');
const prisma = require('../db/prisma');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

/**
 * POST /api/simulator/simulate-inbound:
 * Generates an authentic Meta Cloud API webhook payload and pipes it through the WebhookParserService
 */
router.post('/simulate-inbound', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), async (req, res) => {
  try {
    const {
      senderPhone = '919876543210',
      senderName = 'Aarav Patel',
      messageType = 'text',
      text = 'Namaste, what are the batch timings and fee structure for the NEET dropper course?',
      mediaUrl = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop',
      caption = 'Prescription / Report copy',
    } = req.body;

     const tenant = await req.db((db) => db.tenant.findUnique({ where: { id: req.tenantId } }));
     if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
     if (typeof senderPhone !== 'string' || typeof senderName !== 'string' || typeof messageType !== 'string' ||
       typeof text !== 'string' || typeof caption !== 'string' || typeof mediaUrl !== 'string') {
       return res.status(400).json({ success: false, error: 'Invalid simulator payload' });
     }
     const cleanPhone = senderPhone.replace(/\D/g, '');
     if (!cleanPhone || cleanPhone.length > 32 || senderName.length > 120 || text.length > 4096 || caption.length > 1024) {
       return res.status(400).json({ success: false, error: 'Invalid simulator input length' });
     }
     if (!['text', 'image', 'document', 'interactive'].includes(messageType)) {
       return res.status(400).json({ success: false, error: 'Invalid simulator message type' });
     }
    const wamid = `wamid.HBgL${uuidv4().replace(/-/g, '').slice(0, 20)}INBOUND`;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Construct standard Meta WhatsApp Cloud API payload format
    let messageBody = {};
    if (messageType === 'text') {
      messageBody = {
        type: 'text',
        text: { body: text },
      };
    } else if (messageType === 'image') {
      messageBody = {
        type: 'image',
        image: {
          id: `media_${uuidv4().slice(0, 8)}`,
          mime_type: 'image/jpeg',
          caption: caption || 'Sample attachment',
          url: mediaUrl,
        },
      };
    } else if (messageType === 'document') {
      messageBody = {
        type: 'document',
        document: {
          id: `doc_${uuidv4().slice(0, 8)}`,
          filename: 'Course_Brochure_2026.pdf',
          mime_type: 'application/pdf',
          caption: caption || 'Course details document',
        },
      };
    } else if (messageType === 'interactive') {
      messageBody = {
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: {
            id: 'btn_book_demo',
            title: 'Book Free Demo Class',
          },
        },
      };
    }

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: tenant.wabaId || 'WABA_1092837465',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: tenant.displayPhoneNumber || '+91 98765 00000',
                  phone_number_id: tenant.phoneNumberId || 'PHONE_ID_12345',
                },
                contacts: [
                  {
                    profile: { name: senderName },
                    wa_id: cleanPhone,
                  },
                ],
                messages: [
                  {
                    from: cleanPhone,
                    id: wamid,
                    timestamp,
                    ...messageBody,
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await WebhookParserService.processWebhookPayload(payload);

    return res.json({
      success: true,
      message: 'Simulated Meta inbound payload processed successfully',
      wamid,
      result,
    });
  } catch (error) {
    console.error('[Simulator Inbound Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to simulate inbound webhook' });
  }
});

/**
 * POST /api/simulator/simulate-status:
 * Simulates Meta delivery receipt (SENT -> DELIVERED -> READ)
 */
router.post('/simulate-status', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), async (req, res) => {
  try {
    const { waMessageId, status = 'READ' } = req.body;
    const normalizedStatus = String(status).toUpperCase();

     if (typeof status !== 'string' || typeof waMessageId !== 'string' || !waMessageId || waMessageId.length > 255 ||
       !['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(normalizedStatus)) {
       return res.status(400).json({ success: false, error: 'waMessageId is required' });
     }

     const tenant = await req.db((db) => db.tenant.findUnique({ where: { id: req.tenantId } }));
     if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

     // Never use a hard-coded recipient or accept a WAMID from another
     // tenant. Resolve the actual persisted outbound target before creating
     // the simulated Meta callback.
     const outboundMessage = await req.db((db) =>
       db.message.findFirst({
         where: {
           waMessageId,
           tenantId: req.tenantId,
           direction: 'OUTBOUND',
         },
         include: { chat: { include: { contact: true } } },
       })
     );
     const broadcastRecipient = outboundMessage
       ? null
       : await req.db((db) =>
           db.broadcastRecipient.findFirst({
             where: {
               waMessageId,
               broadcast: { tenantId: req.tenantId },
             },
           })
         );
     const recipientId = outboundMessage?.chat?.contact?.waId || broadcastRecipient?.phone;
     if (!recipientId) {
       return res.status(404).json({ success: false, error: 'Outbound message not found for this tenant' });
     }

     const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: tenant.wabaId || 'WABA_1092837465',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: tenant.phoneNumberId || 'PHONE_ID_12345',
                },
                statuses: [
                  {
                   id: waMessageId,
                    status: normalizedStatus.toLowerCase(),
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    recipient_id: recipientId,
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await WebhookParserService.processWebhookPayload(payload);

    return res.json({
      success: true,
      message: `Status transitioned to ${normalizedStatus}`,
      result,
    });
  } catch (error) {
    console.error('[Simulator Status Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to simulate delivery status' });
  }
});

module.exports = router;
