-- RLS Phase 2 (part D): a database-visible "system" context.
--
-- A small set of flows legitimately work BEFORE or ACROSS tenants:
-- login by email, workspace lookup, register-tenant, webhook tenant
-- resolution, and the maintenance scans. When the app sets
-- app.tenant_id = '__system__', these permissive policies (OR-ed with
-- tenant_isolation by Postgres) grant the app role access for those
-- flows only. Tenant-known traffic keeps using its own tenant id and
-- stays hard-bound by tenant_isolation. The privilege is explicit and
-- auditable in pg_policies instead of hiding in application code.
-- (Inert today: the app still connects as the BYPASSRLS owner; these
-- bind only the teambee_app role used from the Phase 3 cutover.)
CREATE POLICY system_context ON "tenants"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "agents"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "contacts"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "chats"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "messages"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "templates"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "broadcasts"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "quick_replies"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "broadcast_recipients"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "webhook_events"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
CREATE POLICY system_context ON "audit_logs"
  USING (current_setting('app.tenant_id', true) = '__system__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__system__');
