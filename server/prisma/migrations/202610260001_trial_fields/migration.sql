-- Self-serve SaaS: subscription lifecycle on Tenant.
-- Existing tenants default to ACTIVE (no trial limit); new public
-- signups are created as TRIAL with trial_ends_at = signup + 14 days.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "subscription_status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3);
