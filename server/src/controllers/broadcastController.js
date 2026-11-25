const prisma = require('../db/prisma');
const { processBroadcast } = require('../services/broadcastWorker');
const { withTenantDb, rlsContextEnabled } = require('../db/withTenant');

const MAX_RECIPIENTS = 10000;
const DB_BATCH_SIZE = 500;

function normalizeVariables(variables) {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) return null;
  const normalized = {};
  for (const [key, value] of Object.entries(variables)) {
    if (!/^\d{1,3}$/.test(key) || (typeof value !== 'string' && typeof value !== 'number')) return null;
    normalized[key] = String(value).slice(0, 1024);
  }
  return normalized;
}

async function resolveBroadcastContacts(db, tenantId, importedRecipients, contactIds) {
  const targetMap = new Map();
  const importedMap = new Map();

  for (const item of importedRecipients.slice(0, MAX_RECIPIENTS)) {
    const rawPhone = typeof item === 'string' ? item : item?.phone;
    const contactName = typeof item === 'object' && item?.name ? String(item.name).trim().slice(0, 120) : null;
    const cleanPhone = String(rawPhone || '').replace(/\D/g, '');
    if (cleanPhone.length >= 8 && cleanPhone.length <= 20) {
      importedMap.set(cleanPhone, contactName || importedMap.get(cleanPhone) || null);
    }
  }

  if (importedMap.size > 0) {
    const waIds = Array.from(importedMap.keys());
    const existing = await db.contact.findMany({
      where: { tenantId, waId: { in: waIds } },
      select: { id: true, waId: true, name: true },
    });
    const existingByWaId = new Map(existing.map((c) => [c.waId, c]));
    const toCreate = [];
    const toUpdate = [];
    for (const [waId, name] of importedMap.entries()) {
      const match = existingByWaId.get(waId);
      if (!match) toCreate.push({ tenantId, waId, name: name || `+${waId}` });
      else if (name && match.name !== name) toUpdate.push({ id: match.id, name });
    }
    for (let i = 0; i < toCreate.length; i += DB_BATCH_SIZE) {
      await db.contact.createMany({ data: toCreate.slice(i, i + DB_BATCH_SIZE), skipDuplicates: true });
    }
    for (let i = 0; i < toUpdate.length; i += 25) {
      await Promise.all(
        toUpdate.slice(i, i + 25).map((entry) => db.contact.update({ where: { id: entry.id }, data: { name: entry.name } }))
      );
    }
    const hydrated = await db.contact.findMany({
      where: { tenantId, waId: { in: waIds } },
      select: { id: true, waId: true, name: true },
    });
    hydrated.forEach((c) => targetMap.set(c.id, c));
  }

  if (contactIds.length > 0) {
    const found = await db.contact.findMany({
      where: { tenantId, id: { in: [...new Set(contactIds)] } },
      select: { id: true, waId: true, name: true },
    });
    found.forEach((c) => targetMap.set(c.id, c));
  }

  return Array.from(targetMap.values());
}

class BroadcastController {
  static async listBroadcasts(req, res) {
    try {
      const broadcasts = await req.db((db) =>
        db.broadcast.findMany({
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
        })
      );

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
      const contactIds = Array.isArray(req.body?.contactIds) ? req.body.contactIds : [];
      const importedRecipients = Array.isArray(req.body?.importedRecipients) ? req.body.importedRecipients : [];
      const variables = normalizeVariables(req.body?.variables || {});

      if (!name || name.length > 120 || typeof templateId !== 'string' ||
        (!contactIds.length && !importedRecipients.length) ||
        contactIds.length > MAX_RECIPIENTS ||
        contactIds.some((contactId) => typeof contactId !== 'string') || !variables) {
        return res.status(400).json({
          success: false,
          error: 'Campaign name, approved template, variables, and at least one recipient are required',
        });
      }

      const tenantId = req.tenantId;
      const template = await req.db((db) =>
        db.template.findFirst({
          where: { id: templateId, tenantId, status: 'APPROVED' },
        })
      );
      if (!template) return res.status(404).json({ success: false, error: 'Approved template not found' });

      const targetContacts = await req.db((db) =>
        resolveBroadcastContacts(db, tenantId, importedRecipients, contactIds)
      );
      if (targetContacts.length === 0 || targetContacts.length > MAX_RECIPIENTS) {
        return res.status(400).json({ success: false, error: `No valid contacts found or limit exceeded (max ${MAX_RECIPIENTS})` });
      }

      const runBroadcastTx = rlsContextEnabled()
        ? (cb) => withTenantDb(tenantId, cb)
        : (cb) => prisma.$transaction(cb);
      const broadcast = await runBroadcastTx(async (tx) => {
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
