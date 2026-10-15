const prisma = require('../db/prisma');
const MetaApiService = require('../services/metaApiService');
const { broadcastNewMessage } = require('../services/socketService');

class MessageController {
  /**
   * GET /api/messages/:chatId: Fetch chronological message log for a chat
   */
  static async getMessages(req, res) {
    try {
      const { chatId } = req.params;
      const { limit = 100 } = req.query;

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { contact: true },
      });

      if (!chat || chat.tenantId !== req.tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }

      // Check RBAC for standard agent
      if (req.agent.role === 'AGENT') {
        const isMine = chat.assignedAgentId === req.agent.id;
        const isUnassigned = chat.status === 'UNASSIGNED';
        if (!isMine && !isUnassigned) {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }
      }

      const messages = await prisma.message.findMany({
        where: { chatId },
        include: {
          senderAgent: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: parseInt(limit, 10),
      });

      // Calculate if the 24-hour customer care messaging window is currently open
      let isWindowOpen = true;
      let windowExpiresAt = null;

      if (chat.lastCustomerMessageAt) {
        const lastMsgTime = new Date(chat.lastCustomerMessageAt).getTime();
        const expiresTime = lastMsgTime + 24 * 60 * 60 * 1000;
        windowExpiresAt = new Date(expiresTime);
        isWindowOpen = Date.now() < expiresTime;
      }

      return res.json({
        success: true,
        messages,
        messagingWindow: {
          isOpen: isWindowOpen,
          expiresAt: windowExpiresAt,
          hoursRemaining: windowExpiresAt ? Math.max(0, ((windowExpiresAt - Date.now()) / (1000 * 60 * 60)).toFixed(1)) : 0,
        },
      });
    } catch (error) {
      console.error('[Get Messages Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve messages' });
    }
  }

  /**
   * POST /api/messages/:chatId: Send outbound message to customer via WhatsApp
   */
  static async sendMessage(req, res) {
    try {
      const { chatId } = req.params;
      const {
        content,
        messageType = 'TEXT',
        mediaUrl,
        mediaFilename,
        forceSend = false,
        isInternal = false,
        buttons = [],
      } = req.body;
      const { id: agentId, name: agentName, tenantId } = req.agent;

      if (!content && !mediaUrl) {
        return res.status(400).json({ success: false, error: 'Message content or media attachment is required' });
      }

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { contact: true, tenant: true },
      });

      if (!chat || chat.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Chat session not found' });
      }

      const now = new Date();

      // -------------------------------------------------------------
      // 1. PRIVATE INTERNAL TEAM NOTE (Bypasses Meta Cloud API)
      // -------------------------------------------------------------
      if (isInternal || messageType === 'NOTE') {
        const noteMessage = await prisma.message.create({
          data: {
            chatId: chat.id,
            tenantId: chat.tenantId,
            senderType: 'NOTE',
            senderId: agentId,
            messageType: 'NOTE',
            content,
            direction: 'OUTBOUND',
            status: 'DELIVERED',
            createdAt: now,
          },
          include: {
            senderAgent: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        });

        // Update chat preview with lock emoji
        await prisma.chat.update({
          where: { id: chat.id },
          data: {
            lastMessagePreview: `🔒 Internal Note: ${content.slice(0, 40)}`,
            lastMessageAt: now,
          },
        });

        // Broadcast to active room
        broadcastNewMessage(tenantId, chat.id, noteMessage, chat.assignedAgentId || agentId);

        return res.status(201).json({
          success: true,
          message: noteMessage,
          isInternal: true,
        });
      }

      // Check 24-hour window SLA
      if (chat.lastCustomerMessageAt && !forceSend) {
        const lastMsgTime = new Date(chat.lastCustomerMessageAt).getTime();
        const isWindowOpen = Date.now() - lastMsgTime < 24 * 60 * 60 * 1000;
        if (!isWindowOpen && messageType === 'TEXT') {
          return res.status(400).json({
            success: false,
            code: 'WINDOW_EXPIRED',
            error: 'The 24-hour WhatsApp customer reply window has expired. You must send an approved WhatsApp Template message to re-engage this customer.',
          });
        }
      }

      // -------------------------------------------------------------
      // 2. DISPATCH OUTBOUND MESSAGE VIA META CLOUD API
      // -------------------------------------------------------------
      let apiResult;
      if (buttons && Array.isArray(buttons) && buttons.length > 0) {
        apiResult = await MetaApiService.sendInteractiveButtons(chat.tenant, chat.contact.waId, content, buttons);
      } else if (messageType === 'TEXT') {
        apiResult = await MetaApiService.sendTextMessage(chat.tenant, chat.contact.waId, content);
      } else {
        apiResult = await MetaApiService.sendMediaMessage(chat.tenant, chat.contact.waId, {
          type: messageType,
          mediaUrl,
          caption: content,
          filename: mediaFilename,
        });
      }

      if (!apiResult.success) {
        return res.status(502).json({
          success: false,
          error: `Meta Cloud API delivery failure: ${apiResult.error}`,
          code: apiResult.code,
        });
      }

      // Persist outbound message in database
      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          tenantId: chat.tenantId,
          senderType: 'AGENT',
          senderId: agentId,
          waMessageId: apiResult.wamid,
          messageType: buttons && buttons.length > 0 ? 'INTERACTIVE' : messageType,
          content: content || (mediaFilename ? `Attachment: ${mediaFilename}` : `[${messageType}]`),
          mediaUrl,
          mediaFilename,
          rawPayload: buttons && buttons.length > 0 ? JSON.stringify({ buttons }) : null,
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

      // Update chat preview & bump status to OPEN if it was UNASSIGNED
      const newStatus = chat.status === 'UNASSIGNED' ? 'OPEN' : chat.status;
      const newAssignedAgentId = chat.assignedAgentId || agentId;

      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          lastMessagePreview: message.content,
          lastMessageAt: now,
          status: newStatus,
          assignedAgentId: newAssignedAgentId,
        },
      });

      // Broadcast real-time message via Socket.io
      broadcastNewMessage(tenantId, chat.id, message, newAssignedAgentId);

      return res.status(201).json({
        success: true,
        message,
        wamid: apiResult.wamid,
        isMock: apiResult.isMock || false,
      });
    } catch (error) {
      console.error('[Send Message Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to send outbound message' });
    }
  }
}

module.exports = MessageController;
