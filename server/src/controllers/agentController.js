const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');

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

      const formatted = agents.map((a) => ({
        ...a,
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
      const { name, email, password, role = 'AGENT' } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Name, email, and temporary password are required' });
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
          role: role.toUpperCase(),
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
      const { role, isActive, status, name } = req.body;

      // Regular agents can only update their own status (ONLINE / BUSY / OFFLINE)
      if (req.agent.role === 'AGENT' && req.agent.id !== id) {
        return res.status(403).json({ success: false, error: 'You can only update your own profile status' });
      }

      const updateData = {};
      if (status) updateData.status = status;
      if (name) updateData.name = name;

      // Admin only permissions
      if (req.agent.role === 'ADMIN' || req.agent.role === 'SUPERVISOR') {
        if (role) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
      }

      const updated = await prisma.agent.update({
        where: { id },
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

      return res.json({
        success: true,
        metrics: {
          totalChats,
          openChats,
          unassignedChats,
          resolvedChats,
          totalMessages,
          avgResponseTimeSec: 84, // 1m 24s average SLA in demo
          firstContactResolutionRate: '78.5%',
        },
      });
    } catch (error) {
      console.error('[Agent Analytics Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve analytics' });
    }
  }
}

module.exports = AgentController;
