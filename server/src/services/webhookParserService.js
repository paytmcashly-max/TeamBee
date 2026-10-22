const crypto = require('crypto');
const prisma = require('../db/prisma');
const {
  broadcastNewMessage,
  broadcastMessageStatus,
} = require('./socketService');

/**
 * Hardened Webhook Parser Engine for Meta WhatsApp Cloud API (v20.0+)
 */
class WebhookParserService {
  static async processStoredWebhookEvent(eventId) {
    const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status === 'PROCESSED' || event.attempts >= 10) return event;

    const claimed = await prisma.webhookEvent.updateMany({
      where: {
        id: eventId,
        status: { in: ['RECEIVED', 'FAILED'] },
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count === 0) return prisma.webhookEvent.findUnique({ where: { id: eventId } });

    try {
      const result = await this.processWebhookPayload(JSON.parse(event.payload));
      if (!result.success || result.results.errors.length > 0) {
        const error = result.reason || result.results.errors[0]?.error || 'Webhook processing failed';
        await prisma.webhookEvent.update({
          where: { id: eventId },
          data: { status: 'FAILED', lastError: error },
        });
        return result;
      }

      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
      });
      return result;
    } catch (error) {
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: 'FAILED', lastError: error.message.slice(0, 1000) },
      });
      throw error;
    }
  }

  static async drainPendingWebhookEvents(limit = 50) {
    const staleProcessingBefore = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.webhookEvent.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: staleProcessingBefore },
      },
      data: { status: 'RECEIVED', lastError: 'Recovered stale processing event' },
    });
    const events = await prisma.webhookEvent.findMany({
      where: { status: { in: ['RECEIVED', 'FAILED'] }, attempts: { lt: 10 } },
      orderBy: { receivedAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    for (const event of events) {
      await this.processStoredWebhookEvent(event.id);
    }
    return events.length;
  }

  /**
   * Verify HMAC-SHA256 signature from Meta Cloud API
   * header: X-Hub-Signature-256 = "sha256=<hash>"
   */
  static verifySignature(rawBody, signatureHeader, appSecret) {
    if (!rawBody || !signatureHeader || typeof appSecret !== 'string' || !appSecret) {
      return false;
    }
    const match = /^sha256=([a-f0-9]{64})$/i.exec(String(signatureHeader).trim());
    if (!match) return false;

    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest();

    const receivedHash = Buffer.from(match[1], 'hex');
    return receivedHash.length === expectedHash.length && crypto.timingSafeEqual(receivedHash, expectedHash);
  }

  /**
   * Resolve tenant from Meta webhook entry
   */
  static async resolveTenant(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const wabaId = typeof entry.id === 'string' ? entry.id : null;
    const phoneNumberIds = entry.changes
      ?.map((change) => change?.value?.metadata?.phone_number_id)
      .filter((value) => typeof value === 'string' && value) || [];
    if (new Set(phoneNumberIds).size > 1) return null;
    const phoneNumberId = phoneNumberIds[0] || null;

    let tenant = null;
    if (phoneNumberId) {
      tenant = await prisma.tenant.findFirst({ where: { phoneNumberId } });
      // When Meta supplies both identifiers they must identify the same tenant.
      if (tenant && wabaId && tenant.wabaId !== wabaId) return null;
    } else if (wabaId) {
      tenant = await prisma.tenant.findFirst({ where: { wabaId } });
    }

    // Never route an unknown webhook to an arbitrary/primary tenant.
    return tenant;
  }

  /**
   * Parse full Meta Cloud API POST webhook payload
   */
  static async processWebhookPayload(payload) {
    const results = {
      processedMessages: 0,
      processedStatuses: 0,
      errors: [],
    };

    if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry) || payload.entry.length > 100) {
      return { success: false, reason: 'Invalid WhatsApp payload format', results };
    }

    let unresolvedEntries = 0;
    for (const entry of payload.entry) {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.changes)) {
        results.errors.push({ error: 'Invalid webhook entry' });
        continue;
      }
      const tenant = await this.resolveTenant(entry);
      if (!tenant) {
        console.warn(`[Webhook Parser]: No registered tenant found for WABA entry ${entry.id}`);
        if (entry.changes.some((change) => change.field === 'messages')) unresolvedEntries += 1;
        continue;
      }

      for (const change of entry.changes || []) {
        if (change.field !== 'messages' || !change.value) {
          continue;
        }

        const value = change.value;
        const contactsMap = new Map();

        // 1. Ingest contact profiles from payload
         if (Array.isArray(value.contacts)) {
           for (const rawContact of value.contacts) {
             const waId = typeof rawContact?.wa_id === 'string' ? rawContact.wa_id : null;
             if (!/^\d{3,32}$/.test(waId)) continue;
             const profileName = typeof rawContact.profile?.name === 'string'
               ? rawContact.profile.name.slice(0, 120)
               : `Customer ${waId.slice(-4)}`;

            // Upsert contact in local database
            const contact = await prisma.contact.upsert({
              where: {
                tenantId_waId: {
                  tenantId: tenant.id,
                  waId,
                },
              },
              // Name is set on create only: an agent may have renamed this
              // contact in the CRM, and the customer's next message must
              // not silently revert it to their WhatsApp profile name.
              update: {},
              create: {
                tenantId: tenant.id,
                waId,
                name: profileName,
                customAttributes: JSON.stringify({
                  source: 'WHATSAPP_INBOUND',
                  phone: waId,
                }),
              },
            });
            contactsMap.set(waId, contact);
          }
        }

        // 2. Parse Inbound Customer Messages
        if (Array.isArray(value.messages)) {
          for (const rawMsg of value.messages) {
            try {
              const msgResult = await this.parseInboundMessage(tenant, rawMsg, contactsMap);
              if (msgResult.created) {
                results.processedMessages++;
              }
            } catch (err) {
              console.error(`[Webhook Parser Error] Processing message ${rawMsg.id}:`, err);
              results.errors.push({ id: rawMsg.id, error: err.message });
            }
          }
        }

        // 3. Parse Outbound Delivery Status Updates (sent -> delivered -> read -> failed)
        if (Array.isArray(value.statuses)) {
          for (const rawStatus of value.statuses) {
            try {
              const statusResult = await this.parseDeliveryStatus(tenant, rawStatus);
              if (statusResult.updated) {
                results.processedStatuses++;
              }
            } catch (err) {
              console.error(`[Webhook Parser Error] Processing status ${rawStatus.id}:`, err);
              results.errors.push({ id: rawStatus.id, error: err.message });
            }
          }
        }
      }
    }

    // An entry that carried messages/statuses but matched no tenant means
    // the messages were dropped: fail the event so it stays visible and
    // retryable instead of being marked PROCESSED.
    if (unresolvedEntries > 0 && results.processedMessages === 0 && results.processedStatuses === 0) {
      return { success: false, reason: 'No registered tenant matched the webhook payload', results };
    }

    return { success: true, results };
  }

  /**
   * Extract content, media attachments, and metadata for a single message
   */
  static extractMessagePayload(rawMsg) {
    const type = rawMsg.type || 'text';
    let content = '';
    let mediaUrl = null;
    let mediaMimeType = null;
    let mediaFilename = null;
    let mediaId = null;
    let messageType = 'TEXT';

    switch (type) {
      case 'text':
        messageType = 'TEXT';
        content = rawMsg.text?.body || '';
        break;

      case 'image':
        messageType = 'IMAGE';
        mediaId = rawMsg.image?.id;
        mediaMimeType = rawMsg.image?.mime_type || 'image/jpeg';
        content = rawMsg.image?.caption || 'Photo';
        mediaUrl = rawMsg.image?.url || null;
        break;

      case 'audio':
      case 'voice':
        messageType = 'AUDIO';
        mediaId = rawMsg.audio?.id;
        mediaMimeType = rawMsg.audio?.mime_type || 'audio/ogg';
        content = rawMsg.audio?.voice ? 'Voice note' : 'Audio file';
        break;

      case 'video':
        messageType = 'VIDEO';
        mediaId = rawMsg.video?.id;
        mediaMimeType = rawMsg.video?.mime_type || 'video/mp4';
        content = rawMsg.video?.caption || 'Video';
        break;

      case 'document':
        messageType = 'DOCUMENT';
        mediaId = rawMsg.document?.id;
        mediaMimeType = rawMsg.document?.mime_type || 'application/pdf';
        mediaFilename = rawMsg.document?.filename || 'Document';
        content = rawMsg.document?.caption || mediaFilename;
        break;

      case 'location':
        messageType = 'LOCATION';
        const loc = rawMsg.location || {};
        content = loc.name
          ? `📍 ${loc.name} (${loc.address || ''})`
          : `📍 Coordinates: ${loc.latitude}, ${loc.longitude}`;
        break;

      case 'interactive':
        messageType = 'INTERACTIVE';
        if (rawMsg.interactive?.button_reply) {
          content = `🔘 ${rawMsg.interactive.button_reply.title}`;
        } else if (rawMsg.interactive?.list_reply) {
          content = `📋 ${rawMsg.interactive.list_reply.title}: ${rawMsg.interactive.list_reply.description || ''}`;
        } else {
          content = 'Interactive response';
        }
        break;

      case 'button':
        messageType = 'INTERACTIVE';
        content = `🔘 ${rawMsg.button?.text || 'Button clicked'}`;
        break;

      case 'contacts':
        messageType = 'CONTACTS';
        const contactNames = (rawMsg.contacts || [])
          .map((c) => c.name?.formatted_name)
          .filter(Boolean)
          .join(', ');
        content = `👤 Contact Card: ${contactNames || 'Shared contact'}`;
        break;

      default:
        messageType = 'TEXT';
        content = `[${type} message received]`;
    }

    return {
      messageType,
      content,
      mediaUrl,
      mediaMimeType,
      mediaFilename,
      mediaId,
    };
  }

  /**
   * Parse and persist an inbound message
   */
  static async parseInboundMessage(tenant, rawMsg, contactsMap) {
    const waMessageId = typeof rawMsg?.id === 'string' ? rawMsg.id : null;
    if (!waMessageId || waMessageId.length > 255 || !/^\d{3,32}$/.test(rawMsg.from || '')) {
      throw new Error('Invalid inbound message payload');
    }
    const customerWaId = rawMsg.from;
    const parsedPayload = this.extractMessagePayload(rawMsg);
    const now = new Date();
    // Chat ordering and the 24h window key off when the CUSTOMER sent the
    // message (Meta's timestamp), not when this server happened to process
    // it — a webhook retried hours late must not reopen an expired window.
    const inboundAt = Number.isFinite(Number.parseInt(rawMsg.timestamp, 10))
      ? new Date(Number.parseInt(rawMsg.timestamp, 10) * 1000)
      : now;
    let result;

    try {
      // Keep the duplicate check, chat counters, and message insert in one
      // transaction. A concurrent webhook retry can then lose on the unique
      // WAMID constraint without incrementing unreadCount twice.
      result = await prisma.$transaction(async (tx) => {
        const existing = await tx.message.findUnique({ where: { waMessageId } });
        if (existing) {
          if (existing.tenantId !== tenant.id) throw new Error('Message belongs to another tenant');
          return { created: false, message: existing };
        }

        let contact = contactsMap.get(customerWaId);
        if (!contact) {
          contact = await tx.contact.upsert({
            where: {
              tenantId_waId: {
                tenantId: tenant.id,
                waId: customerWaId,
              },
            },
            update: {},
            create: {
              tenantId: tenant.id,
              waId: customerWaId,
              name: `Customer ${customerWaId.slice(-4)}`,
            },
          });
        }

        let chat = await tx.chat.findFirst({
          where: {
            tenantId: tenant.id,
            contactId: contact.id,
          },
        });

        if (!chat) {
          chat = await tx.chat.create({
            data: {
              tenantId: tenant.id,
              contactId: contact.id,
              status: 'UNASSIGNED',
              lastMessagePreview: parsedPayload.content,
              lastMessageAt: inboundAt,
              lastCustomerMessageAt: inboundAt,
              unreadCount: 1,
              tags: JSON.stringify(['Inbound']),
            },
          });
        } else {
          const nextStatus = chat.status === 'RESOLVED'
            ? (chat.assignedAgentId ? 'OPEN' : 'UNASSIGNED')
            : chat.status;

          chat = await tx.chat.update({
            where: { id: chat.id },
            data: {
              status: nextStatus,
              lastMessagePreview: parsedPayload.content,
              lastMessageAt: chat.lastMessageAt && chat.lastMessageAt > inboundAt ? chat.lastMessageAt : inboundAt,
              lastCustomerMessageAt: chat.lastCustomerMessageAt && chat.lastCustomerMessageAt > inboundAt
                ? chat.lastCustomerMessageAt
                : inboundAt,
              unreadCount: { increment: 1 },
            },
          });
        }

        const message = await tx.message.create({
          data: {
            chatId: chat.id,
            tenantId: tenant.id,
            senderType: 'CUSTOMER',
            waMessageId,
            messageType: parsedPayload.messageType,
            content: parsedPayload.content,
            mediaUrl: parsedPayload.mediaUrl,
            mediaMimeType: parsedPayload.mediaMimeType,
            mediaFilename: parsedPayload.mediaFilename,
            mediaId: parsedPayload.mediaId,
            rawPayload: JSON.stringify(rawMsg),
            direction: 'INBOUND',
            status: 'DELIVERED',
            createdAt: inboundAt,
          },
        });

        return { created: true, message, chat };
      });
    } catch (error) {
      // If another retry won the unique insert race, return the committed
      // message as an idempotent duplicate instead of failing the webhook.
      if (error.code === 'P2002') {
        const existing = await prisma.message.findUnique({ where: { waMessageId } });
        if (existing && existing.tenantId === tenant.id) {
          console.log(`[Webhook Parser]: Duplicate message skipped (WAMID: ${waMessageId})`);
          return { created: false, message: existing };
        }
      }
      throw error;
    }

    if (!result.created) {
      console.log(`[Webhook Parser]: Duplicate message skipped (WAMID: ${waMessageId})`);
      return result;
    }

    // Broadcast only after the transaction commits.
    broadcastNewMessage(tenant.id, result.chat.id, result.message, result.chat.assignedAgentId);

    return result;
  }

  /**
   * Parse delivery status update (sent -> delivered -> read -> failed)
   */
  static async parseDeliveryStatus(tenant, rawStatus) {
    const waMessageId = typeof rawStatus?.id === 'string' ? rawStatus.id : null;
    if (!waMessageId || waMessageId.length > 255) throw new Error('Invalid delivery status payload');
    const metaStatus = (rawStatus.status || '').toUpperCase(); // 'SENT', 'DELIVERED', 'READ', 'FAILED'
    if (!['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(metaStatus)) {
      return { updated: false, reason: 'Invalid delivery status' };
    }
    const timestamp = rawStatus.timestamp
      ? new Date(parseInt(rawStatus.timestamp, 10) * 1000)
      : new Date();

    // Map status enum
    let status = 'SENT';
    if (metaStatus === 'DELIVERED') status = 'DELIVERED';
    else if (metaStatus === 'READ') status = 'READ';
    else if (metaStatus === 'FAILED') status = 'FAILED';

    let errorCode = null;
    let errorMessage = null;

    if (Array.isArray(rawStatus.errors) && rawStatus.errors.length > 0) {
      const err = rawStatus.errors[0];
      errorCode = String(err.code || '');
      errorMessage = err.title ? `${err.title}: ${err.message || err.error_data?.details || ''}` : err.message;
    }

    // Lookup matching outbound message
    const message = await prisma.message.findUnique({
      where: { waMessageId },
    });

    if (message && message.tenantId !== tenant.id) {
      return { updated: false, reason: 'Message belongs to another tenant' };
    }

    // A broadcast send creates BOTH a Message row and a BroadcastRecipient
    // row carrying the same WAMID — a status callback must update both, or
    // campaign delivered/read counters never move.
    const recipient = await prisma.broadcastRecipient.findFirst({
      where: { waMessageId },
      include: { broadcast: { select: { tenantId: true } } },
    });

    let recipientUpdated = false;
    if (recipient && recipient.broadcast.tenantId === tenant.id) {
        const statusPriority = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };
        // FAILED is terminal only from pre-delivery states — a late FAILED
        // callback must never regress a DELIVERED/READ record.
        const previousStatuses = status === 'FAILED'
          ? ['PENDING', 'SENT']
          : Object.keys(statusPriority).filter(
              (candidate) => statusPriority[candidate] < statusPriority[status]
            );
        if (previousStatuses.length === 0) {
          return { updated: false, reason: 'Status already applied' };
        }

        const changed = await prisma.$transaction(async (tx) => {
          // Conditional update makes duplicate callbacks idempotent even when
          // two webhook workers process the same WAMID concurrently.
          const updateResult = await tx.broadcastRecipient.updateMany({
            where: {
              id: recipient.id,
              status: { in: previousStatuses },
            },
            data: {
              status,
              errorMessage,
              ...(status === 'DELIVERED' ? { deliveredAt: timestamp } : {}),
              ...(status === 'READ' ? { readAt: timestamp } : {}),
            },
          });
          if (updateResult.count === 0) return false;

          const fieldToIncrement =
            status === 'DELIVERED'
              ? 'deliveredCount'
              : status === 'READ'
              ? 'readCount'
              : status === 'FAILED'
              ? 'failedCount'
              : null;
          if (fieldToIncrement) {
            await tx.broadcast.update({
              where: { id: recipient.broadcastId },
              data: { [fieldToIncrement]: { increment: 1 } },
            });
          }
          return true;
        });

        recipientUpdated = changed;
        if (!message) {
          return changed
            ? { updated: true, type: 'broadcast', recipientId: recipient.id }
            : { updated: false, reason: 'Status already applied' };
        }
    }

    if (!message) {
      return { updated: false, reason: 'Message not found for WAMID' };
    }

    // Prevent regressing or re-applying status (e.g. don't overwrite READ
    // with DELIVERED, and don't broadcast duplicate READ callbacks).
    const statusPriority = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };
    const previousStatuses = status === 'FAILED'
      ? ['PENDING', 'SENT']
      : Object.keys(statusPriority).filter(
          (candidate) => statusPriority[candidate] < statusPriority[status]
        );
    if (previousStatuses.length === 0) {
      return { updated: false, reason: 'Status already higher than update' };
    }

    const updateResult = await prisma.message.updateMany({
      where: {
        id: message.id,
        status: { in: previousStatuses },
      },
      data: {
        status,
        errorCode,
        errorMessage,
        // Never move updatedAt backwards for out-of-order callbacks.
        updatedAt: message.updatedAt && timestamp < message.updatedAt ? message.updatedAt : timestamp,
      },
    });
    if (updateResult.count === 0) {
      return { updated: false, reason: 'Status already higher than update' };
    }

    const updatedMessage = await prisma.message.findUnique({ where: { id: message.id } });

    // Real-time broadcast to active chat canvas
    broadcastMessageStatus(tenant.id, message.chatId, {
      messageId: message.id,
      waMessageId,
      status,
      recipientId: rawStatus.recipient_id,
      timestamp,
    });

    return { updated: true, type: 'message', message: updatedMessage };
  }
}

module.exports = WebhookParserService;
