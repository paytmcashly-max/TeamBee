// Plan entitlements, enforced server-side. Until this existed, the
// pricing page promised per-plan agent caps (3 / 10 / 25) but nothing
// in the API ever counted — a Starter workspace could add unlimited
// agents. Trials run on PRO limits (the trial is a Pro trial).
const { PLANS } = require('../data/plans');

function effectivePlanKey(tenant) {
  if (!tenant) return 'PRO';
  if (tenant.subscriptionStatus === 'TRIAL') return 'PRO';
  const key = String(tenant.plan || 'PRO').toUpperCase();
  return PLANS[key] ? key : 'PRO';
}

function agentLimitForTenant(tenant) {
  return PLANS[effectivePlanKey(tenant)].agents;
}

module.exports = { effectivePlanKey, agentLimitForTenant };
