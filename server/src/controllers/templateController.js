const prisma = require('../db/prisma');
const MetaApiService = require('../services/metaApiService');
const { broadcastNewMessage } = require('../services/socketService');

class TemplateController {
  /**
   * GET /api/templates: List all stored WhatsApp templates for tenant
   */
  static async listTemplates(req, res) {
    try {
      const templates = await prisma.template.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { name: 'asc' },
      });
      return res.json({ success: true, templates });
    } catch (error) {
      console.error('[List Templates Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to list templates' });
    }
  }

  /**
   * POST /api/templates/sync: Pull latest approved templates from Meta Cloud API
   */
  static async syncTemplates(req, res) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });

      const metaRes = await MetaApiService.fetchMetaTemplates(tenant);
      if (!metaRes.success) {
        return res.status(400).json({
          success: false,
          error: `Meta sync failed: ${metaRes.error || metaRes.reason}`,
        });
      }

      const synced = [];
      for (const tpl of metaRes.templates) {
        // Find body text component
        const bodyComp = (tpl.components || []).find((c) => c.type === 'BODY');
        const headerComp = (tpl.components || []).find((c) => c.type === 'HEADER');
        const footerComp = (tpl.components || []).find((c) => c.type === 'FOOTER');
        const buttonsComp = (tpl.components || []).find((c) => c.type === 'BUTTONS');

        const record = await prisma.template.upsert({
          where: {
            tenantId_name_language: {
              tenantId: tenant.id,
              name: tpl.name,
              language: tpl.language,
            },
          },
          update: {
            status: tpl.status,
            category: tpl.category,
            bodyText: bodyComp?.text || '',
            headerType: headerComp?.format || 'NONE',
            headerContent: headerComp?.text || null,
            footerText: footerComp?.text || null,
            buttons: JSON.stringify(buttonsComp?.buttons || []),
          },
          create: {
            tenantId: tenant.id,
            name: tpl.name,
            language: tpl.language,
            status: tpl.status,
            category: tpl.category,
            bodyText: bodyComp?.text || '',
            headerType: headerComp?.format || 'NONE',
            headerContent: headerComp?.text || null,
            footerText: footerComp?.text || null,
            buttons: JSON.stringify(buttonsComp?.buttons || []),
          },
        });
        synced.push(record);
      }

      return res.json({ success: true, count: synced.length, templates: synced });
    } catch (error) {
      console.error('[Sync Templates Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to sync templates with Meta' });
    }
  }

  /**
   * POST /api/templates/send: Send a single template message to contact/chat with dynamic variable mapping
   */
  static async sendTemplate(req, res) {
    try {
      const { chatId, templateId, variables = {} } = req.body;
      const { id: agentId, tenantId } = req.agent;

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { contact: true, tenant: true },
      });

      if (!chat || chat.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }

      const template = await prisma.template.findUnique({
        where: { id: templateId },
      });

      if (!template || template.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      // Check if template body actually expects parameters (e.g. {{1}}, {{2}})
      const matches = template.bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const expectedParamsCount = matches.length;

      let renderedBody = template.bodyText;
      let components = [];

      if (expectedParamsCount > 0) {
        const parameters = [];
        for (let i = 1; i <= expectedParamsCount; i++) {
          const val = String(variables[i] || `Sample ${i}`);
          renderedBody = renderedBody.replace(new RegExp(`\\{\\{${i}\\}\\}`, 'g'), val);
          parameters.push({ type: 'text', text: val });
        }
        components.push({
          type: 'body',
          parameters,
        });
      }

      // Send via Meta Cloud API
      const apiResult = await MetaApiService.sendTemplateMessage(
        chat.tenant,
        chat.contact.waId,
        template.name,
        template.language,
        components
      );

      if (!apiResult.success) {
        return res.status(502).json({ success: false, error: `Delivery failed: ${apiResult.error}` });
      }

      const now = new Date();

      // Persist as outbound message
      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          tenantId: chat.tenantId,
          senderType: 'AGENT',
          senderId: agentId,
          waMessageId: apiResult.wamid,
          messageType: 'TEMPLATE',
          content: renderedBody,
          rawPayload: JSON.stringify({ template: template.name, variables }),
          direction: 'OUTBOUND',
          status: 'SENT',
          createdAt: now,
        },
        include: {
          senderAgent: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      // Update chat session
      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          lastMessagePreview: `📋 Template: ${template.name}`,
          lastMessageAt: now,
          status: chat.status === 'UNASSIGNED' ? 'OPEN' : chat.status,
          assignedAgentId: chat.assignedAgentId || agentId,
        },
      });

      // Broadcast real-time update
      broadcastNewMessage(tenantId, chat.id, message, chat.assignedAgentId || agentId);

      return res.status(201).json({ success: true, message, wamid: apiResult.wamid });
    } catch (error) {
      console.error('[Send Template Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to send template message' });
    }
  }

  /**
   * GET /api/broadcasts: List bulk campaigns
   */
  static async listBroadcasts(req, res) {
    try {
      const broadcasts = await prisma.broadcast.findMany({
        where: { tenantId: req.tenantId },
        include: {
          template: true,
          _count: { select: { recipients: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ success: true, broadcasts });
    } catch (error) {
      console.error('[List Broadcasts Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to load broadcasts' });
    }
  }

  /**
   * POST /api/broadcasts: Trigger bulk campaign to opt-in customer list
   */
  static async createBroadcast(req, res) {
    try {
      const { name, templateId, recipients } = req.body; // recipients: [{ phone, name }]
      const tenantId = req.tenantId;

      if (!name || !templateId || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ success: false, error: 'Broadcast name, template, and recipients are required' });
      }

      const template = await prisma.template.findUnique({ where: { id: templateId } });
      if (!template || template.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

      const broadcast = await prisma.broadcast.create({
        data: {
          tenantId,
          templateId,
          name,
          totalCount: recipients.length,
          status: 'RUNNING',
        },
      });

      // Asynchronously dispatch messages
      (async () => {
        let sent = 0;
        let failed = 0;

        for (const r of recipients) {
          const apiResult = await MetaApiService.sendTemplateMessage(
            tenant,
            r.phone,
            template.name,
            template.language
          );

          await prisma.broadcastRecipient.create({
            data: {
              broadcastId: broadcast.id,
              phone: r.phone,
              name: r.name || null,
              waMessageId: apiResult.wamid || null,
              status: apiResult.success ? 'SENT' : 'FAILED',
              errorMessage: apiResult.error || null,
              sentAt: apiResult.success ? new Date() : null,
            },
          });

          if (apiResult.success) sent++;
          else failed++;
        }

        await prisma.broadcast.update({
          where: { id: broadcast.id },
          data: {
            sentCount: sent,
            failedCount: failed,
            status: 'COMPLETED',
          },
        });
      })().catch((e) => console.error('Broadcast runner error:', e));

      return res.status(201).json({
        success: true,
        broadcast,
        message: `Campaign initiated for ${recipients.length} recipients`,
      });
    } catch (error) {
      console.error('[Create Broadcast Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to create broadcast campaign' });
    }
  }
}

module.exports = TemplateController;
