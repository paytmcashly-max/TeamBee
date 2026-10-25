const prisma = require('./prisma');

// Runs `fn(tx)` inside ONE interactive transaction whose first
// statement sets the transaction-local tenant context that the RLS
// policies (migrations 202610260004/5) read. Transaction-local is the
// only sound carrier on Neon's pooled endpoint: a session-level SET
// could bleed into the next request that reuses the pooled connection.
//
// Until the Phase 3 cutover the app connects as the BYPASSRLS owner,
// so wrapping a flow is behaviour-preserving; after cutover it is what
// makes the database policies bind. System flows (login lookup,
// webhook tenant resolution, cross-tenant maintenance scans) use
// withSystemDb, which claims the database-visible '__system__' context.
async function withTenantDb(tenantId, fn, options) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
    return fn(tx);
  }, options);
}

function withSystemDb(fn, options) {
  return withTenantDb('__system__', fn, options);
}

module.exports = { withTenantDb, withSystemDb };
