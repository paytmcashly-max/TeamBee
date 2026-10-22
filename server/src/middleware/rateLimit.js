const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const standardOptions = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
    });
  },
};

// These in-process limits protect a single instance from accidental abuse.
// Multi-instance deployments must use a shared express-rate-limit store.
const authLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => ipKeyGenerator(req.ip || 'unknown'),
});

const registrationLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  limit: 5,
});

const webhookLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 1200,
  skip: () => process.env.NODE_ENV === 'test',
  // Webhook authenticity is enforced by HMAC signature verification in the
  // controller; a proxy-header validation error must never drop a delivery.
  validate: { xForwardedForHeader: false },
});

module.exports = {
  authLimiter,
  registrationLimiter,
  webhookLimiter,
};
