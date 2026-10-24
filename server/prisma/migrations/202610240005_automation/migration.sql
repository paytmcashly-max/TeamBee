-- Inbound automation: round-robin auto-assign + office-hours away replies.
ALTER TABLE "tenants" ADD COLUMN "auto_assign_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "assignment_counter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN "office_hours_start" TEXT;
ALTER TABLE "tenants" ADD COLUMN "office_hours_end" TEXT;
ALTER TABLE "tenants" ADD COLUMN "office_hours_days" TEXT;
ALTER TABLE "tenants" ADD COLUMN "office_hours_timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE "tenants" ADD COLUMN "away_template_name" TEXT;
ALTER TABLE "chats" ADD COLUMN "last_away_reply_at" TIMESTAMP(3);
