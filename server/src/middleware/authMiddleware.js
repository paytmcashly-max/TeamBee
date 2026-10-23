const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');

// Secrets must be supplied by the runtime.  Keeping a fallback here would make a
// deployment with a missing environment variable accept tokens signed with a
// publicly readable value.
const JWT_SECRET = process.env.JWT_SECRET;

function readCookie(cookieHeader, name) {
  if (typeof cookieHeader !== 'string') return null;
  const match = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function getJwtSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return JWT_SECRET;
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
}

// ---------------------------------------------------------------------------
// Agent cache: authenticateToken used to pay a full DB round trip (agent +
// tenant) on EVERY API call. Entries live 20s and are bypassed whenever the
// presented token's version does not match the cached one; every in-app
// revocation path (logout, password change, admin reset, deactivation) also
// invalidates eagerly via invalidateAgentCache, so revocation stays instant
// in practice. The 20s TTL only bounds staleness for out-of-band DB edits.
// ---------------------------------------------------------------------------
const AGENT_CACHE_TTL_MS = 20_000;
const agentCache = new Map();
const agentCacheInflight = new Map();

function invalidateAgentCache(agentId) {
  agentCache.delete(agentId);
}

async function loadAgent(agentId, decoded) {
  const cached = agentCache.get(agentId);
  if (
    cached &&
    cached.expiresAt > Date.now() &&
    (decoded.tv ?? 0) === (cached.agent.tokenVersion ?? 0)
  ) {
    return cached.agent;
  }
  if (!agentCacheInflight.has(agentId)) {
    agentCacheInflight.set(
      agentId,
      prisma.agent
        .findUnique({ where: { id: agentId }, include: { tenant: true } })
        .finally(() => agentCacheInflight.delete(agentId))
    );
  }
  const agent = await agentCacheInflight.get(agentId);
  if (agent) {
    agentCache.set(agentId, { agent, expiresAt: Date.now() + AGENT_CACHE_TTL_MS });
  }
  return agent;
}

/**
 * Verify JWT token and attach agent & tenant context to Request
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = bearerToken && bearerToken !== 'null' && bearerToken !== 'undefined'
      ? bearerToken
      : readCookie(req.headers.cookie, 'chatflow_session');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required',
      });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.message && err.message.startsWith('JWT_SECRET')) {
        console.error('[Auth Configuration Error]:', err.message);
        return res.status(500).json({ success: false, error: 'Authentication service is not configured' });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session token',
      });
    }

    const agentId = decoded && (decoded.agentId || decoded.id);
    if (!agentId || typeof agentId !== 'string') {
      return res.status(401).json({ success: false, error: 'Invalid session token' });
    }

    const agent = await loadAgent(agentId, decoded);

    if (!agent || !agent.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account not found or has been deactivated',
      });
    }

    // Session revocation: tokens minted before a password change, logout or
    // admin reset carry an older version and die here. Legacy tokens without
    // the claim are version 0 (matching the column default).
    if ((decoded.tv ?? 0) !== (agent.tokenVersion ?? 0)) {
      return res.status(401).json({
        success: false,
        error: 'Session has been revoked. Please sign in again.',
      });
    }

    req.agent = agent;
    req.tenantId = agent.tenantId;
    req.tenant = agent.tenant;

    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal authentication error',
    });
  }
}

/**
 * Role-Based Access Control Guard
 */
function requireRole(...allowedRoles) {
  // Flattening also protects callers from the easy-to-miss
  // requireRole(['ADMIN', 'SUPERVISOR']) mistake.
  const roles = allowedRoles
    .flat()
    .filter((role) => typeof role === 'string')
    .map((role) => role.toUpperCase());

  return (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!roles.includes(String(req.agent.role).toUpperCase())) {
      return res.status(403).json({
        success: false,
        error: `Permission denied. Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Agents may work on their own chats and on the unassigned queue.  Tenant
 * administrators and supervisors can work on every chat in their tenant.
 */
function canAccessChat(agent, chat) {
  if (!agent || !chat || agent.tenantId !== chat.tenantId) return false;
  if (agent.role === 'ADMIN' || agent.role === 'SUPERVISOR') return true;
  return chat.assignedAgentId === agent.id || chat.status === 'UNASSIGNED';
}

module.exports = {
  authenticateToken,
  requireRole,
  canAccessChat,
  getJwtSecret,
  verifyAccessToken,
  readCookie,
  invalidateAgentCache,
  JWT_SECRET,
};
