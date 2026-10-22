const prisma = require('../db/prisma');
const MetaApiService = require('./metaApiService');
const { broadcastNewMessage } = require('./socketService');
const { prepareTemplateMessage } = require('./templateService');

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;
const CONCURRENCY = 5;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

// Exponential backoff between retries: 30s, 1m, 2m, 4m ... capped at 30m.
function retryDelayMs(attemptsCompleted) {
  return Math.min(30_000 * 2 ** Math.max(0, attemptsCompleted - 1), 30 * 60_000);
}

async function processRecipient(recipientId) {
  const recipient = await prisma.broadcastRecipient.findUnique({
    where: { id: recipientId },
    include: {
      broadcast: {
        include: { template: true, tenant: true },
      },
    },
  });
  if (!recipient || !['PENDING', 'FAILED'].includes(recipient.status) || recipient.attempts >= MAX_ATTEMPTS) {
    return;
  }

  const claimed = await prisma.broadcastRecipient.updateMany({
    where: {
      id: recipient.id,
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      status: 'PROCESSING',
      attempts: { increment: 1 },
      lastError: null,
    },
  });
  if (claimed.count === 0) return;

  const { broadcast } = recipient;
  let variables = {};
  try {
    variables = broadcast.variables ? JSON.parse(broadcast.variables) : {};
  } catch (error) {
    variables = {};
  }

  try {
    const { renderedBody, components } = prepareTemplateMessage(
      broadcast.template.bodyText,
      variables,
      (index) => (index === 1 && recipient.name ? recipient.name : `Sample ${index}`)
    );
    const apiResult = await MetaApiService.sendTemplateMessage(
      broadcast.tenant,
      recipient.phone,
      broadcast.template.name,
      broadcast.template.language,
      components
    );

    if (!apiResult.success) {
      throw new Error(apiResult.error || 'Template delivery failed');
    }

    // CRITICAL ORDERING: persist the provider WAMID on the recipient FIRST.
    // The Meta send has already happened; if the process dies during the
    // transcript bookkeeping below, a retry must find this recipient SENT —
    // otherwise the customer receives the campaign twice.
    await prisma.$transaction(async (tx) => {
      await tx.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'SENT', waMessageId: apiResult.wamid, sentAt: new Date(), lastError: null, nextAttemptAt: null },
      });
      await tx.broadcast.update({
        where: { id: broadcast.id },
        data: { sentCount: { increment: 1 } },
      });
    });

    // Transcript bookkeeping is best-effort from here: a failure loses a
    // chat row, never a duplicate send.
    try {
      const contact = await prisma.contact.upsert({
        where: { tenantId_waId: { tenantId: broadcast.tenantId, waId: recipient.phone } },
        update: recipient.name ? { name: recipient.name } : {},
        create: { tenantId: broadcast.tenantId, waId: recipient.phone, name: recipient.name },
      });
      let chat = await prisma.chat.findFirst({
        where: { tenantId: broadcast.tenantId, contactId: contact.id },
      });
      const now = new Date();
      if (!chat) {
        try {
          chat = await prisma.chat.create({
            data: {
              tenantId: broadcast.tenantId,
              contactId: contact.id,
              status: 'OPEN',
              lastMessagePreview: renderedBody.slice(0, 80),
              lastMessageAt: now,
            },
          });
        } catch (createError) {
          if (createError.code !== 'P2002') throw createError;
          chat = await prisma.chat.findFirst({
            where: { tenantId: broadcast.tenantId, contactId: contact.id },
          });
        }
      } else {
        chat = await prisma.chat.update({
          where: { id: chat.id },
          data: { lastMessagePreview: renderedBody.slice(0, 80), lastMessageAt: now },
        });
      }

      if (chat) {
        const message = await prisma.message.create({
          data: {
            chatId: chat.id,
            tenantId: broadcast.tenantId,
            senderType: 'SYSTEM',
            messageType: 'TEMPLATE',
            content: renderedBody,
            rawPayload: JSON.stringify({ template: broadcast.template.name, variables }),
            direction: 'OUTBOUND',
            status: 'SENT',
            waMessageId: apiResult.wamid,
            createdAt: now,
          },
        });
        broadcastNewMessage(broadcast.tenantId, chat.id, message, chat.assignedAgentId);
      }
    } catch (bookkeepingError) {
      console.error(
        `[Broadcast Worker]: Recipient ${recipient.id} was SENT (WAMID ${apiResult.wamid}) but transcript bookkeeping failed:`,
        bookkeepingError.message
      );
    }
  } catch (error) {
    const attemptsCompleted = recipient.attempts + 1;
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: {
        status: attemptsCompleted >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
        lastError: error.message.slice(0, 1000),
        // The periodic drain picks the recipient up again once this passes,
        // instead of the old tight retry loop hammering a failing API.
        nextAttemptAt: attemptsCompleted >= MAX_ATTEMPTS
          ? null
          : new Date(Date.now() + retryDelayMs(attemptsCompleted)),
      },
    });
    if (recipient.attempts + 1 >= MAX_ATTEMPTS) {
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { failedCount: { increment: 1 } },
      });
    }
  }
}

async function finalizeBroadcast(broadcastId) {
  const remaining = await prisma.broadcastRecipient.count({
    where: { broadcastId, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  if (remaining === 0) {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'COMPLETED' },
    });
  }
}

async function processBroadcast(broadcastId) {
  while (true) {
    const now = new Date();
    const recipients = await prisma.broadcastRecipient.findMany({
      where: {
        broadcastId,
        status: { in: ['PENDING', 'FAILED'] },
        attempts: { lt: MAX_ATTEMPTS },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (recipients.length === 0) break;
    // Bounded concurrency: processRecipient claims each row atomically, so
    // parallel workers can never send to the same recipient twice.
    for (let offset = 0; offset < recipients.length; offset += CONCURRENCY) {
      await Promise.all(
        recipients.slice(offset, offset + CONCURRENCY).map((recipient) => processRecipient(recipient.id))
      );
    }
  }
  await finalizeBroadcast(broadcastId);
}

async function drainPendingBroadcasts(limit = 20) {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  await prisma.broadcastRecipient.updateMany({
    where: { status: 'PROCESSING', updatedAt: { lt: staleBefore } },
    data: { status: 'PENDING', lastError: 'Recovered stale processing recipient' },
  });
  const broadcasts = await prisma.broadcast.findMany({
    where: { status: { in: ['PENDING', 'RUNNING'] } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });
  for (const broadcast of broadcasts) {
    await processBroadcast(broadcast.id);
  }
  return broadcasts.length;
}

module.exports = {
  processBroadcast,
  drainPendingBroadcasts,
};
