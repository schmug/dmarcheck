import { renderMessage, type WebhookEnvelope } from "./index.js";

// Slack incoming webhook: `{text: "..."}` renders as a plain chat message
// with URLs auto-linked. No signature header — Slack doesn't verify one.
export function formatSlack(envelope: WebhookEnvelope): { body: string } {
  return { body: JSON.stringify({ text: renderMessage(envelope) }) };
}
