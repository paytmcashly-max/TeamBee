const { PrismaClient } = require('@prisma/client');

// PostgreSQL only. For production scale DATABASE_URL must point at Neon's
// POOLED endpoint (host containing "-pooler") with PgBouncer parameters,
// e.g. ...?pgbouncer=true&connection_limit=15&pool_timeout=20 — the app
// never runs migrations at boot, so transaction pooling is safe and keeps
// many app instances from exhausting Postgres connections.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});


module.exports = prisma;
