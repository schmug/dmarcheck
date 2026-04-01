import { describe, expect, it } from "vitest";
import app, { normalizeDomain, parseSelectors } from "../src/index.js";

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
    expect(csp).toContain("style-src 'unsafe-inline'");
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
});
