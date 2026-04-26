-- Add a `format` column to outbound webhooks so users can target chat
-- platforms (Slack, Google Chat) whose incoming-webhook receivers reject our
-- signed-envelope shape. Existing rows default to 'raw', preserving the
-- current signed-JSON behavior byte-for-byte.
ALTER TABLE webhooks ADD COLUMN format TEXT NOT NULL DEFAULT 'raw';
