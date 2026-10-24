'use strict';

const prisma = require('../db/prisma');
const { broadcastChatSnoozeChanged } = require('./socketService');

/**
 * Clears snoozes whose time has come and notifies every affected client so
 * the chat resurfaces in the inbox. Driven by the server's 60s recovery
 * interval; safe to run on every instance because the clear is a guarded
 * updateMany per chat (only the instance that actually clears it emits).
 */
async function expireSnoozedChats() {
  const now = new Date();
  const expired = await prisma.chat.findMany({
    where: { snoozedUntil: { not: null, lte: now } },
    select: { id: true, tenantId: true, assignedAgentId: true },
    take: 200,
  });
  for (const chat of expired) {
    const cleared = await prisma.chat.updateMany({
      where: { id: chat.id, snoozedUntil: { not: null, lte: now } },
      data: { snoozedUntil: null, snoozedById: null },
    });
    if (cleared.count > 0) {
      broadcastChatSnoozeChanged(chat.tenantId, chat.id, null, chat.assignedAgentId);
    }
  }
  return expired.length;
}

module.exports = { expireSnoozedChats };
