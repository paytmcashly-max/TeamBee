const assert = require('assert');

// The parser depends on Prisma, but its behavior can be tested without a
// running database. Install a small in-memory Prisma-shaped fixture before
// loading the service so this command remains deterministic and offline.
const tenant = {
  id: 'tenant-fixture',
  name: 'Fixture Tenant',
  slug: 'fixture-tenant',
  wabaId: 'WABA_FIXTURE',
  phoneNumberId: 'PHONE_FIXTURE',
  displayPhoneNumber: '+91 90000 00000',
};

const state = {
  contacts: [],
  chats: [],
  messages: [],
};

let nextId = 1;
const id = (prefix) => `${prefix}-${nextId++}`;

function withChatRelations(chat) {
  return {
    ...chat,
    contact: state.contacts.find((contact) => contact.id === chat.contactId) || null,
    assignedAgent: null,
  };
}

function createFixturePrisma() {
  const fixturePrisma = {
    tenant: {
      async findFirst({ where } = {}) {
        if (!where) return tenant;
        if (where.phoneNumberId && where.phoneNumberId !== tenant.phoneNumberId) return null;
        if (where.wabaId && where.wabaId !== tenant.wabaId) return null;
        if (where.slug && where.slug !== tenant.slug) return null;
        return tenant;
      },
    },
    contact: {
      async upsert({ where, update, create }) {
        const key = where.tenantId_waId;
        let contact = state.contacts.find(
          (candidate) => candidate.tenantId === key.tenantId && candidate.waId === key.waId
        );

        if (contact) {
          Object.assign(contact, update);
        } else {
          contact = { ...create, id: id('contact'), createdAt: new Date(), updatedAt: new Date() };
          state.contacts.push(contact);
        }

        return contact;
      },
    },
    chat: {
      async findFirst({ where }) {
        const chat = state.chats.find(
          (candidate) => candidate.tenantId === where.tenantId && candidate.contactId === where.contactId
        );
        return chat ? withChatRelations(chat) : null;
      },
      async create({ data }) {
        const chat = { ...data, id: id('chat'), createdAt: new Date(), updatedAt: new Date() };
        state.chats.push(chat);
        return withChatRelations(chat);
      },
      async update({ where, data }) {
        const chat = state.chats.find((candidate) => candidate.id === where.id);
        assert(chat, `Fixture chat ${where.id} should exist`);

        for (const [key, value] of Object.entries(data)) {
          chat[key] = value && typeof value === 'object' && 'increment' in value
            ? chat[key] + value.increment
            : value;
        }
        chat.updatedAt = new Date();
        return withChatRelations(chat);
      },
    },
    message: {
      async findUnique({ where }) {
        if (where.waMessageId) {
          return state.messages.find((message) => message.waMessageId === where.waMessageId) || null;
        }
        return state.messages.find((message) => message.id === where.id) || null;
      },
      async create({ data }) {
        const message = { ...data, id: id('message'), updatedAt: new Date() };
        state.messages.push(message);
        return message;
      },
      async update({ where, data }) {
        const message = state.messages.find((candidate) => candidate.id === where.id);
        assert(message, `Fixture message ${where.id} should exist`);
        Object.assign(message, data);
        return message;
      },
      async updateMany({ where, data }) {
        const message = state.messages.find((candidate) => candidate.id === where.id);
        if (!message || !where.status?.in?.includes(message.status)) return { count: 0 };
        Object.assign(message, data);
        return { count: 1 };
      },
    },
    broadcastRecipient: {
      async findFirst() {
        return null;
      },
    },
    async $disconnect() {},
  };

  fixturePrisma.$transaction = async (callback) => callback(fixturePrisma);
  return fixturePrisma;
}

const prismaPath = require.resolve('../src/db/prisma');
const fixturePrisma = createFixturePrisma();
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: fixturePrisma,
};

// Socket broadcasting is intentionally outside this unit test's scope. Keep
// the fixture independent from Socket.io initialization and network state.
const socketServicePath = require.resolve('../src/services/socketService');
require.cache[socketServicePath] = {
  id: socketServicePath,
  filename: socketServicePath,
  loaded: true,
  exports: {
    broadcastNewMessage() {},
    broadcastMessageStatus() {},
  },
};

const WebhookParserService = require('../src/services/webhookParserService');
const { getTemplateVariableIndexes, prepareTemplateMessage } = require('../src/services/templateService');
const MetaApiService = require('../src/services/metaApiService');
const { encryptSecret, decryptSecret, hashSecret } = require('../src/services/credentialCrypto');

