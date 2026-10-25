// Display copy for the plan catalogue. Prices are launch placeholders —
// change them here and in the server PLANS map
// (server/src/controllers/billingController.js) together.
export const PLANS = [
  {
    key: 'STARTER',
    name: 'Starter',
    price: 999,
    tagline: 'For a small team starting on WhatsApp',
    features: ['3 agents', 'Shared team inbox', 'Template messages', 'Quick replies & tags', 'Email support'],
  },
  {
    key: 'GROWTH',
    name: 'Growth',
    price: 1999,
    tagline: 'For teams that live on WhatsApp all day',
    features: [
      '10 agents',
      'Everything in Starter',
      'Broadcast campaigns',
      'Chat automation & auto-assignment',
      'Snooze, mentions & supervisors',
    ],
    popular: true,
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: 3999,
    tagline: 'For high-volume businesses',
    features: ['25 agents', 'Everything in Growth', 'Owner analytics dashboard', 'Priority support', 'Multiple workspaces'],
  },
];

export const TRIAL_DAYS = 14;
