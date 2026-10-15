const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { JWT_SECRET } = require('../middleware/authMiddleware');

class AuthController {
  /**
   * POST /api/auth/login: Login for Tenant Admin and Staff Agents
   */
  static async login(req, res) {
    try {
      const { email, password, tenantSlug } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      // Find agent by email (optionally scoped by tenantSlug if provided)
      let query = { email };
      if (tenantSlug) {
        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (tenant) {
          query.tenantId = tenant.id;
        }
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
      const token = jwt.sign(
        {
          agentId: agent.id,
          tenantId: agent.tenantId,
          role: agent.role,
          email: agent.email,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

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
        tenant: {
          id: agent.tenant.id,
          name: agent.tenant.name,
          slug: agent.tenant.slug,
          displayPhoneNumber: agent.tenant.displayPhoneNumber,
          hasMetaConfigured: Boolean(agent.tenant.phoneNumberId && agent.tenant.accessToken),
        },
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
      const { businessName, adminName, email, password, slug } = req.body;

      if (!businessName || !adminName || !email || !password) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

      const finalSlug = (slug || businessName.toLowerCase().replace(/[^a-z0-9]/g, '-')).slice(0, 50);

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
            webhookVerifyToken: `cf_verify_${Math.random().toString(36).substring(2, 10)}`,
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

      const token = jwt.sign(
        {
          agentId: result.admin.id,
          tenantId: result.tenant.id,
          role: 'ADMIN',
          email: result.admin.email,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        token,
        agent: {
          id: result.admin.id,
          name: result.admin.name,
          email: result.admin.email,
          role: result.admin.role,
        },
        tenant: result.tenant,
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
        webhookVerifyToken: req.tenant.webhookVerifyToken,
        hasMetaConfigured: Boolean(req.tenant.phoneNumberId && req.tenant.accessToken),
      },
    });
  }
}

module.exports = AuthController;
