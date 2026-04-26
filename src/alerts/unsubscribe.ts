// One-click unsubscribe token. Signs `{user_id}` with HMAC-SHA256 keyed on
// SESSION_SECRET (the same secret already used for session JWTs). No
// expiration — unsubscribe links in historical emails should keep working
// forever. Rotating SESSION_SECRET invalidates old links, which is the
// correct behaviour if the secret ever leaks.

const ENCODER = new TextEncoder();

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

export async function createUnsubscribeToken(
  userId: string,
  secret: string,
): Promise<string> {
  const payload = base64UrlEncode(ENCODER.encode(userId));
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    ENCODER.encode(payload),
  );
  return `${payload}.${base64UrlEncode(signature)}`;
}

export async function validateUnsubscribeToken(
  token: string,
  secret: string,
): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  try {
    const key = await getKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sig),
      ENCODER.encode(payload),
    );
    if (!valid) return null;
    return new TextDecoder().decode(base64UrlDecode(payload));
  } catch {
    return null;
  }
}
