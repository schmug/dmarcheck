-- Outbound webhook delivery audit log. Records every attempt the dispatcher
-- makes to POST to a user-configured webhook URL, so the dashboard can show
-- recent delivery results and operators can debug failures without storing
-- the request body itself (only its SHA-256 fingerprint).
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  ok INTEGER NOT NULL,
  error TEXT,
  request_body_sha256 TEXT NOT NULL,
  attempted_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_user_time
  ON webhook_deliveries (user_id, attempted_at DESC);
