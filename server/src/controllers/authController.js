const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { getJwtSecret, verifyAccessToken, readCookie } = require('../middleware/authMiddleware');
const { hashSecret } = require('../services/credentialCrypto');

// Compared against when the account does not exist, so unknown-email and
// wrong-password logins cost the same bcrypt time (no enumeration oracle).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 10);

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
      tv: agent.tokenVersion ?? 0,
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
  // SameSite=None is only honoured by browsers together with Secure.
  if (secure || sameSite === 'none') attributes.push('Secure');
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

      // Resolve the account deterministically. The same email may exist in
      // several tenants; without a slug that is ambiguous, and findFirst
      // would silently pick an arbitrary workspace.
      const matches = await prisma.agent.findMany({
        where: { email },
        include: { tenant: true },
      });

      let agent = null;
      if (tenantSlug) {
        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        agent = tenant ? matches.find((candidate) => candidate.tenantId === tenant.id) || null : null;
      } else if (matches.length > 1) {
        return res.status(400).json({
          success: false,
          code: 'WORKSPACE_REQUIRED',
          error: 'This email belongs to multiple workspaces. Please provide your workspace slug to sign in.',
        });
      } else {
        agent = matches[0] || null;
      }

      // Always run bcrypt (against a dummy hash for unknown accounts) and
      // only reveal deactivation after the password has verified, so the
      // endpoint cannot be used to enumerate accounts or their state.
      const isValidPassword = await bcrypt.compare(password, agent ? agent.passwordHash : DUMMY_PASSWORD_HASH);
      if (!agent || !isValidPassword) {
        return res.status(401).json({ success: false, error: 'Invalid email or credentials' });
      }

      if (!agent.isActive) {
        return res.status(403).json({ success: false, error: 'This agent account is deactivated' });
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

      // bcrypt silently truncates past 72 bytes; refuse rather than store a
      // password whose tail is ignored at compare time.
      if (Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ success: false, error: 'Password is too long (maximum 72 bytes)' });
      }

      // Optional invite gate: when REGISTRATION_INVITE_CODE is configured,
      // self-serve registration closes to everyone without the code.
      const inviteCode = process.env.REGISTRATION_INVITE_CODE;
      if (inviteCode) {
        const supplied = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode : '';
        const suppliedBuffer = Buffer.from(supplied);
        const expectedBuffer = Buffer.from(inviteCode);
        if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
          return res.status(403).json({ success: false, error: 'Registration is invite-only right now' });
        }
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
            // Only the hash is stored (same as settings update); the
            // plaintext verify token is never persisted.
            webhookVerifyTokenHash: hashSecret(`cf_verify_${crypto.randomBytes(24).toString('hex')}`),
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
      // The slug pre-check races concurrent registrations; the unique index
      // is the real guard and its violation is a client error, not a 500.
      if (error && error.code === 'P2002') {
        return res.status(400).json({ success: false, error: 'A business with this slug or name already exists' });
      }
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
    // Revoke the presented session: bumping tokenVersion kills this token
    // (and any other outstanding tokens for the agent) immediately, instead
    // of merely clearing a cookie while the JWT lives on for days.
    try {
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
      const token = bearerToken && bearerToken !== 'null' && bearerToken !== 'undefined'
        ? bearerToken
        : readCookie(req.headers.cookie, 'chatflow_session');
      if (token) {
        const decoded = verifyAccessToken(token);
        const agentId = decoded && (decoded.agentId || decoded.id);
        if (typeof agentId === 'string') {
          await prisma.agent.update({
            where: { id: agentId },
            data: { tokenVersion: { increment: 1 } },
          });
        }
      }
    } catch (revokeError) {
      // Logout must succeed even if the presented token is already invalid.
      console.warn('[Auth Logout Revoke Notice]:', revokeError.message);
    }
    clearSessionCookie(res);
    return res.json({ success: true });
  }

  /**
   * POST /api/auth/change-password: rotate own password (revokes other sessions)
   */
  static async changePassword(req, res) {
    try {
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

      if (!currentPassword || newPassword.length < 10 || newPassword.length > 256) {
        return res.status(400).json({ success: false, error: 'Current password and a new password of at least 10 characters are required' });
      }
      if (Buffer.byteLength(newPassword, 'utf8') > 72) {
        return res.status(400).json({ success: false, error: 'Password is too long (maximum 72 bytes)' });
      }

      const isValid = await bcrypt.compare(currentPassword, req.agent.passwordHash);
      if (!isValid) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const updated = await prisma.agent.update({
        where: { id: req.agent.id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
        include: { tenant: true },
      });

      // Re-issue a session for THIS device on the new token version so the
      // user is not logged out of the tab they just secured.
      const token = signSession(updated);
      setSessionCookie(res, token);
      return res.json({ success: true, token, message: 'Password updated. Other sessions have been signed out.' });
    } catch (error) {
      console.error('[Auth Change Password Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to change password' });
    }
  }
}

module.exports = AuthController;
