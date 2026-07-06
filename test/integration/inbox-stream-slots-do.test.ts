import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RateLimiterDO } from "../../src/rate-limit-do.js";

// These tests run inside the real Cloudflare Workers runtime via
// `@cloudflare/vitest-pool-workers`, which is the only place the
// `RATE_LIMITER` Durable Object binding exists. They cover issue #620: the
// inbox SSE poll loop (`streamInboxResult`) had no ceiling on concurrent
// long-lived loops per token, so a client could fan out unboundedly many
// connections and amplify KV reads. `acquireStreamSlot`/`releaseStreamSlot`
// bound that via the DO's single-threaded RPC — something the Node-pool
// tests (single isolate, synchronous JS) cannot exercise under real
// concurrency.

declare module "cloudflare:test" {
  interface ProvidedEnv {
    RATE_LIMITER: DurableObjectNamespace<RateLimiterDO>;
  }
}

const STALE_AFTER_MS = 30 * 60 * 1000; // matches TOKEN_TTL_SECONDS * 1000

describe("RateLimiterDO stream slots (runs inside real workerd runtime)", () => {
  it("bounds concurrent acquireStreamSlot calls for one token — only `max` succeed", async () => {
    const N = 12;
    const max = 3;
    const stub = env.RATE_LIMITER.getByName("stream:atomic-token");
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        stub.acquireStreamSlot(`slot-${i}`, max, STALE_AFTER_MS),
      ),
    );
    expect(results.filter(Boolean).length).toBe(max);
    expect(results.filter((r) => !r).length).toBe(N - max);
  });

  it("keeps different tokens' slot counts independent", async () => {
    const max = 1;
    const stubA = env.RATE_LIMITER.getByName("stream:token-a");
    const stubB = env.RATE_LIMITER.getByName("stream:token-b");
    expect(await stubA.acquireStreamSlot("a1", max, STALE_AFTER_MS)).toBe(true);
    expect(await stubB.acquireStreamSlot("b1", max, STALE_AFTER_MS)).toBe(true);
    // token-a is already at its own cap; token-b's slot doesn't count against it.
    expect(await stubA.acquireStreamSlot("a2", max, STALE_AFTER_MS)).toBe(
      false,
    );
  });

  it("releasing a slot frees capacity for a subsequent acquire", async () => {
    const max = 1;
    const stub = env.RATE_LIMITER.getByName("stream:release-token");
    expect(await stub.acquireStreamSlot("a", max, STALE_AFTER_MS)).toBe(true);
    expect(await stub.acquireStreamSlot("b", max, STALE_AFTER_MS)).toBe(false);
    await stub.releaseStreamSlot("a");
    expect(await stub.acquireStreamSlot("b", max, STALE_AFTER_MS)).toBe(true);
  });

  it("reclaims a slot abandoned by a stream that never released it", async () => {
    const max = 1;
    const stub = env.RATE_LIMITER.getByName("stream:stale-token");
    // Seed a slot as opened well past the stale window — simulates a worker
    // eviction that skipped the `finally` release.
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec(
        "INSERT INTO stream_slots (slot_id, opened_at) VALUES (?, ?)",
        "abandoned",
        Date.now() - 60_000,
      );
    });
    expect(await stub.acquireStreamSlot("fresh", max, 1_000)).toBe(true);
  });

  it("does not reclaim a slot that is still within its stale window", async () => {
    const max = 1;
    const stub = env.RATE_LIMITER.getByName("stream:fresh-token");
    expect(await stub.acquireStreamSlot("a", max, STALE_AFTER_MS)).toBe(true);
    expect(await stub.acquireStreamSlot("b", max, STALE_AFTER_MS)).toBe(false);
  });
});
