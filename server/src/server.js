require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const { initSocket, configureRedisAdapter, closeSocketResources } = require('./services/socketService');
const prisma = require('./db/prisma');
const WebhookParserService = require('./services/webhookParserService');
const { drainPendingBroadcasts } = require('./services/broadcastWorker');
const { expireSnoozedChats } = require('./services/snoozeService');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const agentRoutes = require('./routes/agentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const templateRoutes = require('./routes/templateRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const quickReplyRoutes = require('./routes/quickReplyRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const billingRoutes = require('./routes/billingRoutes');
const simulatorRoutes = require('./routes/simulatorRoutes');

const app = express();
const server = http.createServer(app);
app.disable('x-powered-by');
// Behind Render (and most PaaS) proxies every request carries X-Forwarded-For.
// Trust exactly one proxy hop by default so req.ip and express-rate-limit work;
// set TRUST_PROXY=false only for a direct, unproxied deployment.
if (process.env.TRUST_PROXY !== 'false') app.set('trust proxy', 1);

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

// Enable CORS for frontend clients
app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients do not send Origin and remain supported.
      // A disallowed origin simply gets no CORS headers (callback(null,
      // false)); throwing here turned it into a misleading 500.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...allowedOrigins, 'https://graph.facebook.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

// Gzip API responses (~70% smaller JSON on the wire). Media streams are
// skipped: their bytes are already encoded and compression would only burn
// CPU and break streaming.
app.use(
  compression({
    filter: (req, res) => {
      if (req.path.startsWith('/api/messages/media/')) return false;
      return compression.filter(req, res);
    },
  })
);

// Express JSON body parser preserving raw body buffer for Webhook HMAC signature verification
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ChatFlow WhatsApp Team Inbox Engine',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness: the full schema verification walks information_schema on every
// call and made /ready take 0.5-0.9s. Cache a successful verification for
// 60s — readiness still fails within a minute of real schema breakage, and
// the boot path keeps the strict uncached check.
let schemaVerifiedAt = 0;
async function verifyDatabaseSchemaCached() {
  if (Date.now() - schemaVerifiedAt < 60_000) return;
  await verifyDatabaseSchema();
  schemaVerifiedAt = Date.now();
}

app.get('/ready', async (req, res) => {
  try {
    await verifyDatabaseSchemaCached();
    return res.json({ status: 'ready', database: 'up', schema: 'up' });
  } catch (error) {
    console.error('[Readiness Check Error]:', error.message);
    return res.status(503).json({ status: 'not_ready', database: 'down', error: 'Database migrations are not applied' });
  }
});

// Mount Routes
app.use('/webhook', webhookRoutes);
// Request IDs + one structured JSON log line per API request. Until
// this existed, production logs were ad-hoc console lines with no way
// to correlate a user's complaint with the requests it touched.
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || require('crypto').randomUUID();
  res.setHeader('X-Request-Id', req.id);
  if (req.path.startsWith('/api/')) {
    const startedAt = Date.now();
    res.on('finish', () => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          id: req.id,
          method: req.method,
          path: req.originalUrl?.split('?')[0],
          status: res.statusCode,
          ms: Date.now() - startedAt,
          tenantId: req.tenantId || undefined,
        })
      );
    });
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/quick-replies', quickReplyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
// Dev-only tool: the simulator injects fake inbound messages and statuses,
// so it is mounted only when explicitly enabled (staging), never by default.
if (process.env.ENABLE_SIMULATOR === 'true') {
  app.use('/api/simulator', simulatorRoutes);
}

// Keep API and webhook failures JSON-shaped instead of falling through to the SPA shell.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});
app.use('/webhook', (req, res) => {
  res.status(404).json({ success: false, error: 'Webhook route not found' });
});

// Serve the built Vite application when API and frontend share a container.
// A separate static host may still serve client/dist directly.
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath, { index: false, maxAge: '1h' }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path === '/health' || req.path === '/ready') {
    return next();
  }
  return res.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
    if (error) next();
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Catch]:', err.stack || err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal Server Error' : 'Invalid request',
  });
});

const PORT = process.env.PORT || 5000;
let io;
let shuttingDown = false;
const backgroundRecoveryTasks = new Set();

