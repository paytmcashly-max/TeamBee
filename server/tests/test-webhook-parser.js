const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const WebhookParserService = require('../src/services/webhookParserService');
const prisma = require('../src/db/prisma');

async function runTests() {
  console.log('🧪 Starting ChatFlow Webhook Parser Engine & Idempotency Tests...\n');

  // Fetch seeded tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'apex-educare' },
  });
  assert(tenant, 'Seeded tenant should exist');

  // TEST 1: Process Inbound Text Message
  console.log('Test 1: Processing authentic inbound text payload...');
  const testWamid = `wamid.TEST_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const testPhone = '919123456789';

  const inboundPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: tenant.wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: tenant.displayPhoneNumber,
                phone_number_id: tenant.phoneNumberId,
              },
              contacts: [
                {
                  profile: { name: 'Kavita Iyer' },
                  wa_id: testPhone,
                },
              ],
              messages: [
                {
                  from: testPhone,
                  id: testWamid,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'text',
                  text: { body: 'Hello! I need info regarding biology faculty.' },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res1 = await WebhookParserService.processWebhookPayload(inboundPayload);
  assert(res1.success, 'Webhook processing should succeed');
  assert.strictEqual(res1.results.processedMessages, 1, 'Should process 1 message');

  // Verify message in database
  const savedMsg = await prisma.message.findUnique({
    where: { waMessageId: testWamid },
    include: { chat: { include: { contact: true } } },
  });
  assert(savedMsg, 'Message should be saved in DB');
  assert.strictEqual(savedMsg.content, 'Hello! I need info regarding biology faculty.');
  assert.strictEqual(savedMsg.chat.status, 'UNASSIGNED', 'New customer chat should start in UNASSIGNED queue');
  assert.strictEqual(savedMsg.chat.contact.name, 'Kavita Iyer');
  console.log('✅ Test 1 Passed: Inbound message parsed & Contact + Chat created!\n');

  // TEST 2: Hardened Idempotency & Deduplication
  console.log('Test 2: Verifying Deduplication / Idempotency on repeated Meta webhook...');
  const res2 = await WebhookParserService.processWebhookPayload(inboundPayload);
  assert(res2.success, 'Retry payload should not error out');
  assert.strictEqual(res2.results.processedMessages, 0, 'Duplicate message should NOT increment processed counter');

  const countAfterDuplicate = await prisma.message.count({
    where: { waMessageId: testWamid },
  });
  assert.strictEqual(countAfterDuplicate, 1, 'Only 1 message record should exist in DB');
  console.log('✅ Test 2 Passed: Duplicate WAMID cleanly deduplicated!\n');

  // TEST 3: Status Updates (DELIVERED -> READ)
  console.log('Test 3: Processing delivery status callback (DELIVERED -> READ)...');
  const statusPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: tenant.wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                phone_number_id: tenant.phoneNumberId,
              },
              statuses: [
                {
                  id: testWamid,
                  status: 'read',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  recipient_id: testPhone,
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res3 = await WebhookParserService.processWebhookPayload(statusPayload);
  assert(res3.success, 'Status webhook processing should succeed');
  assert.strictEqual(res3.results.processedStatuses, 1, 'Should process 1 status update');

  const updatedMsg = await prisma.message.findUnique({
    where: { waMessageId: testWamid },
  });
  assert.strictEqual(updatedMsg.status, 'READ', 'Message status should be transitioned to READ');
  console.log('✅ Test 3 Passed: Status update transitioned correctly to READ!\n');

  console.log('🎉 All Webhook Engine tests passed successfully!');
}

runTests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
