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

      // Prune local rows Meta no longer returns: a template deleted or
      // replaced on Meta must not linger in the picker and fail at send time.
      const metaKeys = new Set(metaRes.templates.map((tpl) => `${tpl.name}::${tpl.language}`));
      const localTemplates = await prisma.template.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, name: true, language: true },
      });
      const staleIds = localTemplates
        .filter((tpl) => !metaKeys.has(`${tpl.name}::${tpl.language}`))
        .map((tpl) => tpl.id);
      if (staleIds.length > 0) {
        await prisma.template.deleteMany({ where: { id: { in: staleIds }, tenantId: tenant.id } });
      }

      return res.json({ success: true, count: synced.length, removed: staleIds.length, templates: synced });
    } catch (error) {
      console.error('[Sync Templates Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to sync templates with Meta' });
    }
  }

  /**
   * POST /api/templates: Create a template on Meta for review (ADMIN).
   * Meta decides approval; the local row is stored immediately with the
   * status Meta returns (usually PENDING) and reconciled by /sync.
   */
  static async createTemplate(req, res) {
    try {
      const {
        name,
        language = 'en_US',
        category = 'UTILITY',
        bodyText,
        bodyExamples = [],
        headerText = '',
        footerText = '',
        quickReplies = [],
        urlButton = null,
      } = req.body || {};

      // ---- Validation (mirror Meta's rules so failures are caught here
      // with a readable message instead of a cryptic Graph error) ----
      if (!name || !/^[a-z0-9_]+$/.test(name)) {
        return res.status(400).json({
          success: false,
          error: 'Template name must use only lowercase letters, numbers and underscores (e.g. demo_class_reminder).',
        });
      }
      if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language)) {
        return res.status(400).json({ success: false, error: 'Invalid language code (e.g. en_US, hi).' });
      }
      if (!['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(category)) {
        return res.status(400).json({ success: false, error: 'Category must be UTILITY, MARKETING or AUTHENTICATION.' });
      }
      if (!bodyText || !bodyText.trim()) {
        return res.status(400).json({ success: false, error: 'Template body text is required.' });
      }
      if (bodyText.length > 1024) {
        return res.status(400).json({ success: false, error: 'Template body must be 1024 characters or fewer.' });
      }
      if (/\{\{|\}\}/.test(headerText) || /\{\{|\}\}/.test(footerText)) {
        return res.status(400).json({ success: false, error: 'Variables are not supported in the header or footer in this form.' });
      }
      if (footerText.length > 60) {
        return res.status(400).json({ success: false, error: 'Footer must be 60 characters or fewer.' });
      }
      if (headerText.length > 60) {
        return res.status(400).json({ success: false, error: 'Header text must be 60 characters or fewer.' });
      }

      // Variables must be sequential {{1}}..{{n}} and every one needs an
      // example value — Meta rejects the submission otherwise.
      const varNumbers = [...new Set([...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
      const sequential = varNumbers.every((n, i) => n === i + 1);
      if (!sequential) {
        return res.status(400).json({
          success: false,
          error: 'Body variables must be sequential: {{1}}, {{2}}, {{3}}… with no gaps or repeats out of order.',
        });
      }
      if (varNumbers.length > 0 && (!Array.isArray(bodyExamples) || bodyExamples.length !== varNumbers.length || bodyExamples.some((e) => !String(e).trim()))) {
        return res.status(400).json({
          success: false,
          error: `This body has ${varNumbers.length} variable(s) — provide one example value for each (Meta needs them for review).`,
        });
      }

      const cleanQuickReplies = (Array.isArray(quickReplies) ? quickReplies : [])
        .map((t) => String(t || '').trim())
        .filter(Boolean)
        .slice(0, 3);
      if (cleanQuickReplies.some((t) => t.length > 25)) {
        return res.status(400).json({ success: false, error: 'Quick-reply button text must be 25 characters or fewer.' });
      }

      // ---- Build Meta components ----
      const components = [];
      if (headerText.trim()) {
        components.push({ type: 'HEADER', format: 'TEXT', text: headerText.trim() });
      }
      const bodyComponent = { type: 'BODY', text: bodyText.trim() };
      if (varNumbers.length > 0) {
        bodyComponent.example = { body_text: [bodyExamples.map((e) => String(e).trim())] };
      }
      components.push(bodyComponent);
      if (footerText.trim()) {
        components.push({ type: 'FOOTER', text: footerText.trim() });
      }
      const metaButtons = [
        ...cleanQuickReplies.map((text) => ({ type: 'QUICK_REPLY', text })),
        ...(urlButton?.text && urlButton?.url
          ? [{ type: 'URL', text: String(urlButton.text).trim().slice(0, 25), url: String(urlButton.url).trim() }]
          : []),
      ];
      if (metaButtons.length > 0) {
        components.push({ type: 'BUTTONS', buttons: metaButtons });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      const metaRes = await MetaApiService.createMetaTemplate(tenant, {
        name,
        language,
        category,
        components,
      });
      if (!metaRes.success) {
        return res.status(400).json({
          success: false,
          error: `Meta rejected the template: ${metaRes.error || metaRes.reason}`,
        });
      }

      const record = await prisma.template.upsert({
        where: { tenantId_name_language: { tenantId: tenant.id, name, language } },
        update: {
          status: metaRes.template?.status || 'PENDING',
          category,
          bodyText: bodyText.trim(),
          headerType: headerText.trim() ? 'TEXT' : 'NONE',
          headerContent: headerText.trim() || null,
          footerText: footerText.trim() || null,
          buttons: JSON.stringify(metaButtons),
        },
        create: {
          tenantId: tenant.id,
          name,
          language,
          status: metaRes.template?.status || 'PENDING',
          category,
          bodyText: bodyText.trim(),
          headerType: headerText.trim() ? 'TEXT' : 'NONE',
          headerContent: headerText.trim() || null,
          footerText: footerText.trim() || null,
          buttons: JSON.stringify(metaButtons),
        },
      });

      return res.status(201).json({ success: true, template: record });
    } catch (error) {
      console.error('[Create Template Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to create template' });
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

      if (template.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          error: `Template "${template.name}" is not approved by Meta (status: ${template.status}). Sync templates and choose an approved one.`,
        });
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
