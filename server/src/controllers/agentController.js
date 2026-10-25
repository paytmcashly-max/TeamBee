const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const { logAuditEvent } = require('../services/auditLog');
const { invalidateAgentCache } = require('../middleware/authMiddleware');

class AgentController {
  /**
   * GET /api/agents: List all staff agents in tenant with active workload
   */
  static async listAgents(req, res) {
    try {
      const agents = await req.db((db) =>
        db.agent.findMany({
          where: { tenantId: req.tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          _count: {
            select: {
              assignedChats: {
                where: { status: 'OPEN' },
              },
            },
          },
        },
          orderBy: { name: 'asc' },
        })
      );

      const includeEmail = req.agent.role !== 'AGENT';
      const formatted = agents.map((a) => ({
        ...a,
        ...(includeEmail ? {} : { email: undefined }),
        activeChatCount: a._count.assignedChats,
      }));

      return res.json({ success: true, agents: formatted });
    } catch (error) {
      console.error('[List Agents Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to load staff list' });
    }
  }

  /**
   * POST /api/agents: Create a new agent account (Admin Only)
   */
  static async createAgent(req, res) {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const role = typeof req.body?.role === 'string' ? req.body.role.toUpperCase() : 'AGENT';

      if (!name || !email || !password || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || password.length > 256) {
        return res.status(400).json({ success: false, error: 'Name, email, and temporary password are required' });
      }
      if (!['AGENT', 'SUPERVISOR'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid agent role' });
      }
      if (Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ success: false, error: 'Password is too long (maximum 72 bytes)' });
      }

      // Plan seat limit: the pricing page promises per-plan agent caps —
      // enforce them here, at the only door agents are created through.
      const tenant = await req.db((db) => db.tenant.findUnique({ where: { id: req.tenantId } }));
      const { agentLimitForTenant, effectivePlanKey } = require('../services/planLimits');
      const seatLimit = agentLimitForTenant(tenant);
      const activeAgents = await req.db((db) =>
        db.agent.count({
          where: { tenantId: req.tenantId, isActive: true },
        })
      );
      if (activeAgents >= seatLimit) {
        return res.status(403).json({
          success: false,
          error: `Your ${effectivePlanKey(tenant)} plan includes up to ${seatLimit} agents. Upgrade your plan to add more team members.`,
          code: 'PLAN_SEAT_LIMIT',
        });
      }

      // Check duplicate
      const existing = await req.db((db) =>
        db.agent.findFirst({
          where: {
            tenantId: req.tenantId,
            email,
          },
        })
      );

      if (existing) {
        return res.status(400).json({ success: false, error: 'An agent with this email already exists in your organization' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const agent = await req.db((db) =>
        db.agent.create({
          data: {
          tenantId: req.tenantId,
          name,
          email,
          passwordHash,
           role,
          status: 'OFFLINE',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          isActive: true,
            createdAt: true,
          },
        })
      );

      await logAuditEvent({ tenantId: req.tenantId, agentId: req.agent.id, event: 'AGENT_CREATED', req, metadata: { createdAgentId: agent.id, role: agent.role } });
      return res.status(201).json({ success: true, agent });
    } catch (error) {
      console.error('[Create Agent Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to create agent account' });
    }
  }

  /**
   * PUT /api/agents/:id: Update agent status, role, or active state
   */
  static async updateAgent(req, res) {
    try {
      const { id } = req.params;
      const role = typeof req.body?.role === 'string' ? req.body.role.toUpperCase() : undefined;
      const isActive = req.body?.isActive;
      const status = typeof req.body?.status === 'string' ? req.body.status.toUpperCase() : undefined;
      const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : undefined;

      if (role !== undefined && !['AGENT', 'SUPERVISOR', 'ADMIN'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid agent role' });
      }
      if (status !== undefined && !['ONLINE', 'BUSY', 'OFFLINE'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid agent status' });
      }
      if (isActive !== undefined && typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, error: 'isActive must be a boolean' });
      }

      // Regular agents can only update their own status (ONLINE / BUSY / OFFLINE)
      if (req.agent.role === 'AGENT' && req.agent.id !== id) {
        return res.status(403).json({ success: false, error: 'You can only update your own profile status' });
      }

      const updateData = {};
      if (status) updateData.status = status;
      if (name) updateData.name = name;

      // Admin only permissions
      if (req.agent.role === 'ADMIN' || req.agent.role === 'SUPERVISOR') {
        // Supervisors cannot grant/revoke tenant-admin privileges.
        if (role && (req.agent.role === 'ADMIN' || role !== 'ADMIN')) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
      }

      const target = await req.db((db) =>
        db.agent.findFirst({
          where: { id, tenantId: req.tenantId },
          select: { id: true, role: true, isActive: true },
        })
      );
      if (!target) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }
      if (req.agent.role === 'SUPERVISOR' && target.role === 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Supervisors cannot update tenant administrators' });
      }

      // Last-admin guard: a tenant must always keep at least one active
      // ADMIN, or tenant settings/credentials become unchangeable forever.
      const demotesAdmin = target.role === 'ADMIN' && updateData.role && updateData.role !== 'ADMIN';
      const deactivatesAdmin = target.role === 'ADMIN' && updateData.isActive === false;
      if (demotesAdmin || deactivatesAdmin) {
        const otherAdmins = await req.db((db) =>
          db.agent.count({
            where: { tenantId: req.tenantId, role: 'ADMIN', isActive: true, id: { not: target.id } },
          })
        );
        if (otherAdmins === 0) {
          return res.status(400).json({
            success: false,
            error: 'This is the last active admin of the workspace. Promote another admin first.',
          });
        }
      }

      // Admin password reset (the recovery path for a locked-out agent):
      // sets a new password and revokes every outstanding session.
      const newPassword = typeof req.body?.password === 'string' ? req.body.password : undefined;
      if (newPassword !== undefined) {
        if (req.agent.role !== 'ADMIN') {
          return res.status(403).json({ success: false, error: 'Only an admin can reset passwords' });
        }
        if (newPassword.length < 10 || newPassword.length > 256 || Buffer.byteLength(newPassword, 'utf8') > 72) {
          return res.status(400).json({ success: false, error: 'Password must be 10-256 characters (maximum 72 bytes)' });
        }
        updateData.passwordHash = await bcrypt.hash(newPassword, 10);
        updateData.tokenVersion = { increment: 1 };
      }

      // Deactivation kills live sessions immediately via token revocation.
      if (updateData.isActive === false) {
        updateData.tokenVersion = { increment: 1 };
      }

      const updated = await req.db((db) =>
        db.agent.update({
          where: { id: target.id },
          data: updateData,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            isActive: true,
          },
        })
      );

      // Role/status/password edits take effect immediately, not at cache TTL.
      invalidateAgentCache(target.id);

      return res.json({ success: true, agent: updated });
    } catch (error) {
      console.error('[Update Agent Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to update agent' });
    }
  }

  /**
   * GET /api/agents/analytics: Overview of response speeds & SLA for Admin
   */
  static async getAnalytics(req, res) {
    try {
      const totalChats = await req.db((db) => db.chat.count({ where: { tenantId: req.tenantId } }));
      const openChats = await req.db((db) => db.chat.count({ where: { tenantId: req.tenantId, status: 'OPEN' } }));
      const unassignedChats = await req.db((db) => db.chat.count({ where: { tenantId: req.tenantId, status: 'UNASSIGNED' } }));
      const resolvedChats = await req.db((db) => db.chat.count({ where: { tenantId: req.tenantId, status: 'RESOLVED' } }));
      const totalMessages = await req.db((db) => db.message.count({ where: { tenantId: req.tenantId } }));

      // Average response time computed IN SQL over the last 30 days — the
      // previous version loaded up to 10,000 message rows into JS and paired
      // them in a loop, which degrades linearly with tenant volume. The SQL
      // replicates the exact pairing semantics: a "burst" starts at an
      // inbound message whose predecessor was not inbound; it is answered by
      // the first outbound that follows an inbound; the metric averages
      // (answered_at - burst_start) over all answered bursts.
      const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const slaRows = await req.db((db) => db.$queryRaw`
        WITH ordered AS (
          SELECT id, chat_id, direction, created_at,
                 LAG(direction) OVER (PARTITION BY chat_id ORDER BY created_at, id) AS prev_dir
          FROM messages
          WHERE tenant_id = ${req.tenantId} AND created_at >= ${windowStart}
        ),
        bursts AS (
          SELECT id, chat_id, created_at AS burst_start
          FROM ordered
          WHERE direction = 'INBOUND' AND (prev_dir IS NULL OR prev_dir <> 'INBOUND')
        ),
        responses AS (
          SELECT chat_id, created_at AS responded_at
          FROM ordered
          WHERE direction = 'OUTBOUND' AND prev_dir = 'INBOUND'
        ),
        pairs AS (
          SELECT b.id, b.burst_start, MIN(r.responded_at) AS responded_at
          FROM bursts b
          JOIN responses r
            ON r.chat_id = b.chat_id AND r.responded_at > b.burst_start
          GROUP BY b.id, b.burst_start
        )
        SELECT CAST(AVG(EXTRACT(EPOCH FROM (responded_at - burst_start))) AS double precision) AS avg_sec
        FROM pairs
      `);
      const averageResponse =
        slaRows.length && slaRows[0].avg_sec != null ? Math.round(slaRows[0].avg_sec) : null;
      const resolutionRate = totalChats ? `${((resolvedChats / totalChats) * 100).toFixed(1)}%` : '0.0%';

      return res.json({
        success: true,
        metrics: {
          totalChats,
          openChats,
          unassignedChats,
          resolvedChats,
          totalMessages,
          avgResponseTimeSec: averageResponse,
          firstContactResolutionRate: resolutionRate,
        },
      });
    } catch (error) {
      console.error('[Agent Analytics Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve analytics' });
    }
  }
}

module.exports = AgentController;
