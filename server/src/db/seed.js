const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { hashSecret } = require('../services/credentialCrypto');
const prisma = require('./prisma');

function runtimeSecret(name, developmentFallback) {
  if (process.env[name]) return process.env[name];
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be configured before seeding`);
  }
  return developmentFallback || crypto.randomBytes(24).toString('hex');
}

function requiredSecret(name) {
  if (!process.env[name]) throw new Error(`${name} must be configured before seeding`);
  return process.env[name];
}

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The destructive demo seed is disabled in production');
  }
  console.log('🌱 Starting database seeding for ChatFlow WhatsApp Shared Inbox...');

  // 1. Clean existing records
  await prisma.broadcastRecipient.deleteMany({});
  await prisma.broadcast.deleteMany({});
  await prisma.template.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.chat.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.agent.deleteMany({});
  await prisma.tenant.deleteMany({});

  const defaultPassword = await bcrypt.hash(requiredSecret('SEED_ADMIN_PASSWORD'), 10);
  const agentPassword = await bcrypt.hash(requiredSecret('SEED_AGENT_PASSWORD'), 10);

  // 2. Create Tenant: Apex EduCare Academy
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Apex EduCare Academy',
      slug: 'apex-educare',
      wabaId: 'WABA_1092837465001',
      phoneNumberId: 'PHONE_ID_919876500001',
      displayPhoneNumber: '+91 98765 00001',
       accessToken: process.env.APEX_META_ACCESS_TOKEN || 'MOCK_TOKEN',
       webhookVerifyTokenHash: hashSecret(runtimeSecret('APEX_WEBHOOK_VERIFY_TOKEN')),
       appSecret: runtimeSecret('APEX_META_APP_SECRET'),
      plan: 'ENTERPRISE',
    },
  });

  // 3. Create Tenant: UrbanGlam D2C Store
  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'UrbanGlam D2C',
      slug: 'urbanglam-d2c',
      wabaId: 'WABA_1092837465002',
      phoneNumberId: 'PHONE_ID_919876500002',
      displayPhoneNumber: '+91 98765 00002',
       accessToken: process.env.URBANGLAM_META_ACCESS_TOKEN || 'MOCK_TOKEN',
       webhookVerifyTokenHash: hashSecret(runtimeSecret('URBANGLAM_WEBHOOK_VERIFY_TOKEN')),
       appSecret: runtimeSecret('URBANGLAM_META_APP_SECRET'),
      plan: 'PRO',
    },
  });

  // 4. Create Staff Agents for Apex EduCare
  const adminAgent = await prisma.agent.create({
    data: {
      tenantId: tenant1.id,
      name: 'Rahul Verma (Director)',
      email: 'rahul.verma@apexeducare.in',
      passwordHash: defaultPassword,
      role: 'ADMIN',
      status: 'ONLINE',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop',
    },
  });

  const agentPriya = await prisma.agent.create({
    data: {
      tenantId: tenant1.id,
      name: 'Priya Sharma (Senior Counsellor)',
      email: 'priya.sharma@apexeducare.in',
      passwordHash: agentPassword,
      role: 'AGENT',
      status: 'ONLINE',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop',
    },
  });

  const agentAmit = await prisma.agent.create({
    data: {
      tenantId: tenant1.id,
      name: 'Amit Singh (Admissions Coordinator)',
      email: 'amit.singh@apexeducare.in',
      passwordHash: agentPassword,
      role: 'AGENT',
      status: 'BUSY',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop',
    },
  });

  // 5. Create Approved Meta WhatsApp Templates
  const template1 = await prisma.template.create({
    data: {
      tenantId: tenant1.id,
      name: 'neet_jee_demo_invite',
      category: 'MARKETING',
      language: 'en',
      status: 'APPROVED',
      headerType: 'TEXT',
      headerContent: '🎓 Exclusive Masterclass Invitation',
      bodyText:
        'Namaste {{1}}! You have been selected for a Free 2-Hour Live Physics Masterclass on "{{2}}" by Kota faculty this Saturday at {{3}}. Seats are limited.',
      footerText: 'Apex EduCare • Kota & New Delhi',
      buttons: JSON.stringify([
        { type: 'QUICK_REPLY', text: 'Confirm Attendance' },
        { type: 'QUICK_REPLY', text: 'Reschedule Session' },
      ]),
      exampleVariables: JSON.stringify(['Aarav', 'Rotational Mechanics', '5:00 PM IST']),
    },
  });

  const template2 = await prisma.template.create({
    data: {
      tenantId: tenant1.id,
      name: 'fee_receipt_acknowledgement',
      category: 'UTILITY',
      language: 'en',
      status: 'APPROVED',
      headerType: 'NONE',
      bodyText:
        'Dear Parent/Student {{1}}, your payment of ₹{{2}} for {{3}} has been successfully recorded. Transaction ID: {{4}}. Thank you for choosing Apex EduCare.',
      footerText: 'Apex Finance Office',
      buttons: JSON.stringify([{ type: 'URL', text: 'Download Tax Invoice', url: 'https://apexeducare.in/receipt' }]),
      exampleVariables: JSON.stringify(['Mr. Deshmukh', '45,000', 'NEET Ranker Batch', 'TXN-98402']),
    },
  });

  const template3 = await prisma.template.create({
    data: {
      tenantId: tenant1.id,
      name: 'consultation_reminder',
      category: 'UTILITY',
      language: 'en',
      status: 'APPROVED',
      headerType: 'NONE',
      bodyText:
        'Hello {{1}}, gentle reminder: Your 1-on-1 Academic Counselling session with {{2}} is scheduled for today at {{3}}. Please be ready on WhatsApp Video/Audio.',
      footerText: 'Academic Helpdesk',
      buttons: JSON.stringify([{ type: 'QUICK_REPLY', text: 'I am ready' }]),
      exampleVariables: JSON.stringify(['Sneha', 'Priya Sharma', '4:30 PM']),
    },
  });

  // 6. Create Contacts & Realistic WhatsApp Chats
  // Contact 1: Aarav Patel (Assigned to Priya Sharma - OPEN)
  const contact1 = await prisma.contact.create({
    data: {
      tenantId: tenant1.id,
      waId: '919876543210',
      name: 'Aarav Patel',
      customAttributes: JSON.stringify({
        targetExam: 'NEET 2027',
        school: 'DPS R.K. Puram',
        city: 'Delhi',
        leadStage: 'Trial Scheduled',
      }),
    },
  });

  const chat1 = await prisma.chat.create({
    data: {
      tenantId: tenant1.id,
      contactId: contact1.id,
      assignedAgentId: agentPriya.id,
      status: 'OPEN',
      lastMessagePreview: 'Perfect! I have booked your slot for Saturday 5 PM.',
      lastMessageAt: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
      lastCustomerMessageAt: new Date(Date.now() - 10 * 60 * 1000),
      unreadCount: 0,
      tags: JSON.stringify(['NEET 2027', 'High Intent', 'Trial Scheduled']),
    },
  });

  // Messages for Chat 1
  await prisma.message.createMany({
    data: [
      {
        chatId: chat1.id,
        tenantId: tenant1.id,
        senderType: 'CUSTOMER',
        waMessageId: 'wamid.HBgL919876543210001',
        messageType: 'TEXT',
        content: 'Namaste maam, I want to know about the 1-year NEET repeater batch fees and scholarship test.',
        direction: 'INBOUND',
        status: 'READ',
        createdAt: new Date(Date.now() - 25 * 60 * 1000),
      },
      {
        chatId: chat1.id,
        tenantId: tenant1.id,
        senderType: 'AGENT',
        senderId: agentPriya.id,
        waMessageId: 'wamid.HBgL919876543210002',
        messageType: 'TEXT',
        content: 'Hello Aarav! Welcome to Apex EduCare. Our Repeater batch starts on November 1st with daily 5 hours of classes and personal mentorship.',
        direction: 'OUTBOUND',
        status: 'READ',
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
      {
        chatId: chat1.id,
        tenantId: tenant1.id,
        senderType: 'AGENT',
        senderId: agentPriya.id,
        waMessageId: 'wamid.HBgL919876543210003',
        messageType: 'DOCUMENT',
        content: 'NEET_Repeater_Curriculum_2026.pdf',
        mediaFilename: 'NEET_Repeater_Curriculum_2026.pdf',
        mediaUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        direction: 'OUTBOUND',
        status: 'READ',
        createdAt: new Date(Date.now() - 18 * 60 * 1000),
      },
      {
        chatId: chat1.id,
        tenantId: tenant1.id,
        senderType: 'CUSTOMER',
        waMessageId: 'wamid.HBgL919876543210004',
        messageType: 'TEXT',
        content: 'Can I attend one demo class before paying the registration fee?',
        direction: 'INBOUND',
        status: 'READ',
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        chatId: chat1.id,
        tenantId: tenant1.id,
        senderType: 'AGENT',
        senderId: agentPriya.id,
        waMessageId: 'wamid.HBgL919876543210005',
        messageType: 'TEXT',
        content: 'Perfect! I have booked your slot for Saturday 5 PM.',
        direction: 'OUTBOUND',
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    ],
  });

  // Contact 2: Sunita Deshmukh (UNASSIGNED POOL)
  const contact2 = await prisma.contact.create({
    data: {
      tenantId: tenant1.id,
      waId: '919820012345',
      name: 'Sunita Deshmukh',
      customAttributes: JSON.stringify({
        city: 'Pune',
        inquiry: 'JEE Advanced Foundation Class 11',
      }),
    },
  });

  const chat2 = await prisma.chat.create({
    data: {
      tenantId: tenant1.id,
      contactId: contact2.id,
      assignedAgentId: null, // UNASSIGNED
      status: 'UNASSIGNED',
      lastMessagePreview: 'Is there an installment option available for the 2-year fee?',
      lastMessageAt: new Date(Date.now() - 12 * 60 * 1000),
      lastCustomerMessageAt: new Date(Date.now() - 12 * 60 * 1000),
      unreadCount: 2,
      tags: JSON.stringify(['JEE 2028', 'Fee Plan', 'Unassigned Lead']),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        chatId: chat2.id,
        tenantId: tenant1.id,
        senderType: 'CUSTOMER',
        waMessageId: 'wamid.HBgL919820012345001',
        messageType: 'TEXT',
        content: 'Good morning! My son is in Class 10 and moving to 11. We want JEE offline batch in Pune center.',
        direction: 'INBOUND',
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        chatId: chat2.id,
        tenantId: tenant1.id,
        senderType: 'CUSTOMER',
        waMessageId: 'wamid.HBgL919820012345002',
        messageType: 'TEXT',
        content: 'Is there an installment option available for the 2-year fee?',
        direction: 'INBOUND',
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 12 * 60 * 1000),
      },
    ],
  });

  // Contact 3: Dr. Rohan Mehta (RESOLVED Conversation)
  const contact3 = await prisma.contact.create({
    data: {
      tenantId: tenant1.id,
      waId: '919811122334',
      name: 'Dr. Rohan Mehta',
      customAttributes: JSON.stringify({
        status: 'Enrolled',
        batch: 'Batch B-4 Medical',
      }),
    },
  });

  const chat3 = await prisma.chat.create({
    data: {
      tenantId: tenant1.id,
      contactId: contact3.id,
      assignedAgentId: agentAmit.id,
      status: 'RESOLVED',
      lastMessagePreview: 'Thank you Amit ji, we received the admit card and batch ID.',
      lastMessageAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      lastCustomerMessageAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      unreadCount: 0,
      tags: JSON.stringify(['Enrolled', 'Fee Received', 'Batch Assigned']),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        chatId: chat3.id,
        tenantId: tenant1.id,
        senderType: 'AGENT',
        senderId: agentAmit.id,
        waMessageId: 'wamid.HBgL919811122334001',
        messageType: 'TEXT',
        content: 'Dr. Mehta, your ward has been assigned Roll No APX-8829 for the Sunday test series.',
        direction: 'OUTBOUND',
        status: 'READ',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000),
      },
      {
        chatId: chat3.id,
        tenantId: tenant1.id,
        senderType: 'CUSTOMER',
        waMessageId: 'wamid.HBgL919811122334002',
        messageType: 'TEXT',
        content: 'Thank you Amit ji, we received the admit card and batch ID.',
        direction: 'INBOUND',
        status: 'READ',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // Contact 4: Sneha Kapoor (Inbound photo prescription / inquiry - UNASSIGNED)
  const contact4 = await prisma.contact.create({
    data: {
      tenantId: tenant1.id,
      waId: '919999988888',
      name: 'Sneha Kapoor',
      customAttributes: JSON.stringify({
        city: 'Jaipur',
        exam: 'Olympiad + Class 9 Foundation',
      }),
    },
  });

  const chat4 = await prisma.chat.create({
    data: {
      tenantId: tenant1.id,
      contactId: contact4.id,
      assignedAgentId: null,
      status: 'UNASSIGNED',
      lastMessagePreview: 'Attached past year scorecard for scholarship review',
      lastMessageAt: new Date(Date.now() - 2 * 60 * 1000), // 2 mins ago
      lastCustomerMessageAt: new Date(Date.now() - 2 * 60 * 1000),
      unreadCount: 1,
      tags: JSON.stringify(['Urgent', 'Scholarship Review']),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        chatId: chat4.id,
        tenantId: tenant1.id,
        senderType: 'CUSTOMER',
        waMessageId: 'wamid.HBgL919999988888001',
        messageType: 'IMAGE',
        content: 'Attached past year scorecard for scholarship review',
        mediaUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&auto=format&fit=crop',
        direction: 'INBOUND',
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 2 * 60 * 1000),
      },
    ],
  });

  console.log('✅ Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Admin and agent login passwords are supplied via SEED_ADMIN_PASSWORD and SEED_AGENT_PASSWORD.');
  console.log('----------------------------------------------------');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
