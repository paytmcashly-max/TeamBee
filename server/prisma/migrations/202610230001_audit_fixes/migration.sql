-- Audit fixes (2026-10-23): data-integrity constraints + session revocation
-- + broadcast retry scheduling.

-- 1) Merge duplicate chats (same tenant+contact) before adding the unique
--    constraint: keep the earliest chat, move its messages, fold counters.
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (PARTITION BY tenant_id, contact_id ORDER BY created_at ASC) AS keeper_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id, contact_id ORDER BY created_at ASC) AS rn
  FROM chats
)
UPDATE messages m
SET chat_id = r.keeper_id
FROM ranked r
WHERE m.chat_id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (PARTITION BY tenant_id, contact_id ORDER BY created_at ASC) AS keeper_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id, contact_id ORDER BY created_at ASC) AS rn,
         unread_count, last_message_at
  FROM chats
)
UPDATE chats k
SET unread_count = k.unread_count + COALESCE((SELECT SUM(r.unread_count) FROM ranked r WHERE r.keeper_id = k.id AND r.rn > 1), 0),
    last_message_at = GREATEST(k.last_message_at, (SELECT MAX(r.last_message_at) FROM ranked r WHERE r.keeper_id = k.id AND r.rn > 1))
FROM ranked r0
WHERE k.id = r0.keeper_id AND r0.rn = 1;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id, contact_id ORDER BY created_at ASC) AS rn
  FROM chats
)
DELETE FROM chats WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) One chat per (tenant, contact); one tenant per WhatsApp routing ID.
CREATE UNIQUE INDEX "chats_tenant_id_contact_id_key" ON "chats"("tenant_id", "contact_id");
CREATE UNIQUE INDEX "tenants_phone_number_id_key" ON "tenants"("phone_number_id");
CREATE UNIQUE INDEX "tenants_waba_id_key" ON "tenants"("waba_id");

-- 3) Session revocation handle (bumped on password change / logout /
--    deactivation-driven invalidation).
ALTER TABLE "agents" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- 4) Broadcast retry scheduling (exponential backoff instead of a tight loop).
ALTER TABLE "broadcast_recipients" ADD COLUMN "next_attempt_at" TIMESTAMP(3);
CREATE INDEX "broadcast_recipients_status_next_attempt_at_idx" ON "broadcast_recipients"("status", "next_attempt_at");
