import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _LIMIT,
  _memoryStore,
  _resetCallCount,
  _SWEEP_INTERVAL,
  _WINDOW_SECONDS,
  checkRateLimit,
  rateLimitHeaders,
} from "../src/rate-limit.js";

describe("rate-limit", () => {
  beforeEach(() => {
    _memoryStore.clear();
    _resetCallCount();
    // Ensure caches.default is not available so we hit the in-memory path
    vi.stubGlobal("caches", undefined);
  });

  describe("in-memory fallback (checkRateLimit)", () => {
    it("allows first request and returns correct remaining count", async () => {
      const result = await checkRateLimit("1.2.3.4");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(_LIMIT - 1);
    });

    it("allows up to LIMIT requests", async () => {
      for (let i = 1; i <= _LIMIT; i++) {
        const result = await checkRateLimit("1.2.3.4");
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(_LIMIT - i);
      }
    });

    it("blocks request LIMIT+1", async () => {
      for (let i = 0; i < _LIMIT; i++) {
        await checkRateLimit("1.2.3.4");
      }
      const result = await checkRateLimit("1.2.3.4");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("tracks IPs independently", async () => {
      for (let i = 0; i < _LIMIT; i++) {
        await checkRateLimit("1.2.3.4");
      }
      const blocked = await checkRateLimit("1.2.3.4");
      expect(blocked.allowed).toBe(false);

      const different = await checkRateLimit("5.6.7.8");
      expect(different.allowed).toBe(true);
      expect(different.remaining).toBe(_LIMIT - 1);
    });

    it("resets count after window expires", async () => {
      vi.useFakeTimers();

      for (let i = 0; i < _LIMIT; i++) {
        await checkRateLimit("1.2.3.4");
      }
      const blocked = await checkRateLimit("1.2.3.4");
      expect(blocked.allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(_WINDOW_SECONDS * 1000 + 1);

      const afterExpiry = await checkRateLimit("1.2.3.4");
      expect(afterExpiry.allowed).toBe(true);
      expect(afterExpiry.remaining).toBe(_LIMIT - 1);

      vi.useRealTimers();
    });
  });

  describe("expired entry eviction", () => {
    it("removes expired entries after SWEEP_INTERVAL calls", async () => {
      vi.useFakeTimers();

      // Seed expired entries from other IPs
      const past = Date.now() - 1;
      _memoryStore.set("stale-1", { count: 5, expires: past });
      _memoryStore.set("stale-2", { count: 3, expires: past });

      // Make SWEEP_INTERVAL calls to trigger the sweep
      for (let i = 0; i < _SWEEP_INTERVAL; i++) {
        await checkRateLimit(`10.0.0.${i % 256}`);
      }

      expect(_memoryStore.has("stale-1")).toBe(false);
      expect(_memoryStore.has("stale-2")).toBe(false);

      vi.useRealTimers();
    });

    it("preserves non-expired entries during sweep", async () => {
      vi.useFakeTimers();

      const past = Date.now() - 1;
      const future = Date.now() + 60_000;
      _memoryStore.set("stale", { count: 5, expires: past });
      _memoryStore.set("active", { count: 2, expires: future });

      for (let i = 0; i < _SWEEP_INTERVAL; i++) {
        await checkRateLimit(`10.0.0.${i % 256}`);
      }

      expect(_memoryStore.has("stale")).toBe(false);
      expect(_memoryStore.has("active")).toBe(true);
      expect(_memoryStore.get("active")?.count).toBe(2);

      vi.useRealTimers();
    });

    it("does not sweep before SWEEP_INTERVAL calls", async () => {
      vi.useFakeTimers();

      const past = Date.now() - 1;
      _memoryStore.set("stale", { count: 5, expires: past });

      // Make fewer calls than the interval
      for (let i = 0; i < _SWEEP_INTERVAL - 1; i++) {
        await checkRateLimit(`10.0.0.${i % 256}`);
      }

      expect(_memoryStore.has("stale")).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("rateLimitHeaders", () => {
    it("returns correct header values", () => {
      const headers = rateLimitHeaders(7);
      expect(headers["X-RateLimit-Limit"]).toBe(String(_LIMIT));
      expect(headers["X-RateLimit-Remaining"]).toBe("7");
      expect(headers["X-RateLimit-Window"]).toBe(`${_WINDOW_SECONDS}s`);
    });

    it("returns 0 remaining when exhausted", () => {
      const headers = rateLimitHeaders(0);
      expect(headers["X-RateLimit-Remaining"]).toBe("0");
    });
  });
});
