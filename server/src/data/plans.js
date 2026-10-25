// Plan catalogue (amounts in paise, per month). Single source of truth
// server-side — billing charges from it and entitlement checks read
// seat limits from it. The client keeps display copy in
// client/src/data/plans.js; change prices in both places together.
const PLANS = {
  STARTER: { name: 'Starter', amountPaise: 99900, agents: 3 },
  GROWTH: { name: 'Growth', amountPaise: 199900, agents: 10 },
  PRO: { name: 'Pro', amountPaise: 399900, agents: 25 },
};

module.exports = { PLANS };
