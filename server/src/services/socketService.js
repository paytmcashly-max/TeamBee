const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const prisma = require('../db/prisma');
const { withTenantDb, rlsContextEnabled } = require('../db/withTenant');

async function tenantDb(tenantId, fn) {
  return rlsContextEnabled() ? withTenantDb(tenantId, (tx) => fn(tx)) : fn(prisma);
}
const { verifyAccessToken, canAccessChat, readCookie } = require('../middleware/authMiddleware');

let io = null;
let redisClients = [];
// Track online socket count per agent: agentId -> Set of socketIds
const onlineAgents = new Map();

/**
 * Initialize Socket.io with HTTP server and configure security middleware
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // =========================================================================
  // COMPLEX SOCKET.IO CUSTOM AUTHENTICATION MIDDLEWARE
  // =========================================================================
  io.use(async (socket, next) => {
    try {
      // 1. Extract Bearer token from auth payload or query/headers
      let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

      if (typeof token !== 'string' || token === 'null' || token === 'undefined') {
        token = readCookie(socket.handshake.headers?.cookie, 'chatflow_session');
      }
      if (!token) return next(new Error('AUTHENTICATION_ERROR: Token missing from handshake'));

      if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }

      // 2. Cryptographic signature and expiration verification
      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new Error('AUTHENTICATION_ERROR: Session expired. Please login again.'));
        }
        return next(new Error('AUTHENTICATION_ERROR: Invalid authentication signature'));
      }

      // 3. Database lookup for agent status & tenant binding
      const tokenAgentId = decoded && (decoded.agentId || decoded.id);
      if (typeof tokenAgentId !== 'string' || tokenAgentId.length > 100) {
        return next(new Error('AUTHENTICATION_ERROR: Invalid session claims'));
      }
      const agent = await tenantDb(decoded.tenantId, (db) =>
        db.agent.findUnique({
          where: { id: tokenAgentId },
          include: { tenant: true },
        })
      );

      if (!agent) {
        return next(new Error('AUTHENTICATION_ERROR: Agent account not found'));
      }

      if (!agent.isActive) {
        return next(new Error('AUTHENTICATION_ERROR: Agent account is deactivated'));
      }

      // Revoked sessions (password change / logout / admin reset bump
      // tokenVersion) cannot open new socket connections either.
      if ((decoded.tv ?? 0) !== (agent.tokenVersion ?? 0)) {
        return next(new Error('AUTHENTICATION_ERROR: Session has been revoked. Please login again.'));
      }

      // 4. Attach verified tenant & agent security context to socket instance
      socket.agent = {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role, // 'ADMIN' | 'AGENT' | 'SUPERVISOR'
        tenantId: agent.tenantId,
        avatarUrl: agent.avatarUrl,
      };

      return next();
    } catch (error) {
      console.error('[Socket Auth Middleware Error]:', error);
      return next(new Error('AUTHENTICATION_ERROR: Internal handshake verification failure'));
    }
  });

  // =========================================================================
  // CONNECTION EVENT & ROOM MANAGEMENT
  // =========================================================================
  io.on('connection', async (socket) => {
    const { id: agentId, name: agentName, role, tenantId } = socket.agent;
    console.log(`[Socket Connected]: Agent ${agentName} (${role}) | Tenant: ${tenantId} | SocketID: ${socket.id}`);

    // Join tenant-wide operational broadcast room
    const tenantRoom = `tenant:${tenantId}`;
    socket.join(tenantRoom);

    // Keep operational events scoped to the roles that can see the affected
    // conversation. The legacy tenant room remains useful for presence, but
    // must not carry message content for every chat in the tenant.
    const tenantAdminsRoom = `tenant:${tenantId}:admins`;
    const tenantAgentsRoom = `tenant:${tenantId}:agents`;
    if (role === 'ADMIN' || role === 'SUPERVISOR') {
      socket.join(tenantAdminsRoom);
    } else {
      socket.join(tenantAgentsRoom);
    }

    // Join agent-specific private messaging room
    const agentRoom = `agent:${agentId}`;
    socket.join(agentRoom);

    // Track active connection count
    if (!onlineAgents.has(agentId)) {
      onlineAgents.set(agentId, new Set());
      // First connection marks the agent ONLINE — but only from OFFLINE.
      // A manually chosen BUSY must survive reconnects and new tabs.
      const currentAgent = await tenantDb(tenantId, (db) =>
        db.agent.findUnique({ where: { id: agentId }, select: { status: true } })
      ).catch(() => null);
      if (currentAgent && currentAgent.status === 'OFFLINE') {
        await tenantDb(tenantId, (db) =>
          db.agent.update({
            where: { id: agentId },
            data: { status: 'ONLINE' },
          })
        ).catch((e) => console.error('Agent presence update error:', e));

        io.to(tenantRoom).emit('agent_presence_changed', {
          agentId,
          status: 'ONLINE',
          timestamp: new Date().toISOString(),
        });
      }
    }
    onlineAgents.get(agentId).add(socket.id);

    // -----------------------------------------------------------------------
    // EVENT: join_chat (Strict RBAC Guarded Room Access)
    // -----------------------------------------------------------------------
    socket.on('join_chat', async (data, ack) => {
      try {
        const { chatId } = data || {};
        if (typeof chatId !== 'string' || !chatId || chatId.length > 100) {
          if (ack) ack({ success: false, error: 'Chat ID is required' });
          return;
        }

        // Query chat to verify tenant isolation and RBAC permission
        const chat = await tenantDb(tenantId, (db) =>
          db.chat.findUnique({
            where: { id: chatId },
          })
        );

        if (!chat || chat.tenantId !== tenantId) {
          if (ack) ack({ success: false, error: 'Chat session not found' });
          return;
        }

        // AGENT ROLE RESTRICTION:
        // Admin & Supervisor have omniscient visibility.
        // Standard Agents can ONLY join chats assigned to them OR unassigned queue.
        if (!canAccessChat(socket.agent, chat)) {
            console.warn(`[RBAC Violation]: Agent ${agentName} denied joining chat ${chatId} (assigned to ${chat.assignedAgentId})`);
            if (ack) {
              ack({
                success: false,
                error: 'FORBIDDEN: You do not have permission to access chats assigned to another staff member.',
              });
            }
            return;
          }

        // Leave any currently active individual chat rooms
        for (const room of socket.rooms) {
          if (room.startsWith('chat:') && room !== `chat:${chatId}`) {
            socket.leave(room);
          }
        }

        const chatRoom = `chat:${chatId}`;
        socket.join(chatRoom);
        console.log(`[Socket Room Joined]: Agent ${agentName} joined ${chatRoom}`);

        if (ack) {
          ack({ success: true, chatId, room: chatRoom });
        }
      } catch (err) {
        console.error('join_chat error:', err);
        if (ack) ack({ success: false, error: 'Failed to join chat room' });
      }
    });

    // -----------------------------------------------------------------------
    // EVENT: leave_chat
    // -----------------------------------------------------------------------
    socket.on('leave_chat', (data, ack) => {
      const chatId = data && data.chatId;
      if (chatId && socket.rooms.has(`chat:${chatId}`)) {
        socket.leave(`chat:${chatId}`);
      }
      if (ack) ack({ success: true });
    });

    // -----------------------------------------------------------------------
    // EVENT: typing_indicator (Agent is typing)
    // -----------------------------------------------------------------------
    socket.on('typing_indicator', async ({ chatId, isTyping } = {}) => {
      // A client may only publish typing events after the server has granted
      // membership in the chat room. This prevents cross-tenant/cross-agent
      // room probing through forged chat IDs.
      if (typeof chatId !== 'string' || chatId.length > 100 || !socket.rooms.has(`chat:${chatId}`) || typeof isTyping !== 'boolean') return;
      try {
        const chat = await tenantDb(tenantId, (db) => db.chat.findUnique({ where: { id: chatId } }));
        if (!canAccessChat(socket.agent, chat)) return;
        socket.to(`chat:${chatId}`).emit('agent_typing', {
          chatId,
          agentId,
          agentName,
          isTyping,
        });
      } catch (error) {
        console.error('[Socket Typing Authorization Error]:', error.message);
      }
    });

    // -----------------------------------------------------------------------
    // DISCONNECT EVENT
    // -----------------------------------------------------------------------
    socket.on('disconnect', async () => {
      console.log(`[Socket Disconnected]: Agent ${agentName} | Socket: ${socket.id}`);
      const agentSockets = onlineAgents.get(agentId);
      if (agentSockets) {
        agentSockets.delete(socket.id);
        if (agentSockets.size === 0) {
          onlineAgents.delete(agentId);
          // Mark agent OFFLINE in database
          await tenantDb(tenantId, (db) =>
            db.agent.update({
              where: { id: agentId },
              data: { status: 'OFFLINE' },
            })
          ).catch((e) => console.error('Agent offline update error:', e));

          io.to(tenantRoom).emit('agent_presence_changed', {
            agentId,
            status: 'OFFLINE',
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
  });

  return io;
}

async function configureRedisAdapter() {
  if (!io || redisClients.length > 0) return;
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  pubClient.on('error', (error) => console.error('[Socket Redis Publisher Error]:', error.message));
  subClient.on('error', (error) => console.error('[Socket Redis Subscriber Error]:', error.message));
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  redisClients = [pubClient, subClient];
  console.log('[Socket.io]: Redis adapter enabled for multi-instance fanout');
}

async function closeSocketResources() {
  await Promise.all(redisClients.map((client) => client.quit().catch(() => undefined)));
  redisClients = [];
}

/**
 * Access the initialized Socket.io instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet');
  }
  return io;
}

/**
 * Helper to emit real-time messages with tenant & chat scope
 */
