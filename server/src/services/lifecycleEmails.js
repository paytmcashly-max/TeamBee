const prisma = require('../db/prisma');
const { withSystemDb, rlsContextEnabled } = require('../db/withTenant');
const { sendEmail, emailConfigured, appBaseUrl } = require('./emailService');
const { logAuditEvent } = require('./auditLog');

// Lifecycle email: the messages a SaaS owes its users beyond password
// reset — a welcome with ONE next step, and trial-ending reminders.
// Everything here is dormant until RESEND_API_KEY is set (sendEmail
// reports EMAIL_NOT_CONFIGURED and callers degrade silently), so wiring
// it now is safe ahead of the key arriving.
//
// Reminder dedupe: each (tenant, stage) pair is emailed at most once;
// the send is recorded as a TRIAL_REMINDER_SENT audit event whose
// metadata carries the stage, and the drain checks for it before
// sending. Stages: '3d' (trial ends within 3 days), '1d' (within 1
// day), 'expired' (ended within the last 24 hours).

const systemDb = (fn) => (rlsContextEnabled() ? withSystemDb(fn) : fn(prisma));

function shellHtml(title, bodyHtml) {
  return `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
  <div style="background: #0b1220; border-radius: 12px 12px 0 0; padding: 20px 24px;">
    <span style="color: #25D366; font-size: 19px; font-weight: 800;">TeamBee</span>
  </div>
  <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
    <h1 style="font-size: 19px; margin: 0 0 12px; color: #0f172a;">${title}</h1>
    ${bodyHtml}
    <p style="font-size: 12px; color: #64748b; margin-top: 22px;">You are receiving this because you have a TeamBee workspace. Support is available inside your workspace.</p>
  </div>
</div>`;
}

async function sendWelcomeEmail({ to, adminName, businessName }) {
  const url = appBaseUrl();
  const firstName = (adminName || '').trim().split(' ')[0] || 'there';
  const subject = 'Welcome to TeamBee — one step to go live';
  const body = `<p>Hello ${firstName},</p>
<p>Your workspace <strong>${businessName}</strong> is ready and your 14-day free trial (full Pro features) has started.</p>
<p><strong>Your one next step:</strong> connect your WhatsApp business number. It takes a few minutes with the in-app wizard, and it is the step everything else — team replies, templates, broadcasts — builds on.</p>
<p><a href="${url}" style="display: inline-block; background: #25D366; color: #052e12; font-weight: 700; padding: 11px 18px; border-radius: 9px; text-decoration: none;">Open TeamBee &amp; connect WhatsApp</a></p>
<p>After that: invite your team from the dashboard, and send your first template. The setup checklist on your dashboard tracks all of it.</p>`;
  const text = `Hello ${firstName},\n\nYour workspace "${businessName}" is ready and your 14-day free trial (full Pro features) has started.\n\nYour one next step: connect your WhatsApp business number — it takes a few minutes with the in-app wizard.\n\nOpen TeamBee: ${url}\n\nAfter that, invite your team from the dashboard and send your first template. The setup checklist tracks all of it.`;
  return sendEmail({ to, subject, html: shellHtml('Welcome to TeamBee', body), text });
}

function stageFor(trialEndsAt, now) {
  const msLeft = trialEndsAt.getTime() - now.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (msLeft > 3 * day) return null;
  if (msLeft > 1 * day) return '3d';
  if (msLeft > 0) return '1d';
  if (msLeft > -1 * day) return 'expired';
  return null;
}

