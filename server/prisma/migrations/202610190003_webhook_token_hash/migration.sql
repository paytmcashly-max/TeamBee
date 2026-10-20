ALTER TABLE tenants ADD COLUMN IF NOT EXISTS webhook_verify_token_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_tenants_webhook_verify_token_hash ON tenants(webhook_verify_token_hash);
