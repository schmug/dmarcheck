import type { WebhookEnvelope } from "./index.js";

// Canonical dmarcheck envelope: serialize as-is. The dispatcher signs this
// body with HMAC-SHA256 and attaches the Dmarcheck-Signature header.
export function formatRaw(envelope: WebhookEnvelope): { body: string } {
  return { body: JSON.stringify(envelope) };
}
