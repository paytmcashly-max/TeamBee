const prisma = require('../db/prisma');
const MetaApiService = require('./metaApiService');
const { broadcastNewMessage } = require('./socketService');
const { prepareTemplateMessage } = require('./templateService');

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

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

    const contact = await prisma.contact.upsert({
      where: { tenantId_waId: { tenantId: broadcast.tenantId, waId: recipient.phone } },
      update: recipient.name ? { name: recipient.name } : {},
      create: { tenantId: broadcast.tenantId, waId: recipient.phone, name: recipient.name },
    });
    {
      let chat = await prisma.chat.findFirst({
        where: { tenantId: broadcast.tenantId, contactId: contact.id },
      });
      const now = new Date();
      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            tenantId: broadcast.tenantId,
            contactId: contact.id,
            status: 'OPEN',
            lastMessagePreview: renderedBody.slice(0, 80),
            lastMessageAt: now,
          },
        });
      } else {
        chat = await prisma.chat.update({
          where: { id: chat.id },
          data: { lastMessagePreview: renderedBody.slice(0, 80), lastMessageAt: now },
        });
      }

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

    await prisma.$transaction(async (tx) => {
      await tx.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'SENT', waMessageId: apiResult.wamid, sentAt: new Date(), lastError: null },
      });
      await tx.broadcast.update({
        where: { id: broadcast.id },
        data: { sentCount: { increment: 1 } },
      });
    });
  } catch (error) {
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: {
        status: recipient.attempts + 1 >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
        lastError: error.message.slice(0, 1000),
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
    const recipients = await prisma.broadcastRecipient.findMany({
      where: { broadcastId, status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (recipients.length === 0) break;
    for (const recipient of recipients) {
      await processRecipient(recipient.id);
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