async function runTests() {
  console.log('🧪 Starting offline ChatFlow Webhook Parser tests...\n');

  console.log('Test 0: Normalizing repeated template variables...');
  assert.deepStrictEqual(getTemplateVariableIndexes('Hi {{2}}, {{1}} / {{1}}'), [1, 2]);
  const renderedTemplate = prepareTemplateMessage('Hi {{2}}, {{1}} / {{1}}', { 1: 'Asha', 2: 0 });
  assert.strictEqual(renderedTemplate.renderedBody, 'Hi 0, Asha / Asha');
  assert.deepStrictEqual(renderedTemplate.components[0].parameters, [
    { type: 'text', text: 'Asha' },
    { type: 'text', text: '0' },
  ]);
  console.log('✅ Test 0 Passed: Repeated placeholders render once with stable ordering.\n');

  console.log('Test 0b: Protecting credentials and disabling mock delivery in production...');
  const previousNodeEnv = process.env.NODE_ENV;
  const previousEncryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'fixture-credential-encryption-key';
  const encrypted = encryptSecret('fixture-access-token');
  assert.notStrictEqual(encrypted, 'fixture-access-token');
  assert.strictEqual(decryptSecret(encrypted), 'fixture-access-token');
  assert.strictEqual(hashSecret('fixture-verify-token').length, 64);
  process.env.NODE_ENV = 'production';
  const productionMockResult = await MetaApiService.sendTextMessage(
    { accessToken: 'MOCK_TOKEN', phoneNumberId: 'PHONE_ID_FIXTURE' },
    '919123456789',
    'This must not be delivered by a production mock'
  );
  assert.strictEqual(productionMockResult.success, false);
  assert.strictEqual(productionMockResult.code, 'META_NOT_CONFIGURED');
  process.env.NODE_ENV = previousNodeEnv;
  if (previousEncryptionKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
  else process.env.CREDENTIAL_ENCRYPTION_KEY = previousEncryptionKey;
  console.log('✅ Test 0b Passed: Credential encryption round-trips and production mocks fail closed.\n');

  console.log('Test 1: Verifying webhook signature and message extraction...');
  const rawBody = Buffer.from('{"fixture":true}');
  const appSecret = 'fixture-app-secret';
  const signature = `sha256=${require('crypto').createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  assert.strictEqual(WebhookParserService.verifySignature(rawBody, signature, appSecret), true);
  assert.strictEqual(WebhookParserService.verifySignature(rawBody, signature.replace(/.$/, '0'), appSecret), false);
  assert.deepStrictEqual(WebhookParserService.extractMessagePayload({
    type: 'image',
    image: { id: 'media-1', caption: 'Scorecard', mime_type: 'image/jpeg' },
  }), {
    messageType: 'IMAGE',
    content: 'Scorecard',
    mediaUrl: null,
    mediaMimeType: 'image/jpeg',
    mediaFilename: null,
    mediaId: 'media-1',
  });
  console.log('✅ Test 1 Passed: Signature and extraction behavior is deterministic.\n');

  const testWamid = 'wamid.TEST_OFFLINE_FIXTURE_001';
  const testPhone = '919123456789';
  const inboundPayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: tenant.wabaId,
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: tenant.displayPhoneNumber,
            phone_number_id: tenant.phoneNumberId,
          },
          contacts: [{ profile: { name: 'Kavita Iyer' }, wa_id: testPhone }],
          messages: [{
            from: testPhone,
            id: testWamid,
            timestamp: '1700000000',
            type: 'text',
            text: { body: 'Hello! I need info regarding biology faculty.' },
          }],
        },
      }],
    }],
  };

  console.log('Test 2: Processing an inbound message with an isolated fixture...');
  const firstResult = await WebhookParserService.processWebhookPayload(inboundPayload);
  assert(firstResult.success, 'Webhook processing should succeed');
  assert.strictEqual(firstResult.results.processedMessages, 1);
  assert.strictEqual(state.messages.length, 1);
  assert.strictEqual(state.chats.length, 1);
  assert.strictEqual(state.chats[0].status, 'UNASSIGNED');
  assert.strictEqual(state.contacts[0].name, 'Kavita Iyer');
  assert.strictEqual(state.messages[0].content, 'Hello! I need info regarding biology faculty.');
  console.log('✅ Test 2 Passed: Inbound message, contact, and unassigned chat were created.\n');

  console.log('Test 3: Verifying idempotency and delivery status transitions...');
  const duplicateResult = await WebhookParserService.processWebhookPayload(inboundPayload);
  assert(duplicateResult.success, 'Retry payload should not error out');
  assert.strictEqual(duplicateResult.results.processedMessages, 0);
  assert.strictEqual(state.messages.length, 1);

  const statusResult = await WebhookParserService.processWebhookPayload({
    object: 'whatsapp_business_account',
    entry: [{
      id: tenant.wabaId,
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: tenant.phoneNumberId },
          statuses: [{
            id: testWamid,
            status: 'read',
            timestamp: '1700000001',
            recipient_id: testPhone,
          }],
        },
      }],
    }],
  });
  assert(statusResult.success, 'Status webhook processing should succeed');
  assert.strictEqual(statusResult.results.processedStatuses, 1);
  assert.strictEqual(state.messages[0].status, 'READ');
  console.log('✅ Test 3 Passed: Duplicate WAMIDs are ignored and status reaches READ.\n');

  const duplicateStatusResult = await WebhookParserService.processWebhookPayload({
    object: 'whatsapp_business_account',
    entry: [{
      id: tenant.wabaId,
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: tenant.phoneNumberId },
          statuses: [{ id: testWamid, status: 'read', timestamp: '1700000002', recipient_id: testPhone }],
        },
      }],
    }],
  });
  assert(duplicateStatusResult.success, 'Duplicate status webhook should not error out');
  assert.strictEqual(duplicateStatusResult.results.processedStatuses, 0);

  const staleStatusResult = await WebhookParserService.processWebhookPayload({
    object: 'whatsapp_business_account',
    entry: [{
      id: tenant.wabaId,
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: tenant.phoneNumberId },
          statuses: [{ id: testWamid, status: 'delivered', timestamp: '1700000003', recipient_id: testPhone }],
        },
      }],
    }],
  });
  assert(staleStatusResult.success, 'Out-of-order status webhook should not error out');
  assert.strictEqual(staleStatusResult.results.processedStatuses, 0);
  assert.strictEqual(state.messages[0].status, 'READ');
  console.log('✅ Test 4 Passed: Duplicate and stale status callbacks are ignored.\n');

  console.log('🎉 All offline Webhook Parser tests passed successfully!');
}

runTests().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exitCode = 1;
});
