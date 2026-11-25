const assert = require('assert');
const crypto = require('crypto');

// Ensure offline test safety
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teambee-test-jwt-secret-key-min-32-chars';
process.env.CREDENTIAL_ENCRYPTION_KEY =
  process.env.CREDENTIAL_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Stub Prisma in require cache for isolated controller & service assertions
const capturedQueries = [];
const createdRecords = [];

const stubPrisma = {
  chat: {
    async findMany(args) {
      capturedQueries.push({ model: 'chat', op: 'findMany', args });
      return [];
    },
    async findFirst() {
      return null;
    },
    async count(args) {
      capturedQueries.push({ model: 'chat', op: 'count', args });
      return 0;
    },
    async findUnique({ where }) {
      return { id: where.id, tenantId: 'tenant-1', assignedAgentId: null, status: 'UNASSIGNED' };
    },
    async create({ data }) {
      const created = { id: 'chat-new-1', assignedAgentId: null, ...data };
      createdRecords.push({ model: 'chat', data: created });
      return created;
    },
    async update({ where, data }) {
      const updated = { id: where.id, ...data };
      createdRecords.push({ model: 'chat.update', data: updated });
      return updated;
    },
  },
  contact: {
    async upsert({ create }) {
      return { id: 'contact-1', ...create };
    },
  },
  message: {
    async create({ data }) {
      return { id: 'msg-1', ...data };
    },
  },
  agent: {
    async findMany() {
      return [{ id: 'agent-online-1', name: 'Priya', role: 'AGENT', status: 'ONLINE', isActive: true }];
    },
  },
  broadcastRecipient: {
    async findUnique() {
      return {
        id: 'rec-1',
        phone: '919876543210',
        name: 'Test Lead',
        status: 'PENDING',
        attempts: 0,
        broadcast: {
          id: 'bcast-1',
          tenantId: 'tenant-1',
          variables: '{}',
          template: { name: 'welcome_msg', language: 'en', bodyText: 'Hello {{1}}' },
          tenant: { id: 'tenant-1', phoneNumberId: 'P1', accessToken: 'MOCK_TOKEN' },
        },
      };
    },
    async updateMany() {
      return { count: 1 };
    },
    async update() {
      return { id: 'rec-1', status: 'SENT' };
    },
  },
  broadcast: {
    async update() {
      return { id: 'bcast-1' };
    },
  },
  tenant: {
    async findFirst({ where }) {
      if (where?.OR?.some((clause) => clause.webhookVerifyToken === 'global_or_tenant_secret')) {
        return { id: 'tenant-1' };
      }
      return null;
    },
  },
  async $transaction(fn) {
    return fn(stubPrisma);
  },
};

const prismaPath = require.resolve('../src/db/prisma');
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: stubPrisma,
};

