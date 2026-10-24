'use strict';

const prisma = require('../db/prisma');

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanShortcut(value) {
  const raw = clean(value, 40).replace(/^\/+/, '').toLowerCase();
  return raw || null;
}

function shape(reply) {
  return {
    id: reply.id,
    title: reply.title,
    body: reply.body,
    shortcut: reply.shortcut,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  };
}

class QuickReplyController {
  /** GET /api/quick-replies — every agent in the tenant can read. */
  static async list(req, res) {
    try {
      const replies = await prisma.quickReply.findMany({
        where: { tenantId: req.tenantId },
        orderBy: [{ title: 'asc' }],
        take: 200,
      });
      return res.json({ success: true, quickReplies: replies.map(shape) });
    } catch (error) {
      console.error('[Quick Replies List Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to load quick replies' });
    }
  }

  /** POST /api/quick-replies — ADMIN / SUPERVISOR. */
  static async create(req, res) {
    try {
      const title = clean(req.body?.title, 80);
      const body = clean(req.body?.body, 1000);
      const shortcut = cleanShortcut(req.body?.shortcut);
      if (!title || !body) {
        return res.status(400).json({ success: false, error: 'Title and message text are required' });
      }
      const reply = await prisma.quickReply.create({
        data: { tenantId: req.tenantId, title, body, shortcut },
      });
      return res.status(201).json({ success: true, quickReply: shape(reply) });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'That shortcut is already used by another quick reply' });
      }
      console.error('[Quick Reply Create Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to create quick reply' });
    }
  }

  /** PUT /api/quick-replies/:id — ADMIN / SUPERVISOR, tenant-scoped. */
  static async update(req, res) {
    try {
      const existing = await prisma.quickReply.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Quick reply not found' });
      }
      const title = clean(req.body?.title, 80);
      const body = clean(req.body?.body, 1000);
      if (!title || !body) {
        return res.status(400).json({ success: false, error: 'Title and message text are required' });
      }
      const reply = await prisma.quickReply.update({
        where: { id: existing.id },
        data: { title, body, shortcut: cleanShortcut(req.body?.shortcut) },
      });
      return res.json({ success: true, quickReply: shape(reply) });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'That shortcut is already used by another quick reply' });
      }
      console.error('[Quick Reply Update Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to update quick reply' });
    }
  }

  /** DELETE /api/quick-replies/:id — ADMIN / SUPERVISOR, tenant-scoped. */
  static async remove(req, res) {
    try {
      const existing = await prisma.quickReply.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Quick reply not found' });
      }
      await prisma.quickReply.delete({ where: { id: existing.id } });
      return res.json({ success: true });
    } catch (error) {
      console.error('[Quick Reply Delete Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to delete quick reply' });
    }
  }
}

module.exports = QuickReplyController;
