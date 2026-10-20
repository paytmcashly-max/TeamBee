const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { encryptSecret, hashSecret } = require('../services/credentialCrypto');

const prisma = new PrismaClient();

function runtimeSecret(name, developmentFallback) {
  if (process.env[name]) return process.env[name];
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be configured before running the Neon seed in production`);
  }
  return developmentFallback || crypto.randomBytes(24).toString('hex');
}

function requiredSecret(name) {
  if (!process.env[name]) throw new Error(`${name} must be configured before seeding`);
  return process.env[name];
}

const seedAdminPassword = requiredSecret('SEED_ADMIN_PASSWORD');
const webhookVerifyToken = runtimeSecret('WEBHOOK_VERIFY_TOKEN');
const metaAppSecret = runtimeSecret('META_APP_SECRET');
const metaAccessToken = runtimeSecret('META_ACCESS_TOKEN', 'MOCK_TOKEN');
const metaPhoneNumberId = runtimeSecret('META_PHONE_NUMBER_ID', 'PHONE_ID_SEED');
const metaWabaId = runtimeSecret('META_WABA_ID', 'WABA_SEED');
const encryptedMetaAccessToken = encryptSecret(metaAccessToken);
const encryptedMetaAppSecret = encryptSecret(metaAppSecret);
const hashedWebhookVerifyToken = hashSecret(webhookVerifyToken);

async function seed() {
  console.log('🌱 Seeding Neon PostgreSQL Database...');

  // 1. Create or update Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'apex-educare' },
    update: {
        accessToken: encryptedMetaAccessToken,
       phoneNumberId: metaPhoneNumberId,
       wabaId: metaWabaId,
      displayPhoneNumber: '+1 555-676-6956',
         webhookVerifyToken: null,
         webhookVerifyTokenHash: hashedWebhookVerifyToken,
         appSecret: encryptedMetaAppSecret,
    },
    create: {
      id: '720de0ce-182f-4c1c-acb6-351a74154f80',
      name: 'Apex EduCare Academy',
      slug: 'apex-educare',
       phoneNumberId: metaPhoneNumberId,
       wabaId: metaWabaId,
      displayPhoneNumber: '+1 555-676-6956',
        accessToken: encryptedMetaAccessToken,
        webhookVerifyToken: null,
        webhookVerifyTokenHash: hashedWebhookVerifyToken,
        appSecret: encryptedMetaAppSecret,
    },
  });

  console.log('✅ Tenant ready:', tenant.name, tenant.id);

  // 2. Create Admin Agent
  const passwordHash = await bcrypt.hash(seedAdminPassword, 10);
  const adminAgent = await prisma.agent.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'rahul.verma@apexeducare.in' } },
    update: { passwordHash },
    create: {
      id: '70157ea5-47fe-4f60-99cf-6f477e392d26',
      tenantId: tenant.id,
      name: 'Rahul Verma (Director)',
      email: 'rahul.verma@apexeducare.in',
      passwordHash,
      role: 'ADMIN',
      status: 'ONLINE',
    },
  });
  console.log('✅ Admin Agent ready:', adminAgent.name);

  // 3. Create Staff Agent
  const staffAgent = await prisma.agent.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'priya.sharma@apexeducare.in' } },
    update: { passwordHash },
    create: {
      tenantId: tenant.id,
      name: 'Priya Sharma (Senior Counselor)',
      email: 'priya.sharma@apexeducare.in',
      passwordHash,
      role: 'AGENT',
      status: 'ONLINE',
    },
  });
  console.log('✅ Staff Agent ready:', staffAgent.name);

  // 4. Create User Contact
  const userContact = await prisma.contact.upsert({
    where: { tenantId_waId: { tenantId: tenant.id, waId: '916203386747' } },
    update: { name: 'Kishan (Lead)' },
    create: {
      tenantId: tenant.id,
      waId: '916203386747',
      name: 'Kishan (Lead)',
      customAttributes: JSON.stringify({
        leadStage: 'Demo Attended',
        targetExam: 'NEET 2026',
        city: 'Mumbai',
      }),
    },
  });
  console.log('✅ Contact ready:', userContact.name, userContact.waId);

  // 5. Create or link Chat session
  let chat = await prisma.chat.findFirst({
    where: { tenantId: tenant.id, contactId: userContact.id },
  });
  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        tenantId: tenant.id,
        contactId: userContact.id,
        assignedAgentId: adminAgent.id,
        status: 'OPEN',
        lastMessagePreview: 'Namaste! ChatFlow system is live & refreshed.',
        lastMessageAt: new Date(),
        tags: JSON.stringify(['High Priority', 'NEET 2026']),
      },
    });
  }
  console.log('✅ Chat session ready:', chat.id);

  // 6. Seed Meta Approved Templates
  const templates = [
    {
      name: 'neet_jee_demo_invite',
      category: 'MARKETING',
      language: 'en',
      bodyText: 'Namaste {{1}}! You are cordially invited to attend a complimentary 2-hour Live Demo Class for NEET 2026-27 with Kota mentors this Saturday at 5 PM. Reply YES to confirm your seat.',
      exampleVariables: JSON.stringify(['Aarav']),
    },
    {
      name: 'scholarship_test_confirmation',
      category: 'UTILITY',
      language: 'en',
      bodyText: 'Dear {{1}}, your registration for the Apex National Talent Hunt Exam is confirmed. Exam Date: {{2}}. Best of luck!',
      exampleVariables: JSON.stringify(['Pooja', 'Sunday 10:00 AM']),
    },
    {
      name: 'fee_due_reminder_installment',
      category: 'UTILITY',
      language: 'en',
      bodyText: 'Dear Parent, this is a gentle reminder that the Q3 installment of ₹{{1}} for {{2}} is due by {{3}}. Please click below to make payment.',
      exampleVariables: JSON.stringify(['25,000', 'Rohan Gupta', '25th Oct']),
    },
    {
      name: 'sample_shipping_confirmation',
      category: 'UTILITY',
      language: 'en',
      bodyText: 'Your order #{{1}} has been shipped via BlueDart. Track delivery at: {{2}}.',
      exampleVariables: JSON.stringify(['84920', 'https://track.bluedart.com']),
    },
  ];

  for (const tpl of templates) {
    await prisma.template.upsert({
      where: {
        tenantId_name_language: {
          tenantId: tenant.id,
          name: tpl.name,
          language: tpl.language,
        },
      },
      update: tpl,
      create: {
        tenantId: tenant.id,
        ...tpl,
      },
    });
  }
  console.log('✅ Approved templates seeded!');

  console.log('🎉 Neon PostgreSQL Database Seeding Completed Successfully!');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
