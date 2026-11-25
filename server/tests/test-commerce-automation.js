'use strict';

const assert = require('assert');
const CommerceService = require('../src/services/commerceService');
const AutomationRulesService = require('../src/services/automationRulesService');

function createInMemoryCommercePrisma() {
  const products = new Map();
  const settings = new Map();
  const configs = new Map();

  const clone = (obj) => (obj ? { ...obj } : obj);

  return {
    commerceProduct: {
      async findMany({ where = {}, take = 200 }) {
        return Array.from(products.values())
          .filter((row) => !where.tenantId || row.tenantId === where.tenantId)
          .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
          .slice(0, take)
          .map(clone);
      },
      async findFirst({ where = {} }) {
        for (const row of products.values()) {
          if (
            (!where.id || row.id === where.id) &&
            (!where.tenantId || row.tenantId === where.tenantId)
          ) {
            return clone(row);
          }
        }
        return null;
      },
      async create({ data }) {
        const now = new Date();
        const row = { ...data, createdAt: now, updatedAt: now };
        products.set(row.id, row);
        return clone(row);
      },
      async update({ where, data }) {
        const existing = products.get(where.id);
        if (!existing) throw new Error('Product missing');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        products.set(where.id, updated);
        return clone(updated);
      },
      async deleteMany({ where = {} }) {
        let count = 0;
        for (const [id, row] of products.entries()) {
          if (
            (!where.id || row.id === where.id) &&
            (!where.tenantId || row.tenantId === where.tenantId)
          ) {
            products.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    commerceSettings: {
      async findUnique({ where = {} }) {
        return clone(settings.get(where.tenantId) || null);
      },
      async upsert({ where, update, create }) {
        const existing = settings.get(where.tenantId);
        const now = new Date();
        const row = existing
          ? { ...existing, ...update, updatedAt: now }
          : { ...create, createdAt: now, updatedAt: now };
        settings.set(where.tenantId, row);
        return clone(row);
      },
    },
    automationConfig: {
      async findUnique({ where = {} }) {
        return clone(configs.get(where.tenantId) || null);
      },
      async upsert({ where, update, create }) {
        const existing = configs.get(where.tenantId);
        const now = new Date();
        const row = existing
          ? { ...existing, ...update, updatedAt: now }
          : { ...create, createdAt: now, updatedAt: now };
        configs.set(where.tenantId, row);
        return clone(row);
      },
    },
  };
}

async function runTests() {
  console.log('Running TeamBee DB-backed Commerce & Automation tests...\n');
  let passed = 0;
  let failed = 0;

  function check(name, ok) {
    if (ok) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ ${name}`);
      failed++;
    }
  }

  const fakePrisma = createInMemoryCommercePrisma();
  const dbAccessor = (fn) => fn(fakePrisma);
  const tenantA = 'tenant_alpha_test';
  const tenantB = 'tenant_beta_test';

  // 1. CommerceService CRUD, validation & tenant isolation
  {
    const initial = await CommerceService.getProducts(tenantA, dbAccessor);
    check('commerce: new tenant starts with empty catalog (no ephemeral disk seed)', Array.isArray(initial) && initial.length === 0);

    let priceRejected = false;
    try {
      await CommerceService.saveProduct(tenantA, { title: 'Bad Item', price: -5 }, dbAccessor);
    } catch (err) {
      priceRejected = err.statusCode === 400;
    }
    check('commerce: negative price rejected with 400', priceRejected);

    const saved = await CommerceService.saveProduct(
      tenantA,
      {
        title: 'Custom Test Product',
        price: 1299,
        description: 'Test product description',
        category: 'Testing',
        imageUrl: 'javascript:alert(1)',
      },
      dbAccessor
    );
    check('commerce: product created with ID', Boolean(saved.id && saved.id.startsWith('prod_')));
    check('commerce: unsafe non-https imageUrl stripped', saved.imageUrl === null);

    const updated = await CommerceService.saveProduct(
      tenantA,
      {
        id: saved.id,
        title: 'Updated Product Title',
        price: 1499,
        imageUrl: 'https://cdn.example.com/item.png',
      },
      dbAccessor
    );
    check('commerce: product updated in place with https imageUrl', updated.id === saved.id && updated.price === 1499 && updated.imageUrl === 'https://cdn.example.com/item.png');

    let crossTenantUpdateBlocked = false;
    try {
      await CommerceService.saveProduct(
        tenantB,
        { id: saved.id, title: 'Hijacked', price: 1 },
        dbAccessor
      );
    } catch (err) {
      crossTenantUpdateBlocked = err.statusCode === 404;
    }
    check('commerce: cross-tenant product update returns 404', crossTenantUpdateBlocked);

    const crossTenantDelete = await CommerceService.deleteProduct(tenantB, saved.id, dbAccessor);
    check('commerce: cross-tenant delete returns false', crossTenantDelete === false);

    const tenantAList = await CommerceService.getProducts(tenantA, dbAccessor);
    check('commerce: product still belongs to tenantA', tenantAList.some((p) => p.id === saved.id));

    const deleted = await CommerceService.deleteProduct(tenantA, saved.id, dbAccessor);
    const missingDelete = await CommerceService.deleteProduct(tenantA, saved.id, dbAccessor);
    check('commerce: own product delete returns true, repeat delete returns false', deleted === true && missingDelete === false);

    const defaultCfg = await CommerceService.getSettings(tenantA, dbAccessor);
    check('commerce: default UPI settings returned', defaultCfg.currency === 'INR' && typeof defaultCfg.upiId === 'string');

    let invalidVpaRejected = false;
    try {
      await CommerceService.updateSettings(tenantA, { upiId: 'not-a-vpa' }, dbAccessor);
    } catch (err) {
      invalidVpaRejected = err.statusCode === 400;
    }
    check('commerce: malformed UPI VPA rejected with 400', invalidVpaRejected);

    const updatedSettings = await CommerceService.updateSettings(
      tenantA,
      { upiId: 'mybrand@okaxis', merchantName: 'TeamBee Store' },
      dbAccessor
    );
    check('commerce: valid UPI settings persisted', updatedSettings.upiId === 'mybrand@okaxis');

    const upiLink = CommerceService.generateUpiLink({
      vpa: 'test@upi',
      merchantName: 'Test Merchant',
      amount: 499.5,
      orderId: 'ORD-1234',
      note: 'Payment for services',
    });
    check(
      'commerce: UPI intent URI format valid',
      upiLink === 'upi://pay?pa=test%40upi&pn=Test%20Merchant&am=499.50&tn=Payment%20for%20services&cu=INR'
    );
  }

  // 2. AutomationRulesService CRUD, validation & tenant isolation
  {
    const config = await AutomationRulesService.getConfig(tenantA, dbAccessor);
    check('automation: default config loaded asynchronously', config.botEnabled === true && config.autoAssignEnabled === true);
    check('automation: default keyword lists loaded', config.agentHandoffKeywords.includes('agent') && config.catalogKeywords.includes('catalog'));

    let invalidBoolRejected = false;
    try {
      await AutomationRulesService.updateConfig(tenantA, { botEnabled: 'yes' }, dbAccessor);
    } catch (err) {
      invalidBoolRejected = err.statusCode === 400;
    }
    check('automation: invalid botEnabled type rejected with 400', invalidBoolRejected);

    const updatedConfig = await AutomationRulesService.updateConfig(
      tenantA,
      {
        botEnabled: false,
        welcomeMessage: 'Custom DB welcome message',
        customRules: [
          {
            trigger: 'warranty',
            matchType: 'exact',
            response: '1 year replacement warranty included.',
            buttons: ['Claim Warranty', 'Ignore Long Button Label Beyond 20 Chars'],
          },
        ],
      },
      dbAccessor
    );
    check('automation: config updated & JSON arrays deserialized', updatedConfig.botEnabled === false && updatedConfig.welcomeMessage === 'Custom DB welcome message');
    check(
      'automation: custom rule sanitized (20-char button cap)',
      updatedConfig.customRules.length === 1 &&
        updatedConfig.customRules[0].matchType === 'exact' &&
        updatedConfig.customRules[0].buttons[1].length <= 20
    );

    const tenantBConfig = await AutomationRulesService.getConfig(tenantB, dbAccessor);
    check('automation: tenantB retains independent default config', tenantBConfig.botEnabled === true && tenantBConfig.customRules.length === 2);
  }

  console.log(`\nCommerce & Automation DB Tests: ${passed} passed, ${failed} failed`);
  assert.strictEqual(failed, 0);
  process.exit(failed ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
