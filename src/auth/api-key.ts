import type { Context } from "hono";
import { findActiveApiKeyByHash, touchApiKeyLastUsed } from "../db/api-keys.js";

// Bearer-token format: `dmk_` + 32 base64url chars = 36 chars total.
// 24 random bytes (~192 bits of entropy) encode to exactly 32 b64url chars.
const RAW_PREFIX = "dmk_";
const RAW_LENGTH = RAW_PREFIX.length + 32;
const PREFIX_LENGTH = RAW_PREFIX.length + 8;

// Touching `last_used_at` on every request would write-amplify a table that's
// only read during auth. Debounce per-key-per-Worker-instance; across Workers
// you'll occasionally get one extra write, which is fine.
const TOUCH_DEBOUNCE_MS = 60_000;
const lastTouchAt = new Map<string, number>();

// Exposed for tests — lets them reset between cases without leaking state.
export function __resetApiKeyTouchCache(): void {
  lastTouchAt.clear();
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

export async function hashApiKey(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return bytesToHex(new Uint8Array(digest));
}

export interface GeneratedApiKey {
  raw: string;
  prefix: string;
  hash: string;
}

export async function generateApiKey(): Promise<GeneratedApiKey> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const raw = `${RAW_PREFIX}${base64UrlEncode(bytes)}`;
  return {
    raw,
    prefix: raw.slice(0, PREFIX_LENGTH),
    hash: await hashApiKey(raw),
  };
}

export interface BearerIdentity {
  userId: string;
  keyId: string;
}

// Hashes the supplied token and looks it up. Returns null on any failure
// (wrong prefix, wrong length, unknown hash, revoked key). Shape-check first
// avoids a DB round-trip for obviously malformed headers.
export async function verifyApiKey(
  raw: string,
  db: D1Database,
): Promise<BearerIdentity | null> {
  if (!raw.startsWith(RAW_PREFIX) || raw.length !== RAW_LENGTH) return null;
  const hash = await hashApiKey(raw);
  const row = await findActiveApiKeyByHash(db, hash);
  if (!row) return null;
  return { userId: row.user_id, keyId: row.id };
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

// Pulls the bearer token out of the request, verifies it, and schedules a
// debounced `last_used_at` update. The touch is fire-and-forget via
// `waitUntil` so the hot path doesn't wait on the write.
export async function resolveBearer(
  c: Context,
): Promise<BearerIdentity | null> {
  const raw = extractBearerToken(c.req.header("authorization"));
  if (!raw) return null;

  const db = (c.env as { DB?: D1Database }).DB;
  if (!db) return null;

  const identity = await verifyApiKey(raw, db);
  if (!identity) return null;

  const now = Date.now();
  const last = lastTouchAt.get(identity.keyId) ?? 0;
  if (now - last > TOUCH_DEBOUNCE_MS) {
    lastTouchAt.set(identity.keyId, now);
    c.executionCtx.waitUntil(
      touchApiKeyLastUsed(db, identity.keyId).catch(() => {
        /* best-effort; a missed touch is harmless */
      }),
    );
  }

  return identity;
}
