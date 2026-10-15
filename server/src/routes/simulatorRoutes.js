const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const WebhookParserService = require('../services/webhookParserService');
const prisma = require('../db/prisma');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * POST /api/simulator/simulate-inbound:
 * Generates an authentic Meta Cloud API webhook payload and pipes it through the WebhookParserService
 */
router.post('/simulate-inbound', authenticateToken, async (req, res) => {
  try {
    const {
      senderPhone = '919876543210',
      senderName = 'Aarav Patel',
      messageType = 'text',
      text = 'Namaste, what are the batch timings and fee structure for the NEET dropper course?',
      mediaUrl = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop',
      caption = 'Prescription / Report copy',
    } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    const cleanPhone = senderPhone.replace(/\D/g, '');
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/simulator/simulate-status:
 * Simulates Meta delivery receipt (SENT -> DELIVERED -> READ)
 */
router.post('/simulate-status', authenticateToken, async (req, res) => {
  try {
    const { waMessageId, status = 'READ' } = req.body;

    if (!waMessageId) {
      return res.status(400).json({ success: false, error: 'waMessageId is required' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });

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
                    status: status.toLowerCase(),
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    recipient_id: '919876543210',
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
      message: `Status transitioned to ${status}`,
      result,
    });
  } catch (error) {
    console.error('[Simulator Status Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
