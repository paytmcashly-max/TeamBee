'use strict';

/**
 * WhatsApp reply (quote) support.
 *
 * A reply is anchored on the quoted message's Meta WAMID: the send API
 * passes it to Meta as `context.message_id`, and a display snapshot is
 * stored in the new message's rawPayload so the quote still renders even
 * if the original message is later edited or the thread is re-fetched.
 */

const MAX_REPLY_ID_LENGTH = 100;
const SNIPPET_LENGTH = 200;

/**
 * Validate a client-supplied replyToMessageId against the chat and build
 * the stored snapshot. Runs against a Prisma-like client (the request's
 * tenant-scoped accessor, a transaction, or plain prisma).
 *
 * Returns { snapshot } on success or { error } with a client-safe message.
 */
async function resolveReplySnapshot(db, { tenantId, chatId, replyToMessageId, contactName }) {
  if (typeof replyToMessageId !== 'string' || !replyToMessageId || replyToMessageId.length > MAX_REPLY_ID_LENGTH) {
    return { error: 'Invalid reply target' };
  }
  const target = await db.message.findFirst({
    where: { id: replyToMessageId, chatId, tenantId },
    include: {
      senderAgent: { select: { name: true } },
    },
  });
  if (!target) {
    return { error: 'The message you are replying to was not found in this chat' };
  }
  // Meta can only quote messages it knows about: inbound customer messages
  // and outbound ones that actually reached Meta (they carry a WAMID).
  // Notes, system rows and failed sends have none.
  if (!target.waMessageId) {
    return { error: 'This message cannot be quoted in a reply' };
  }
  const snapshot = {
    waMessageId: target.waMessageId,
    messageId: target.id,
    content: String(target.content || '').slice(0, SNIPPET_LENGTH),
    senderType: target.senderType,
    senderName:
      target.senderType === 'CUSTOMER'
        ? contactName || 'Customer'
        : target.senderAgent?.name || 'Team',
  };
  return { snapshot };
}

/**
 * Parse a stored rawPayload without ever throwing on legacy/junk values.
 */
function parseRawPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'string') return null;
  try {
    const parsed = JSON.parse(rawPayload);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = { resolveReplySnapshot, parseRawPayload };