function scheduleBackgroundRecovery(label, task) {
  const recoveryTask = Promise.resolve()
    .then(() => {
      if (shuttingDown) return 0;
      return task();
    })
    .then((count) => {
      if (!shuttingDown && count > 0) {
        console.log(`[${label} Recovery]: ${label === 'Webhook' ? 'Drained' : 'Resumed'} ${count} ${label === 'Webhook' ? 'pending event(s)' : 'campaign(s)'}`);
      }
      return count;
    })
    .catch((error) => {
      if (!shuttingDown) console.error(`[${label} Recovery Error]:`, error.message);
      return 0;
    })
    .finally(() => backgroundRecoveryTasks.delete(recoveryTask));

  backgroundRecoveryTasks.add(recoveryTask);
  return recoveryTask;
}

async function verifyDatabaseSchema() {
  const requiredTables = ['tenants', 'agents', 'contacts', 'chats', 'messages', 'templates', 'broadcasts', 'broadcast_recipients', 'webhook_events'];
  const rows = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${requiredTables})
  `;
  const foundTables = new Set(rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !foundTables.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Database migrations are incomplete; missing tables: ${missingTables.join(', ')}`);
  }

  const columnRows = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'messages' AND column_name = 'client_message_id')
        OR (table_name = 'broadcast_recipients' AND column_name IN ('updated_at', 'last_error'))
        OR (table_name = 'tenants' AND column_name = 'webhook_verify_token_hash'))
  `;
  const foundColumns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
  const requiredColumns = [
    'messages.client_message_id',
    'broadcast_recipients.updated_at',
    'broadcast_recipients.last_error',
    'tenants.webhook_verify_token_hash',
  ];
  const missingColumns = requiredColumns.filter((column) => !foundColumns.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Database migrations are incomplete; missing columns: ${missingColumns.join(', ')}`);
  }
}

function validateRuntimeConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured in production');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
  }
  if (!process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.CREDENTIAL_ENCRYPTION_KEY.length < 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be configured with at least 32 characters in production');
  }
  if (!process.env.CORS_ORIGINS && !process.env.CLIENT_URL) {
    throw new Error('CORS_ORIGINS or CLIENT_URL must be configured in production');
  }
}

async function start() {
  validateRuntimeConfig();
  shuttingDown = false;
  io = initSocket(server);
  if (process.env.REDIS_URL) await configureRedisAdapter();
  try {
    await prisma.$connect();
    await verifyDatabaseSchema();
    await new Promise((resolve, reject) => {
      const handleServerError = (error) => reject(error);
      server.once('error', handleServerError);
      server.listen(PORT, () => {
        server.off('error', handleServerError);
        console.log('================================================================');
        console.log(`🚀 ChatFlow Backend Engine listening on http://localhost:${PORT}`);
        console.log('⚡ WebSocket Server active with JWT Role-Based Handshake Guard');
        console.log(`🔗 Meta Webhook Endpoint: http://localhost:${PORT}/webhook`);
        console.log('================================================================');
        setImmediate(() => scheduleBackgroundRecovery(
          'Webhook',
          () => WebhookParserService.drainPendingWebhookEvents()
        ));
        setImmediate(() => scheduleBackgroundRecovery(
          'Broadcast',
          () => drainPendingBroadcasts()
        ));
        // Scheduled retries (broadcast backoff, webhook dead-letters) need a
        // periodic driver — a boot-time pass alone would leave them parked
        // until the next deploy.
        const recoveryInterval = setInterval(() => {
          scheduleBackgroundRecovery('Webhook', () => WebhookParserService.drainPendingWebhookEvents());
          scheduleBackgroundRecovery('Broadcast', () => drainPendingBroadcasts());
          scheduleBackgroundRecovery('Snooze', () => expireSnoozedChats());
        }, 60_000);
        if (typeof recoveryInterval.unref === 'function') recoveryInterval.unref();
        resolve(server);
      });
    });
  } catch (error) {
    if (io?.close) io.close();
    await prisma.$disconnect().catch(() => {});
    throw error;
  }
  return server;
}

async function shutdown(signal) {
  console.log(`[Shutdown]: Received ${signal}, closing server gracefully...`);
  shuttingDown = true;
  await Promise.allSettled([...backgroundRecoveryTasks]);
  if (io?.close) io.close();
  await closeSocketResources();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
}

if (require.main === module) {
  start().catch((error) => {
    console.error('[Startup Error]:', error.message);
    process.exitCode = 1;
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      shutdown(signal)
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('[Shutdown Error]:', error.message);
          process.exit(1);
        });
    });
  }
}

module.exports = { app, server, start, shutdown };
