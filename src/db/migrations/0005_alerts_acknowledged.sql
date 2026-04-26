-- Phase 4b — track in-product dismissal of grade-drop / protocol-regression
-- alerts. Independent of `notified_via` (email delivery state). NULL on
-- existing rows so they appear in the dashboard's "Needs attention" list
-- until the user dismisses them.
ALTER TABLE alerts ADD COLUMN acknowledged_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_alerts_unacked
  ON alerts(domain_id, created_at)
  WHERE acknowledged_at IS NULL;
