'use strict';
/**
 * Controller/service logic tests with an in-memory prisma fake injected via
 * the require cache. Covers the five-feature round:
 *  - QuickReplyController CRUD + validation + tenant scoping + P2002 -> 409
 *  - ChatController.snoozeChat validation windows + access control
 *  - TenantController.updateSettings automation validation
 *  - automationService.applyInboundAutomation orchestration (RR + away)
 */
const path = require('path');

const serverSrc = path.join(__dirname, '..', 'src');

function stub(modulePath, exportsObj) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function main() {
  // -------------------------------------------------------------------------
  // Shared fake prisma (state reset per suite)
  // -------------------------------------------------------------------------
  const db = {
    quickReplies: [],
    chats: [],
    agents: [],
    tenants: [],
    templates: [],
    messages: [],
  };
  let qrSeq = 0;

  const prismaFake = {
    quickReply: {
      findMany: async ({ where }) =>
        db.quickReplies.filter((r) => r.tenantId === where.tenantId),
      create: async ({ data }) => {
        if (
          data.shortcut &&
          db.quickReplies.some((r) => r.tenantId === data.tenantId && r.shortcut === data.shortcut)
        ) {
          const err = new Error('unique');
          err.code = 'P2002';
          throw err;
        }
        const row = { id: `qr-${++qrSeq}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        db.quickReplies.push(row);
        return row;
      },
      findFirst: async ({ where }) =>
        db.quickReplies.find((r) => r.id === where.id && r.tenantId === where.tenantId) || null,
      update: async ({ where, data }) => {
        const row = db.quickReplies.find((r) => r.id === where.id);
        if (
          data.shortcut &&
          db.quickReplies.some((r) => r.id !== where.id && r.tenantId === row.tenantId && r.shortcut === data.shortcut)
        ) {
          const err = new Error('unique');
          err.code = 'P2002';
          throw err;
        }
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }) => {
        db.quickReplies = db.quickReplies.filter((r) => r.id !== where.id);
        return {};
      },
    },
    chat: {
      findUnique: async ({ where }) => db.chats.find((c) => c.id === where.id) || null,
      update: async ({ where, data }) => {
        const row = db.chats.find((c) => c.id === where.id);
        Object.assign(row, data);
        return { ...row, contact: row.contact };
      },
    },
    agent: {
      findMany: async ({ where }) =>
        db.agents.filter((a) => a.tenantId === where.tenantId && a.isActive),
    },
    tenant: {
      update: async ({ where, data }) => {
        const row = db.tenants.find((t) => t.id === where.id);
        if (data.assignmentCounter && typeof data.assignmentCounter === 'object') {
          row.assignmentCounter += data.assignmentCounter.increment;
        } else {
          Object.assign(row, data);
        }
        return { ...row };
      },
      findUnique: async ({ where }) => db.tenants.find((t) => t.id === where.id) || null,
    },
    template: {
      findFirst: async ({ where }) =>
        db.templates.find(
          (t) => t.tenantId === where.tenantId && t.name === where.name && t.status === where.status
        ) || null,
    },
    message: {
      create: async ({ data }) => {
        const row = { id: `msg-${db.messages.length + 1}`, ...data };
        db.messages.push(row);
        return row;
      },
    },
  };

  const socketCalls = { snooze: [], assigned: [], newMessage: [], mentions: [] };
  stub(path.join(serverSrc, 'db', 'prisma'), prismaFake);
  stub(path.join(serverSrc, 'services', 'socketService'), {
    broadcastNewMessage: (...args) => socketCalls.newMessage.push(args),
    broadcastMessageStatus: () => {},
    broadcastChatAssignment: (...args) => socketCalls.assigned.push(args),
    broadcastChatStatusTransition: () => {},
    broadcastChatSnoozeChanged: (...args) => socketCalls.snooze.push(args),
    broadcastNoteMentions: (...args) => socketCalls.mentions.push(args),
  });
  stub(path.join(serverSrc, 'middleware', 'authMiddleware'), {
    canAccessChat: (agent, chat) => agent.role !== 'AGENT' || !chat.assignedAgentId || chat.assignedAgentId === agent.id,
    authenticateToken: () => {},
    requireRole: () => () => {},
  });
  const metaCalls = [];
  let metaResult = { success: true, wamid: 'wamid.test' };
  stub(path.join(serverSrc, 'services', 'metaApiService'), {
    sendTemplateMessage: async (...args) => {
      metaCalls.push(args);
      return metaResult;
    },
  });

  const QuickReplyController = require(path.join(serverSrc, 'controllers', 'quickReplyController'));
  const ChatController = require(path.join(serverSrc, 'controllers', 'chatController'));
  const TenantController = require(path.join(serverSrc, 'controllers', 'tenantController'));
  const { applyInboundAutomation } = require(path.join(serverSrc, 'services', 'automationService'));

  const adminReq = {
    tenantId: 't1',
    agent: { id: 'a1', role: 'ADMIN', name: 'Admin' },
    body: {},
    params: {},
    db: (fn) => fn(prismaFake),
  };

  // -------------------------------------------------------------------------
  // Quick replies
  // -------------------------------------------------------------------------
  {
    let res = makeRes();
    await QuickReplyController.create(
      { ...adminReq, body: { title: '  Price list ', body: 'Prices attached', shortcut: '/Price' } },
      res
    );
    check('qr create 201', res.statusCode === 201 && res.body.success === true);
    check('qr create trims title', res.body.quickReply.title === 'Price list');
    check('qr shortcut normalized (slash stripped, lowercased)', res.body.quickReply.shortcut === 'price');

    res = makeRes();
    await QuickReplyController.create({ ...adminReq, body: { title: '', body: 'x' } }, res);
    check('qr create missing title -> 400', res.statusCode === 400);

    res = makeRes();
    await QuickReplyController.create(
      { ...adminReq, body: { title: 'Dup', body: 'y', shortcut: 'price' } },
      res
    );
    check('qr duplicate shortcut -> 409', res.statusCode === 409);

    res = makeRes();
    await QuickReplyController.create({ ...adminReq, body: { title: 'NoSC', body: 'z' } }, res);
    check('qr null shortcut allowed', res.statusCode === 201 && res.body.quickReply.shortcut === null);
    res = makeRes();
    await QuickReplyController.create({ ...adminReq, body: { title: 'NoSC2', body: 'z' } }, res);
    check('qr second null shortcut allowed', res.statusCode === 201);

    res = makeRes();
    await QuickReplyController.list({ ...adminReq }, res);
    check('qr list returns tenant rows', res.body.quickReplies.length === 3);

    res = makeRes();
    await QuickReplyController.list({ ...adminReq, tenantId: 'other' }, res);
    check('qr list tenant-isolated', res.body.quickReplies.length === 0);

    const targetId = db.quickReplies[0].id;
    res = makeRes();
    await QuickReplyController.update(
      { ...adminReq, tenantId: 'other', params: { id: targetId }, body: { title: 'H', body: 'H' } },
      res
    );
    check('qr update other tenant -> 404', res.statusCode === 404);

    res = makeRes();
    await QuickReplyController.update(
      { ...adminReq, params: { id: targetId }, body: { title: 'Prices v2', body: 'New', shortcut: '' } },
      res
    );
    check('qr update ok + shortcut cleared', res.statusCode === 200 && res.body.quickReply.shortcut === null);

    res = makeRes();
    await QuickReplyController.remove({ ...adminReq, params: { id: targetId } }, res);
    check('qr delete ok', res.statusCode === 200 && db.quickReplies.length === 2);
  }

  // -------------------------------------------------------------------------
  // Snooze
  // -------------------------------------------------------------------------
  {
    db.chats = [
      { id: 'c1', tenantId: 't1', assignedAgentId: 'a1', snoozedUntil: null, snoozedById: null },
      { id: 'c2', tenantId: 't2', assignedAgentId: null, snoozedUntil: null, snoozedById: null },
    ];
    const agentReq = {
      tenantId: 't1',
      agent: { id: 'a1', role: 'AGENT', name: 'A' },
      params: { id: 'c1' },
      body: {},
      db: (fn) => fn(prismaFake),
    };
    const future = new Date(Date.now() + 3600e3).toISOString();

    let res = makeRes();
    await ChatController.snoozeChat({ ...agentReq, body: { until: future } }, res);
    check('snooze set 200', res.statusCode === 200 && res.body.chat.snoozedUntil);
    check('snooze stored + by agent', db.chats[0].snoozedUntil && db.chats[0].snoozedById === 'a1');
    check('snooze broadcast fired', socketCalls.snooze.length === 1);

    res = makeRes();
    await ChatController.snoozeChat({ ...agentReq, body: { until: new Date(Date.now() - 1000).toISOString() } }, res);
    check('snooze past time -> 400', res.statusCode === 400);

    res = makeRes();
    await ChatController.snoozeChat(
      { ...agentReq, body: { until: new Date(Date.now() + 31 * 24 * 3600e3).toISOString() } },
      res
    );
    check('snooze >30d -> 400', res.statusCode === 400);

    res = makeRes();
    await ChatController.snoozeChat({ ...agentReq, body: { until: 'not-a-date' } }, res);
    check('snooze garbage date -> 400', res.statusCode === 400);

    res = makeRes();
    await ChatController.snoozeChat({ ...agentReq, params: { id: 'c2' }, body: { until: future } }, res);
    check('snooze other tenant chat -> 404', res.statusCode === 404);

    res = makeRes();
    await ChatController.snoozeChat(
      { ...agentReq, agent: { id: 'a9', role: 'AGENT', name: 'Other' }, body: { until: future } },
      res
    );
    check('snooze chat assigned to someone else -> 403', res.statusCode === 403);

    res = makeRes();
    await ChatController.snoozeChat({ ...agentReq, body: { until: null } }, res);
    check('unsnooze clears', res.statusCode === 200 && db.chats[0].snoozedUntil === null && db.chats[0].snoozedById === null);
  }

  // -------------------------------------------------------------------------
  // Tenant automation settings validation
  // -------------------------------------------------------------------------
  {
    db.tenants = [{ id: 't1', assignmentCounter: 0 }];
    const req = (body) => ({
      tenantId: 't1',
      agent: { id: 'a1', role: 'ADMIN' },
      body,
      db: (fn) => fn(prismaFake),
    });

    let res = makeRes();
    await TenantController.updateSettings(req({ officeHoursStart: '25:00' }), res);
    check('settings bad hour -> 400', res.statusCode === 400);

    res = makeRes();
    await TenantController.updateSettings(req({ officeHoursEnd: '9:99' }), res);
    check('settings bad minutes -> 400', res.statusCode === 400);

    res = makeRes();
    await TenantController.updateSettings(req({ officeHoursDays: '1,2,x' }), res);
    check('settings bad days -> 400', res.statusCode === 400);

    res = makeRes();
    await TenantController.updateSettings(req({ officeHoursTimezone: 'Mars/Olympus' }), res);
    check('settings bad timezone -> 400', res.statusCode === 400);

    res = makeRes();
    await TenantController.updateSettings(req({ autoAssignEnabled: 'yes' }), res);
    check('settings non-boolean autoAssign -> 400', res.statusCode === 400);

    res = makeRes();
    await TenantController.updateSettings(
      req({
        autoAssignEnabled: true,
        officeHoursStart: '09:00',
        officeHoursEnd: '21:00',
        officeHoursDays: '1,2,3,4,5',
        officeHoursTimezone: 'Asia/Kolkata',
        awayTemplateName: 'we_will_reply_soon',
      }),
      res
    );
    check('settings valid automation -> 200', res.statusCode === 200);
    const t = db.tenants[0];
    check(
      'settings persisted',
      t.autoAssignEnabled === true && t.officeHoursStart === '09:00' && t.awayTemplateName === 'we_will_reply_soon'
    );

    res = makeRes();
    await TenantController.updateSettings(req({ awayTemplateName: '' }), res);
    check('settings away template cleared to null', res.statusCode === 200 && db.tenants[0].awayTemplateName === null);
  }

  // -------------------------------------------------------------------------
  // Automation orchestration
  // -------------------------------------------------------------------------
  {
    const baseTenant = {
      id: 't1',
      autoAssignEnabled: true,
      assignmentCounter: 0,
      officeHoursStart: null,
      officeHoursEnd: null,
      officeHoursDays: null,
      officeHoursTimezone: 'Asia/Kolkata',
      awayTemplateName: null,
    };
    db.tenants = [baseTenant];
    db.agents = [
      { id: 'a1', tenantId: 't1', isActive: true, name: 'One', createdAt: 1 },
      { id: 'a2', tenantId: 't1', isActive: true, name: 'Two', createdAt: 2 },
      { id: 'a3', tenantId: 't1', isActive: true, name: 'Three', createdAt: 3 },
    ];
    db.chats = [
      { id: 'ac1', tenantId: 't1', assignedAgentId: null, status: 'UNASSIGNED', lastAwayReplyAt: null, contact: { waId: '919999999999' } },
    ];
    socketCalls.assigned = [];

    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac1' });
    check('auto-assign: first chat -> first agent', db.chats[0].assignedAgentId === 'a1');
    check('auto-assign: status OPEN', db.chats[0].status === 'OPEN');
    check('auto-assign: broadcast fired', socketCalls.assigned.length === 1);

    db.chats.push({ id: 'ac2', tenantId: 't1', assignedAgentId: null, status: 'UNASSIGNED', lastAwayReplyAt: null, contact: { waId: '918888888888' } });
    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac2' });
    check('auto-assign: second chat -> second agent (RR)', db.chats[1].assignedAgentId === 'a2');

    db.chats.push({ id: 'ac3', tenantId: 't1', assignedAgentId: null, status: 'UNASSIGNED', lastAwayReplyAt: null, contact: { waId: '917777777777' } });
    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac3' });
    db.chats.push({ id: 'ac4', tenantId: 't1', assignedAgentId: null, status: 'UNASSIGNED', lastAwayReplyAt: null, contact: { waId: '916666666666' } });
    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac4' });
    check('auto-assign: rotation wraps to first', db.chats[3].assignedAgentId === 'a1');

    // Already-assigned chats are untouched
    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac1' });
    check('auto-assign: assigned chat untouched', db.chats[0].assignedAgentId === 'a1' && baseTenant.assignmentCounter === 4);

    // Disabled -> no assignment
    baseTenant.autoAssignEnabled = false;
    db.chats.push({ id: 'ac5', tenantId: 't1', assignedAgentId: null, status: 'UNASSIGNED', lastAwayReplyAt: null, contact: { waId: '915555555555' } });
    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac5' });
    check('auto-assign disabled -> unassigned stays', db.chats[4].assignedAgentId === null);
    baseTenant.autoAssignEnabled = true;

    // Away reply: configure hours so "now" is outside in IST regardless of
    // the test-run wall clock: a 1-minute window on a day list that excludes
    // today is fragile; instead use days='' ... no — instead set the window
    // to a single minute far from now: start=end is rejected. Use days with
    // only tomorrow's weekday relative to IST: compute dynamically.
    const istDay = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit' }).format(new Date())
    );
    void istDay;
    const istWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date());
    const dayNum = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[istWeekday];
    const notToday = String((dayNum + 1) % 7); // a weekday that is NOT today in IST
    baseTenant.officeHoursStart = '09:00';
    baseTenant.officeHoursEnd = '21:00';
    baseTenant.officeHoursDays = notToday; // today is never a working day -> always outside
    baseTenant.awayTemplateName = 'away_note';
    db.templates = [{ id: 'tpl1', tenantId: 't1', name: 'away_note', status: 'APPROVED', language: 'en', bodyText: 'We are away' }];
    metaCalls.length = 0;
    db.messages = [];

    db.chats.push({ id: 'ac6', tenantId: 't1', assignedAgentId: 'a1', status: 'OPEN', lastAwayReplyAt: null, contact: { waId: '914444444444' } });
    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac6' });
    check('away: template sent outside hours', metaCalls.length === 1 && metaCalls[0][2] === 'away_note');
    check('away: lastAwayReplyAt stamped', Boolean(db.chats[5].lastAwayReplyAt));
    check('away: transcript message persisted', db.messages.length === 1 && db.messages[0].messageType === 'TEMPLATE');

    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac6' });
    check('away: throttled within 12h', metaCalls.length === 1);

    // Working day = today -> inside hours -> no away reply
    baseTenant.officeHoursDays = String(dayNum);
    baseTenant.officeHoursStart = '00:00';
    baseTenant.officeHoursEnd = '23:59';
    db.chats.push({ id: 'ac7', tenantId: 't1', assignedAgentId: 'a1', status: 'OPEN', lastAwayReplyAt: null, contact: { waId: '913333333333' } });
    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac7' });
    check('away: not sent inside hours', metaCalls.length === 1);

    // Meta failure -> no stamp, no crash
    baseTenant.officeHoursDays = notToday;
    metaResult = { success: false, error: 'meta down' };
    db.chats.push({ id: 'ac8', tenantId: 't1', assignedAgentId: 'a1', status: 'OPEN', lastAwayReplyAt: null, contact: { waId: '912222222222' } });
    await applyInboundAutomation({ tenant: baseTenant, chatId: 'ac8' });
    check('away: meta failure -> no stamp', db.chats[7].lastAwayReplyAt === null);
    metaResult = { success: true, wamid: 'wamid.test' };
  }

  console.log(`\nfeature controllers: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('harness crashed:', err);
  process.exit(1);
});
