const prisma = require('../db/prisma');
const { withSystemDb, rlsContextEnabled } = require('../db/withTenant');

// Append-only audit trail for security-relevant events. Writes are
// fire-and-forget: an audit failure must never fail the user's request,
// so errors are swallowed after a console note.
async function logAuditEvent({ tenantId = null, agentId = null, event, req = null, metadata = null }) {
  const data = {
    tenantId,
    agentId,
    event,
    ip: req ? req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null : null,
    userAgent: req ? String(req.headers?.['user-agent'] || '').slice(0, 300) || null : null,
    metadata: metadata ? JSON.stringify(metadata).slice(0, 2000) : null,
  };
  try {
    // Audit rows are written from every context (including pre-auth);
    // under RLS they ride the system context in their own transaction.
    if (rlsContextEnabled()) {
      await withSystemDb((tx) => tx.auditLog.create({ data }));
    } else {
      await prisma.auditLog.create({ data });
    }
  } catch (err) {
    console.error('[AuditLog] write failed:', err.message);
  }
}

module.exports = { logAuditEvent };
