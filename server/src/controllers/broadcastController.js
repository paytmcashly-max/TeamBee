const prisma = require('../db/prisma');
const MetaApiService = require('../services/metaApiService');
const { broadcastNewMessage } = require('../services/socketService');

class BroadcastController {
  /**
   * GET /api/broadcasts: List all broadcast campaigns for tenant
   */
  static async listBroadcasts(req, res) {
    try {
      const broadcasts = await prisma.broadcast.findMany({
        where: { tenantId: req.tenantId },
        include: {
          template: {
            select: { name: true, category: true, bodyText: true },
          },
          recipients: {
            take: 5,
            select: { phone: true, name: true, status: true, sentAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({ success: true, broadcasts });
    } catch (error) {
      console.error('[List Broadcasts Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to list broadcasts' });
    }
  }

  /**
   * POST /api/broadcasts: Launch a new WhatsApp template broadcast campaign
   */
  static async createBroadcast(req, res) {
    try {
      const { name, templateId, contactIds = [], variables = {} } = req.body;
      const tenantId = req.tenantId;
      const { id: agentId } = req.agent;

      if (!name || !templateId) {
        return res.status(400).json({ success: false, error: 'Campaign name and template are required' });
      }

      const template = await prisma.template.findUnique({
        where: { id: templateId },
      });

      if (!template || template.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      // Fetch target contacts
      const whereContacts = { tenantId };
      if (contactIds && contactIds.length > 0) {
        whereContacts.id = { in: contactIds };
      }

      const targetContacts = await prisma.contact.findMany({
        where: whereContacts,
      });

      if (targetContacts.length === 0) {
        return res.status(400).json({ success: false, error: 'No contacts selected or found for broadcast' });
      }

      // Fetch tenant details for Meta Cloud API credentials
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      // Create broadcast record
      const broadcast = await prisma.broadcast.create({
        data: {
          tenantId,
          templateId,
          name,
          totalCount: targetContacts.length,
          status: 'RUNNING',
        },
      });

      let sentCount = 0;
      let failedCount = 0;

      // Extract template variable count
      const matches = template.bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const expectedParamsCount = matches.length;

      // Process dispatch sequentially / micro-batched
      for (const contact of targetContacts) {
        let recipientStatus = 'PENDING';
        let errorMessage = null;
        let wamid = null;

        try {
          // Prepare parameters for this contact
          let renderedBody = template.bodyText;
          let components = [];

          if (expectedParamsCount > 0) {
            const parameters = [];
            for (let i = 1; i <= expectedParamsCount; i++) {
              let val = String(variables[i] || '');
              if (!val && i === 1 && contact.name) {
                val = contact.name;
              } else if (!val) {
                val = `Sample ${i}`;
              }
              renderedBody = renderedBody.replace(new RegExp(`\\{\\{${i}\\}\\}`, 'g'), val);
              parameters.push({ type: 'text', text: val });
            }
            components.push({
              type: 'body',
              parameters,
            });
          }

          // Dispatch via Meta API
          const apiResult = await MetaApiService.sendTemplateMessage(
            tenant,
            contact.waId,
            template.name,
            template.language,
            components
          );

          if (apiResult.success) {
            recipientStatus = 'SENT';
            wamid = apiResult.wamid;
            sentCount++;

            // Ensure Chat exists and log outbound message in conversation feed
            let chat = await prisma.chat.findFirst({
              where: { tenantId, contactId: contact.id },
            });

            const now = new Date();
            if (!chat) {
              chat = await prisma.chat.create({
                data: {
                  tenantId,
                  contactId: contact.id,
                  status: 'OPEN',
                  lastMessagePreview: renderedBody.slice(0, 80),
                  lastMessageAt: now,
                },
              });
            } else {
              await prisma.chat.update({
                where: { id: chat.id },
                data: {
                  lastMessagePreview: renderedBody.slice(0, 80),
                  lastMessageAt: now,
                },
              });
            }

            // Persist message record
            const newMsg = await prisma.message.create({
              data: {
                chatId: chat.id,
                tenantId,
                senderType: 'AGENT',
                senderId: agentId,
                waMessageId: wamid,
                messageType: 'TEMPLATE',
                content: renderedBody,
                direction: 'OUTBOUND',
                status: 'SENT',
                createdAt: now,
              },
            });

            // WebSocket broadcast for real-time inbox UI
            broadcastNewMessage(tenantId, chat.id, newMsg, chat.assignedAgentId);
          } else {
            recipientStatus = 'FAILED';
            errorMessage = apiResult.error;
            failedCount++;
          }
        } catch (err) {
          recipientStatus = 'FAILED';
          errorMessage = err.message;
          failedCount++;
        }

        // Create recipient log
        await prisma.broadcastRecipient.create({
          data: {
            broadcastId: broadcast.id,
            phone: contact.waId,
            name: contact.name,
            waMessageId: wamid,
            status: recipientStatus,
            errorMessage,
            sentAt: recipientStatus === 'SENT' ? new Date() : null,
          },
        });
      }

      // Mark broadcast complete
      const finalBroadcast = await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          sentCount,
          failedCount,
          status: 'COMPLETED',
        },
      });

      return res.status(201).json({
        success: true,
        broadcast: finalBroadcast,
        stats: { total: targetContacts.length, sent: sentCount, failed: failedCount },
      });
    } catch (error) {
      console.error('[Create Broadcast Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to launch broadcast campaign' });
    }
  }
}

module.exports = BroadcastController;
