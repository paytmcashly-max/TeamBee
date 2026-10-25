const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { getJwtSecret, verifyAccessToken, readCookie, invalidateAgentCache } = require('../middleware/authMiddleware');
const { hashSecret } = require('../services/credentialCrypto');
const { logAuditEvent } = require('../services/auditLog');
const { sendEmail, appBaseUrl } = require('../services/emailService');

// Compared against when the account does not exist, so unknown-email and
// wrong-password logins cost the same bcrypt time (no enumeration oracle).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 10);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

// Effective subscription status: a TRIAL whose trialEndsAt has passed is
// EXPIRED everywhere it is read (login, /me, register) without needing a
// background job to flip the stored value.
function effectiveSubscriptionStatus(tenant) {
  if (!tenant) return 'ACTIVE';
  if (
    tenant.subscriptionStatus === 'TRIAL' &&
    tenant.trialEndsAt &&
    new Date(tenant.trialEndsAt).getTime() < Date.now()
  ) {
    return 'EXPIRED';
  }
  return tenant.subscriptionStatus || 'ACTIVE';
}

function publicTenant(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    displayPhoneNumber: tenant.displayPhoneNumber,
    hasMetaConfigured: Boolean(tenant.phoneNumberId && tenant.accessToken),
    plan: tenant.plan || 'PRO',
    subscriptionStatus: effectiveSubscriptionStatus(tenant),
    trialEndsAt: tenant.trialEndsAt || null,
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

// The SPA and this API are always served from different origins in this
// deployment (separate frontend/backend hosts), so the session cookie
// must be SameSite=None (+Secure) for browsers to send it on the app's
// cross-origin fetches at all. With the old Lax default the cookie was
// silently withheld after every page reload: /api/auth/me failed, the
// socket had no token, and users saw a permanent "connection lost"
// banner plus repeat logouts. COOKIE_SAME_SITE can still override.
function sessionSameSite() {
  const sameSite = String(process.env.COOKIE_SAME_SITE || 'none').toLowerCase();
  return sameSite === 'strict' ? 'Strict' : sameSite === 'lax' ? 'Lax' : 'None';
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  const sameSite = sessionSameSite();
  const attributes = [
    `chatflow_session=${encodeURIComponent(token)}`,
    'Max-Age=604800',
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
  ];
  // SameSite=None is only honoured by browsers together with Secure.
  if (secure || sameSite === 'None') attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `chatflow_session=; Max-Age=0; Path=/; HttpOnly; SameSite=${sessionSameSite()}`
  );
}

