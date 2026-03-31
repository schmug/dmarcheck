import { describe, it, expect } from "vitest";
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
    expect(parseSelectors("google,selector1,s2")).toEqual(["google", "selector1", "s2"]);
  });

  it("trims whitespace from selectors", () => {
    expect(parseSelectors("google , selector1 , s2")).toEqual(["google", "selector1", "s2"]);
  });

  it("filters out empty strings from extra commas", () => {
    expect(parseSelectors("google,,selector1,")).toEqual(["google", "selector1"]);
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
    expect(normalizeDomain("https://münchen.de/path")).toBe("xn--mnchen-3ya.de");
  });
});

describe("security headers", () => {
  it("sets security headers on landing page", async () => {
    const res = await app.request("/");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("sets CSP with script hash on HTML responses", async () => {
    const res = await app.request("/");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("script-src 'sha256-");
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
});
