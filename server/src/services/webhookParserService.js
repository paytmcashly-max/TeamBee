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
  /**
   * Verify HMAC-SHA256 signature from Meta Cloud API
   * header: X-Hub-Signature-256 = "sha256=<hash>"
   */
  static verifySignature(rawBody, signatureHeader, appSecret) {
    if (!signatureHeader || !appSecret) {
      return false;
    }
    const elements = signatureHeader.split('=');
    const signatureHash = elements[1];
    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'utf-8'),
      Buffer.from(expectedHash, 'utf-8')
    );
  }

  /**
   * Resolve tenant from Meta webhook entry
   */
  static async resolveTenant(entry) {
    const wabaId = entry.id;
    let phoneNumberId = null;

    if (entry.changes && entry.changes[0]?.value?.metadata) {
      phoneNumberId = entry.changes[0].value.metadata.phone_number_id;
    }

    // Try finding by phoneNumberId first, then wabaId
    let tenant = null;
    if (phoneNumberId) {
      tenant = await prisma.tenant.findFirst({
        where: { phoneNumberId },
      });
    }

    if (!tenant && wabaId) {
      tenant = await prisma.tenant.findFirst({
        where: { wabaId },
      });
    }

    // Fallback: If no exact match (e.g. during onboarding or initial mock testing), pick primary tenant
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }

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

    if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
      return { success: false, reason: 'Invalid WhatsApp payload format', results };
    }

    for (const entry of payload.entry) {
      const tenant = await this.resolveTenant(entry);
      if (!tenant) {
        console.warn(`[Webhook Parser]: No registered tenant found for WABA entry ${entry.id}`);
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
            const waId = rawContact.wa_id;
            const profileName = rawContact.profile?.name || `Customer ${waId.slice(-4)}`;

            // Upsert contact in local database
            const contact = await prisma.contact.upsert({
              where: {
                tenantId_waId: {
                  tenantId: tenant.id,
                  waId,
                },
              },
              update: {
                name: profileName,
                updatedAt: new Date(),
              },
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
    const waMessageId = rawMsg.id;

    // Hardened Idempotency Check: Don't process duplicates
    const existing = await prisma.message.findUnique({
      where: { waMessageId },
    });
    if (existing) {
      console.log(`[Webhook Parser]: Duplicate message skipped (WAMID: ${waMessageId})`);
      return { created: false, message: existing };
    }

    const customerWaId = rawMsg.from;
    let contact = contactsMap.get(customerWaId);

    // If contact wasn't in contacts array, find or create
    if (!contact) {
      contact = await prisma.contact.upsert({
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

    // Extract normalized payload fields
    const parsedPayload = this.extractMessagePayload(rawMsg);

    // Find or create conversation session (Chat)
    let chat = await prisma.chat.findFirst({
      where: {
        tenantId: tenant.id,
        contactId: contact.id,
      },
    });

    const now = new Date();

    if (!chat) {
      // New conversation session created in UNASSIGNED queue
      chat = await prisma.chat.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          status: 'UNASSIGNED',
          lastMessagePreview: parsedPayload.content,
          lastMessageAt: now,
          lastCustomerMessageAt: now,
          unreadCount: 1,
          tags: JSON.stringify(['Inbound']),
        },
        include: {
          contact: true,
          assignedAgent: true,
        },
      });
    } else {
      // If chat was RESOLVED, customer reply automatically re-opens it
      const nextStatus = chat.status === 'RESOLVED' ? (chat.assignedAgentId ? 'OPEN' : 'UNASSIGNED') : chat.status;

      chat = await prisma.chat.update({
        where: { id: chat.id },
        data: {
          status: nextStatus,
          lastMessagePreview: parsedPayload.content,
          lastMessageAt: now,
          lastCustomerMessageAt: now,
          unreadCount: { increment: 1 },
        },
        include: {
          contact: true,
          assignedAgent: true,
        },
      });
    }

    // Persist Message Log
    const message = await prisma.message.create({
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
        createdAt: rawMsg.timestamp ? new Date(parseInt(rawMsg.timestamp, 10) * 1000) : now,
      },
    });

    // Broadcast immediately across Socket.io rooms
    broadcastNewMessage(tenant.id, chat.id, message, chat.assignedAgentId);

    return { created: true, message, chat };
  }

  /**
   * Parse delivery status update (sent -> delivered -> read -> failed)
   */
  static async parseDeliveryStatus(tenant, rawStatus) {
    const waMessageId = rawStatus.id;
    const metaStatus = (rawStatus.status || '').toUpperCase(); // 'SENT', 'DELIVERED', 'READ', 'FAILED'
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

    if (!message) {
      // Check if this was a broadcast recipient update
      const recipient = await prisma.broadcastRecipient.findFirst({
        where: { waMessageId },
      });

      if (recipient) {
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status,
            errorMessage,
            ...(status === 'DELIVERED' ? { deliveredAt: timestamp } : {}),
            ...(status === 'READ' ? { readAt: timestamp } : {}),
          },
        });

        // Increment campaign stats
        const fieldToIncrement =
          status === 'DELIVERED'
            ? 'deliveredCount'
            : status === 'READ'
            ? 'readCount'
            : status === 'FAILED'
            ? 'failedCount'
            : null;

        if (fieldToIncrement) {
          await prisma.broadcast.update({
            where: { id: recipient.broadcastId },
            data: { [fieldToIncrement]: { increment: 1 } },
          });
        }
        return { updated: true, type: 'broadcast', recipientId: recipient.id };
      }

      return { updated: false, reason: 'Message not found for WAMID' };
    }

    // Prevent regressing status (e.g. don't overwrite READ with DELIVERED)
    const statusPriority = { PENDING: 1, SENT: 2, DELIVERED: 3, READ: 4, FAILED: 5 };
    if (statusPriority[message.status] > statusPriority[status] && status !== 'FAILED') {
      return { updated: false, reason: 'Status already higher than update' };
    }

    const updatedMessage = await prisma.message.update({
      where: { id: message.id },
      data: {
        status,
        errorCode,
        errorMessage,
        updatedAt: timestamp,
      },
    });

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
