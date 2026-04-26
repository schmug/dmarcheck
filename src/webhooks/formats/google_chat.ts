import { renderMessage, type WebhookEnvelope } from "./index.js";

// Google Chat incoming webhook: `{text: "..."}` renders as a plain chat
// message with URLs auto-linked. Kept as its own module so moving to a
// cardsV2 payload later doesn't touch the slack adapter.
export function formatGoogleChat(envelope: WebhookEnvelope): { body: string } {
  return { body: JSON.stringify({ text: renderMessage(envelope) }) };
}
