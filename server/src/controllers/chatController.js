const prisma = require('../db/prisma');
const {
  broadcastNewMessage,
  broadcastChatAssignment,
  broadcastChatStatusTransition,
  broadcastChatSnoozeChanged,
} = require('../services/socketService');
const { canAccessChat } = require('../middleware/authMiddleware');

function buildRoleVisibilityClause(role, agentId, filter) {
  if (role === 'AGENT') {
    if (filter === 'mine') return { assignedAgentId: agentId };
    if (filter === 'unassigned') return { status: 'UNASSIGNED' };
    return { OR: [{ assignedAgentId: agentId }, { status: 'UNASSIGNED' }] };
  }
  if (filter === 'mine') return { assignedAgentId: agentId };
  if (filter === 'unassigned') return { status: 'UNASSIGNED' };
  return null;
}

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

      const baseConditions = [{ tenantId }];

      // 1. SEARCH FILTERING (shared across tabs and list)
      if (search) {
        baseConditions.push({
          contact: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { waId: { contains: search } },
            ],
          },
        });
      }

      // 2. STRICT RBAC + TAB + STATUS INTERSECTION (AND ensures status never widens RBAC)
      const roleAllClause = buildRoleVisibilityClause(role, agentId, 'all');
      const activeRoleClause = buildRoleVisibilityClause(role, agentId, filter);
      const listConditions = [...baseConditions];
      if (activeRoleClause) listConditions.push(activeRoleClause);
      if (status && status !== 'ALL') {
        listConditions.push({ status });
      }

      if (cursor) {
        const separatorIndex = cursor.lastIndexOf('|');
        const cursorDatePart = separatorIndex >= 0 ? cursor.slice(0, separatorIndex) : cursor;
        const cursorId = separatorIndex >= 0 ? cursor.slice(separatorIndex + 1) : null;
        if (cursorDatePart === 'null') {
          if (!cursorId) {
            return res.status(400).json({ success: false, error: 'Invalid chat cursor' });
          }
          listConditions.push({ lastMessageAt: null, id: { lt: cursorId } });
        } else {
          const cursorDate = new Date(cursorDatePart);
          if (Number.isNaN(cursorDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid chat cursor' });
          }
          if (cursorId) {
            listConditions.push({
              OR: [
                { lastMessageAt: { lt: cursorDate } },
                { lastMessageAt: cursorDate, id: { lt: cursorId } },
              ],
            });
          } else {
            listConditions.push({ lastMessageAt: { lt: cursorDate } });
          }
        }
      }

      const allCountConditions = roleAllClause ? [...baseConditions, roleAllClause] : [...baseConditions];
      const unassignedCountConditions = roleAllClause
        ? [...baseConditions, roleAllClause, { status: 'UNASSIGNED' }]
        : [...baseConditions, { status: 'UNASSIGNED' }];
      const mineCountConditions = [...baseConditions, { assignedAgentId: agentId }];

      const [rows, allCount, unassignedCount, mineCount] = await req.db((db) =>
        Promise.all([
          db.chat.findMany({
            where: { AND: listConditions },
            include: {
              contact: true,
              assignedAgent: {
                select: { id: true, name: true, email: true, avatarUrl: true, role: true },
              },
            },
            orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
            take: requestedLimit + 1,
          }),
          db.chat.count({ where: { AND: allCountConditions } }),
          db.chat.count({ where: { AND: unassignedCountConditions } }),
          db.chat.count({ where: { AND: mineCountConditions } }),
        ])
      );
      const hasMore = rows.length > requestedLimit;
      const chats = hasMore ? rows.slice(0, requestedLimit) : rows;
      const lastRow = chats[chats.length - 1];
      const nextCursor = hasMore && lastRow
        ? `${lastRow.lastMessageAt ? lastRow.lastMessageAt.toISOString() : 'null'}|${lastRow.id}`
        : null;

      return res.json({
        success: true,
        chats,
        counts: {
          all: allCount,
          unassigned: unassignedCount,
          mine: mineCount,
        },
        pagination: { hasMore, nextCursor },
      });
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

      const chat = await req.db((db) =>
        db.chat.findUnique({
          where: { id },
          include: {
            contact: true,
            assignedAgent: {
              select: { id: true, name: true, email: true, avatarUrl: true, role: true },
            },
          },
        })
      );

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
        const cleared = await req.db((db) =>
          db.chat.updateMany({
            where: { id: chat.id, unreadCount: viewedCount },
            data: { unreadCount: 0 },
          })
        );
        if (cleared.count === 0) {
          await req.db(async (db) => {
            await db.chat.update({
              where: { id: chat.id },
              data: { unreadCount: { decrement: viewedCount } },
            });
            await db.chat.updateMany({
              where: { id: chat.id, unreadCount: { lt: 0 } },
              data: { unreadCount: 0 },
            });
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

      const chat = await req.db((db) => db.chat.findUnique({ where: { id } }));
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
       assignedAgent = await req.db((db) =>
         db.agent.findFirst({
           where: { id: targetAgentId, tenantId: req.tenantId, isActive: true },
         })
       );

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
      const claim = await req.db((db) =>
        db.chat.updateMany({
          where: { id, assignedAgentId: chat.assignedAgentId, status: chat.status },
          data: {
            assignedAgentId: targetAgentId || null,
            status: newStatus,
          },
        })
      );
      if (claim.count === 0) {
        return res.status(409).json({
          success: false,
          error: 'This conversation was just changed by someone else. Refresh and try again.',
        });
      }
      const updatedChat = await req.db((db) =>
        db.chat.findUnique({
          where: { id },
          include: {
            contact: true,
            assignedAgent: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        })
      );

      // Insert system message into chat transcript
      const systemNote = targetAgentId
        ? `Assigned to ${assignedAgent.name} by ${requesterName}`
        : `Unassigned by ${requesterName}`;

      const systemMessage = await req.db((db) =>
        db.message.create({
          data: {
            chatId: chat.id,
            tenantId: req.tenantId,
            senderType: 'SYSTEM',
            content: systemNote,
            direction: 'INBOUND',
            status: 'DELIVERED',
          },
        })
      );

      broadcastNewMessage(req.tenantId, chat.id, systemMessage, targetAgentId || null);

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

       const chat = await req.db((db) => db.chat.findUnique({ where: { id } }));
       if (!chat || chat.tenantId !== req.tenantId) {
         return res.status(404).json({ success: false, error: 'Chat not found' });
       }
       if (!canAccessChat(req.agent, chat)) {
         return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
       }

      const transition = await req.db((db) =>
        db.chat.updateMany({
          where: { id, status: chat.status },
          data: { status },
        })
      );
      if (transition.count === 0) {
        return res.status(409).json({
          success: false,
          error: 'This conversation was just changed by someone else. Refresh and try again.',
        });
      }
      const updatedChat = await req.db((db) =>
        db.chat.findUnique({
          where: { id },
          include: {
            contact: true,
            assignedAgent: true,
          },
        })
      );

      // System message
      const systemMessage = await req.db((db) =>
        db.message.create({
          data: {
            chatId: chat.id,
            tenantId: req.tenantId,
            senderType: 'SYSTEM',
            content: `Conversation marked as ${status} by ${agentName}`,
            direction: 'INBOUND',
            status: 'DELIVERED',
          },
        })
      );

      broadcastNewMessage(req.tenantId, chat.id, systemMessage, updatedChat.assignedAgentId);

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
   * PUT /api/chats/:id/snooze: snooze a chat until a future time, or clear
   * the snooze with { until: null }. Snoozed chats stay fully usable; the
   * inbox just badges them and the expiry sweep resurfaces them.
   */
  static async snoozeChat(req, res) {
    try {
      const { id } = req.params;
      const { until } = req.body || {};

      let snoozedUntil = null;
      if (until !== null && until !== undefined) {
        const parsed = new Date(until);
        const now = Date.now();
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now + 30_000) {
          return res.status(400).json({ success: false, error: 'Snooze time must be at least a minute in the future' });
        }
        if (parsed.getTime() > now + 30 * 24 * 60 * 60 * 1000) {
          return res.status(400).json({ success: false, error: 'Snooze time cannot be more than 30 days ahead' });
        }
        snoozedUntil = parsed;
      }

      const chat = await req.db((db) => db.chat.findUnique({ where: { id } }));
      if (!chat || chat.tenantId !== req.tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }
      if (!canAccessChat(req.agent, chat)) {
        return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
      }

      const updated = await req.db((db) =>
        db.chat.update({
          where: { id },
          data: {
            snoozedUntil,
            snoozedById: snoozedUntil ? req.agent.id : null,
          },
          select: { id: true, snoozedUntil: true, snoozedById: true, assignedAgentId: true },
        })
      );

      broadcastChatSnoozeChanged(req.tenantId, id, updated.snoozedUntil, updated.assignedAgentId);

      return res.json({
        success: true,
        chat: { id: updated.id, snoozedUntil: updated.snoozedUntil, snoozedById: updated.snoozedById },
      });
    } catch (error) {
      console.error('[Snooze Chat Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to update snooze' });
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

      const chat = await req.db((db) => db.chat.findUnique({ where: { id } }));
       if (!chat || chat.tenantId !== req.tenantId) {
         return res.status(404).json({ success: false, error: 'Chat not found' });
       }
       if (!canAccessChat(req.agent, chat)) {
         return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
       }

      const updated = await req.db((db) =>
        db.chat.update({
          where: { id },
          data: {
            tags: JSON.stringify(tags || []),
          },
        })
      );

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

       const chat = await req.db((db) =>
         db.chat.findUnique({
           where: { id },
           include: { contact: true },
         })
       );
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

      const updatedContact = await req.db((db) =>
        db.contact.update({
          where: { id: chat.contactId },
          data: updateData,
        })
      );

      return res.json({ success: true, contact: updatedContact });
    } catch (error) {
      console.error('[Update Contact Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to update contact' });
    }
  }

  /**
   * POST /api/chats/initiate: Start or open a 1-on-1 WhatsApp conversation by phone number
   */
  static async initiateChat(req, res) {
    try {
      const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone : '';
      const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
      const initialMessage = typeof req.body?.initialMessage === 'string' ? req.body.initialMessage.trim() : '';
      const { id: agentId, tenantId } = req.agent;

      const cleanPhone = rawPhone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 8 || cleanPhone.length > 20) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid phone number with country code (e.g. 919876543210)',
        });
      }

      let contact = await req.db((db) =>
        db.contact.findUnique({ where: { tenantId_waId: { tenantId, waId: cleanPhone } } })
      );
      if (!contact) {
        contact = await req.db((db) =>
          db.contact.create({ data: { tenantId, waId: cleanPhone, name: name || `+${cleanPhone}` } })
        );
      } else if (name && contact.name !== name) {
        contact = await req.db((db) =>
          db.contact.update({ where: { id: contact.id }, data: { name } })
        );
      }

      let chat = await req.db((db) =>
        db.chat.findFirst({
          where: { tenantId, contactId: contact.id },
          include: {
            contact: true,
            assignedAgent: { select: { id: true, name: true, avatarUrl: true, role: true } },
          },
        })
      );
      const now = new Date();
      if (!chat) {
        chat = await req.db((db) =>
          db.chat.create({
            data: {
              tenantId,
              contactId: contact.id,
              assignedAgentId: agentId,
              status: 'OPEN',
              lastMessagePreview: initialMessage || 'Conversation initiated by staff',
              lastMessageAt: now,
            },
            include: {
              contact: true,
              assignedAgent: { select: { id: true, name: true, avatarUrl: true, role: true } },
            },
          })
        );
      } else {
        chat = await req.db((db) =>
          db.chat.update({
            where: { id: chat.id },
            data: { status: 'OPEN', assignedAgentId: chat.assignedAgentId || agentId, lastMessageAt: now },
            include: {
              contact: true,
              assignedAgent: { select: { id: true, name: true, avatarUrl: true, role: true } },
            },
          })
        );
      }

      let sentMessage = null;
      if (initialMessage) {
        const tenant = await req.db((db) => db.tenant.findUnique({ where: { id: tenantId } }));
        const MetaApiService = require('../services/metaApiService');
        const apiResult = await MetaApiService.sendTextMessage(tenant, cleanPhone, initialMessage);
        sentMessage = await req.db((db) =>
          db.message.create({
            data: {
              chatId: chat.id,
              tenantId,
              senderType: 'AGENT',
              senderId: agentId,
              messageType: 'TEXT',
              content: initialMessage,
              direction: 'OUTBOUND',
              status: apiResult.success ? 'SENT' : 'FAILED',
              waMessageId: apiResult.wamid || null,
              errorCode: apiResult.success ? null : (apiResult.code || 'META_API_ERROR'),
              errorMessage: apiResult.success ? null : (apiResult.error || 'Failed to dispatch'),
            },
            include: { senderAgent: { select: { id: true, name: true, avatarUrl: true } } },
          })
        );
        await req.db((db) =>
          db.chat.update({ where: { id: chat.id }, data: { lastMessagePreview: initialMessage, lastMessageAt: new Date() } })
        );
        broadcastNewMessage(tenantId, chat.id, sentMessage, chat.assignedAgentId || agentId);
      }

      return res.status(201).json({ success: true, chat, message: sentMessage });
    } catch (error) {
      console.error('[Initiate Chat Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to initiate conversation' });
    }
  }
}

module.exports = ChatController;
