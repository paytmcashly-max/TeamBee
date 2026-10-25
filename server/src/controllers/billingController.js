const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../db/prisma');

// Plan catalogue (paise, per month). Single source of truth server-side;
// the client keeps a display copy in src/data/plans.js.
const PLANS = {
  STARTER: { name: 'Starter', amountPaise: 99900, agents: 3 },
  GROWTH: { name: 'Growth', amountPaise: 199900, agents: 10 },
  PRO: { name: 'Pro', amountPaise: 399900, agents: 25 },
};

function billingConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

class BillingController {
  /** GET /api/billing/status — plan state + whether payments are live. */
  static async status(req, res) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
      return res.json({
        success: true,
        configured: billingConfigured(),
        plan: tenant.plan || 'PRO',
        subscriptionStatus: tenant.subscriptionStatus || 'ACTIVE',
        trialEndsAt: tenant.trialEndsAt || null,
        plans: PLANS,
      });
    } catch (error) {
      console.error('[Billing Status Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to load billing status' });
    }
  }

  /**
   * POST /api/billing/create-order — Razorpay order for a plan.
   * Dormant until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are configured:
   * without keys it answers 501 so the UI can say "payments opening
   * soon" instead of pretending a checkout exists.
   */
  static async createOrder(req, res) {
    try {
      if (!billingConfigured()) {
        return res.status(501).json({
          success: false,
          error: 'Payments are not configured yet. Please contact us to upgrade.',
          code: 'BILLING_NOT_CONFIGURED',
        });
      }
      const planKey = String(req.body?.plan || '').toUpperCase();
      const plan = PLANS[planKey];
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Unknown plan' });
      }
      const response = await axios.post(
        'https://api.razorpay.com/v1/orders',
        {
          amount: plan.amountPaise,
          currency: 'INR',
          receipt: `tb_${req.tenantId.slice(0, 8)}_${Date.now()}`,
          notes: { tenantId: req.tenantId, plan: planKey },
        },
        {
          auth: { username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET },
          timeout: 15000,
        }
      );
      return res.json({
        success: true,
        order: response.data,
        keyId: process.env.RAZORPAY_KEY_ID,
        plan: planKey,
      });
    } catch (error) {
      console.error('[Billing Create Order Error]:', error.response?.data || error.message);
      return res.status(502).json({ success: false, error: 'Payment gateway error — please try again.' });
    }
  }

  /**
   * POST /api/billing/webhook — Razorpay events. Signature-verified when
   * RAZORPAY_WEBHOOK_SECRET is set. On a captured payment for a known
   * tenant+plan (carried in the order notes), the subscription is marked
   * ACTIVE and the purchased plan applied.
   */
  static async webhook(req, res) {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (secret) {
        const signature = req.headers['x-razorpay-signature'];
        const raw = req.rawBody || JSON.stringify(req.body || {});
        const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
        const valid =
          signature &&
          signature.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        if (!valid) {
          return res.status(400).json({ success: false, error: 'Invalid signature' });
        }
      }

      const event = req.body?.event;
      const entity = req.body?.payload?.payment?.entity || req.body?.payload?.order?.entity;
      const notes = entity?.notes || req.body?.payload?.order?.entity?.notes || {};
      if (event === 'payment.captured' && notes.tenantId && PLANS[String(notes.plan || '').toUpperCase()]) {
        await prisma.tenant.update({
          where: { id: notes.tenantId },
          data: {
            plan: String(notes.plan).toUpperCase(),
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
        });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('[Billing Webhook Error]:', error);
      return res.status(500).json({ success: false });
    }
  }
}

module.exports = BillingController;
module.exports.PLANS = PLANS;
