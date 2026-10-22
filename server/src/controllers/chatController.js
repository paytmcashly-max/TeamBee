const prisma = require('../db/prisma');
const {
  broadcastChatAssignment,
  broadcastChatStatusTransition,
} = require('../services/socketService');
const { canAccessChat } = require('../middleware/authMiddleware');

class ChatController {
  /**
   * GET /api/chats: List chats with strict role-based access filtering
   * Query params:
   *  - filter: 'mine' | 'unassigned' | 'all'
   *  - status: 'UNASSIGNED' | 'OPEN' | 'RESOLVED' | 'ALL'
   *  - search: customer name or phone query
   */
  static async listChats(req, res) {
    try {
        const { filter = 'all', status = 'ALL', search = '' } = req.query;
        const requestedLimit = Number.parseInt(req.query.limit || '100', 10);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
       const { role, id: agentId } = req.agent;
       const tenantId = req.tenantId;

       if (!['mine', 'unassigned', 'all'].includes(filter) || !['UNASSIGNED', 'OPEN', 'RESOLVED', 'ALL'].includes(status)) {
         return res.status(400).json({ success: false, error: 'Invalid chat filter' });
       }
        if (typeof search !== 'string' || search.length > 100) {
          return res.status(400).json({ success: false, error: 'Invalid search query' });
        }
        if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
          return res.status(400).json({ success: false, error: 'limit must be between 1 and 100' });
        }

      const whereClause = {
        tenantId,
      };

      // 1. ROLE-BASED ACCESS CONTROL FILTERING
       if (role === 'AGENT') {
        // Regular Agents can ONLY see chats assigned to them OR in the global unassigned pool
        if (filter === 'mine') {
          whereClause.assignedAgentId = agentId;
        } else if (filter === 'unassigned') {
          whereClause.status = 'UNASSIGNED';
        } else {
          // If viewing general feed, combine assigned to me OR unassigned
          whereClause.OR = [
            { assignedAgentId: agentId },
            { status: 'UNASSIGNED' },
          ];
        }
      } else {
        // ADMIN / SUPERVISOR: Complete operational visibility
        if (filter === 'mine') {
          whereClause.assignedAgentId = agentId;
        } else if (filter === 'unassigned') {
          whereClause.status = 'UNASSIGNED';
        }
        // If filter === 'all', no restriction on assigned agent
      }

      // 2. STATUS FILTERING
      if (status && status !== 'ALL') {
        whereClause.status = status;
      }

      // 3. SEARCH FILTERING
      if (search) {
        whereClause.contact = {
          OR: [
            { name: { contains: search } },
            { waId: { contains: search } },
          ],
        };
      }

      // filter and status INTERSECT: the old code let the status parameter
      // silently overwrite the unassigned-queue restriction, widening what
      // an AGENT-role caller could list.
      if (whereClause.status && status && status !== 'ALL' && whereClause.status !== status) {
        return res.json({ success: true, chats: [], pagination: { hasMore: false, nextCursor: null } });
      }

      if (cursor) {
        // Composite cursor "<iso>|<id>": Meta timestamps repeat at second
        // precision, so a bare timestamp cursor skips tied rows. A legacy
        // bare-ISO cursor keeps the old strict-less-than behaviour.
        const separatorIndex = cursor.lastIndexOf('|');
        const cursorDatePart = separatorIndex >= 0 ? cursor.slice(0, separatorIndex) : cursor;
        const cursorId = separatorIndex >= 0 ? cursor.slice(separatorIndex + 1) : null;
        if (cursorDatePart === 'null') {
          if (!cursorId) {
            return res.status(400).json({ success: false, error: 'Invalid chat cursor' });
          }
          whereClause.lastMessageAt = null;
          whereClause.id = { lt: cursorId };
        } else {
          const cursorDate = new Date(cursorDatePart);
          if (Number.isNaN(cursorDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid chat cursor' });
          }
          if (cursorId) {
            const cursorCondition = {
              OR: [
                { lastMessageAt: { lt: cursorDate } },
                { lastMessageAt: cursorDate, id: { lt: cursorId } },
              ],
            };
            whereClause.AND = [...(whereClause.AND || []), cursorCondition];
          } else {
            whereClause.lastMessageAt = { lt: cursorDate };
          }
        }
      }

      const rows = await prisma.chat.findMany({
        where: whereClause,
        include: {
          contact: true,
          assignedAgent: {
            select: { id: true, name: true, email: true, avatarUrl: true, role: true },
          },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        take: requestedLimit + 1,
      });
      const hasMore = rows.length > requestedLimit;
      const chats = hasMore ? rows.slice(0, requestedLimit) : rows;
      const lastRow = chats[chats.length - 1];
      const nextCursor = hasMore && lastRow
        ? `${lastRow.lastMessageAt ? lastRow.lastMessageAt.toISOString() : 'null'}|${lastRow.id}`
        : null;

      return res.json({ success: true, chats, pagination: { hasMore, nextCursor } });
    } catch (error) {
      console.error('[List Chats Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to load conversations' });
    }
  }

