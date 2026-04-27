import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidGrade, renderBadgeSvg } from "../src/api/badge.js";
import { app } from "../src/index.js";
import { _memoryStore } from "../src/rate-limit.js";

vi.mock("../src/cache.js", () => ({
  getCachedScan: vi.fn().mockResolvedValue(null),
  setCachedScan: vi.fn(),
}));

vi.mock("../src/orchestrator.js", async () => ({
  scan: vi.fn().mockResolvedValue({
    domain: "example.com",
    timestamp: "2026-04-27T00:00:00.000Z",
    grade: "B+",
    breakdown: {
      grade: "B+",
      tier: "B",
      tierReason: "ok",
      modifier: 1,
      modifierLabel: "+",
      factors: [],
      recommendations: [],
    },
    summary: {
      mx_records: 1,
      mx_providers: [],
      dmarc_policy: "quarantine",
      spf_result: "pass",
      spf_lookups: "5/10",
      dkim_selectors_found: 0,
      bimi_enabled: false,
      mta_sts_mode: null,
    },
    protocols: {},
  }),
}));

vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn().mockResolvedValue(null),
  queryMx: vi.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  _memoryStore.clear();
});

describe("renderBadgeSvg", () => {
  it("emits a well-formed SVG element", () => {
    const svg = renderBadgeSvg({ grade: "A+" });
    expect(svg).toMatch(/^<svg [^>]+>/);
    expect(svg).toContain("</svg>");
  });

  it("includes the grade and label text twice (shadow + foreground)", () => {
    const svg = renderBadgeSvg({ grade: "A+" });
    const labelMatches = svg.match(/dmarcheck/g) ?? [];
    const valueMatches = svg.match(/>A\+</g) ?? [];
    expect(labelMatches.length).toBeGreaterThanOrEqual(2);
    expect(valueMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("includes an aria-label combining label and grade", () => {
    const svg = renderBadgeSvg({ grade: "B" });
    expect(svg).toContain('aria-label="dmarcheck: B"');
  });

  it("color-codes by tier", () => {
    expect(renderBadgeSvg({ grade: "S" })).toContain("#16a34a");
    expect(renderBadgeSvg({ grade: "A+" })).toContain("#22c55e");
    expect(renderBadgeSvg({ grade: "B" })).toContain("#84cc16");
    expect(renderBadgeSvg({ grade: "C-" })).toContain("#f59e0b");
    expect(renderBadgeSvg({ grade: "D" })).toContain("#f97316");
    expect(renderBadgeSvg({ grade: "F" })).toContain("#dc2626");
  });

  it("escapes the grade value to prevent SVG injection", () => {
    const svg = renderBadgeSvg({ grade: "<script>" });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("respects an explicit color override", () => {
    const svg = renderBadgeSvg({ grade: "F", color: "#000000" });
    expect(svg).toContain("#000000");
    expect(svg).not.toContain("#dc2626");
  });

  it("widens the value column for longer grade tokens", () => {
    const a = renderBadgeSvg({ grade: "F" });
    const b = renderBadgeSvg({ grade: "rate limited" });
    const widthOf = (svg: string) =>
      Number(svg.match(/^<svg [^>]*width="(\d+)"/)?.[1] ?? 0);
    expect(widthOf(b)).toBeGreaterThan(widthOf(a));
  });
});

describe("isValidGrade", () => {
  it("accepts every grade the scoring engine emits", () => {
    for (const g of [
      "S",
      "A+",
      "A",
      "A-",
      "B+",
      "B",
      "B-",
      "C+",
      "C",
      "C-",
      "D+",
      "D",
      "D-",
      "F",
    ]) {
      expect(isValidGrade(g)).toBe(true);
    }
  });

  it("rejects unknown tokens", () => {
    expect(isValidGrade("E")).toBe(false);
    expect(isValidGrade("A++")).toBe(false);
    expect(isValidGrade("")).toBe(false);
    expect(isValidGrade("<script>")).toBe(false);
  });
});

describe("/badge route", () => {
  it("returns 200 SVG for a valid domain", async () => {
    const res = await app.request("/badge?domain=example.com");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "image/svg+xml; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toMatch(/^<svg /);
    expect(body).toContain(">B+<");
  });

  it("sets a 1h browser cache + long stale-while-revalidate", async () => {
    const res = await app.request("/badge?domain=example.com");
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("max-age=3600");
    expect(cc).toContain("stale-while-revalidate=");
  });

  it("returns an SVG (not JSON) on missing domain", async () => {
    const res = await app.request("/badge");
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe(
      "image/svg+xml; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toMatch(/^<svg /);
    expect(body).toContain(">invalid<");
  });

  it("returns an SVG on rejected/invalid domain input", async () => {
    const res = await app.request("/badge?domain=not%20a%20domain");
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe(
      "image/svg+xml; charset=utf-8",
    );
  });

  it("sets a strict CSP that blocks scripts in the embedded SVG", async () => {
    const res = await app.request("/badge?domain=example.com");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'none'");
  });

  it("rate limits repeated requests with an SVG 429", async () => {
    // Rate limit is 10/60s for anonymous IPs. Burn 11 requests from the
    // same synthetic IP and expect the 11th to come back as a badge SVG
    // 429, not JSON.
    for (let i = 0; i < 10; i++) {
      const ok = await app.request("/badge?domain=example.com");
      expect(ok.status).toBe(200);
    }
    const limited = await app.request("/badge?domain=example.com");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Content-Type")).toBe(
      "image/svg+xml; charset=utf-8",
    );
    const body = await limited.text();
    expect(body).toMatch(/^<svg /);
    expect(body).toContain(">rate limited<");
  });
});
