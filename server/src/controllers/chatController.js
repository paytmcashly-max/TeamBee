const prisma = require('../db/prisma');
const {
  broadcastChatAssignment,
  broadcastChatStatusTransition,
} = require('../services/socketService');

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
      const { role, id: agentId } = req.agent;
      const tenantId = req.tenantId;

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

      const chats = await prisma.chat.findMany({
        where: whereClause,
        include: {
          contact: true,
          assignedAgent: {
            select: { id: true, name: true, email: true, avatarUrl: true, role: true },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      return res.json({ success: true, chats });
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

      // RBAC check for standard agent
      if (role === 'AGENT') {
        const isMine = chat.assignedAgentId === agentId;
        const isUnassigned = chat.status === 'UNASSIGNED';
        if (!isMine && !isUnassigned) {
          return res.status(403).json({
            success: false,
            error: 'You do not have access to view this conversation',
          });
        }
      }

      // Mark unread count as 0 when viewed
      if (chat.unreadCount > 0) {
        await prisma.chat.update({
          where: { id: chat.id },
          data: { unreadCount: 0 },
        });
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

      const chat = await prisma.chat.findUnique({ where: { id } });
      if (!chat || chat.tenantId !== req.tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }

      // Permission check: Agents can only claim unassigned chats for themselves
      let targetAgentId = agentId;
      if (role === 'AGENT') {
        // Agent is "claiming" the chat for themselves
        targetAgentId = requesterAgentId;
      }

      let assignedAgent = null;
      let newStatus = chat.status;

      if (targetAgentId) {
        assignedAgent = await prisma.agent.findFirst({
          where: { id: targetAgentId, tenantId: req.tenantId },
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

      const updatedChat = await prisma.chat.update({
        where: { id },
        data: {
          assignedAgentId: targetAgentId || null,
          status: newStatus,
        },
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

      const updatedChat = await prisma.chat.update({
        where: { id },
        data: { status },
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
      const { tags } = req.body; // array of strings

      const chat = await prisma.chat.findUnique({ where: { id } });
      if (!chat || chat.tenantId !== req.tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
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
}

module.exports = ChatController;
