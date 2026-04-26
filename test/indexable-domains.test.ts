import { describe, expect, it } from "vitest";
import {
  isIndexableScanDomain,
  listIndexableScanDomains,
} from "../src/shared/indexable-domains.js";

describe("isIndexableScanDomain", () => {
  it("returns true for curated allowlist entries", () => {
    expect(isIndexableScanDomain("gmail.com")).toBe(true);
    expect(isIndexableScanDomain("github.com")).toBe(true);
    expect(isIndexableScanDomain("dmarc.mx")).toBe(true);
  });

  it("returns false for arbitrary domains", () => {
    expect(isIndexableScanDomain("example.com")).toBe(false);
    expect(isIndexableScanDomain("some-random-startup.io")).toBe(false);
  });

  it("is case-sensitive — input must already be lowercased by normalizeDomain", () => {
    // Catches future regressions where someone removes normalization upstream.
    expect(isIndexableScanDomain("GMAIL.COM")).toBe(false);
  });
});

describe("listIndexableScanDomains", () => {
  it("returns a non-empty list of normalized domains", () => {
    const domains = listIndexableScanDomains();
    expect(domains.length).toBeGreaterThan(0);
    for (const d of domains) {
      expect(d).toBe(d.toLowerCase());
      expect(d).not.toMatch(/^https?:/);
      expect(d).not.toContain("/");
      expect(d).toContain(".");
    }
  });

  it("agrees with isIndexableScanDomain for every listed entry", () => {
    for (const d of listIndexableScanDomains()) {
      expect(isIndexableScanDomain(d)).toBe(true);
    }
  });

  it("has no duplicate entries", () => {
    const domains = listIndexableScanDomains();
    expect(new Set(domains).size).toBe(domains.length);
  });
});
