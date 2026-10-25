-- Append-only security/audit log: who did what, when (logins, password
-- changes, agent management). Written fire-and-forget by the app; never
-- updated or deleted by application code.
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT,
  "agent_id" TEXT,
  "event" TEXT NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "metadata" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_created_at_idx" ON "audit_logs" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_event_idx" ON "audit_logs" ("event");
