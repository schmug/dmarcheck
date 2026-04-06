import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanResult } from "../src/analyzers/types.js";
import { getCachedScan, setCachedScan } from "../src/cache.js";

const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("caches", { default: mockCache });
});

const fakeScan: ScanResult = {
  domain: "example.com",
  timestamp: "2026-04-06T00:00:00.000Z",
  grade: "A",
  breakdown: {
    grade: "A",
    tier: "A",
    tierReason: "All protocols passing",
    modifier: 0,
    modifierLabel: "",
    score: 90,
    modifiers: [],
  },
  results: [],
};

describe("setCachedScan", () => {
  it("stores response with stale-while-revalidate header", async () => {
    await setCachedScan("example.com", [], fakeScan);
    expect(mockCache.put).toHaveBeenCalledOnce();
    const [, response] = mockCache.put.mock.calls[0];
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=300, stale-while-revalidate=600",
    );
  });
});

describe("getCachedScan", () => {
  it("returns null on cache miss", async () => {
    mockCache.match.mockResolvedValueOnce(null);
    const result = await getCachedScan("example.com", []);
    expect(result).toBeNull();
  });

  it("returns parsed result on cache hit", async () => {
    mockCache.match.mockResolvedValueOnce(
      new Response(JSON.stringify(fakeScan)),
    );
    const result = await getCachedScan("example.com", []);
    expect(result).toEqual(fakeScan);
  });

  it("returns null when caches API is unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    const result = await getCachedScan("example.com", []);
    expect(result).toBeNull();
  });
});
