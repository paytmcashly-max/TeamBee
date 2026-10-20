-- Safe forward migration for databases that were created from the original
-- ChatFlow schema before durable webhook events and outbound idempotency were
-- introduced. Every statement is safe to run after the initial migration.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(128);
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_tenant_client_id
  ON messages(tenant_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'messages'::regclass AND conname = 'messages_sender_type_check'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_sender_type_check;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check
    CHECK (sender_type IN ('CUSTOMER', 'AGENT', 'SYSTEM', 'BOT', 'NOTE'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'messages'::regclass AND conname = 'messages_message_type_check'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_message_type_check;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACTS', 'INTERACTIVE', 'TEMPLATE', 'NOTE'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS variables TEXT DEFAULT '{}';

ALTER TABLE broadcast_recipients ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE broadcast_recipients ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE broadcast_recipients ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE broadcast_recipients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'broadcast_recipients'::regclass
      AND conname = 'broadcast_recipients_status_check'
  ) THEN
    ALTER TABLE broadcast_recipients DROP CONSTRAINT broadcast_recipients_status_check;
  END IF;
  ALTER TABLE broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_status_check
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT,
    payload_hash VARCHAR(64) UNIQUE NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED')),
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_webhook_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_received ON webhook_events(status, received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_received ON webhook_events(tenant_id, received_at);
