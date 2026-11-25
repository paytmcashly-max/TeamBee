'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Writable } = require('stream');

const BillingController = require('../src/controllers/billingController');
const CommerceController = require('../src/controllers/commerceController');
const MediaController = require('../src/controllers/mediaController');
const AnalyticsController = require('../src/controllers/analyticsController');
const MetaApiService = require('../src/services/metaApiService');
const storageService = require('../src/services/storageService');
const { isAllowedMetaMediaUrl } = storageService;
const prisma = require('../src/db/prisma');
const automationRoutes = require('../src/routes/automationRoutes');
const commerceRoutes = require('../src/routes/commerceRoutes');

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end() {
      return this;
    },
  };
  return res;
}

function getRouteMiddlewares(router, method, routePath) {
  const layer = router.stack.find(
    (item) => item.route && item.route.path === routePath && item.route.methods[method.toLowerCase()]
  );
  assert(layer, `Route ${method.toUpperCase()} ${routePath} should exist`);
  return layer.route.stack.map((s) => s.handle);
}

async function runTests() {
  console.log('Running security, RBAC route & controller contract tests...\n');

  // 1. BillingController.webhook fail-closed behavior
  {
    const prevSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const prevUpdate = prisma.tenant.update;
    let dbUpdated = null;
    prisma.tenant.update = async (args) => {
      dbUpdated = args;
      return { id: args.where.id, ...args.data };
    };

    try {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const res503 = createMockRes();
      await BillingController.webhook(
        { headers: {}, body: { event: 'payment.captured' } },
        res503
      );
      assert.strictEqual(res503.statusCode, 503);
      assert.strictEqual(res503.body.code, 'BILLING_WEBHOOK_NOT_CONFIGURED');

      process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test_secret_123';
      const payloadObj = {
        event: 'payment.captured',
        payload: { payment: { entity: { notes: { tenantId: 't_bill', plan: 'GROWTH' } } } },
      };
      const rawBuf = Buffer.from(JSON.stringify(payloadObj));

      const resBadSig = createMockRes();
      await BillingController.webhook(
        { headers: { 'x-razorpay-signature': 'deadbeef' }, rawBody: rawBuf, body: payloadObj },
        resBadSig
      );
      assert.strictEqual(resBadSig.statusCode, 400);
      assert.strictEqual(dbUpdated, null);

      const goodSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBuf)
        .digest('hex');
      const resOk = createMockRes();
      await BillingController.webhook(
        { headers: { 'x-razorpay-signature': goodSig }, rawBody: rawBuf, body: payloadObj },
        resOk
      );
      assert.strictEqual(resOk.statusCode, 200);
      assert.strictEqual(resOk.body.success, true);
      assert(dbUpdated && dbUpdated.where.id === 't_bill' && dbUpdated.data.plan === 'GROWTH');
      console.log('  ✓ BillingController.webhook fail-closed 503/400 + valid HMAC upgrade');
    } finally {
      prisma.tenant.update = prevUpdate;
      if (prevSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = prevSecret;
    }
  }

  // 2. CommerceController object-level chat authorization & validation
  {
    const foreignChatDb = (fn) =>
      fn({
        chat: {
          findUnique: async () => ({
            id: 'chat_1',
            tenantId: 't_1',
            status: 'OPEN',
            assignedAgentId: 'agent_other',
            contact: { waId: '919999999999' },
            tenant: { id: 't_1' },
          }),
        },
      });

    const prodForbiddenRes = createMockRes();
    await CommerceController.sendProductToChat(
      {
        params: { chatId: 'chat_1' },
        body: { productId: 'prod_1' },
        tenantId: 't_1',
        agent: { id: 'agent_me', role: 'AGENT', tenantId: 't_1' },
        db: foreignChatDb,
      },
      prodForbiddenRes
    );
    assert.strictEqual(prodForbiddenRes.statusCode, 403);

    const payForbiddenRes = createMockRes();
    await CommerceController.sendPaymentRequest(
      {
        params: { chatId: 'chat_1' },
        body: { amount: 499 },
        tenantId: 't_1',
        agent: { id: 'agent_me', role: 'AGENT', tenantId: 't_1' },
        db: foreignChatDb,
      },
      payForbiddenRes
    );
    assert.strictEqual(payForbiddenRes.statusCode, 403);

    // Ensure MetaApiService untouched even under error path
    assert.strictEqual(typeof MetaApiService.sendInteractiveButtons, 'function');
    console.log('  ✓ CommerceController enforces canAccessChat (403 on foreign chat)');
  }

  // 3. Automation & Commerce route RBAC middleware wiring
  {
    const guardedRoutes = [
      { router: automationRoutes, method: 'get', path: '/config' },
      { router: automationRoutes, method: 'put', path: '/config' },
      { router: commerceRoutes, method: 'post', path: '/products' },
      { router: commerceRoutes, method: 'delete', path: '/products/:id' },
      { router: commerceRoutes, method: 'put', path: '/settings' },
    ];

    for (const entry of guardedRoutes) {
      const stack = getRouteMiddlewares(entry.router, entry.method, entry.path);
      assert.strictEqual(stack.length, 3, `${entry.method.toUpperCase()} ${entry.path} must chain auth + role + handler`);
      const roleMiddleware = stack[1];

      const agentRes = createMockRes();
      let nextCalledForAgent = false;
      roleMiddleware({ agent: { role: 'AGENT' } }, agentRes, () => {
        nextCalledForAgent = true;
      });
      assert.strictEqual(agentRes.statusCode, 403, `AGENT must get 403 on ${entry.method.toUpperCase()} ${entry.path}`);
      assert.strictEqual(nextCalledForAgent, false);

      const supRes = createMockRes();
      let nextCalledForSupervisor = false;
      roleMiddleware({ agent: { role: 'SUPERVISOR' } }, supRes, () => {
        nextCalledForSupervisor = true;
      });
      assert.strictEqual(nextCalledForSupervisor, true, `SUPERVISOR must be allowed on ${entry.method.toUpperCase()} ${entry.path}`);
    }

    const agentAllowedCommerce = [
      ['get', '/products'],
      ['post', '/payment-link'],
      ['post', '/send-product/:chatId'],
      ['post', '/send-payment/:chatId'],
    ];
    for (const [method, routePath] of agentAllowedCommerce) {
      const stack = getRouteMiddlewares(commerceRoutes, method, routePath);
      assert.strictEqual(stack.length, 2, `${method.toUpperCase()} ${routePath} should allow authenticated AGENTs`);
    }
    console.log('  ✓ Automation & commerce routes enforce ADMIN/SUPERVISOR role checks');
  }

  // 4. MediaController MIME safety, byte bounds, and SSRF allowlist
  {
    assert.strictEqual(isAllowedMetaMediaUrl('https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1'), true);
    assert.strictEqual(isAllowedMetaMediaUrl('https://scontent.whatsapp.net/v/media.jpg'), true);
    assert.strictEqual(isAllowedMetaMediaUrl('http://lookaside.fbsbx.com/v/media.jpg'), false);
    assert.strictEqual(isAllowedMetaMediaUrl('https://169.254.169.254/latest/meta-data'), false);
    assert.strictEqual(isAllowedMetaMediaUrl('https://evil.example.com/media.jpg'), false);

    // Reject empty buffer
    const emptyRes = createMockRes();
    await MediaController.uploadFile(
      { body: { filename: 'empty.txt', mimeType: 'text/plain', dataBase64: '   ' }, tenant: { slug: 'demo' } },
      emptyRes
    );
    assert.strictEqual(emptyRes.statusCode, 400);

    // Reject >20MB upload
    const over20MbBase64 = Buffer.alloc(20 * 1024 * 1024 + 1).toString('base64');
    const bigRes = createMockRes();
    await MediaController.uploadFile(
      { body: { filename: 'big.txt', mimeType: 'text/plain', dataBase64: over20MbBase64 }, tenant: { slug: 'demo' } },
      bigRes
    );
    assert.strictEqual(bigRes.statusCode, 400);

    // MIME dictates extension (ignores spoofed .html filename) and local upload round-trip works
    // Force offline local-disk branch so unit test never touches remote R2 storage.
    const prevIsConfigured = storageService.isConfigured;
    const prevUploadBuffer = storageService.uploadBuffer;
    const uploadsDir = path.resolve(__dirname, '../uploads');
    let savedDiskPath = null;
    try {
      storageService.isConfigured = () => false;

      const uploadRes = createMockRes();
      await MediaController.uploadFile(
        {
          body: {
            filename: 'spoofed.html',
            mimeType: 'text/plain',
            dataBase64: Buffer.from('hello teambee').toString('base64'),
          },
          tenant: { slug: 'demo' },
        },
        uploadRes
      );
      assert.strictEqual(uploadRes.statusCode, 201);
      assert(uploadRes.body.url.endsWith('.txt'), `Expected canonical .txt URL, got ${uploadRes.body.url}`);

      const savedFilename = path.basename(uploadRes.body.url);
      savedDiskPath = path.join(uploadsDir, savedFilename);

      const badNameRes = createMockRes();
      await MediaController.getFile({ params: { filename: '../secret.txt' } }, badNameRes);
      assert.strictEqual(badNameRes.statusCode, 404);
      assert(fs.existsSync(savedDiskPath), 'Uploaded file should exist in local uploads directory');

      const servedHeaders = {};
      const chunks = [];
      await new Promise((resolve, reject) => {
        const serveStream = new Writable({
          write(chunk, _enc, cb) {
            chunks.push(chunk);
            cb();
          },
        });
        serveStream.statusCode = 200;
        serveStream.status = function status(code) {
          this.statusCode = code;
          return this;
        };
        serveStream.setHeader = function setHeader(k, v) {
          servedHeaders[k.toLowerCase()] = v;
        };
        serveStream.json = function json(payload) {
          this.body = payload;
          resolve();
          return this;
        };
        serveStream.on('finish', resolve);
        serveStream.on('error', reject);
        MediaController.getFile({ params: { filename: savedFilename } }, serveStream).catch(reject);
      });
      assert.strictEqual(servedHeaders['content-type'], 'text/plain');
      assert.strictEqual(servedHeaders['cross-origin-resource-policy'], 'cross-origin');
      assert(String(servedHeaders['content-disposition'] || '').includes('attachment;'));
      assert.strictEqual(Buffer.concat(chunks).toString('utf8'), 'hello teambee');

      // Verify R2 delegation branch without making external network calls
      storageService.isConfigured = () => true;
      let uploadedArgs = null;
      storageService.uploadBuffer = async (args) => {
        uploadedArgs = args;
        return { url: 'https://cdn.example.com/uploads/demo/fake.txt' };
      };
      const r2Res = createMockRes();
      await MediaController.uploadFile(
        {
          body: {
            filename: 'report.txt',
            mimeType: 'text/plain',
            dataBase64: Buffer.from('r2 test').toString('base64'),
          },
          tenant: { slug: 'demo' },
        },
        r2Res
      );
      assert.strictEqual(r2Res.statusCode, 201);
      assert.strictEqual(r2Res.body.url, 'https://cdn.example.com/uploads/demo/fake.txt');
      assert(uploadedArgs && uploadedArgs.mimeType === 'text/plain' && uploadedArgs.tenantSlug === 'demo');
    } finally {
      storageService.isConfigured = prevIsConfigured;
      storageService.uploadBuffer = prevUploadBuffer;
      if (savedDiskPath && fs.existsSync(savedDiskPath)) fs.unlinkSync(savedDiskPath);
    }
    console.log('  ✓ MediaController MIME mapping, 0B/>20MB limits & Meta SSRF allowlist');
  }

  // 5. AnalyticsController.overview counts active agents & matches frontend contract
  {
    let capturedAgentWhere = [];
    const mockDb = (fn) =>
      fn({
        tenant: {
          findUnique: async () => ({
            id: 't_1',
            officeHoursTimezone: 'Asia/Kolkata',
            phoneNumberId: '123',
            plan: 'GROWTH',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          }),
        },
        chat: { count: async () => 4 },
        message: { count: async () => 9 },
        agent: {
          count: async ({ where }) => {
            capturedAgentWhere.push(where);
            return 3;
          },
        },
        template: { count: async () => 2 },
        broadcast: { count: async () => 1 },
      });

    const analyticsRes = createMockRes();
    await AnalyticsController.overview({ tenantId: 't_1', db: mockDb }, analyticsRes);
    assert.strictEqual(analyticsRes.statusCode, 200);
    assert.strictEqual(analyticsRes.body.stats.outboundTotal, 9);
    assert.strictEqual(analyticsRes.body.stats.templatesApproved, 2);
    assert.strictEqual(typeof analyticsRes.body.stats.yesterday.chats, 'number');
    assert.strictEqual(analyticsRes.body.checklist.templatesApproved, 2);
    assert(capturedAgentWhere.every((w) => w.isActive === true), 'Agent queries must filter isActive: true');
    console.log('  ✓ AnalyticsController.overview contracts & active-agent scoping');
  }

  console.log('\nAll security & contract tests passed cleanly.');
}

runTests().catch((err) => {
  console.error('Security & contract tests failed:', err);
  process.exit(1);
});
