'use strict';

const { createClient } = require('redis');

/**
 * Shared rate-limit store for express-rate-limit, backed by Redis so limits
 * hold across every app instance (the default MemoryStore silently becomes
 * per-instance the moment a second instance runs).
 *
 * Failure policy: a Redis outage must never take the API down or disable
 * limiting, so every operation falls back to an in-process map on error,
 * with a cooldown so a dead Redis is not hammered on every request.
 *
 * One Redis client is shared by all limiter stores; each limiter gets its
 * own key prefix.
 */
const REDIS_DOWN_COOLDOWN_MS = 30_000;

let sharedClient = null;
let clientConnectPromise = null;
let redisDownUntil = 0;
let lastErrorLogAt = 0;

function noteRedisError(error) {
  redisDownUntil = Date.now() + REDIS_DOWN_COOLDOWN_MS;
  if (Date.now() - lastErrorLogAt > REDIS_DOWN_COOLDOWN_MS) {
    lastErrorLogAt = Date.now();
    console.error('[RateLimit Store]: Redis unavailable, using in-memory fallback:', error.message);
  }
}

function getClient(url) {
  if (!sharedClient) {
    sharedClient = createClient({ url });
    sharedClient.on('error', noteRedisError);
  }
  return sharedClient;
}

async function ensureConnected(url) {
  const client = getClient(url);
  if (client.isReady) return client;
  if (!clientConnectPromise) {
    clientConnectPromise = client
      .connect()
      .catch((error) => {
        noteRedisError(error);
        throw error;
      })
      .finally(() => {
        clientConnectPromise = null;
      });
  }
  await clientConnectPromise;
  return client;
}

class RedisRateLimitStore {
  constructor(url, prefix) {
    this.url = url;
    this.prefix = prefix || 'rl:';
    this.windowMs = 60_000;
    // In-memory fallback buckets: key -> { hits, resetAt }
    this.local = new Map();
  }

  // Called by express-rate-limit once per limiter with its options.
  init(options) {
    if (options && options.windowMs) this.windowMs = options.windowMs;
  }

  localIncrement(key) {
    const now = Date.now();
    let bucket = this.local.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { hits: 0, resetAt: now + this.windowMs };
      this.local.set(key, bucket);
    }
    bucket.hits += 1;
    // Opportunistic cleanup so a long-lived fallback cannot grow unbounded.
    if (this.local.size > 10_000) {
      for (const [k, v] of this.local) {
        if (v.resetAt <= now) this.local.delete(k);
      }
    }
    return { totalHits: bucket.hits, resetTime: new Date(bucket.resetAt) };
  }

  localDecrement(key) {
    const bucket = this.local.get(key);
    if (bucket) bucket.hits = Math.max(0, bucket.hits - 1);
  }

  async increment(key) {
    const redisKey = this.prefix + key;
    if (Date.now() >= redisDownUntil) {
      try {
        const client = await ensureConnected(this.url);
        const totalHits = await client.incr(redisKey);
        let ttl = await client.pTTL(redisKey);
        if (ttl < 0) {
          await client.pExpire(redisKey, this.windowMs);
          ttl = this.windowMs;
        }
        return { totalHits, resetTime: new Date(Date.now() + ttl) };
      } catch (error) {
        noteRedisError(error);
      }
    }
    return this.localIncrement(key);
  }

  async decrement(key) {
    if (Date.now() >= redisDownUntil) {
      try {
        const client = await ensureConnected(this.url);
        const value = await client.decr(this.prefix + key);
        if (value < 0) await client.set(this.prefix + key, '0', { PX: this.windowMs });
        return;
      } catch (error) {
        noteRedisError(error);
      }
    }
    this.localDecrement(key);
  }

  async resetKey(key) {
    this.local.delete(key);
    if (Date.now() >= redisDownUntil) {
      try {
        const client = await ensureConnected(this.url);
        await client.del(this.prefix + key);
      } catch (error) {
        noteRedisError(error);
      }
    }
  }

  async get(key) {
    const bucket = this.local.get(key);
    if (bucket && bucket.resetAt > Date.now()) {
      return { totalHits: bucket.hits, resetTime: new Date(bucket.resetAt) };
    }
    if (Date.now() >= redisDownUntil) {
      try {
        const client = await ensureConnected(this.url);
        const [value, ttl] = await Promise.all([client.get(this.prefix + key), client.pTTL(this.prefix + key)]);
        if (value != null && ttl > 0) {
          return { totalHits: parseInt(value, 10) || 0, resetTime: new Date(Date.now() + ttl) };
        }
      } catch (error) {
        noteRedisError(error);
      }
    }
    return undefined;
  }

  async resetAll() {
    this.local.clear();
  }
}

function createRateLimitStores(url) {
  return {
    forLimiter: (prefix) => new RedisRateLimitStore(url, prefix),
  };
}

module.exports = { RedisRateLimitStore, createRateLimitStores };
