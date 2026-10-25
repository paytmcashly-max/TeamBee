-- Self-serve password reset: single-use, expiring token (hash only at
-- rest, same discipline as the webhook verify token).
ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "password_reset_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "password_reset_expires_at" TIMESTAMP(3);
