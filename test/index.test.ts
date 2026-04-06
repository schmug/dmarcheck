import { describe, expect, it, vi } from "vitest";
import app, { normalizeDomain, parseSelectors } from "../src/index.js";

vi.mock("../src/cache.js", () => ({
  getCachedScan: vi.fn().mockResolvedValue(null),
  setCachedScan: vi.fn(),
}));

vi.mock("../src/orchestrator.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/orchestrator.js")>();
  return {
    ...original,
    scanStreaming: vi.fn(original.scanStreaming),
  };
});

vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn().mockResolvedValue(null),
  queryMx: vi.fn().mockResolvedValue(null),
}));

describe("normalizeDomain", () => {
  it("returns null for undefined input", () => {
    expect(normalizeDomain(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeDomain("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(normalizeDomain("   ")).toBeNull();
  });

  it("returns null for input without a dot", () => {
    expect(normalizeDomain("localhost")).toBeNull();
  });

  it("returns null for input with spaces", () => {
    expect(normalizeDomain("example .com")).toBeNull();
  });

  it("returns null for domain exceeding 253 characters (RFC 1035)", () => {
    const longDomain = `${"a".repeat(250)}.com`;
    expect(normalizeDomain(longDomain)).toBeNull();
  });

  it("strips https:// prefix", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
  });

  it("strips http:// prefix", () => {
    expect(normalizeDomain("http://example.com")).toBe("example.com");
  });

  it("strips path after domain", () => {
    expect(normalizeDomain("example.com/path/to/page")).toBe("example.com");
  });

  it("strips query string after domain", () => {
    expect(normalizeDomain("example.com?q=test")).toBe("example.com");
  });

  it("strips trailing dot", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });

  it("lowercases domain", () => {
    expect(normalizeDomain("Example.COM")).toBe("example.com");
  });

  it("handles full URL with protocol, path, and query", () => {
    expect(normalizeDomain("https://Example.COM/path?q=1")).toBe("example.com");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeDomain("  example.com  ")).toBe("example.com");
  });
});

describe("parseSelectors", () => {
  it("returns empty array for undefined", () => {
    expect(parseSelectors(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseSelectors("")).toEqual([]);
  });

  it("splits comma-separated values", () => {
    expect(parseSelectors("google,selector1,s2")).toEqual([
      "google",
      "selector1",
      "s2",
    ]);
  });

  it("trims whitespace from selectors", () => {
    expect(parseSelectors("google , selector1 , s2")).toEqual([
      "google",
      "selector1",
      "s2",
    ]);
  });

  it("filters out empty strings from extra commas", () => {
    expect(parseSelectors("google,,selector1,")).toEqual([
      "google",
      "selector1",
    ]);
  });

  it("returns single selector", () => {
    expect(parseSelectors("google")).toEqual(["google"]);
  });
});

describe("normalizeDomain — extended edge cases", () => {
  it("strips port number", () => {
    expect(normalizeDomain("example.com:8080")).toBe("example.com");
  });

  it("strips port from full URL", () => {
    expect(normalizeDomain("https://example.com:443/path")).toBe("example.com");
  });

  it("converts IDN to Punycode", () => {
    expect(normalizeDomain("münchen.de")).toBe("xn--mnchen-3ya.de");
  });

  it("strips userinfo", () => {
    expect(normalizeDomain("user:pass@example.com")).toBe("example.com");
  });

  it("returns null for IPv6 address", () => {
    expect(normalizeDomain("[::1]")).toBeNull();
  });

  it("handles IDN with protocol and path", () => {
    expect(normalizeDomain("https://münchen.de/path")).toBe(
      "xn--mnchen-3ya.de",
    );
  });
});

describe("normalizeDomain — XSS payload rejection", () => {
  // These inputs were the XSS vectors before the fix: `encodeURIComponent`
  // preserves single quotes, and the URL constructor accepts them in hostnames.
  // normalizeDomain must now reject them at the boundary.
  it("rejects single quote in hostname", () => {
    expect(normalizeDomain("example.com';alert(1);'")).toBeNull();
  });

  it("rejects double quote in hostname", () => {
    expect(normalizeDomain('example.com";alert(1);"')).toBeNull();
  });

  it("rejects angle brackets in hostname", () => {
    expect(normalizeDomain("example.com<script>")).toBeNull();
  });

  it("rejects backtick in hostname", () => {
    expect(normalizeDomain("example.com`alert(1)`")).toBeNull();
  });

  it("rejects underscore in hostname (not valid per RFC 1035)", () => {
    expect(normalizeDomain("foo_bar.example.com")).toBeNull();
  });

  it("accepts plain ASCII hostnames", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
    expect(normalizeDomain("sub.example.co.uk")).toBe("sub.example.co.uk");
    expect(normalizeDomain("a-b.example.com")).toBe("a-b.example.com");
  });

  it("accepts IPv4 addresses (dotted quads pass the charset)", () => {
    expect(normalizeDomain("192.168.1.1")).toBe("192.168.1.1");
  });
});

