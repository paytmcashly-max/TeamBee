'use strict';

const assert = require('assert');
const path = require('path');
const CommerceService = require('../src/services/commerceService');
const AutomationRulesService = require('../src/services/automationRulesService');

async function runTests() {
  console.log('Running DoubleTick Commerce & Automation tests...\n');
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

  const testTenantId = 'test_tenant_doubletick_saas';

  // 1. Commerce Service tests
  {
    const products = CommerceService.getProducts(testTenantId);
    check('commerce: starter products seeded', Array.isArray(products) && products.length >= 3);

    const saved = CommerceService.saveProduct(testTenantId, {
      title: 'Custom Test Product',
      price: 1299,
      description: 'Test product description',
      category: 'Testing',
    });
    check('commerce: product created with ID', Boolean(saved.id && saved.id.startsWith('prod_')));
    check('commerce: product price parsed as number', saved.price === 1299);

    const updatedList = CommerceService.getProducts(testTenantId);
    check('commerce: list includes new product', updatedList.some((p) => p.id === saved.id));

    CommerceService.deleteProduct(testTenantId, saved.id);
    const afterDelete = CommerceService.getProducts(testTenantId);
    check('commerce: product deleted successfully', !afterDelete.some((p) => p.id === saved.id));

    const settings = CommerceService.getSettings(testTenantId);
    check('commerce: default upi settings present', typeof settings.upiId === 'string');

    const updatedSettings = CommerceService.updateSettings(testTenantId, { upiId: 'mybrand@okaxis' });
    check('commerce: settings updated', updatedSettings.upiId === 'mybrand@okaxis');

    const upiLink = CommerceService.generateUpiLink({
      vpa: 'test@upi',
      merchantName: 'Test Merchant',
      amount: 499.5,
      orderId: 'ORD-1234',
      note: 'Payment for services',
    });
    check('commerce: UPI link format valid', upiLink.startsWith('upi://pay?pa=test@upi&pn=Test%20Merchant&am=499.50&tn=Payment%20for%20services&cu=INR'));
  }

  // 2. Automation Rules Service tests
  {
    const config = AutomationRulesService.getConfig(testTenantId);
    check('automation: default config loaded', config.botEnabled === true);
    check('automation: handoff keywords array present', Array.isArray(config.agentHandoffKeywords) && config.agentHandoffKeywords.includes('agent'));
    check('automation: catalog keywords present', config.catalogKeywords.includes('catalog'));

    const updatedConfig = AutomationRulesService.updateConfig(testTenantId, {
      welcomeMessage: 'Custom welcome message test',
    });
    check('automation: config updated', updatedConfig.welcomeMessage === 'Custom welcome message test');
  }

  console.log(`\nDoubleTick Commerce & Automation: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
