const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'chatflow_super_secret_jwt_key_2026_indian_smb';

/**
 * Verify JWT token and attach agent & tenant context to Request
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session token',
      });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: decoded.agentId || decoded.id },
      include: { tenant: true },
    });

    if (!agent || !agent.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account not found or has been deactivated',
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
  return (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.agent.role)) {
      return res.status(403).json({
        success: false,
        error: `Permission denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET,
};
