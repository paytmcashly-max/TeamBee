'use strict';

const prisma = require('../db/prisma');
const { withTenantDb, rlsContextEnabled } = require('../db/withTenant');
const MetaApiService = require('./metaApiService');
const { broadcastNewMessage, broadcastChatAssignment } = require('./socketService');

/**
 * Inbound automation: round-robin auto-assignment and office-hours away
 * replies. The decision helpers are pure functions (unit-tested); the
 * orchestrator never throws — automation must not break webhook ingestion.
 */

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Pick the agent for a rotation counter value (counter taken BEFORE increment semantics are handled by the caller). */
function pickRoundRobinAgent(counterValue, agentIds) {
  if (!Array.isArray(agentIds) || agentIds.length === 0) return null;
  const idx = ((counterValue % agentIds.length) + agentIds.length) % agentIds.length;
  return agentIds[idx];
}

function parseHHMM(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 24 || mins > 59 || (hours === 24 && mins !== 0)) return null;
  return hours * 60 + mins;
}

function localParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'Asia/Kolkata',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[parts.weekday],
    minutes: (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10),
  };
}

/**
 * cfg: { start: 'HH:MM', end: 'HH:MM', days: '1,2,3,4,5' (JS getDay numbers),
 *        timezone: 'Asia/Kolkata' }
 * Returns true when `date` falls OUTSIDE the configured office window.
 * Unconfigured/invalid input is never "outside" (automation stays silent
 * rather than spamming customers on a config mistake).
 */
function isOutsideOfficeHours(date, cfg) {
  if (!cfg || !cfg.start || !cfg.end || !cfg.days) return false;
  const start = parseHHMM(cfg.start);
  const end = parseHHMM(cfg.end);
  if (start === null || end === null || start === end) return false;
  const days = new Set(
    String(cfg.days)
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
  if (days.size === 0) return false;

  const { day, minutes } = localParts(date, cfg.timezone);
  if (start < end) {
    // Same-day window, e.g. 09:00–21:00 on the listed days.
    return !(days.has(day) && minutes >= start && minutes < end);
  }
  // Overnight window, e.g. 21:00–09:00: the pre-midnight part belongs to
  // `day`; the post-midnight part belongs to the previous day's window.
  if (minutes >= start) return !days.has(day);
  if (minutes < end) return !days.has((day + 6) % 7);
  return true;
}

const AWAY_REPLY_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;

/** At most one away reply per chat per 12 hours. */
function shouldSendAwayReply(lastAwayReplyAt, now) {
  if (!lastAwayReplyAt) return true;
  return now.getTime() - new Date(lastAwayReplyAt).getTime() >= AWAY_REPLY_MIN_INTERVAL_MS;
}

// ---------------------------------------------------------------------------
// Orchestration (post-ingestion, fire-and-forget from the webhook path)
// ---------------------------------------------------------------------------

async function applyInboundAutomation({ tenant, chatId }) {
  const run = (fn) => (rlsContextEnabled() ? withTenantDb(tenant.id, fn) : fn(prisma));
  try {
    const chat = await run((db) =>
      db.chat.findUnique({
        where: { id: chatId },
        include: { contact: true },
      })
    );
    if (!chat || chat.tenantId !== tenant.id) return;
    let current = chat;

    // 1) Round-robin auto-assign while the chat is unassigned. The rotation
    // counter is bumped atomically on the tenant row, so concurrent
    // webhooks (and multiple instances) can never pick from a stale count.
    if (tenant.autoAssignEnabled && !current.assignedAgentId) {
      const agents = await run((db) =>
        db.agent.findMany({
          where: { tenantId: tenant.id, isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true },
        })
      );
      if (agents.length) {
        const bumped = await run((db) =>
          db.tenant.update({
            where: { id: tenant.id },
            data: { assignmentCounter: { increment: 1 } },
            select: { assignmentCounter: true },
          })
        );
        const chosenId = pickRoundRobinAgent(
          bumped.assignmentCounter - 1,
          agents.map((a) => a.id)
        );
        const chosen = agents.find((a) => a.id === chosenId);
        if (chosen) {
          current = await run((db) =>
            db.chat.update({
              where: { id: current.id },
              data: { assignedAgentId: chosen.id, status: 'OPEN' },
              include: { contact: true },
            })
          );
          broadcastChatAssignment(tenant.id, current.id, {
            assignedAgentId: chosen.id,
            previousAssignedAgentId: null,
            assignedAgentName: chosen.name,
            status: 'OPEN',
          });
        }
      }
    }

    // 2) Office-hours away reply: an APPROVED, zero-variable template sent
    // at most once per 12h per chat when a customer writes outside hours.
    if (tenant.awayTemplateName && tenant.officeHoursStart && tenant.officeHoursEnd) {
      const now = new Date();
      const outside = isOutsideOfficeHours(now, {
        start: tenant.officeHoursStart,
        end: tenant.officeHoursEnd,
        days: tenant.officeHoursDays,
        timezone: tenant.officeHoursTimezone,
      });
      if (outside && shouldSendAwayReply(current.lastAwayReplyAt, now) && current.contact?.waId) {
        const template = await run((db) =>
          db.template.findFirst({
            where: { tenantId: tenant.id, name: tenant.awayTemplateName, status: 'APPROVED' },
          })
        );
        if (template) {
          const result = await MetaApiService.sendTemplateMessage(
            tenant,
            current.contact.waId,
            template.name,
            template.language || 'en',
            []
          );
          if (result.success) {
            const sentAt = new Date();
            await run((db) =>
              db.chat.update({
                where: { id: current.id },
                data: {
                  lastAwayReplyAt: sentAt,
                  lastMessagePreview: `Template: ${template.name}`,
                  lastMessageAt: sentAt,
                },
              })
            );
            const message = await run((db) =>
              db.message.create({
                data: {
                  chatId: current.id,
                  tenantId: tenant.id,
                senderType: 'SYSTEM',
                messageType: 'TEMPLATE',
                content: template.bodyText || `Template: ${template.name}`,
                rawPayload: JSON.stringify({ template: template.name, automation: 'away_reply' }),
                direction: 'OUTBOUND',
                status: 'SENT',
                  waMessageId: result.wamid || null,
                  createdAt: sentAt,
                },
              })
            );
            broadcastNewMessage(tenant.id, current.id, message, current.assignedAgentId);
          } else {
            console.error('[Automation]: away template send failed:', result.error || result.code);
          }
        }
      }
    }
  } catch (error) {
    // Automation is best-effort by design; ingestion already succeeded.
    console.error('[Automation]: inbound automation failed (webhook unaffected):', error.message);
  }
}

module.exports = {
  pickRoundRobinAgent,
  parseHHMM,
  isOutsideOfficeHours,
  shouldSendAwayReply,
  applyInboundAutomation,
  AWAY_REPLY_MIN_INTERVAL_MS,
};
