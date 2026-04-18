-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_domain TEXT NOT NULL,
  stripe_customer_id TEXT,
  api_key TEXT UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Monitored domains
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_free INTEGER NOT NULL DEFAULT 0,
  scan_frequency TEXT NOT NULL DEFAULT 'monthly',
  last_scanned_at INTEGER,
  last_grade TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, domain)
);

-- Scan history snapshots
CREATE TABLE IF NOT EXISTS scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  score_factors TEXT,
  protocol_results TEXT,
  scanned_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Alert log
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  notified_via TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Webhook configurations
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_domain_id ON scan_history(domain_id);
CREATE INDEX IF NOT EXISTS idx_alerts_domain_id ON alerts(domain_id);
CREATE INDEX IF NOT EXISTS idx_domains_last_scanned ON domains(last_scanned_at);