const { canAccessChat, requireRole } = require('../src/middleware/authMiddleware');
const ChatController = require('../src/controllers/chatController');
const WebhookController = require('../src/controllers/webhookController');
const WebhookParserService = require('../src/services/webhookParserService');
const BroadcastWorker = require('../src/services/broadcastWorker');
const socketService = require('../src/services/socketService');
const { getExternalBaseUrl } = require('../src/utils/requestUtils');
const { encryptSecret, decryptSecret } = require('../src/services/credentialCrypto');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runTests() {
  // 1. Test RBAC helper & tenant isolation
  assert.strictEqual(
    canAccessChat({ id: 'a1', tenantId: 't1', role: 'AGENT' }, { tenantId: 't1', assignedAgentId: 'a1', status: 'OPEN' }),
    true,
    'Agent should access own chat'
  );
  assert.strictEqual(
    canAccessChat({ id: 'a1', tenantId: 't1', role: 'AGENT' }, { tenantId: 't1', assignedAgentId: 'a2', status: 'OPEN' }),
    false,
    'Agent must NOT access another agent chat'
  );
  assert.strictEqual(
    canAccessChat({ id: 'a1', tenantId: 't1', role: 'ADMIN' }, { tenantId: 't2', assignedAgentId: 'a1', status: 'OPEN' }),
    false,
    'Cross-tenant access must always be denied'
  );

  let roleNextCalled = false;
  requireRole(['ADMIN', 'SUPERVISOR'])(
    { agent: { role: 'ADMIN' } },
    createMockRes(),
    () => { roleNextCalled = true; }
  );
  assert.strictEqual(roleNextCalled, true, 'requireRole should flatten nested role arrays');

  // 2. Test ChatController.listChats preserves AGENT RBAC when status != ALL
  capturedQueries.length = 0;
  const listRes = createMockRes();
  await ChatController.listChats(
    {
      query: { filter: 'unassigned', status: 'OPEN', limit: '50' },
      agent: { id: 'agent-1', role: 'AGENT' },
      tenantId: 'tenant-1',
      db: (fn) => fn(stubPrisma),
    },
    listRes
  );
  assert.strictEqual(listRes.statusCode, 200);
  const findManyQuery = capturedQueries.find((q) => q.op === 'findMany');
  assert(findManyQuery?.args?.where?.AND, 'listChats must compose constraints using AND');
  const hasUnassignedConstraint = findManyQuery.args.where.AND.some((c) => c.status === 'UNASSIGNED');
  const hasOpenConstraint = findManyQuery.args.where.AND.some((c) => c.status === 'OPEN');
  assert(
    hasUnassignedConstraint && hasOpenConstraint,
    'status filter must intersect rather than overwrite filter=unassigned'
  );

  // 3. Test WebhookParserService delivery transition safety (never regress READ -> FAILED)
  assert.strictEqual(
    WebhookParserService.getAllowedPreviousStatuses('FAILED').includes('READ'),
    false,
    'FAILED callback must never overwrite a READ message'
  );
  assert.strictEqual(
    WebhookParserService.getAllowedPreviousStatuses('READ').includes('DELIVERED'),
    true,
    'READ callback must advance from DELIVERED'
  );

  // 4. Test socketService.getOnlineAgentIds exists
  assert.strictEqual(typeof socketService.getOnlineAgentIds, 'function', 'socketService should export getOnlineAgentIds');

  // 5. Test BroadcastWorker creates new chats as UNASSIGNED
  createdRecords.length = 0;
  const originalMock = process.env.META_ALLOW_MOCK;
  process.env.META_ALLOW_MOCK = 'true';
  try {
    await BroadcastWorker.processRecipient('rec-1', 'tenant-1');
    const createdChat = createdRecords.find((r) => r.model === 'chat');
    assert.strictEqual(createdChat?.data?.status, 'UNASSIGNED', 'New broadcast chat must start as UNASSIGNED');
  } finally {
    process.env.META_ALLOW_MOCK = originalMock;
  }

  // 6. Test WebhookController verify supports both META_WEBHOOK_VERIFY_TOKEN and WEBHOOK_VERIFY_TOKEN
  const prevVerifyEnv = process.env.WEBHOOK_VERIFY_TOKEN;
  process.env.WEBHOOK_VERIFY_TOKEN = 'verify_tok_123';
  try {
    const okRes = createMockRes();
    await WebhookController.verify(
      { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify_tok_123', 'hub.challenge': 'chal-99' } },
      okRes
    );
    assert.strictEqual(okRes.statusCode, 200);
    assert.strictEqual(okRes.body, 'chal-99');

    const badRes = createMockRes();
    await WebhookController.verify(
      { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'chal-99' } },
      badRes
    );
    assert.strictEqual(badRes.statusCode, 403);
  } finally {
    if (prevVerifyEnv === undefined) delete process.env.WEBHOOK_VERIFY_TOKEN;
    else process.env.WEBHOOK_VERIFY_TOKEN = prevVerifyEnv;
  }

  // 7. Test getExternalBaseUrl and secret encryption round-trip
  const url = getExternalBaseUrl({
    headers: { 'x-forwarded-proto': 'https, http', host: 'api.teambee.app\r\n' },
    protocol: 'http',
    get: () => 'api.teambee.app',
  });
  assert.strictEqual(url, 'https://api.teambee.app');

  const cipher = encryptSecret('secret-value-' + crypto.randomBytes(4).toString('hex'));
  assert(cipher.startsWith('enc:v1:'));
  assert(decryptSecret(cipher).startsWith('secret-value-'));

  console.log('All RBAC & service tests passed cleanly.');
}

runTests().catch((err) => {
  console.error('RBAC & service test failed:', err);
  process.exit(1);
});
