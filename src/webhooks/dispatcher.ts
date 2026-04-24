import { insertWebhookDelivery } from "../db/webhook-deliveries.js";
import { getWebhookForUser } from "../db/webhooks.js";
import { hmacSha256Hex } from "../shared/hmac.js";

// Outbound webhook dispatcher. Single-attempt POST with a 5s timeout, signed
// like Stripe (Dmarcheck-Signature: t=<unix>,v1=<hex of HMAC-SHA256 over
// "<unix>.<body>" with the user's per-webhook secret). Every attempt — success
// or failure — is recorded to webhook_deliveries so the dashboard can show
// recent results without us having to keep request bodies around.

const FETCH_TIMEOUT_MS = 5_000;

// Payload shapes per event type. `data` is whatever the trigger site has on
// hand at completion; receivers can call back into the API for more detail.
export interface ScanCompletedData {
  domain: string;
  grade: string;
  scan_id: string | number;
  trigger: "dashboard" | "cron" | "bulk_api";
  report_url: string;
}

export interface WebhookTestData {
  message: string;
}

export type WebhookEvent =
  | { type: "scan.completed"; data: ScanCompletedData }
  | { type: "webhook.test"; data: WebhookTestData };

export interface DispatchResult {
  ok: boolean;
  status: number | null;
  error: string | null;
  attempted_at: number;
  event_id: string;
}

export interface DispatchOptions {
  // Override for tests so signatures and event timestamps are deterministic.
  now?: number;
  // Override for tests so generated event ids are deterministic.
  eventId?: string;
}

export async function dispatchWebhook(
  db: D1Database,
  userId: string,
  event: WebhookEvent,
  options: DispatchOptions = {},
): Promise<DispatchResult | null> {
  const webhook = await getWebhookForUser(db, userId);
  if (!webhook) return null;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const eventId = options.eventId ?? `evt_${crypto.randomUUID()}`;
  const envelope = {
    id: eventId,
    type: event.type,
    created: now,
    data: event.data,
  };
  const body = JSON.stringify(envelope);
  const bodySha = await sha256Hex(body);

  // No secret = nothing to sign with. Surface as a recorded failure so the
  // user sees it in their delivery log instead of silently dropping events.
  if (!webhook.secret) {
    const result: DispatchResult = {
      ok: false,
      status: null,
      error: "webhook secret missing — re-save the webhook to rotate",
      attempted_at: now,
      event_id: eventId,
    };
    await recordDelivery(
      db,
      userId,
      webhook.id,
      webhook.url,
      event.type,
      body,
      bodySha,
      result,
    );
    return result;
  }

  const signature = await hmacSha256Hex(webhook.secret, `${now}.${body}`);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Dmarcheck-Signature": `t=${now},v1=${signature}`,
    "User-Agent": "dmarcheck-webhook/1",
  };

  let result: DispatchResult;
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    result = {
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
      attempted_at: now,
      event_id: eventId,
    };
  } catch (err) {
    result = {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : String(err),
      attempted_at: now,
      event_id: eventId,
    };
  }

  await recordDelivery(
    db,
    userId,
    webhook.id,
    webhook.url,
    event.type,
    body,
    bodySha,
    result,
  );
  return result;
}

async function recordDelivery(
  db: D1Database,
  userId: string,
  webhookId: number,
  url: string,
  eventType: string,
  _body: string,
  bodySha: string,
  result: DispatchResult,
): Promise<void> {
  await insertWebhookDelivery(db, {
    userId,
    webhookId,
    eventId: result.event_id,
    eventType,
    url,
    statusCode: result.status,
    ok: result.ok,
    error: result.error,
    requestBodySha256: bodySha,
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  let out = "";
  for (const b of new Uint8Array(digest)) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}
