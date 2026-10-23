-- Serve the broadcast recovery drain's global scans
-- (status + next_attempt_at) instead of scanning per broadcast.
CREATE INDEX IF NOT EXISTS "broadcast_recipients_status_next_attempt_at_idx"
  ON "broadcast_recipients"("status", "next_attempt_at");
