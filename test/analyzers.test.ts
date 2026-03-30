import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DNS client before importing analyzers
vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn(),
  queryMx: vi.fn(),
}));

import { queryTxt } from "../src/dns/client.js";
import { analyzeDmarc } from "../src/analyzers/dmarc.js";
import { analyzeSpf } from "../src/analyzers/spf.js";

const mockQueryTxt = vi.mocked(queryTxt);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("analyzeDmarc", () => {
  it("returns fail when no record found", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeDmarc("example.com");
    expect(result.status).toBe("fail");
    expect(result.record).toBeNull();
    expect(result.validations[0].message).toContain("No DMARC record");
  });

  it("parses a valid DMARC record with reject policy", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=DMARC1; p=reject; rua=mailto:d@example.com; pct=100"],
      raw: "v=DMARC1; p=reject; rua=mailto:d@example.com; pct=100",
    });

    const result = await analyzeDmarc("example.com");
    expect(result.status).toBe("pass");
    expect(result.tags?.p).toBe("reject");
    expect(result.tags?.rua).toBe("mailto:d@example.com");
    expect(result.validations.some((v) => v.message.includes("reject"))).toBe(true);
  });

  it("warns on p=none", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=DMARC1; p=none"],
      raw: "v=DMARC1; p=none",
    });

    const result = await analyzeDmarc("example.com");
    expect(result.validations.some((v) => v.status === "fail" && v.message.includes("none"))).toBe(true);
  });

  it("warns when no rua configured", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=DMARC1; p=reject"],
      raw: "v=DMARC1; p=reject",
    });

    const result = await analyzeDmarc("example.com");
    expect(result.validations.some((v) => v.status === "warn" && v.message.includes("rua"))).toBe(true);
  });

  it("warns on partial pct", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=DMARC1; p=reject; pct=50"],
      raw: "v=DMARC1; p=reject; pct=50",
    });

    const result = await analyzeDmarc("example.com");
    expect(result.validations.some((v) => v.message.includes("50%"))).toBe(true);
  });
});

describe("analyzeSpf", () => {
  it("returns fail when no record found", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeSpf("example.com");
    expect(result.status).toBe("fail");
    expect(result.record).toBeNull();
  });

  it("parses a simple SPF record", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=spf1 ip4:192.0.2.0/24 -all"],
      raw: "v=spf1 ip4:192.0.2.0/24 -all",
    });

    const result = await analyzeSpf("example.com");
    expect(result.status).toBe("pass");
    expect(result.lookups_used).toBe(0);
    expect(result.validations.some((v) => v.message.includes("hardfail"))).toBe(true);
  });

  it("counts DNS lookup mechanisms", async () => {
    // First call: root domain
    mockQueryTxt.mockResolvedValueOnce({
      entries: ["v=spf1 include:_spf.google.com mx a -all"],
      raw: "v=spf1 include:_spf.google.com mx a -all",
    });
    // Second call: _spf.google.com include
    mockQueryTxt.mockResolvedValueOnce({
      entries: ["v=spf1 ip4:35.190.247.0/24 -all"],
      raw: "v=spf1 ip4:35.190.247.0/24 -all",
    });

    const result = await analyzeSpf("example.com");
    // include(1) + mx(1) + a(1) = 3
    expect(result.lookups_used).toBe(3);
  });

  it("warns on softfail ~all", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=spf1 ~all"],
      raw: "v=spf1 ~all",
    });

    const result = await analyzeSpf("example.com");
    expect(result.validations.some((v) => v.message.includes("softfail"))).toBe(true);
  });
});
