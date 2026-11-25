-- RLS policies for automation_configs, commerce_settings, and commerce_products.
ALTER TABLE "automation_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "automation_configs";
CREATE POLICY tenant_isolation ON "automation_configs"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "commerce_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_settings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "commerce_settings";
CREATE POLICY tenant_isolation ON "commerce_settings"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "commerce_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_products" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "commerce_products";
CREATE POLICY tenant_isolation ON "commerce_products"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
