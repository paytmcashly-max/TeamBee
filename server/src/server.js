require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');

const { initSocket } = require('./services/socketService');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const agentRoutes = require('./routes/agentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const templateRoutes = require('./routes/templateRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const simulatorRoutes = require('./routes/simulatorRoutes');

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend clients
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

// Express JSON body parser preserving raw body buffer for Webhook HMAC signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ChatFlow WhatsApp Team Inbox Engine',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/webhook', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/simulator', simulatorRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Catch]:', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Initialize Socket.io with RBAC Security
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`🚀 ChatFlow Backend Engine listening on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket Server active with JWT Role-Based Handshake Guard`);
  console.log(`🔗 Meta Webhook Endpoint: http://localhost:${PORT}/webhook`);
  console.log('================================================================');
});

module.exports = { app, server };
