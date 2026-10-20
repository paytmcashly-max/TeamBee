const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { getJwtSecret } = require('../middleware/authMiddleware');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function publicTenant(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    displayPhoneNumber: tenant.displayPhoneNumber,
    hasMetaConfigured: Boolean(tenant.phoneNumberId && tenant.accessToken),
  };
}

function signSession(agent) {
  return jwt.sign(
    {
      agentId: agent.id,
      tenantId: agent.tenantId,
      role: agent.role,
      email: agent.email,
    },
    getJwtSecret(),
    { expiresIn: '7d', algorithm: 'HS256' }
  );
}

function setSessionCookie(res, token) {
  const sameSite = String(process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  const attributes = [
    `chatflow_session=${encodeURIComponent(token)}`,
    'Max-Age=604800',
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite === 'none' ? 'None' : sameSite === 'strict' ? 'Strict' : 'Lax'}`,
  ];
  if (secure) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'chatflow_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
}

class AuthController {
  /**
   * POST /api/auth/login: Login for Tenant Admin and Staff Agents
   */
  static async login(req, res) {
    try {
      const email = cleanString(req.body?.email, 320).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const tenantSlug = cleanString(req.body?.tenantSlug, 50).toLowerCase();

      if (!email || !password || !EMAIL_PATTERN.test(email) || password.length > 256) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      let query = { email };
      if (tenantSlug) {
        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (!tenant) {
          return res.status(401).json({ success: false, error: 'Invalid email or credentials' });
        }
        query.tenantId = tenant.id;
      }

      const agent = await prisma.agent.findFirst({
        where: query,
        include: { tenant: true },
      });

      if (!agent) {
        return res.status(401).json({ success: false, error: 'Invalid email or credentials' });
      }

      if (!agent.isActive) {
        return res.status(403).json({ success: false, error: 'This agent account is deactivated' });
      }

      const isValidPassword = await bcrypt.compare(password, agent.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, error: 'Invalid email or credentials' });
      }

      // Generate session JWT with 7-day validity
      const token = signSession(agent);
      setSessionCookie(res, token);

      return res.json({
        success: true,
        token,
        agent: {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
          status: agent.status,
          avatarUrl: agent.avatarUrl,
          tenantId: agent.tenantId,
        },
        tenant: publicTenant(agent.tenant),
      });
    } catch (error) {
      console.error('[Auth Login Error]:', error);
      return res.status(500).json({ success: false, error: 'Internal login error' });
    }
  }

  /**
   * POST /api/auth/register-tenant: Admin self-serve onboarding
   */
  static async registerTenant(req, res) {
    try {
      const businessName = cleanString(req.body?.businessName, 120);
      const adminName = cleanString(req.body?.adminName, 120);
      const email = cleanString(req.body?.email, 320).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const requestedSlug = cleanString(req.body?.slug, 50).toLowerCase();

      if (
        !businessName ||
        !adminName ||
        !email ||
        !password ||
        !EMAIL_PATTERN.test(email) ||
        password.length < 10 ||
        password.length > 256
      ) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

      const finalSlug = (requestedSlug || businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
      if (!finalSlug) {
        return res.status(400).json({ success: false, error: 'A valid business name or slug is required' });
      }

      // Check slug uniqueness
      const existingTenant = await prisma.tenant.findUnique({ where: { slug: finalSlug } });
      if (existingTenant) {
        return res.status(400).json({ success: false, error: 'A business with this slug or name already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // Atomic creation of tenant + admin agent
      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: businessName,
            slug: finalSlug,
            webhookVerifyToken: `cf_verify_${crypto.randomBytes(24).toString('hex')}`,
          },
        });

        const admin = await tx.agent.create({
          data: {
            tenantId: tenant.id,
            name: adminName,
            email,
            passwordHash,
            role: 'ADMIN',
            status: 'ONLINE',
          },
        });

        return { tenant, admin };
      });

      const token = signSession(result.admin);
      setSessionCookie(res, token);

      return res.status(201).json({
        success: true,
        token,
        agent: {
          id: result.admin.id,
          name: result.admin.name,
          email: result.admin.email,
          role: result.admin.role,
        },
        tenant: publicTenant(result.tenant),
      });
    } catch (error) {
      console.error('[Register Tenant Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to create business account' });
    }
  }

  /**
   * GET /api/auth/me: Retrieve currently authenticated profile
   */
  static async getMe(req, res) {
    return res.json({
      success: true,
      agent: {
        id: req.agent.id,
        name: req.agent.name,
        email: req.agent.email,
        role: req.agent.role,
        status: req.agent.status,
        avatarUrl: req.agent.avatarUrl,
        tenantId: req.agent.tenantId,
      },
      tenant: {
        id: req.tenant.id,
        name: req.tenant.name,
        slug: req.tenant.slug,
        displayPhoneNumber: req.tenant.displayPhoneNumber,
        phoneNumberId: req.tenant.phoneNumberId,
        wabaId: req.tenant.wabaId,
         hasMetaConfigured: Boolean(req.tenant.phoneNumberId && req.tenant.accessToken),
      },
    });
  }

  static async logout(req, res) {
    clearSessionCookie(res);
    return res.json({ success: true });
  }
}

module.exports = AuthController;
