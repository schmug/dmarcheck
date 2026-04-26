export interface SessionPayload {
  sub: string;
  email: string;
  exp: number;
}

const ENCODER = new TextEncoder();
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(
  claims: { sub: string; email: string },
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const header = base64UrlEncode(
    ENCODER.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const payload: SessionPayload = {
    sub: claims.sub,
    email: claims.email,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadEncoded = base64UrlEncode(
    ENCODER.encode(JSON.stringify(payload)),
  );
  const signingInput = `${header}.${payloadEncoded}`;
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    ENCODER.encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function validateSessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payloadStr, signatureStr] = parts;
  const signingInput = `${header}.${payloadStr}`;

  try {
    const key = await getKey(secret);
    const signature = base64UrlDecode(signatureStr);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      ENCODER.encode(signingInput),
    );
    if (!valid) return null;

    const payload: SessionPayload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadStr)),
    );

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