describe("parseSelectors — XSS payload rejection", () => {
  it("drops selector containing single quote", () => {
    expect(parseSelectors("x';alert(1);'")).toEqual([]);
  });

  it("drops selector containing angle brackets", () => {
    expect(parseSelectors("<script>")).toEqual([]);
  });

  it("drops selector containing space (rejected by strict charset)", () => {
    expect(parseSelectors("foo bar")).toEqual([]);
  });

  it("keeps valid selectors and drops invalid ones in the same list", () => {
    expect(parseSelectors("google,x';alert(1);',selector1")).toEqual([
      "google",
      "selector1",
    ]);
  });

  it("accepts selectors with dots, underscores, and hyphens", () => {
    expect(parseSelectors("dkim._domainkey,my-selector,s_1")).toEqual([
      "dkim._domainkey",
      "my-selector",
      "s_1",
    ]);
  });
});

describe("GET /check — XSS regression", () => {
  // Full end-to-end check: a pathological domain or selectors query string
  // must not cause attacker-controlled JavaScript tokens to appear in the
  // HTML response.
  it("does not reflect XSS payload from selectors into streaming loader", async () => {
    const res = await app.request(
      "/check?domain=example.com&selectors=x';alert(1);'",
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    // The payload string must not appear verbatim anywhere in the response
    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("';alert");
  });

  it("does not reflect XSS payload from domain into streaming loader", async () => {
    // A domain with a single quote must be rejected with a 400 — it never
    // reaches renderStreamingLoading, so no injection point.
    const res = await app.request("/check?domain=example.com';alert(2);'");
    // Either rejected as invalid (400) or silently normalized — in both
    // cases, the payload must not appear in the response body.
    const html = await res.text();
    expect(html).not.toContain("alert(2)");
  });

  it("streaming loader emits qs in a data-qs attribute, not a JS literal", async () => {
    const res = await app.request("/check?domain=example.com&selectors=google");
    expect(res.status).toBe(200);
    const html = await res.text();
    // Must contain the new data-qs attribute
    expect(html).toContain('data-qs="domain=example.com&amp;selectors=google"');
    // Must NOT contain the old inline JS literal pattern with the query string
    expect(html).not.toMatch(/var qs = 'domain=/);
  });
});

describe("GET /health", () => {
  it("returns 200 with status ok and a timestamp", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    // Verify timestamp is a valid ISO 8601 date
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});

describe("CSV format routes", () => {
  it("returns 400 for /check?format=csv without domain", async () => {
    const res = await app.request("/check?format=csv");
    expect(res.status).toBe(400);
  });

  it("returns 400 for /api/check?format=csv without domain", async () => {
    const res = await app.request("/api/check?format=csv");
    expect(res.status).toBe(400);
  });

  it("sets strict CSP on CSV responses (non-HTML)", async () => {
    const res = await app.request("/api/check?domain=&format=csv");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBe("default-src 'none'");
  });
});

describe("security headers", () => {
  it("sets security headers on landing page", async () => {
    const res = await app.request("/");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("sets CSP with inline scripts allowed on HTML responses", async () => {
    const res = await app.request("/");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("sets strict CSP on JSON responses", async () => {
    const res = await app.request("/api/check?domain=");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBe("default-src 'none'");
  });

  it("does not include HSTS header (handled by Cloudflare)", async () => {
    const res = await app.request("/");
    expect(res.headers.get("Strict-Transport-Security")).toBeNull();
  });

  it("allows same-origin images in CSP", async () => {
    const res = await app.request("/");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("img-src 'self' data:");
  });
});

describe("favicon and icon routes", () => {
  it("serves adaptive SVG favicon", async () => {
    const res = await app.request("/favicon.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    const body = await res.text();
    expect(body).toContain("prefers-color-scheme");
    expect(body.length).toBeLessThan(5000);
  });

  it("serves ICO favicon", async () => {
    const res = await app.request("/favicon.ico");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/x-icon");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("serves apple touch icon", async () => {
    const res = await app.request("/apple-touch-icon.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("serves web manifest with icon entries", async () => {
    const res = await app.request("/manifest.webmanifest");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/manifest+json");
    const body = await res.json();
    expect(body.icons).toHaveLength(2);
    expect(body.icons[0].src).toBe("/icon-192.png");
    expect(body.icons[1].src).toBe("/icon-512.png");
  });

  it("serves 192px icon", async () => {
    const res = await app.request("/icon-192.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("serves 512px icon", async () => {
    const res = await app.request("/icon-512.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("still serves existing logo SVG unchanged", async () => {
    const res = await app.request("/logo.svg");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('viewBox="0 0 512 512"');
    expect(body).toContain('fill="#0a0a0a"');
  });
});

describe("HTML head tags", () => {
  it("includes favicon link tags", async () => {
    const res = await app.request("/");
    const html = await res.text();
    expect(html).toContain('rel="icon" href="/favicon.ico"');
    expect(html).toContain('rel="icon" href="/favicon.svg"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('rel="manifest"');
  });

  it("includes preconnect hint", async () => {
    const res = await app.request("/");
    const html = await res.text();
    expect(html).toContain('rel="preconnect"');
  });

  it("references external CSS and JS instead of inlining", async () => {
    const res = await app.request("/");
    const html = await res.text();
    expect(html).toContain('rel="stylesheet" href="/assets/styles-');
    expect(html).toContain('<script src="/assets/scripts-');
    expect(html).not.toMatch(/<style>[^<]{500,}<\/style>/);
    expect(html).not.toMatch(/<script>[^<]{500,}<\/script>/);
  });
});

describe("static asset routes", () => {
  it("serves CSS with immutable cache header", async () => {
    const { CSS_PATH } = await import("../src/views/assets.js");
    const res = await app.request(CSS_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/css; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    const body = await res.text();
    expect(body.length).toBeGreaterThan(1000);
  });

  it("serves JS with immutable cache header", async () => {
    const { JS_PATH } = await import("../src/views/assets.js");
    const res = await app.request(JS_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/javascript; charset=utf-8",
    );
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    const body = await res.text();
    expect(body.length).toBeGreaterThan(1000);
  });
});

describe("SSE streaming cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replays cached result as SSE events on cache hit", async () => {
    const { getCachedScan } = await import("../src/cache.js");
    const { scanStreaming } = await import("../src/orchestrator.js");
    vi.mocked(getCachedScan).mockResolvedValueOnce({
      domain: "example.com",
      timestamp: "2026-04-02T00:00:00.000Z",
      grade: "A+",
      breakdown: {
        grade: "A+",
        tier: "A",
        tierReason: "All protocols passing",
        modifier: 0,
        modifierLabel: "",
        score: 100,
        maxScore: 100,
        factors: [],
        recommendations: [],
        protocolSummaries: {
          dmarc: { status: "pass", summary: "p=reject" },
          spf: { status: "pass", summary: "pass" },
          dkim: { status: "pass", summary: "1 selector found" },
          bimi: { status: "fail", summary: "No BIMI record" },
          mta_sts: { status: "fail", summary: "No MTA-STS policy" },
        },
      } as any,
      summary: {
        mx_records: 1,
        mx_providers: ["Google Workspace"],
        dmarc_policy: "reject",
        spf_result: "pass",
        spf_lookups: "3/10",
        dkim_selectors_found: 1,
        bimi_enabled: false,
        mta_sts_mode: null,
      },
      protocols: {
        mx: { status: "info", records: [], providers: [], validations: [] },
        dmarc: {
          status: "pass",
          record: "v=DMARC1; p=reject",
          tags: { p: "reject" },
          validations: [],
        },
        spf: {
          status: "pass",
          record: "v=spf1 -all",
          lookups_used: 0,
          lookup_limit: 10,
          include_tree: null,
          validations: [],
        },
        dkim: { status: "pass", selectors: {}, validations: [] },
        bimi: { status: "fail", record: null, tags: null, validations: [] },
        mta_sts: {
          status: "fail",
          dns_record: null,
          policy: null,
          validations: [],
        },
      },
    });

    const res = await app.request("/api/check/stream?domain=example.com");
    expect(res.status).toBe(200);

    const text = await res.text();
    // Should contain all 6 protocol events
    expect(text).toContain('event: protocol\ndata: {"id":"mx"');
    expect(text).toContain('event: protocol\ndata: {"id":"dmarc"');
    expect(text).toContain('event: protocol\ndata: {"id":"spf"');
    expect(text).toContain('event: protocol\ndata: {"id":"dkim"');
    expect(text).toContain('event: protocol\ndata: {"id":"bimi"');
    expect(text).toContain('event: protocol\ndata: {"id":"mta_sts"');
    // Should contain done event with grade
    expect(text).toContain("event: done");
    expect(text).toContain('"grade":"A+"');
    // scanStreaming should NOT have been called
    expect(scanStreaming).not.toHaveBeenCalled();
  });
});
