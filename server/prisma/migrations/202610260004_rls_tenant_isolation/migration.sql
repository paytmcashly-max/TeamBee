-- Row-Level Security: database-enforced tenant isolation (Phase 1).
--
-- Until now, tenant isolation lived only in application WHERE clauses —
-- one missed filter away from a cross-tenant leak. These policies make
-- the DATABASE refuse cross-tenant reads/writes for any role bound by
-- them. The tenant context is the transaction/session setting
-- `app.tenant_id`, which the app will set per request in Phase 2.
--
-- Phase 1 safety: the app still connects as the DB owner role, which
-- has BYPASSRLS, so these policies change nothing for the running app.
-- They bind the dedicated `teambee_app` role (NOBYPASSRLS), verified by
-- role-switched probes. Cutover (Phase 3) = point DATABASE_URL at
-- teambee_app after Phase 2 code sets the tenant context, including
-- pre-auth flows (login lookup, webhook tenant resolution).

-- Tenants: the row IS the tenant.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenants";
CREATE POLICY tenant_isolation ON "tenants"
  USING ("id" = current_setting('app.tenant_id', true))
  WITH CHECK ("id" = current_setting('app.tenant_id', true));

-- Direct tenant_id tables.
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agents" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "agents";
CREATE POLICY tenant_isolation ON "agents"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "contacts";
CREATE POLICY tenant_isolation ON "contacts"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "chats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chats" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "chats";
CREATE POLICY tenant_isolation ON "chats"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "messages";
CREATE POLICY tenant_isolation ON "messages"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "templates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "templates";
CREATE POLICY tenant_isolation ON "templates"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "broadcasts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "broadcasts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "broadcasts";
CREATE POLICY tenant_isolation ON "broadcasts"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "quick_replies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quick_replies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "quick_replies";
CREATE POLICY tenant_isolation ON "quick_replies"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

-- Recipients carry no tenant_id: scope through the parent broadcast.
ALTER TABLE "broadcast_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "broadcast_recipients" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "broadcast_recipients";
CREATE POLICY tenant_isolation ON "broadcast_recipients"
  USING (EXISTS (
    SELECT 1 FROM "broadcasts" b
    WHERE b."id" = "broadcast_id"
      AND b."tenant_id" = current_setting('app.tenant_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "broadcasts" b
    WHERE b."id" = "broadcast_id"
      AND b."tenant_id" = current_setting('app.tenant_id', true)
  ));

-- Nullable tenant_id: platform-level rows (tenant_id NULL) stay visible
-- to every workspace context; tenant rows stay scoped.
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "webhook_events";
CREATE POLICY tenant_isolation ON "webhook_events"
  USING ("tenant_id" IS NULL OR "tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" IS NULL OR "tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "audit_logs";
CREATE POLICY tenant_isolation ON "audit_logs"
  USING ("tenant_id" IS NULL OR "tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" IS NULL OR "tenant_id" = current_setting('app.tenant_id', true));

-- The application role for Phase 3: no login yet (a password is set at
-- cutover), never a superuser, and crucially NOBYPASSRLS.
CREATE ROLE teambee_app NOLOGIN NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO teambee_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO teambee_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO teambee_app;
REVOKE ALL ON "_prisma_migrations" FROM teambee_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO teambee_app;
-- Lets the owner run role-switched verification probes (SET ROLE).
GRANT teambee_app TO neondb_owner;
