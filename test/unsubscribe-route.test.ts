import { describe, expect, it, vi } from "vitest";
import { createUnsubscribeToken } from "../src/alerts/unsubscribe.js";

vi.mock("../src/cache.js", () => ({
  getCachedScan: vi.fn().mockResolvedValue(null),
  setCachedScan: vi.fn(),
}));
vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn().mockResolvedValue(null),
  queryMx: vi.fn().mockResolvedValue(null),
}));

const { app } = await import("../src/index.js");

const SECRET = "test-unsub-route-secret";

function makeEnv(opts: {
  userId: string;
  captureUpdate?: (bindings: unknown[]) => void;
}): { SESSION_SECRET: string; DB: D1Database } {
  const db = {
    prepare: () => ({
      bind: (...params: unknown[]) => ({
        run: async () => {
          opts.captureUpdate?.(params);
          return { success: true };
        },
      }),
    }),
  } as unknown as D1Database;
  return { SESSION_SECRET: SECRET, DB: db };
}

describe("GET /alerts/unsubscribe", () => {
  it("returns 400 when token is missing", async () => {
    const env = makeEnv({ userId: "user_1" });
    const res = await app.request("/alerts/unsubscribe", {}, env);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid/tampered token", async () => {
    const env = makeEnv({ userId: "user_1" });
    const res = await app.request(
      "/alerts/unsubscribe?token=not-a-real-token",
      {},
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when the token was signed with a different secret", async () => {
    const token = await createUnsubscribeToken("user_1", "other-secret");
    const env = makeEnv({ userId: "user_1" });
    const res = await app.request(
      `/alerts/unsubscribe?token=${token}`,
      {},
      env,
    );
    expect(res.status).toBe(400);
  });

  it("flips email_alerts_enabled = 0 for a valid token and confirms", async () => {
    const token = await createUnsubscribeToken("user_42", SECRET);
    let captured: unknown[] | null = null;
    const env = makeEnv({
      userId: "user_42",
      captureUpdate: (bindings) => {
        captured = bindings;
      },
    });

    const res = await app.request(
      `/alerts/unsubscribe?token=${token}`,
      {},
      env,
    );

    expect(res.status).toBe(200);
    expect(captured).toEqual([0, "user_42"]);
    const html = await res.text();
    expect(html).toContain("Unsubscribed");
  });
});
