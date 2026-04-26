import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetApiKeyTouchCache,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
} from "../src/auth/api-key.js";

interface StoredKey {
  id: string;
  user_id: string;
  hash: string;
  revoked_at: number | null;
}

function makeKeyDb(keys: StoredKey[]): D1Database {
  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      first: async <T>(): Promise<T | null> => {
        if (
          sql.includes("SELECT id, user_id FROM api_keys WHERE hash") &&
          sql.includes("revoked_at IS NULL")
        ) {
          const hash = params[0] as string;
          const row = keys.find(
            (k) => k.hash === hash && k.revoked_at === null,
          );
          return (
            row ? { id: row.id, user_id: row.user_id } : null
          ) as T | null;
        }
        return null;
      },
      run: async () => ({ success: true }),
    }),
  });
  return { prepare } as unknown as D1Database;
}

describe("auth/api-key", () => {
  beforeEach(() => {
    __resetApiKeyTouchCache();
  });

  describe("generateApiKey", () => {
    it("produces a dmk_-prefixed token of the expected length", async () => {
      const { raw, prefix, hash } = await generateApiKey();
      expect(raw).toMatch(/^dmk_[A-Za-z0-9_-]{32}$/);
      expect(raw.length).toBe(36);
      expect(prefix).toBe(raw.slice(0, 12));
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns a stable hex SHA-256 across runs for the same raw value", async () => {
      const a = await hashApiKey("dmk_known-test-token");
      const b = await hashApiKey("dmk_known-test-token");
      expect(a).toBe(b);
      // Sanity-check against a pre-computed value (hex SHA-256).
      const precomputed = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("dmk_known-test-token"),
      );
      const hex = Array.from(new Uint8Array(precomputed))
        .map((b2) => b2.toString(16).padStart(2, "0"))
        .join("");
      expect(a).toBe(hex);
    });

    it("produces different raw values on each call", async () => {
      const k1 = await generateApiKey();
      const k2 = await generateApiKey();
      expect(k1.raw).not.toBe(k2.raw);
      expect(k1.hash).not.toBe(k2.hash);
    });
  });

  describe("verifyApiKey", () => {
    it("rejects malformed tokens without hitting the DB", async () => {
      const db = makeKeyDb([]);
      expect(await verifyApiKey("", db)).toBeNull();
      expect(await verifyApiKey("not-a-key", db)).toBeNull();
      expect(await verifyApiKey("dmk_short", db)).toBeNull();
      expect(await verifyApiKey(`wrong_${"a".repeat(32)}`, db)).toBeNull();
    });

    it("accepts a valid key and returns the owner id + key id", async () => {
      const { raw, hash } = await generateApiKey();
      const db = makeKeyDb([
        { id: "k1", user_id: "u1", hash, revoked_at: null },
      ]);
      const result = await verifyApiKey(raw, db);
      expect(result).toEqual({ userId: "u1", keyId: "k1" });
    });

    it("rejects a revoked key", async () => {
      const { raw, hash } = await generateApiKey();
      const db = makeKeyDb([
        { id: "k1", user_id: "u1", hash, revoked_at: 123456 },
      ]);
      expect(await verifyApiKey(raw, db)).toBeNull();
    });

    it("rejects an unknown key that's shaped correctly", async () => {
      const db = makeKeyDb([]);
      const unknown = `dmk_${"z".repeat(32)}`;
      expect(await verifyApiKey(unknown, db)).toBeNull();
    });
  });
});
