-- Phase 3 M3 — replace cleartext users.api_key with hashed api_keys table.
-- Existing cleartext keys are invalidated on purpose (tiny pre-launch audience,
-- acceptable breaking change per the Phase 3 plan). Users who had a legacy key
-- will see a one-time "your API key was retired" banner and must generate a
-- new one; users who never had one are pre-acknowledged so the banner does
-- not show up spuriously for them.

ALTER TABLE users ADD COLUMN api_key_retirement_acknowledged_at INTEGER;

-- Pre-ack users who never had a legacy key — no banner needed for them.
UPDATE users
  SET api_key_retirement_acknowledged_at = unixepoch()
  WHERE api_key IS NULL;

-- D1 ships SQLite 3.45+, which supports ALTER TABLE DROP COLUMN.
ALTER TABLE users DROP COLUMN api_key;

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  prefix TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
