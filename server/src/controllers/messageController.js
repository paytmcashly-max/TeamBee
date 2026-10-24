const prisma = require('../db/prisma');
const MetaApiService = require('../services/metaApiService');
const { decryptSecret } = require('../services/credentialCrypto');
const { broadcastNewMessage, broadcastNoteMentions } = require('../services/socketService');
const { canAccessChat } = require('../middleware/authMiddleware');

class MessageController {
  /**
   * GET /api/messages/:chatId: Fetch chronological message log for a chat
   */
  static async getMessages(req, res) {
    try {
      const { chatId } = req.params;
       const requestedLimit = Number.parseInt(req.query.limit || '100', 10);
       if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200) {
         return res.status(400).json({ success: false, error: 'limit must be between 1 and 200' });
       }

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { contact: true },
      });

       if (!chat || chat.tenantId !== req.tenantId || chat.contact?.tenantId !== req.tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }

      if (!canAccessChat(req.agent, chat)) {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }

       const requestedBefore = req.query.before;
       let messageWhere = { chatId };
       if (requestedBefore) {
         // Composite cursor "<iso>|<id>": inbound bursts share the same
         // second, so a bare timestamp cursor permanently skipped messages.
         // A legacy bare-ISO cursor keeps the old behaviour.
         const separatorIndex = requestedBefore.lastIndexOf('|');
         const datePart = separatorIndex >= 0 ? requestedBefore.slice(0, separatorIndex) : requestedBefore;
         const cursorId = separatorIndex >= 0 ? requestedBefore.slice(separatorIndex + 1) : null;
         const beforeDate = new Date(datePart);
         if (Number.isNaN(beforeDate.getTime())) {
           return res.status(400).json({ success: false, error: 'Invalid message cursor' });
         }
         if (cursorId) {
           messageWhere.OR = [
             { createdAt: { lt: beforeDate } },
             { createdAt: beforeDate, id: { lt: cursorId } },
           ];
         } else {
           messageWhere.createdAt = { lt: beforeDate };
         }
       }

       const messageRows = await prisma.message.findMany({
         where: messageWhere,
        include: {
          senderAgent: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
         orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
         take: requestedLimit + 1,
       });
       const hasMore = messageRows.length > requestedLimit;
       // Payload diet: a message's rawPayload is the full Meta webhook JSON
       // (kilobytes each). The client reads it only for INTERACTIVE button
       // pills and NOTE @mentions — strip it for every other type.
       const messages = (hasMore ? messageRows.slice(0, requestedLimit) : messageRows)
         .reverse()
         .map((message) =>
           message.messageType === 'INTERACTIVE' || message.messageType === 'NOTE'
             ? message
             : { ...message, rawPayload: undefined }
         );
       const nextBefore = hasMore && messages[0]
         ? `${messages[0].createdAt.toISOString()}|${messages[0].id}`
         : null;

      // Calculate if the 24-hour customer care messaging window is currently
      // open. A chat with no customer message yet has NO open window.
      let isWindowOpen = false;
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
        pagination: { hasMore, nextBefore },
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
        mentions = [],
        clientMessageId: rawClientMessageId,
      } = req.body;
      const { id: agentId, name: agentName, tenantId } = req.agent;
      const clientMessageId =
        typeof rawClientMessageId === 'string' && rawClientMessageId.trim().length <= 128
          ? rawClientMessageId.trim()
          : null;

       const allowedMessageTypes = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'NOTE'];
       if (typeof content !== 'undefined' && typeof content !== 'string') {
         return res.status(400).json({ success: false, error: 'content must be a string' });
       }
       if (typeof content === 'string' && content.length > 4096) {
         return res.status(400).json({ success: false, error: 'Message content is too long' });
       }
       if (typeof mediaUrl !== 'undefined' && mediaUrl !== null) {
         let parsedMediaUrl = null;
         try {
           parsedMediaUrl = typeof mediaUrl === 'string' ? new URL(mediaUrl) : null;
         } catch (parseError) {
           parsedMediaUrl = null;
         }
         if (
           typeof mediaUrl !== 'string' ||
           mediaUrl.length > 2048 ||
           !parsedMediaUrl ||
           parsedMediaUrl.protocol !== 'https:' ||
           !parsedMediaUrl.hostname ||
           parsedMediaUrl.username ||
           parsedMediaUrl.password
         ) {
           return res.status(400).json({ success: false, error: 'mediaUrl must be a valid HTTPS URL without embedded credentials' });
         }
       }
       if (typeof mediaFilename !== 'undefined' && mediaFilename !== null &&
         (typeof mediaFilename !== 'string' || mediaFilename.length > 255)) {
         return res.status(400).json({ success: false, error: 'Invalid media filename' });
       }
       if (!allowedMessageTypes.includes(messageType)) {
         return res.status(400).json({ success: false, error: 'Invalid message type' });
       }
       if (typeof forceSend !== 'boolean' || typeof isInternal !== 'boolean' || !Array.isArray(buttons)) {
         return res.status(400).json({ success: false, error: 'Invalid message options' });
       }
       if (!Array.isArray(mentions) || mentions.length > 10 || mentions.some((m) => typeof m !== 'string')) {
         return res.status(400).json({ success: false, error: 'Invalid mentions' });
       }
       if (buttons.length > 3 || buttons.some((button) => !button || typeof button !== 'object' ||
         (button.id !== undefined && (typeof button.id !== 'string' || button.id.length > 100)) ||
         (button.title !== undefined && (typeof button.title !== 'string' || button.title.length > 20)) ||
         (button.text !== undefined && (typeof button.text !== 'string' || button.text.length > 20)))) {
         return res.status(400).json({ success: false, error: 'Invalid interactive buttons' });
       }

       if (!content && !mediaUrl) {
         return res.status(400).json({ success: false, error: 'Message content or media attachment is required' });
       }
       if ((isInternal || messageType === 'NOTE') && (!content || !content.trim())) {
         return res.status(400).json({ success: false, error: 'Internal notes require text content' });
       }
       if (messageType === 'TEXT' && (!content || !content.trim())) {
         return res.status(400).json({ success: false, error: 'Text messages require content' });
       }
       if (messageType !== 'TEXT' && messageType !== 'NOTE' && !mediaUrl) {
         return res.status(400).json({ success: false, error: 'Media messages require an HTTPS attachment URL' });
       }

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { contact: true, tenant: true },
      });

        if (!chat || chat.tenantId !== tenantId || chat.contact?.tenantId !== tenantId || chat.tenant?.id !== tenantId) {
         return res.status(404).json({ success: false, error: 'Chat session not found' });
       }
        if (!canAccessChat(req.agent, chat)) {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }

       if (clientMessageId) {
         const existingMessage = await prisma.message.findFirst({
           where: { tenantId, clientMessageId },
           include: {
             senderAgent: {
               select: { id: true, name: true, avatarUrl: true },
             },
           },
         });
         if (existingMessage) {
           if (existingMessage.chatId !== chat.id) {
             return res.status(409).json({ success: false, error: 'clientMessageId was already used for another chat' });
           }
           return res.status(200).json({
             success: true,
             message: { ...existingMessage, clientMessageId },
             duplicate: true,
           });
         }
       }

       const now = new Date();

      // -------------------------------------------------------------
      // 1. PRIVATE INTERNAL TEAM NOTE (Bypasses Meta Cloud API)
      // -------------------------------------------------------------
      if (isInternal || messageType === 'NOTE') {
        // @mentions ride inside rawPayload (no schema change on the hot
        // messages table); ids are re-validated against the tenant so a
        // client can never mention another workspace's agent.
        let validMentionIds = [];
        if (mentions.length) {
          const mentionedAgents = await prisma.agent.findMany({
            where: { tenantId, id: { in: mentions } },
            select: { id: true },
          });
          validMentionIds = mentionedAgents.map((a) => a.id);
        }

        const noteMessage = await prisma.message.create({
          data: {
            chatId: chat.id,
            tenantId: chat.tenantId,
             senderType: 'NOTE',
             senderId: agentId,
             clientMessageId,
             messageType: 'NOTE',
            content,
            rawPayload: validMentionIds.length ? JSON.stringify({ mentions: validMentionIds }) : null,
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

        // Broadcast to active room. The non-persisted client ID lets the
        // browser reconcile this event with its optimistic note bubble.
        const responseMessage = clientMessageId ? { ...noteMessage, clientMessageId } : noteMessage;
        broadcastNewMessage(tenantId, chat.id, responseMessage, chat.assignedAgentId || agentId);

        const notifyIds = validMentionIds.filter((id) => id !== agentId);
        if (notifyIds.length) {
          broadcastNoteMentions(tenantId, chat.id, {
            authorName: agentName,
            contactName: chat.contact?.name || null,
            mentionedAgentIds: notifyIds,
            messageId: noteMessage.id,
          });
        }

        return res.status(201).json({
          success: true,
          message: responseMessage,
          isInternal: true,
        });
      }

      // Check the 24-hour window for EVERY outbound type (Meta rejects
      // free-form media outside the window too), not just text. A chat with
      // no customer message yet has no open window.
      const windowOpen = chat.lastCustomerMessageAt
        ? Date.now() - new Date(chat.lastCustomerMessageAt).getTime() < 24 * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        if (!forceSend) {
          return res.status(400).json({
            success: false,
            code: 'WINDOW_EXPIRED',
            error: 'The 24-hour WhatsApp customer reply window has expired. You must send an approved WhatsApp Template message to re-engage this customer.',
          });
        }
        if (!['ADMIN', 'SUPERVISOR'].includes(req.agent.role)) {
          return res.status(403).json({
            success: false,
            error: 'Only admins or supervisors can force-send outside the 24-hour window',
          });
        }
        console.warn(`[Send Message]: forceSend override by agent ${agentId} (${req.agent.role}) on chat ${chat.id} outside the 24h window`);
      }

      // -------------------------------------------------------------
      // 2. PERSIST A PENDING OUTBOUND MESSAGE BEFORE DISPATCH
      // -------------------------------------------------------------
      // Saving first guarantees that a provider timeout or a database error
      // after a successful API call does not erase the attempted delivery.
      const outboundMessageType = buttons && buttons.length > 0 ? 'INTERACTIVE' : messageType;
      const outboundContent = content || (mediaFilename ? `Attachment: ${mediaFilename}` : `[${messageType}]`);
      const pendingMessage = await prisma.message.create({
        data: {
          chatId: chat.id,
          tenantId: chat.tenantId,
           senderType: 'AGENT',
           senderId: agentId,
           clientMessageId,
           messageType: outboundMessageType,
          content: outboundContent,
          mediaUrl,
          mediaFilename,
          rawPayload: buttons && buttons.length > 0 ? JSON.stringify({ buttons }) : null,
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

      // -------------------------------------------------------------
      // 3. DISPATCH OUTBOUND MESSAGE VIA META CLOUD API
      // -------------------------------------------------------------
      let apiResult;
      try {
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
      } catch (dispatchError) {
        apiResult = {
          success: false,
          error: dispatchError.message || 'Meta Cloud API request failed',
          code: 'META_API_ERROR',
        };
      }

      if (!apiResult || !apiResult.success) {
        const failedMessage = await prisma.message.update({
          where: { id: pendingMessage.id },
          data: {
            status: 'FAILED',
            errorCode: apiResult?.code || 'META_API_ERROR',
            errorMessage: apiResult?.error || 'Meta Cloud API delivery failure',
          },
          include: {
            senderAgent: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        });
        const responseMessage = clientMessageId ? { ...failedMessage, clientMessageId } : failedMessage;
        broadcastNewMessage(tenantId, chat.id, responseMessage, chat.assignedAgentId || agentId);
        return res.status(502).json({
          success: false,
          error: `Meta Cloud API delivery failure: ${apiResult?.error || 'Unknown provider error'}`,
          code: apiResult?.code,
          message: responseMessage,
        });
      }

      // Complete the persisted record with the provider receipt.
      const messageRecord = await prisma.message.update({
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
      const message = clientMessageId ? { ...messageRecord, clientMessageId } : messageRecord;

      // Update chat preview; an outbound reply reopens UNASSIGNED/RESOLVED
      // conversations so the thread cannot sit closed while being worked.
      const newStatus = chat.status === 'UNASSIGNED' || chat.status === 'RESOLVED' ? 'OPEN' : chat.status;
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
      if (error?.code === 'P2002' && clientMessageId) {
        const existingMessage = await prisma.message.findFirst({
          where: { tenantId, clientMessageId },
          include: {
            senderAgent: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        });
        if (existingMessage) {
          return res.status(200).json({
            success: true,
            message: { ...existingMessage, clientMessageId },
            duplicate: true,
          });
        }
      }
      console.error('[Send Message Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to send outbound message' });
    }
  }

  /**
   * GET /api/media/:messageId: stream an inbound message's media.
   * Meta media URLs are short-lived and need the tenant token, so the binary
   * is proxied server-side after the same access check as reading the chat.
   */
  static async getMedia(req, res) {
    try {
      const { messageId } = req.params;
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { chat: true, tenant: true },
      });
      if (!message || message.tenantId !== req.tenantId || !message.mediaId) {
        return res.status(404).json({ success: false, error: 'Media not found' });
      }
      if (!canAccessChat(req.agent, message.chat)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const accessToken = decryptSecret(message.tenant.accessToken) || process.env.META_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(502).json({ success: false, error: 'WhatsApp access token is not configured for this workspace' });
      }
      const apiVersion = process.env.META_API_VERSION || 'v20.0';
      const lookup = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(message.mediaId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!lookup.ok) {
        return res.status(502).json({ success: false, error: 'Could not resolve media with Meta' });
      }
      const { url } = await lookup.json();
      if (!url) {
        return res.status(502).json({ success: false, error: 'Meta returned no media URL' });
      }
      const binary = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!binary.ok || !binary.body) {
        return res.status(502).json({ success: false, error: 'Could not download media from Meta' });
      }
      res.setHeader('Content-Type', binary.headers.get('content-type') || message.mediaMimeType || 'application/octet-stream');
      const contentLength = binary.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (message.mediaFilename) {
        res.setHeader('Content-Disposition', `inline; filename="${message.mediaFilename.replace(/"/g, '')}"`);
      }
      const { Readable } = require('stream');
      Readable.fromWeb(binary.body).pipe(res);
    } catch (error) {
      console.error('[Get Media Error]:', error);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: 'Failed to load media' });
      }
      res.end();
    }
  }
}

module.exports = MessageController;
