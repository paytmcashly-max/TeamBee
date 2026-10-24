-- Chat snooze / follow-up reminders.
ALTER TABLE "chats" ADD COLUMN "snoozed_until" TIMESTAMP(3);
ALTER TABLE "chats" ADD COLUMN "snoozed_by_id" TEXT;
CREATE INDEX "chats_snoozed_until_idx" ON "chats"("snoozed_until");
