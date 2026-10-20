const prisma = require('../db/prisma');
const MetaApiService = require('../services/metaApiService');
const { broadcastNewMessage } = require('../services/socketService');
const { canAccessChat } = require('../middleware/authMiddleware');
const { prepareTemplateMessage } = require('../services/templateService');

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
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

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

      if (typeof chatId !== 'string' || typeof templateId !== 'string' ||
        !variables || typeof variables !== 'object' || Array.isArray(variables)) {
        return res.status(400).json({ success: false, error: 'chatId, templateId, and variables are required' });
      }

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { contact: true, tenant: true },
      });

       if (!chat || chat.tenantId !== tenantId || chat.contact?.tenantId !== tenantId || chat.tenant?.id !== tenantId) {
         return res.status(404).json({ success: false, error: 'Chat not found' });
       }
       if (!canAccessChat(req.agent, chat)) {
         return res.status(403).json({ success: false, error: 'Access denied' });
       }

      const template = await prisma.template.findUnique({
        where: { id: templateId },
      });

      if (!template || template.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      const variableValues = {};
      for (const [key, rawValue] of Object.entries(variables)) {
        if (rawValue !== undefined && rawValue !== null && typeof rawValue !== 'string' && typeof rawValue !== 'number') {
          return res.status(400).json({ success: false, error: 'Template variables must be strings or numbers' });
        }
        variableValues[key] = rawValue === undefined || rawValue === null ? rawValue : String(rawValue).slice(0, 1024);
      }
      const { renderedBody, components } = prepareTemplateMessage(template.bodyText, variableValues);

      const now = new Date();

      // Persist before dispatch so provider failures remain visible in the
      // transcript instead of disappearing from the outbound history.
      const pendingMessage = await prisma.message.create({
        data: {
          chatId: chat.id,
          tenantId: chat.tenantId,
          senderType: 'AGENT',
          senderId: agentId,
          messageType: 'TEMPLATE',
          content: renderedBody,
          rawPayload: JSON.stringify({ template: template.name, variables }),
          direction: 'OUTBOUND',
          status: 'PENDING',
          createdAt: now,
        },
        include: {
          senderAgent: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      let apiResult;
      try {
        apiResult = await MetaApiService.sendTemplateMessage(
          chat.tenant,
          chat.contact.waId,
          template.name,
          template.language,
          components
        );
      } catch (dispatchError) {
        apiResult = { success: false, error: dispatchError.message, code: 'META_API_ERROR' };
      }

      if (!apiResult || !apiResult.success) {
        const failedMessage = await prisma.message.update({
          where: { id: pendingMessage.id },
          data: {
            status: 'FAILED',
            errorCode: apiResult?.code || 'META_API_ERROR',
            errorMessage: apiResult?.error || 'Template delivery failed',
          },
          include: {
            senderAgent: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        });
        broadcastNewMessage(tenantId, chat.id, failedMessage, chat.assignedAgentId || agentId);
        return res.status(502).json({
          success: false,
          error: `Delivery failed: ${apiResult?.error || 'Unknown provider error'}`,
          message: failedMessage,
        });
      }

      const message = await prisma.message.update({
        where: { id: pendingMessage.id },
        data: {
          waMessageId: apiResult.wamid,
          status: 'SENT',
          errorCode: null,
          errorMessage: null,
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

}

module.exports = TemplateController;