const STAGE_COPY = {
  '3d': {
    subject: (days) => `Your TeamBee trial ends in ${days} days`,
    title: 'Your trial is ending soon',
    body: (days, url) => `<p>Your free trial ends in <strong>${days} day${days === 1 ? '' : 's'}</strong>. Your workspace, templates and team stay exactly as they are when you continue on a plan — nothing is lost.</p><p><a href="${url}" style="display: inline-block; background: #25D366; color: #052e12; font-weight: 700; padding: 11px 18px; border-radius: 9px; text-decoration: none;">Review plans in TeamBee</a></p><p>If you do nothing, the workspace pauses when the trial ends; your data is kept and you can pick a plan later to resume.</p>`,
  },
  '1d': {
    subject: () => 'Your TeamBee trial ends tomorrow',
    title: 'Last day of your trial',
    body: (days, url) => `<p>Your free trial ends <strong>tomorrow</strong>. Continue on a plan to keep your team replying without a break.</p><p><a href="${url}" style="display: inline-block; background: #25D366; color: #052e12; font-weight: 700; padding: 11px 18px; border-radius: 9px; text-decoration: none;">Choose your plan</a></p><p>If you do nothing, the workspace pauses when the trial ends; your data is kept and you can resume anytime by picking a plan.</p>`,
  },
  expired: {
    subject: () => 'Your TeamBee trial has ended — your workspace is paused',
    title: 'Your trial has ended',
    body: (days, url) => `<p>Your free trial has ended, so your workspace is <strong>paused</strong> — your customers' messages, templates and team are all kept safe.</p><p>Pick a plan to resume exactly where you left off:</p><p><a href="${url}" style="display: inline-block; background: #25D366; color: #052e12; font-weight: 700; padding: 11px 18px; border-radius: 9px; text-decoration: none;">Reactivate my workspace</a></p>`,
  },
};

async function reminderAlreadySent(db, tenantId, stage) {
  const row = await db.auditLog.findFirst({
    where: { tenantId, event: 'TRIAL_REMINDER_SENT' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true, createdAt: true },
  });
  if (!row) return false;
  // Any prior reminder for this tenant covers earlier stages; only the
  // SAME stage needs its own check, parsed from the metadata JSON.
  try {
    const meta = JSON.parse(row.metadata || '{}');
    return meta.stage === stage;
  } catch {
    return false;
  }
}

let lastDrainAt = 0;
const DRAIN_EVERY_MS = 6 * 60 * 60 * 1000; // the 60s maintenance tick calls in; self-throttle to 6h

async function drainTrialReminders() {
  const now = Date.now();
  if (now - lastDrainAt < DRAIN_EVERY_MS) return { skipped: 'throttled' };
  lastDrainAt = now;
  if (!emailConfigured()) return { skipped: 'email-not-configured' };

  const nowDate = new Date(now);
  const horizon = new Date(now + 3 * 24 * 60 * 60 * 1000);
  const floor = new Date(now - 24 * 60 * 60 * 1000);
  const tenants = await systemDb((db) =>
    db.tenant.findMany({
      where: {
        subscriptionStatus: 'TRIAL',
        trialEndsAt: { gte: floor, lte: horizon },
      },
      select: { id: true, name: true, trialEndsAt: true },
    })
  );

  let sent = 0;
  for (const tenant of tenants) {
    const stage = stageFor(tenant.trialEndsAt, nowDate);
    if (!stage) continue;
    const already = await systemDb((db) => reminderAlreadySent(db, tenant.id, stage));
    if (already) continue;
    const admins = await systemDb((db) =>
      db.agent.findMany({
        where: { tenantId: tenant.id, role: 'ADMIN', isActive: true },
        select: { id: true, email: true },
        take: 5,
      })
    );
    if (!admins.length) continue;
    const daysLeft = Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)));
    const copy = STAGE_COPY[stage];
    const url = appBaseUrl();
    let anySent = false;
    for (const admin of admins) {
      const result = await sendEmail({
        to: admin.email,
        subject: copy.subject(daysLeft),
        html: shellHtml(copy.title, copy.body(daysLeft, url)),
        text: `${copy.title} — workspace "${tenant.name}". Open TeamBee: ${url}`,
      });
      if (result.success) anySent = true;
    }
    if (anySent) {
      sent += 1;
      await logAuditEvent({
        tenantId: tenant.id,
        event: 'TRIAL_REMINDER_SENT',
        metadata: { stage, daysLeft },
      });
    }
  }
  return { scanned: tenants.length, sent };
}

module.exports = { sendWelcomeEmail, drainTrialReminders };
