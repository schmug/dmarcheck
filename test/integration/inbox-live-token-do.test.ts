import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  MAX_LIVE_TOKENS_PER_IDENTITY,
  reserveLiveToken,
  TOKEN_TTL_SECONDS,
} from "../../src/inbox/store.js";
import type { RateLimiterDO } from "../../src/rate-limit-do.js";
import { FakeKV } from "../helpers/fake-kv.js";

// Runs inside the real Cloudflare Workers runtime via
// `@cloudflare/vitest-pool-workers`, the only place the `RATE_LIMITER`
// Durable Object binding exists. Complete fix for #618: the prior KV
// read-modify-write on the per-identity live-token index was a TOCTOU — a
// concurrent burst under one identity could each read a pre-insert count
// below `MAX_LIVE_TOKENS_PER_IDENTITY` and all reserve, exceeding the cap. The
// DO's single-threaded RPC serializes the prune-count-insert, closing that
// window (mirrors the GHSA-v7qc-7qh8-h69g fix for the rate limiter itself).

declare module "cloudflare:test" {
  interface ProvidedEnv {
    RATE_LIMITER: DurableObjectNamespace<RateLimiterDO>;
  }
}

describe("reserveLiveToken via RATE_LIMITER DO (runs inside real workerd runtime)", () => {
  it("serializes N concurrent reservations to one identity — never exceeds the cap", async () => {
    const N = 30;
    const kv = new FakeKV().asKv();
    const identity = "ip:inbox-burst";
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        reserveLiveToken(kv, identity, `t${i}`, undefined, env.RATE_LIMITER),
      ),
    );
    expect(results.filter(Boolean).length).toBe(MAX_LIVE_TOKENS_PER_IDENTITY);
  });

  it("scopes the cap per identity", async () => {
    const kv = new FakeKV().asKv();
    for (let i = 0; i < MAX_LIVE_TOKENS_PER_IDENTITY; i++) {
      expect(
        await reserveLiveToken(
          kv,
          "ip:do-scope-a",
          `t${i}`,
          undefined,
          env.RATE_LIMITER,
        ),
      ).toBe(true);
    }
    expect(
      await reserveLiveToken(
        kv,
        "ip:do-scope-a",
        "overflow",
        undefined,
        env.RATE_LIMITER,
      ),
    ).toBe(false);
    expect(
      await reserveLiveToken(
        kv,
        "ip:do-scope-b",
        "fresh",
        undefined,
        env.RATE_LIMITER,
      ),
    ).toBe(true);
  });

  it("prunes expired entries, freeing slots", async () => {
    const kv = new FakeKV().asKv();
    const identity = "ip:do-prune";
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_LIVE_TOKENS_PER_IDENTITY; i++) {
      expect(
        await reserveLiveToken(kv, identity, `t${i}`, t0, env.RATE_LIMITER),
      ).toBe(true);
    }
    expect(
      await reserveLiveToken(kv, identity, "x", t0, env.RATE_LIMITER),
    ).toBe(false);

    const later = t0 + (TOKEN_TTL_SECONDS + 60) * 1000;
    expect(
      await reserveLiveToken(kv, identity, "later", later, env.RATE_LIMITER),
    ).toBe(true);
  });
});
