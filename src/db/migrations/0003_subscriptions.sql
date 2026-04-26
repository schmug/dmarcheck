-- Phase 3 M2 — Stripe subscription state for paid-tier gating. The table is
-- always present so migrations stay linear across free-only self-host deploys
-- and the hosted tier; rows are only written when Stripe is configured.

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Idempotency ledger for Stripe webhook events. Storing the event id lets the
-- PR 2 webhook handler reject replays cheaply before doing any work. The
-- shared donthype-me Stripe account means a misrouted event could reach the
-- dmarcheck endpoint — without this ledger, a double-delivered event could
-- flip plan state twice.
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL DEFAULT (unixepoch())
);
