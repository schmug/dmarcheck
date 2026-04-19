-- Phase 2c — per-user toggle for grade-drop email alerts. Default 1 (opt-out
-- rather than opt-in) so the feature is useful for users who signed up during
-- Phase 1 before the setting existed. Users can flip it off via the settings
-- page or any /alerts/unsubscribe link in a prior email.

ALTER TABLE users ADD COLUMN email_alerts_enabled INTEGER NOT NULL DEFAULT 1;
