'use strict';
/**
 * Unit tests for automationService's pure decision helpers.
 * The service's heavy dependencies (prisma, Meta API, sockets) are stubbed
 * in the require cache — only the exported pure functions run.
 */
const Module = require('module');
const path = require('path');

const serverSrc = path.join(__dirname, '..', 'src');
function stub(modulePath, exportsObj) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsObj,
  };
}
stub(path.join(serverSrc, 'db', 'prisma'), {});
stub(path.join(serverSrc, 'services', 'metaApiService'), {});
stub(path.join(serverSrc, 'services', 'socketService'), {
  broadcastNewMessage: () => {},
  broadcastChatAssignment: () => {},
});

const {
  pickRoundRobinAgent,
  parseHHMM,
  isOutsideOfficeHours,
  shouldSendAwayReply,
  AWAY_REPLY_MIN_INTERVAL_MS,
} = require(path.join(serverSrc, 'services', 'automationService'));

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const ok = Object.is(actual, expected);
  if (ok) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// --- pickRoundRobinAgent ---
check('rr empty list', pickRoundRobinAgent(0, []), null);
check('rr first', pickRoundRobinAgent(0, ['a', 'b', 'c']), 'a');
check('rr second', pickRoundRobinAgent(1, ['a', 'b', 'c']), 'b');
check('rr wraps', pickRoundRobinAgent(3, ['a', 'b', 'c']), 'a');
check('rr large counter', pickRoundRobinAgent(1000, ['a', 'b']), 'a');
check('rr negative counter', pickRoundRobinAgent(-1, ['a', 'b', 'c']), 'c');
{
  // Fairness over a full rotation: every agent picked equally.
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 300; i += 1) counts[pickRoundRobinAgent(i, ['a', 'b', 'c'])] += 1;
  check('rr fairness a', counts.a, 100);
  check('rr fairness b', counts.b, 100);
  check('rr fairness c', counts.c, 100);
}

// --- parseHHMM ---
check('hhmm ok', parseHHMM('09:30'), 570);
check('hhmm midnight', parseHHMM('00:00'), 0);
check('hhmm end of day', parseHHMM('24:00'), 1440);
check('hhmm garbage', parseHHMM('abc'), null);
check('hhmm bad minutes rejected', parseHHMM('09:99'), null);
check('hhmm 24:30 rejected', parseHHMM('24:30'), null);
check('hhmm empty', parseHHMM(''), null);
check('hhmm null', parseHHMM(null), null);

// --- isOutsideOfficeHours ---
// IST = UTC+5:30. 2026-10-26 is a Monday. 10:00 IST = 04:30 UTC.
const mon10Ist = new Date('2026-10-26T04:30:00Z');
const mon22Ist = new Date('2026-10-26T16:30:00Z');
const sat10Ist = new Date('2026-10-31T04:30:00Z'); // Saturday
const cfgWeekday = { start: '09:00', end: '21:00', days: '1,2,3,4,5', timezone: 'Asia/Kolkata' };
check('inside weekday hours', isOutsideOfficeHours(mon10Ist, cfgWeekday), false);
check('outside after close', isOutsideOfficeHours(mon22Ist, cfgWeekday), true);
check('outside on Saturday', isOutsideOfficeHours(sat10Ist, cfgWeekday), true);
check('unconfigured -> never outside', isOutsideOfficeHours(mon22Ist, {}), false);
check('missing days -> never outside', isOutsideOfficeHours(mon22Ist, { start: '09:00', end: '21:00' }), false);
check('start==end -> never outside', isOutsideOfficeHours(mon22Ist, { start: '09:00', end: '09:00', days: '1' }), false);
check('invalid time -> never outside', isOutsideOfficeHours(mon22Ist, { start: 'xx', end: '21:00', days: '1' }), false);

// Boundaries: exactly at start = inside; exactly at end = outside.
const mon0859 = new Date('2026-10-26T03:29:00Z'); // 08:59 IST
const mon0900 = new Date('2026-10-26T03:30:00Z'); // 09:00 IST
const mon2100 = new Date('2026-10-26T15:30:00Z'); // 21:00 IST
check('just before open is outside', isOutsideOfficeHours(mon0859, cfgWeekday), true);
check('exactly at open is inside', isOutsideOfficeHours(mon0900, cfgWeekday), false);
check('exactly at close is outside', isOutsideOfficeHours(mon2100, cfgWeekday), true);

// Overnight window 21:00–09:00, Mon–Fri listed.
const cfgNight = { start: '21:00', end: '09:00', days: '1,2,3,4,5', timezone: 'Asia/Kolkata' };
const mon2330 = new Date('2026-10-26T18:00:00Z'); // Mon 23:30 IST
const tue0200 = new Date('2026-10-26T20:30:00Z'); // Tue 02:00 IST (Monday night window)
const sat0200 = new Date('2026-10-30T20:30:00Z'); // Sat 02:00 IST (Friday night window)
const mon0200 = new Date('2026-10-25T20:30:00Z'); // Mon 02:00 IST (Sunday night — not listed)
check('overnight pre-midnight inside', isOutsideOfficeHours(mon2330, cfgNight), false);
check('overnight post-midnight inside (prev day listed)', isOutsideOfficeHours(tue0200, cfgNight), false);
check('overnight Fri->Sat inside', isOutsideOfficeHours(sat0200, cfgNight), false);
check('overnight Sun->Mon outside (Sun not listed)', isOutsideOfficeHours(mon0200, cfgNight), true);
check('overnight midday is outside', isOutsideOfficeHours(mon10Ist, cfgNight), true);

// Another timezone: America/New_York (UTC-4 in Oct). Mon 10:00 IST = 00:30 EDT.
const cfgNy = { start: '09:00', end: '17:00', days: '1,2,3,4,5', timezone: 'America/New_York' };
check('NY tz: 00:30 local is outside', isOutsideOfficeHours(mon10Ist, cfgNy), true);
const mon1430Utc = new Date('2026-10-26T14:30:00Z'); // 10:30 EDT
check('NY tz: 10:30 local is inside', isOutsideOfficeHours(mon1430Utc, cfgNy), false);

// --- shouldSendAwayReply ---
const now = new Date('2026-10-26T00:00:00Z');
check('away: never sent', shouldSendAwayReply(null, now), true);
check('away: sent just now', shouldSendAwayReply(now, now), false);
check(
  'away: sent 11h59m ago',
  shouldSendAwayReply(new Date(now.getTime() - (AWAY_REPLY_MIN_INTERVAL_MS - 60000)), now),
  false
);
check(
  'away: sent exactly 12h ago',
  shouldSendAwayReply(new Date(now.getTime() - AWAY_REPLY_MIN_INTERVAL_MS), now),
  true
);
check(
  'away: sent 24h ago',
  shouldSendAwayReply(new Date(now.getTime() - 24 * 3600 * 1000), now),
  true
);

console.log(`\nautomation units: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
