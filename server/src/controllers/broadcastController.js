const prisma = require('../db/prisma');
const { processBroadcast } = require('../services/broadcastWorker');

const MAX_RECIPIENTS = 10000;

function normalizeVariables(variables) {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) return null;
  const normalized = {};
  for (const [key, value] of Object.entries(variables)) {
    if (!/^\d{1,3}$/.test(key) || (typeof value !== 'string' && typeof value !== 'number')) return null;
    normalized[key] = String(value).slice(0, 1024);
  }
  return normalized;
}

class BroadcastController {
  static async listBroadcasts(req, res) {
    try {
      const broadcasts = await prisma.broadcast.findMany({
        where: { tenantId: req.tenantId },
        include: {
          template: {
            select: { name: true, category: true, bodyText: true },
          },
          recipients: {
            take: 5,
            orderBy: { sentAt: 'desc' },
            select: { phone: true, name: true, status: true, sentAt: true, errorMessage: true, lastError: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return res.json({ success: true, broadcasts });
    } catch (error) {
      console.error('[List Broadcasts Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to list broadcasts' });
    }
  }

  static async createBroadcast(req, res) {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const templateId = req.body?.templateId;
      const contactIds = req.body?.contactIds;
      const variables = normalizeVariables(req.body?.variables || {});

      if (!name || name.length > 120 || typeof templateId !== 'string' || !Array.isArray(contactIds) ||
        contactIds.length === 0 || contactIds.length > MAX_RECIPIENTS ||
        contactIds.some((contactId) => typeof contactId !== 'string') || !variables) {
        return res.status(400).json({
          success: false,
          error: 'Campaign name, approved template, variables, and at least one recipient are required',
        });
      }

      const tenantId = req.tenantId;
      const template = await prisma.template.findFirst({
        where: { id: templateId, tenantId, status: 'APPROVED' },
      });
      if (!template) return res.status(404).json({ success: false, error: 'Approved template not found' });

      const targetContacts = await prisma.contact.findMany({
        where: { tenantId, id: { in: [...new Set(contactIds)] } },
        select: { id: true, waId: true, name: true },
      });
      if (targetContacts.length === 0) {
        return res.status(400).json({ success: false, error: 'No contacts selected or found for broadcast' });
      }

      const broadcast = await prisma.$transaction(async (tx) => {
        const created = await tx.broadcast.create({
          data: {
            tenantId,
            templateId,
            name,
            totalCount: targetContacts.length,
            status: 'RUNNING',
            variables: JSON.stringify(variables),
          },
        });

        await tx.broadcastRecipient.createMany({
          data: targetContacts.map((contact) => ({
            broadcastId: created.id,
            phone: contact.waId,
            name: contact.name,
            status: 'PENDING',
          })),
        });
        return created;
      });

      // Recipients are durable before the HTTP response. The worker can resume
      // this campaign after a process restart.
      setImmediate(() => processBroadcast(broadcast.id)
        .catch((error) => console.error('[Broadcast Runner Error]:', error)));

      return res.status(202).json({
        success: true,
        broadcast,
        message: `Campaign queued for ${targetContacts.length} recipients`,
      });
    } catch (error) {
      console.error('[Create Broadcast Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to queue broadcast campaign' });
    }
  }
}

module.exports = BroadcastController;
