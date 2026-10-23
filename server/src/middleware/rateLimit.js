const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { createRateLimitStores } = require('./redisRateLimitStore');

// Shared store across instances when Redis is configured; without REDIS_URL
// the limiters fall back to express-rate-limit's per-process MemoryStore
// (single-instance deployments only). Each limiter gets its own key prefix.
const sharedStores = process.env.REDIS_URL ? createRateLimitStores(process.env.REDIS_URL) : null;
const storeFor = (prefix) => (sharedStores ? { store: sharedStores.forLimiter(prefix) } : {});

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

const authLimiter = rateLimit({
  ...standardOptions,
  ...storeFor('rl:auth:'),
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => ipKeyGenerator(req.ip || 'unknown'),
});

const registrationLimiter = rateLimit({
  ...standardOptions,
  ...storeFor('rl:register:'),
  windowMs: 60 * 60 * 1000,
  limit: 5,
});

const webhookLimiter = rateLimit({
  ...standardOptions,
  ...storeFor('rl:webhook:'),
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
