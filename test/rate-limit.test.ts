import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  rateLimitHeaders,
  _memoryStore,
  _LIMIT,
  _WINDOW_SECONDS,
} from "../src/rate-limit.js";

describe("rate-limit", () => {
  beforeEach(() => {
    _memoryStore.clear();
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
