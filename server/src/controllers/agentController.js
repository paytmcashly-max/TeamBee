const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const { invalidateAgentCache } = require('../middleware/authMiddleware');

class AgentController {
  /**
   * GET /api/agents: List all staff agents in tenant with active workload
   */
  static async listAgents(req, res) {
    try {
      const agents = await prisma.agent.findMany({
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
      });

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

      // Check duplicate
      const existing = await prisma.agent.findFirst({
        where: {
          tenantId: req.tenantId,
          email,
        },
      });

      if (existing) {
        return res.status(400).json({ success: false, error: 'An agent with this email already exists in your organization' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const agent = await prisma.agent.create({
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
      });

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

      const target = await prisma.agent.findFirst({
        where: { id, tenantId: req.tenantId },
        select: { id: true, role: true, isActive: true },
      });
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
        const otherAdmins = await prisma.agent.count({
          where: { tenantId: req.tenantId, role: 'ADMIN', isActive: true, id: { not: target.id } },
        });
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

      const updated = await prisma.agent.update({
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
      });

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
      const totalChats = await prisma.chat.count({ where: { tenantId: req.tenantId } });
      const openChats = await prisma.chat.count({ where: { tenantId: req.tenantId, status: 'OPEN' } });
      const unassignedChats = await prisma.chat.count({ where: { tenantId: req.tenantId, status: 'UNASSIGNED' } });
      const resolvedChats = await prisma.chat.count({ where: { tenantId: req.tenantId, status: 'RESOLVED' } });
      const totalMessages = await prisma.message.count({ where: { tenantId: req.tenantId } });

      // Bounded recent window (newest first, then re-sorted in JS): the old
      // query silently measured only the OLDEST 10,000 messages forever.
      const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentMessages = (await prisma.message.findMany({
        where: { tenantId: req.tenantId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: 10000,
        select: { chatId: true, direction: true, createdAt: true },
      })).reverse();
      const waitingSince = new Map();
      const responseTimes = [];
      for (const message of recentMessages) {
        if (message.direction === 'INBOUND' && !waitingSince.has(message.chatId)) {
          waitingSince.set(message.chatId, message.createdAt);
        } else if (message.direction === 'OUTBOUND' && waitingSince.has(message.chatId)) {
          responseTimes.push((message.createdAt.getTime() - waitingSince.get(message.chatId).getTime()) / 1000);
          waitingSince.delete(message.chatId);
        }
      }
      const averageResponse = responseTimes.length
        ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : null;
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
