-- Per-tenant Postgres persistence for automation bot rules and commerce catalog/settings.
CREATE TABLE IF NOT EXISTS "automation_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bot_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_assign_enabled" BOOLEAN NOT NULL DEFAULT true,
    "welcome_message" TEXT NOT NULL,
    "agent_handoff_keywords" TEXT NOT NULL DEFAULT '[]',
    "catalog_keywords" TEXT NOT NULL DEFAULT '[]',
    "payment_keywords" TEXT NOT NULL DEFAULT '[]',
    "custom_rules" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "automation_configs_tenant_id_key" ON "automation_configs"("tenant_id");
ALTER TABLE "automation_configs" ADD CONSTRAINT "automation_configs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "commerce_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "upi_id" TEXT NOT NULL DEFAULT 'teambee@upi',
    "merchant_name" TEXT NOT NULL DEFAULT 'TeamBee WhatsApp Store',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commerce_settings_tenant_id_key" ON "commerce_settings"("tenant_id");
ALTER TABLE "commerce_settings" ADD CONSTRAINT "commerce_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "commerce_products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "category" TEXT NOT NULL DEFAULT 'General',
    "sku" TEXT,
    "image_url" TEXT,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "commerce_products_tenant_id_idx" ON "commerce_products"("tenant_id");
ALTER TABLE "commerce_products" ADD CONSTRAINT "commerce_products_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