class AuthController {
  /**
   * POST /api/auth/workspaces/lookup: which workspaces can this email sign
   * in to? Powers the login page's chooser: the page fetches this when an
   * email is entered and shows a chooser only when 2+ active workspaces
   * exist; a single workspace scopes the login silently. Rate-limited at
   * the route. Only names + slugs are returned here — display phone
   * numbers and roles stay behind password verification (see the login
   * handler's WORKSPACE_SELECTION_REQUIRED payload).
   */
  static async lookupWorkspaces(req, res) {
    try {
      const email = cleanString(req.body?.email, 254).toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ success: false, error: 'A valid email is required' });
      }

      const agents = await prisma.agent.findMany({
        where: { email, isActive: true },
        include: { tenant: true },
        take: 25,
      });

      const byTenant = new Map();
      for (const agent of agents) {
        if (agent.tenant && !byTenant.has(agent.tenant.id)) {
          byTenant.set(agent.tenant.id, {
            tenantId: agent.tenant.id,
            name: agent.tenant.name,
            slug: agent.tenant.slug,
          });
        }
      }

      return res.json({ success: true, workspaces: [...byTenant.values()] });
    } catch (error) {
      console.error('[Workspace Lookup Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to look up workspaces' });
    }
  }

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

      // Account resolution. The same email may have an account in several
      // workspaces, each with its own password. Design:
      //  - slug given        -> verify only that workspace's account
      //  - one account       -> verify it
      //  - several accounts  -> verify the password against each; exactly one
      //    match signs straight in, several matches return a workspace
      //    picker payload (names are revealed ONLY after the password has
      //    verified, so the picker cannot be used to enumerate workspaces).
      let agent = null;
      if (tenantSlug) {
        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        agent = tenant ? matches.find((candidate) => candidate.tenantId === tenant.id) || null : null;
        const isValidPassword = await bcrypt.compare(password, agent ? agent.passwordHash : DUMMY_PASSWORD_HASH);
        if (!agent || !isValidPassword) {
          await logAuditEvent({ event: 'LOGIN_FAILED', req, metadata: { email } });
          return res.status(401).json({ success: false, error: 'Invalid email or credentials' });
        }
      } else if (matches.length <= 1) {
        agent = matches[0] || null;
        const isValidPassword = await bcrypt.compare(password, agent ? agent.passwordHash : DUMMY_PASSWORD_HASH);
        if (!agent || !isValidPassword) {
          await logAuditEvent({ event: 'LOGIN_FAILED', req, metadata: { email } });
          return res.status(401).json({ success: false, error: 'Invalid email or credentials' });
        }
      } else {
        const verified = [];
        for (const candidate of matches.slice(0, 10)) {
          // Sequential by design: bounded at 10 accounts, and parallel
          // bcrypt would spike CPU on the login path.
          if (await bcrypt.compare(password, candidate.passwordHash)) {
            verified.push(candidate);
          }
        }
        if (verified.length === 0) {
          await logAuditEvent({ event: 'LOGIN_FAILED', req, metadata: { email } });
          return res.status(401).json({ success: false, error: 'Invalid email or credentials' });
        }
        const verifiedActive = verified.filter((candidate) => candidate.isActive);
        if (verifiedActive.length === 0) {
          return res.status(403).json({ success: false, error: 'This agent account is deactivated' });
        }
        if (verifiedActive.length > 1) {
          return res.json({
            success: false,
            code: 'WORKSPACE_SELECTION_REQUIRED',
            workspaces: verifiedActive.map((candidate) => ({
              tenantId: candidate.tenantId,
              name: candidate.tenant.name,
              slug: candidate.tenant.slug,
              displayPhoneNumber: candidate.tenant.displayPhoneNumber,
              role: candidate.role,
            })),
          });
        }
        agent = verifiedActive[0];
      }

      if (!agent.isActive) {
        return res.status(403).json({ success: false, error: 'This agent account is deactivated' });
      }

      await logAuditEvent({ tenantId: agent.tenantId, agentId: agent.id, event: 'LOGIN_SUCCESS', req });
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

      // Invite gate: when REGISTRATION_INVITE_CODE is configured,
      // self-serve registration closes to everyone without the code —
      // unless public signup has been deliberately opened
      // (PUBLIC_SIGNUP_ENABLED=true), in which case anyone may register
      // and the invite code remains valid as an alternate path.
      const inviteCode = process.env.REGISTRATION_INVITE_CODE;
      if (inviteCode && process.env.PUBLIC_SIGNUP_ENABLED !== 'true') {
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
            // New public signups start on a 14-day free trial of PRO.
            plan: 'PRO',
            subscriptionStatus: 'TRIAL',
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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

      await logAuditEvent({ tenantId: result.tenant.id, agentId: result.admin.id, event: 'REGISTER_TENANT', req, metadata: { slug: result.tenant.slug } });
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
      // A freshly minted session token rides along so a reloaded SPA can
      // restore its in-memory Bearer token (used by API calls and the
      // socket handshake) from the cookie-backed session. Same claims
      // and tokenVersion as the cookie token, so revocation still works.
      token: signSession(req.agent),
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
          invalidateAgentCache(agentId);
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
      invalidateAgentCache(req.agent.id);

      // Re-issue a session for THIS device on the new token version so the
      // user is not logged out of the tab they just secured.
      await logAuditEvent({ tenantId: req.agent.tenantId, agentId: req.agent.id, event: 'PASSWORD_CHANGED', req });
      const token = signSession(updated);
      setSessionCookie(res, token);
      return res.json({ success: true, token, message: 'Password updated. Other sessions have been signed out.' });
    } catch (error) {
      console.error('[Auth Change Password Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to change password' });
    }
  }
  /**
   * POST /api/auth/forgot-password: Start a self-serve reset. The
   * response is deliberately identical whether or not the email exists
   * (no account enumeration). A single-use token (1 hour) is emailed as
   * a link; only its SHA-256 hash is stored. With several workspaces on
   * one email, the email carries one link per workspace (max 3).
   */
  static async forgotPassword(req, res) {
    const generic = {
      success: true,
      message: 'If an account exists for that email, a password reset link is on its way.',
    };
    try {
      const email = cleanString(req.body?.email, 320).toLowerCase();
      if (!email || !EMAIL_PATTERN.test(email)) {
        return res.json(generic);
      }
      const matches = await prisma.agent.findMany({
        where: { email, isActive: true },
        include: { tenant: true },
        take: 3,
      });
      if (matches.length === 0) {
        return res.json(generic);
      }

      const links = [];
      for (const agent of matches) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await prisma.agent.update({
          where: { id: agent.id },
          data: {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
        await logAuditEvent({
          tenantId: agent.tenantId,
          agentId: agent.id,
          event: 'PASSWORD_RESET_REQUESTED',
          req,
        });
        links.push({ workspace: agent.tenant.name, url: `${appBaseUrl()}/?reset=${rawToken}` });
      }

      const listHtml = links
        .map(
          (l) =>
            `<p><strong>${l.workspace}</strong><br/><a href="${l.url}">Reset your password</a> — ${l.url}</p>`
        )
        .join('');
      const listText = links.map((l) => `${l.workspace}: ${l.url}`).join('\n\n');
      await sendEmail({
        to: email,
        subject: 'Reset your TeamBee password',
        html: `<p>Hello,</p><p>We received a request to reset your TeamBee password. The link${
          links.length > 1 ? 's below are' : ' below is'
        } valid for 1 hour. If you did not request this, you can ignore this email — your password stays unchanged.</p>${listHtml}`,
        text: `We received a request to reset your TeamBee password. The link(s) below are valid for 1 hour. If you did not request this, ignore this email.\n\n${listText}`,
      });

      return res.json(generic);
    } catch (error) {
      console.error('[Forgot Password Error]:', error);
      return res.json(generic);
    }
  }

  /**
   * POST /api/auth/reset-password: Complete a reset. Consumes the
   * token (single-use), rotates the password, and bumps tokenVersion so
   * every existing session is signed out.
   */
  static async resetPassword(req, res) {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!token || password.length < 10 || password.length > 256) {
        return res.status(400).json({ success: false, error: 'A valid reset link and a new password of at least 10 characters are required' });
      }
      if (Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ success: false, error: 'Password is too long (maximum 72 bytes)' });
      }
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const agent = await prisma.agent.findFirst({
        where: { passwordResetTokenHash: tokenHash, isActive: true },
      });
      if (!agent || !agent.passwordResetExpiresAt || agent.passwordResetExpiresAt.getTime() < Date.now()) {
        return res.status(400).json({ success: false, error: 'This reset link is invalid or has expired. Please request a new one.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          tokenVersion: { increment: 1 },
        },
      });
      invalidateAgentCache(agent.id);
      await logAuditEvent({
        tenantId: agent.tenantId,
        agentId: agent.id,
        event: 'PASSWORD_RESET_COMPLETED',
        req,
      });
      return res.json({ success: true, message: 'Password updated. Please sign in with your new password.' });
    } catch (error) {
      console.error('[Reset Password Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
  }
}

module.exports = AuthController;
