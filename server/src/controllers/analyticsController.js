const prisma = require('../db/prisma');

// Start of "today" in the business's timezone (Asia/Kolkata by default):
// owners think in local days, the DB stores UTC instants. Method: take
// today's date in the zone, guess UTC midnight of that date, then shift
// back by however far into the day that guess lands in the zone (one
// correction step converges for any fixed offset).
function startOfToday(timezone = 'Asia/Kolkata') {
  const now = new Date();
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const guess = new Date(
    Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day))
  );
  const timeParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(guess)
      .map((p) => [p.type, p.value])
  );
  const secondsIntoDay =
    (Number(timeParts.hour) % 24) * 3600 + Number(timeParts.minute) * 60 + Number(timeParts.second);
  return new Date(guess.getTime() - secondsIntoDay * 1000);
}

class AnalyticsController {
  /**
   * GET /api/analytics/overview — the owner's home screen: today's pulse
   * plus the setup checklist state, in one round-trip.
   */
  static async overview(req, res) {
    try {
      const tenantId = req.tenantId;
      const tenant = await req.db((db) => db.tenant.findUnique({ where: { id: tenantId } }));
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }
      const todayStart = startOfToday(tenant.officeHoursTimezone || 'Asia/Kolkata');

      const [
        chatsToday,
        openChats,
        unassignedChats,
        resolvedToday,
        messagesInToday,
        messagesOutToday,
        agentsTotal,
        agentsOnline,
        templatesApproved,
        templatesCustom,
        broadcastsTotal,
        outboundTotal,
      ] = await req.db((db) =>
        Promise.all([
        db.chat.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
        db.chat.count({ where: { tenantId, status: 'OPEN' } }),
        db.chat.count({ where: { tenantId, status: 'UNASSIGNED' } }),
        db.chat.count({ where: { tenantId, status: 'RESOLVED', updatedAt: { gte: todayStart } } }),
        db.message.count({ where: { tenantId, direction: 'INBOUND', createdAt: { gte: todayStart } } }),
        db.message.count({ where: { tenantId, direction: 'OUTBOUND', createdAt: { gte: todayStart } } }),
        db.agent.count({ where: { tenantId } }),
        db.agent.count({ where: { tenantId, status: 'ONLINE' } }),
        db.template.count({ where: { tenantId, status: 'APPROVED' } }),
        db.template.count({
          where: { tenantId, status: 'APPROVED', name: { notIn: ['hello_world', '3p_direct_integration_test_template'] } },
        }),
        db.broadcast.count({ where: { tenantId } }),
        db.message.count({ where: { tenantId, direction: 'OUTBOUND' } }),
        ])
      );

      return res.json({
        success: true,
        stats: {
          chatsToday,
          openChats,
          unassignedChats,
          resolvedToday,
          messagesInToday,
          messagesOutToday,
          agentsTotal,
          agentsOnline,
          broadcastsTotal,
        },
        checklist: {
          hasWhatsApp: Boolean(tenant.phoneNumberId),
          hasCustomTemplate: templatesCustom > 0,
          templatesApproved,
          teamInvited: agentsTotal > 1,
          hasBroadcast: broadcastsTotal > 0,
          hasOutbound: outboundTotal > 0,
        },
        subscription: {
          plan: tenant.plan || 'PRO',
          status: tenant.subscriptionStatus || 'ACTIVE',
          trialEndsAt: tenant.trialEndsAt || null,
        },
      });
    } catch (error) {
      console.error('[Analytics Overview Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to load overview' });
    }
  }
}

module.exports = AnalyticsController;