function broadcastNewMessage(tenantId, chatId, message, assignedAgentId = null) {
  if (!io) return;
  // 1. Send to the active chat room (anyone viewing the chat)
  io.to(`chat:${chatId}`).emit('new_message', { chatId, message });

  const isInternalNote = message.messageType === 'NOTE' || message.senderType === 'NOTE';
  const preview = {
    chatId,
    // Queue previews go to room subscribers who may not have this chat
    // open; an internal note's TEXT must never ride along — label only.
    lastMessage: isInternalNote ? '🔒 Internal note' : message.content || `[${message.messageType}]`,
    lastMessageAt: message.createdAt,
    senderType: message.senderType,
    direction: message.direction,
  };

  // 2. Send only the preview to agents authorized to see this queue. Admins
  // and supervisors can see every tenant chat; standard agents receive their
  // assigned chats or the unassigned queue.
  io.to(`tenant:${tenantId}:admins`).emit('chat_preview_updated', preview);
  if (assignedAgentId) {
    io.to(`agent:${assignedAgentId}`).emit('chat_preview_updated', preview);
  } else {
    io.to(`tenant:${tenantId}:agents`).emit('chat_preview_updated', preview);
  }

  // 3. If chat has an assigned agent, notify their personal room
  if (assignedAgentId) {
    io.to(`agent:${assignedAgentId}`).emit('agent_chat_notification', {
      chatId,
      message,
    });
  }
}

