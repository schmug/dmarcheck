-- Phase 3 M3 — replace cleartext users.api_key with hashed api_keys table.
-- Existing cleartext keys are invalidated on purpose (tiny pre-launch audience,
-- acceptable breaking change per the Phase 3 plan). Users who had a legacy key
-- will see a one-time "your API key was retired" banner and must generate a
-- new one; users who never had one are pre-acknowledged so the banner does
-- not show up spuriously for them.
--
-- 2026-04-20: rewritten in place. The original
-- `ALTER TABLE users DROP COLUMN api_key` is rejected by SQLite ("cannot
-- drop UNIQUE column") because the inline `api_key TEXT UNIQUE` declaration
-- creates an auto-index that DROP INDEX cannot remove. The standard table-
-- rebuild fix has its own snag in D1: dropping `users` triggers
-- `ON DELETE CASCADE` on every dependent table (domains → scan_history /
-- alerts, plus webhooks and subscriptions), and per Cloudflare's D1 docs
-- `PRAGMA defer_foreign_keys = ON` defers constraint *checks* but does not
-- suppress cascade *actions*. `PRAGMA foreign_keys = OFF` is a no-op inside
-- a transaction (and `wrangler d1 migrations apply` runs each file as one
-- transaction). So we back up every dependent table to a temp `_bk_*` table
-- before dropping `users`, then restore after. `CREATE TABLE _bk_X AS
-- SELECT *` copies data without constraints; the post-restore FK check
-- (deferred to commit) verifies row-level integrity. Safe to edit in place
-- because the original migration never successfully applied anywhere.

PRAGMA defer_foreign_keys = ON;

ALTER TABLE users ADD COLUMN api_key_retirement_acknowledged_at INTEGER;

UPDATE users
  SET api_key_retirement_acknowledged_at = unixepoch()
  WHERE api_key IS NULL;

-- Snapshot every table that would be wiped by CASCADE when `users` is dropped.
-- Direct refs: domains, webhooks, subscriptions. Transitive via domains:
-- scan_history, alerts. (api_keys does not exist yet — created below.)
CREATE TABLE _bk_users AS
  SELECT id, email, email_domain, stripe_customer_id, email_alerts_enabled,
         api_key_retirement_acknowledged_at, created_at
    FROM users;
CREATE TABLE _bk_domains AS SELECT * FROM domains;
CREATE TABLE _bk_scan_history AS SELECT * FROM scan_history;
CREATE TABLE _bk_alerts AS SELECT * FROM alerts;
CREATE TABLE _bk_webhooks AS SELECT * FROM webhooks;
CREATE TABLE _bk_subscriptions AS SELECT * FROM subscriptions;

-- DROP fires the implicit DELETE FROM users → CASCADE empties the dependents.
-- Backups above retain the data.
DROP TABLE users;

-- Recreate users with the new shape. Column order matches src/db/schema.sql
-- so a fresh install (schema.sql) and a migrated install produce byte-
-- identical user table schemas.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_domain TEXT NOT NULL,
  stripe_customer_id TEXT,
  email_alerts_enabled INTEGER NOT NULL DEFAULT 1,
  api_key_retirement_acknowledged_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO users (
  id, email, email_domain, stripe_customer_id, email_alerts_enabled,
  api_key_retirement_acknowledged_at, created_at
)
SELECT id, email, email_domain, stripe_customer_id, email_alerts_enabled,
       api_key_retirement_acknowledged_at, created_at
  FROM _bk_users;

INSERT INTO domains       SELECT * FROM _bk_domains;
INSERT INTO scan_history  SELECT * FROM _bk_scan_history;
INSERT INTO alerts        SELECT * FROM _bk_alerts;
INSERT INTO webhooks      SELECT * FROM _bk_webhooks;
INSERT INTO subscriptions SELECT * FROM _bk_subscriptions;

DROP TABLE _bk_users;
DROP TABLE _bk_domains;
DROP TABLE _bk_scan_history;
DROP TABLE _bk_alerts;
DROP TABLE _bk_webhooks;
DROP TABLE _bk_subscriptions;

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