  /**
   * GET /api/chats/:id: Retrieve single chat session details with permissions verification
   */
  static async getChatById(req, res) {
    try {
      const { id } = req.params;
      const { role, id: agentId } = req.agent;

      const chat = await prisma.chat.findUnique({
        where: { id },
        include: {
          contact: true,
          assignedAgent: {
            select: { id: true, name: true, email: true, avatarUrl: true, role: true },
          },
        },
      });

      if (!chat || chat.tenantId !== req.tenantId) {
        return res.status(404).json({ success: false, error: 'Conversation session not found' });
      }

       if (!canAccessChat(req.agent, chat)) {
         return res.status(403).json({
           success: false,
           error: 'You do not have access to view this conversation',
         });
      }

      // Clear only the unread messages this view actually saw: an
      // unconditional set-to-0 erased messages that arrived while the chat
      // was being opened (and one agent's view cleared everyone's badge).
      if (chat.unreadCount > 0) {
        const viewedCount = chat.unreadCount;
        const cleared = await prisma.chat.updateMany({
          where: { id: chat.id, unreadCount: viewedCount },
          data: { unreadCount: 0 },
        });
        if (cleared.count === 0) {
          await prisma.chat.update({
            where: { id: chat.id },
            data: { unreadCount: { decrement: viewedCount } },
          });
          await prisma.chat.updateMany({
            where: { id: chat.id, unreadCount: { lt: 0 } },
            data: { unreadCount: 0 },
          });
        }
        chat.unreadCount = 0;
      }

      return res.json({ success: true, chat });
    } catch (error) {
      console.error('[Get Chat Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve chat session' });
    }
  }

  /**
   * PUT /api/chats/:id/assign: Manually route / re-assign chat to an agent or claim it
   */
  static async assignChat(req, res) {
    try {
       const { id } = req.params;
       const { agentId } = req.body; // Can be specific agent ID or null to unassign
       const { role, id: requesterAgentId, name: requesterName } = req.agent;

       if (agentId !== undefined && agentId !== null && typeof agentId !== 'string') {
         return res.status(400).json({ success: false, error: 'agentId must be a string or null' });
       }

      const chat = await prisma.chat.findUnique({ where: { id } });
      if (!chat || chat.tenantId !== req.tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }

       if (!canAccessChat(req.agent, chat)) {
         return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
       }

       // Standard agents can only claim an unassigned conversation for themselves.
       let targetAgentId = agentId;
       if (role === 'AGENT') {
         if (chat.assignedAgentId && chat.assignedAgentId !== requesterAgentId) {
           return res.status(403).json({ success: false, error: 'You cannot reassign another agent\'s conversation' });
         }
         targetAgentId = requesterAgentId;
       }

      let assignedAgent = null;
      let newStatus = chat.status;

      if (targetAgentId) {
       assignedAgent = await prisma.agent.findFirst({
           where: { id: targetAgentId, tenantId: req.tenantId, isActive: true },
        });

        if (!assignedAgent) {
          return res.status(400).json({ success: false, error: 'Assigned agent does not exist in tenant' });
        }
        // Moving from UNASSIGNED to OPEN when assigned
        if (chat.status === 'UNASSIGNED') {
          newStatus = 'OPEN';
        }
      } else {
        // Unassigning
        newStatus = 'UNASSIGNED';
      }

      // Compare-and-swap on the state read above: two agents claiming the
      // same chat concurrently must not both succeed silently.
      const claim = await prisma.chat.updateMany({
        where: { id, assignedAgentId: chat.assignedAgentId, status: chat.status },
        data: {
          assignedAgentId: targetAgentId || null,
          status: newStatus,
        },
      });
      if (claim.count === 0) {
        return res.status(409).json({
          success: false,
          error: 'This conversation was just changed by someone else. Refresh and try again.',
        });
      }
      const updatedChat = await prisma.chat.findUnique({
        where: { id },
        include: {
          contact: true,
          assignedAgent: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      // Insert system message into chat transcript
      const systemNote = targetAgentId
        ? `Assigned to ${assignedAgent.name} by ${requesterName}`
        : `Unassigned by ${requesterName}`;

      await prisma.message.create({
        data: {
          chatId: chat.id,
          tenantId: req.tenantId,
          senderType: 'SYSTEM',
          content: systemNote,
          direction: 'INBOUND',
          status: 'DELIVERED',
        },
      });

      // Broadcast assignment via WebSockets
      broadcastChatAssignment(req.tenantId, chat.id, {
        assignedAgentId: targetAgentId || null,
        previousAssignedAgentId: chat.assignedAgentId,
        assignedAgentName: assignedAgent ? assignedAgent.name : null,
        status: newStatus,
      });

      return res.json({ success: true, chat: updatedChat });
    } catch (error) {
      console.error('[Assign Chat Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to assign conversation' });
    }
  }

  /**
   * PUT /api/chats/:id/status: Transition lifecycle state (UNASSIGNED, OPEN, RESOLVED)
   */
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'OPEN' | 'RESOLVED' | 'UNASSIGNED'
      const { id: agentId, name: agentName } = req.agent;

      if (!['UNASSIGNED', 'OPEN', 'RESOLVED'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid chat status' });
      }

       const chat = await prisma.chat.findUnique({ where: { id } });
       if (!chat || chat.tenantId !== req.tenantId) {
         return res.status(404).json({ success: false, error: 'Chat not found' });
       }
       if (!canAccessChat(req.agent, chat)) {
         return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
       }

      const transition = await prisma.chat.updateMany({
        where: { id, status: chat.status },
        data: { status },
      });
      if (transition.count === 0) {
        return res.status(409).json({
          success: false,
          error: 'This conversation was just changed by someone else. Refresh and try again.',
        });
      }
      const updatedChat = await prisma.chat.findUnique({
        where: { id },
        include: {
          contact: true,
          assignedAgent: true,
        },
      });

      // System message
      await prisma.message.create({
        data: {
          chatId: chat.id,
          tenantId: req.tenantId,
          senderType: 'SYSTEM',
          content: `Conversation marked as ${status} by ${agentName}`,
          direction: 'INBOUND',
          status: 'DELIVERED',
        },
      });

      // WebSocket broadcast
      broadcastChatStatusTransition(req.tenantId, chat.id, {
        status,
        updatedBy: agentName,
        assignedAgentId: updatedChat.assignedAgentId,
      });

      return res.json({ success: true, chat: updatedChat });
    } catch (error) {
      console.error('[Update Status Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to update conversation status' });
    }
  }

  /**
   * PUT /api/chats/:id/tags: Update custom tags and notes
   */
  static async updateTags(req, res) {
    try {
      const { id } = req.params;
       const { tags } = req.body;

       if (!Array.isArray(tags) || tags.length > 50 || tags.some((tag) => typeof tag !== 'string' || tag.length > 80)) {
         return res.status(400).json({ success: false, error: 'tags must be an array of short strings' });
       }

      const chat = await prisma.chat.findUnique({ where: { id } });
       if (!chat || chat.tenantId !== req.tenantId) {
         return res.status(404).json({ success: false, error: 'Chat not found' });
       }
       if (!canAccessChat(req.agent, chat)) {
         return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
       }

      const updated = await prisma.chat.update({
        where: { id },
        data: {
          tags: JSON.stringify(tags || []),
        },
      });

      return res.json({ success: true, tags: JSON.parse(updated.tags) });
    } catch (error) {
      console.error('[Update Tags Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to update tags' });
    }
  }

  /**
   * PUT /api/chats/:id/contact: Update contact name, email, and custom CRM attributes
   */
  static async updateContact(req, res) {
    try {
      const { id } = req.params;
      const { name, email, customAttributes } = req.body;

       const chat = await prisma.chat.findUnique({
         where: { id },
         include: { contact: true },
       });
       if (!chat || chat.tenantId !== req.tenantId || chat.contact?.tenantId !== req.tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }
      if (!canAccessChat(req.agent, chat)) {
        return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
      }

       const updateData = {};
       if (name !== undefined && (typeof name !== 'string' || name.length > 120)) {
         return res.status(400).json({ success: false, error: 'Invalid contact name' });
       }
       if (email !== undefined && (typeof email !== 'string' || email.length > 320)) {
         return res.status(400).json({ success: false, error: 'Invalid contact email' });
       }
       if (name !== undefined) updateData.name = name.trim();
       if (email !== undefined) updateData.email = email.trim().toLowerCase();
       if (customAttributes !== undefined) {
         if (typeof customAttributes === 'string') {
           if (customAttributes.length > 5000) {
             return res.status(400).json({ success: false, error: 'Custom attributes are too long' });
           }
           try {
             const parsedAttributes = JSON.parse(customAttributes);
             if (!parsedAttributes || typeof parsedAttributes !== 'object' || Array.isArray(parsedAttributes)) {
               return res.status(400).json({ success: false, error: 'customAttributes must be a JSON object' });
             }
           } catch (error) {
             return res.status(400).json({ success: false, error: 'customAttributes must be valid JSON' });
           }
           updateData.customAttributes = customAttributes;
         } else if (customAttributes && typeof customAttributes === 'object' && !Array.isArray(customAttributes)) {
           const serializedAttributes = JSON.stringify(customAttributes);
           if (serializedAttributes.length > 5000) {
             return res.status(400).json({ success: false, error: 'Custom attributes are too long' });
           }
           updateData.customAttributes = serializedAttributes;
         } else {
           return res.status(400).json({ success: false, error: 'customAttributes must be an object or JSON object' });
         }
       }

      const updatedContact = await prisma.contact.update({
        where: { id: chat.contactId },
        data: updateData,
      });

      return res.json({ success: true, contact: updatedContact });
    } catch (error) {
      console.error('[Update Contact Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to update contact' });
    }
  }
}

module.exports = ChatController;
