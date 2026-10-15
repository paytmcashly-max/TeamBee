const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');

let io = null;
// Track online socket count per agent: agentId -> Set of socketIds
const onlineAgents = new Map();

/**
 * Initialize Socket.io with HTTP server and configure security middleware
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow frontend origins
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
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      if (!token) {
        return next(new Error('AUTHENTICATION_ERROR: Token missing from handshake'));
      }

      if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }

      // 2. Cryptographic signature and expiration verification
      const jwtSecret = process.env.JWT_SECRET || 'chatflow_super_secret_jwt_key_2026_indian_smb';
      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new Error('AUTHENTICATION_ERROR: Session expired. Please login again.'));
        }
        return next(new Error('AUTHENTICATION_ERROR: Invalid authentication signature'));
      }

      // 3. Database lookup for agent status & tenant binding
      const agent = await prisma.agent.findUnique({
        where: { id: decoded.agentId || decoded.id },
        include: { tenant: true },
      });

      if (!agent) {
        return next(new Error('AUTHENTICATION_ERROR: Agent account not found'));
      }

      if (!agent.isActive) {
        return next(new Error('AUTHENTICATION_ERROR: Agent account is deactivated'));
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

    // Join agent-specific private messaging room
    const agentRoom = `agent:${agentId}`;
    socket.join(agentRoom);

    // Track active connection count
    if (!onlineAgents.has(agentId)) {
      onlineAgents.set(agentId, new Set());
      // First connection for this agent -> update DB status to ONLINE
      await prisma.agent.update({
        where: { id: agentId },
        data: { status: 'ONLINE' },
      }).catch((e) => console.error('Agent presence update error:', e));

      io.to(tenantRoom).emit('agent_presence_changed', {
        agentId,
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
      });
    }
    onlineAgents.get(agentId).add(socket.id);

    // -----------------------------------------------------------------------
    // EVENT: join_chat (Strict RBAC Guarded Room Access)
    // -----------------------------------------------------------------------
    socket.on('join_chat', async (data, ack) => {
      try {
        const { chatId } = data || {};
        if (!chatId) {
          if (ack) ack({ success: false, error: 'Chat ID is required' });
          return;
        }

        // Query chat to verify tenant isolation and RBAC permission
        const chat = await prisma.chat.findUnique({
          where: { id: chatId },
        });

        if (!chat || chat.tenantId !== tenantId) {
          if (ack) ack({ success: false, error: 'Chat session not found' });
          return;
        }

        // AGENT ROLE RESTRICTION:
        // Admin & Supervisor have omniscient visibility.
        // Standard Agents can ONLY join chats assigned to them OR unassigned queue.
        if (role === 'AGENT') {
          const isAssignedToMe = chat.assignedAgentId === agentId;
          const isUnassigned = chat.status === 'UNASSIGNED';

          if (!isAssignedToMe && !isUnassigned) {
            console.warn(`[RBAC Violation]: Agent ${agentName} denied joining chat ${chatId} (assigned to ${chat.assignedAgentId})`);
            if (ack) {
              ack({
                success: false,
                error: 'FORBIDDEN: You do not have permission to access chats assigned to another staff member.',
              });
            }
            return;
          }
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
    socket.on('leave_chat', ({ chatId }, ack) => {
      if (chatId) {
        socket.leave(`chat:${chatId}`);
      }
      if (ack) ack({ success: true });
    });

    // -----------------------------------------------------------------------
    // EVENT: typing_indicator (Agent is typing)
    // -----------------------------------------------------------------------
    socket.on('typing_indicator', ({ chatId, isTyping }) => {
      if (chatId) {
        socket.to(`chat:${chatId}`).emit('agent_typing', {
          chatId,
          agentId,
          agentName,
          isTyping,
        });
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
          await prisma.agent.update({
            where: { id: agentId },
            data: { status: 'OFFLINE' },
          }).catch((e) => console.error('Agent offline update error:', e));

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

  // 2. Send to tenant room for updating conversation list preview / unread counter
  io.to(`tenant:${tenantId}`).emit('chat_preview_updated', {
    chatId,
    lastMessage: message.content || `[${message.messageType}]`,
    lastMessageAt: message.createdAt,
    senderType: message.senderType,
    direction: message.direction,
  });

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
  io.to(`tenant:${tenantId}`).emit('message_status_updated', {
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
function broadcastChatAssignment(tenantId, chatId, { assignedAgentId, assignedAgentName, status }) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit('chat_assigned', {
    chatId,
    assignedAgentId,
    assignedAgentName,
    status,
  });
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
function broadcastChatStatusTransition(tenantId, chatId, { status, updatedBy }) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit('chat_status_changed', {
    chatId,
    status,
    updatedBy,
  });
  io.to(`chat:${chatId}`).emit('chat_status_changed', {
    chatId,
    status,
    updatedBy,
  });
}

module.exports = {
  initSocket,
  getIO,
  broadcastNewMessage,
  broadcastMessageStatus,
  broadcastChatAssignment,
  broadcastChatStatusTransition,
};
