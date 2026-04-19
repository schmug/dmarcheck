import type { BillingEnv } from "./feature-flag.js";

// Minimal Stripe client built on the Workers Fetch API. We avoid the official
// `stripe` npm package to keep the Worker bundle small; we only need a tiny
// slice of the API surface (Checkout, Portal, webhook verification) and all
// of it is straightforward REST + HMAC.

export interface StripeSubscriptionEvent {
  id: string;
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted"
    | (string & {});
  data: {
    object: {
      id: string;
      customer: string;
      status: string;
      cancel_at_period_end?: boolean;
      current_period_end?: number;
      items?: {
        data: Array<{ price: { id: string } }>;
      };
    };
  };
}

// Stripe-Signature header format: `t=<ts>,v1=<sig>[,v1=<sig>...]`.
// Signed payload is `${ts}.${body}`, HMAC-SHA256 with the endpoint secret.
// We accept within a 5-minute skew window (Stripe's default) to protect
// against replay while tolerating clock drift.
const SIG_TOLERANCE_SECONDS = 5 * 60;

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

// Verifies the Stripe-Signature header and returns the parsed event. Throws
// StripeSignatureError on any validation failure — callers should map that to
// a 400 response without leaking which check failed.
export async function constructWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<StripeSubscriptionEvent> {
  if (!signatureHeader) {
    throw new StripeSignatureError("missing signature header");
  }

  const parts = parseSignatureHeader(signatureHeader);
  if (parts.timestamp === null || parts.signatures.length === 0) {
    throw new StripeSignatureError("malformed signature header");
  }

  if (Math.abs(now - parts.timestamp) > SIG_TOLERANCE_SECONDS) {
    throw new StripeSignatureError("timestamp outside tolerance");
  }

  const expected = await hmacSha256Hex(secret, `${parts.timestamp}.${rawBody}`);
  const matched = parts.signatures.some((sig) =>
    constantTimeEqualHex(sig, expected),
  );
  if (!matched) {
    throw new StripeSignatureError("signature mismatch");
  }

  try {
    return JSON.parse(rawBody) as StripeSubscriptionEvent;
  } catch {
    throw new StripeSignatureError("body is not valid JSON");
  }
}

interface ParsedSignature {
  timestamp: number | null;
  signatures: string[];
}

function parseSignatureHeader(header: string): ParsedSignature {
  const out: ParsedSignature = { timestamp: null, signatures: [] };
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (!key || value === undefined) continue;
    if (key === "t") {
      const ts = Number.parseInt(value, 10);
      if (Number.isFinite(ts)) out.timestamp = ts;
    } else if (key === "v1") {
      out.signatures.push(value);
    }
  }
  return out;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToHex(new Uint8Array(sig));
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Thin POST helper for future Checkout / Portal calls (PR 2 wires these up).
// Exported now so PR 2 is additive, not a rewrite.
export async function stripeRequest<T>(
  env: BillingEnv,
  path: string,
  form: Record<string, string>,
): Promise<T> {
  const body = new URLSearchParams(form).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as T | { error: { message: string } };
  if (!res.ok) {
    const err = (json as { error?: { message?: string } }).error;
    throw new Error(`Stripe API ${res.status}: ${err?.message ?? "unknown"}`);
  }
  return json as T;
}