/**
 * Helper to emit message status updates (sent -> delivered -> read)
 */
function broadcastMessageStatus(tenantId, chatId, { messageId, waMessageId, status, recipientId, timestamp }) {
  if (!io) return;
  io.to(`chat:${chatId}`).emit('message_status_updated', {
    chatId,
    messageId,
    waMessageId,
    status,
    recipientId,
    timestamp,
  });
}

/**
 * Helper to emit chat assignment changes
 */
function broadcastChatAssignment(tenantId, chatId, {
  assignedAgentId,
  previousAssignedAgentId,
  assignedAgentName,
  status,
}) {
  if (!io) return;
  const payload = {
    chatId,
    assignedAgentId,
    assignedAgentName,
    status,
  };
  io.to(`tenant:${tenantId}:admins`).emit('chat_assigned', payload);
  if (assignedAgentId) {
    io.to(`agent:${assignedAgentId}`).emit('chat_assigned', payload);
  } else {
    io.to(`tenant:${tenantId}:agents`).emit('chat_assigned', payload);
  }
  if (previousAssignedAgentId && previousAssignedAgentId !== assignedAgentId) {
    io.to(`agent:${previousAssignedAgentId}`).emit('chat_assigned', payload);
  }
  io.to(`chat:${chatId}`).emit('chat_assigned', {
    chatId,
    assignedAgentId,
    assignedAgentName,
    status,
  });
}

/**
 * Helper to emit chat status transition (UNASSIGNED -> OPEN -> RESOLVED)
 */
function broadcastChatStatusTransition(tenantId, chatId, { status, updatedBy, assignedAgentId }) {
  if (!io) return;
  const payload = {
    chatId,
    status,
    updatedBy,
  };
  io.to(`tenant:${tenantId}:admins`).emit('chat_status_changed', payload);
  if (assignedAgentId) {
    io.to(`agent:${assignedAgentId}`).emit('chat_status_changed', payload);
  } else {
    io.to(`tenant:${tenantId}:agents`).emit('chat_status_changed', payload);
  }
  io.to(`chat:${chatId}`).emit('chat_status_changed', {
    chatId,
    status,
    updatedBy,
  });
}

/**
 * Notify each @mentioned agent's personal room about an internal note.
 * Carries no note text — just enough for an alert strip with a jump link.
 */
function broadcastNoteMentions(tenantId, chatId, { authorName, contactName, mentionedAgentIds, messageId }) {
  if (!io || !Array.isArray(mentionedAgentIds)) return;
  for (const agentId of mentionedAgentIds) {
    io.to(`agent:${agentId}`).emit('note_mention', {
      chatId,
      messageId,
      authorName,
      contactName,
    });
  }
}

/**
 * Helper to emit a chat snooze change (set or expired/cleared) to the same
 * audiences that follow the chat's lifecycle.
 */
function broadcastChatSnoozeChanged(tenantId, chatId, snoozedUntil, assignedAgentId) {
  if (!io) return;
  const payload = { chatId, snoozedUntil };
  io.to(`tenant:${tenantId}:admins`).emit('chat_snooze_changed', payload);
  if (assignedAgentId) {
    io.to(`agent:${assignedAgentId}`).emit('chat_snooze_changed', payload);
  } else {
    io.to(`tenant:${tenantId}:agents`).emit('chat_snooze_changed', payload);
  }
  io.to(`chat:${chatId}`).emit('chat_snooze_changed', payload);
}

module.exports = {
  initSocket,
  configureRedisAdapter,
  closeSocketResources,
  getIO,
  broadcastNewMessage,
  broadcastMessageStatus,
  broadcastChatAssignment,
  broadcastChatStatusTransition,
  broadcastChatSnoozeChanged,
  broadcastNoteMentions,
};
