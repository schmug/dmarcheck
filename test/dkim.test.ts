import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn(),
  queryMx: vi.fn(),
}));

import { queryTxt } from "../src/dns/client.js";
import { analyzeDkim } from "../src/analyzers/dkim.js";

const mockQueryTxt = vi.mocked(queryTxt);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("analyzeDkim", () => {
  it("returns fail when no selectors found", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeDkim("example.com");
    expect(result.status).toBe("fail");
    expect(result.validations.some((v) => v.status === "fail" && v.message.includes("No DKIM selectors found"))).toBe(true);
  });

  it("finds a single DKIM selector with RSA 2048 key", async () => {
    // All common selectors return null except "google"
    mockQueryTxt.mockImplementation(async (name: string) => {
      if (name === "google._domainkey.example.com") {
        // RSA 2048-bit key = 256 bytes decoded = ~344 base64 chars
        const fakeKey = btoa("x".repeat(256));
        return {
          entries: [`v=DKIM1; k=rsa; p=${fakeKey}`],
          raw: `v=DKIM1; k=rsa; p=${fakeKey}`,
        };
      }
      return null;
    });

    const result = await analyzeDkim("example.com");
    expect(result.status).toBe("pass");
    expect(result.selectors["google"].found).toBe(true);
    expect(result.selectors["google"].key_type).toBe("rsa");
    expect(result.selectors["google"].key_bits).toBe(2048);
    expect(result.validations.some((v) => v.message.includes("1 DKIM selector found"))).toBe(true);
  });

  it("detects weak key under 2048 bits", async () => {
    mockQueryTxt.mockImplementation(async (name: string) => {
      if (name === "google._domainkey.example.com") {
        // RSA 1024-bit key = 128 bytes decoded
        const fakeKey = btoa("x".repeat(128));
        return {
          entries: [`v=DKIM1; k=rsa; p=${fakeKey}`],
          raw: `v=DKIM1; k=rsa; p=${fakeKey}`,
        };
      }
      return null;
    });

    const result = await analyzeDkim("example.com");
    expect(result.status).toBe("warn");
    expect(result.selectors["google"].key_bits).toBe(1024);
    expect(result.validations.some((v) => v.status === "warn" && v.message.includes("under 2048 bits"))).toBe(true);
  });

  it("detects revoked key (empty p= tag)", async () => {
    mockQueryTxt.mockImplementation(async (name: string) => {
      if (name === "google._domainkey.example.com") {
        return {
          entries: ["v=DKIM1; k=rsa; p="],
          raw: "v=DKIM1; k=rsa; p=",
        };
      }
      return null;
    });

    const result = await analyzeDkim("example.com");
    expect(result.selectors["google"].found).toBe(true);
    expect(result.selectors["google"].revoked).toBe(true);
    expect(result.validations.some((v) => v.status === "warn" && v.message.includes("revoked"))).toBe(true);
  });

  it("detects testing mode (t=y)", async () => {
    mockQueryTxt.mockImplementation(async (name: string) => {
      if (name === "google._domainkey.example.com") {
        const fakeKey = btoa("x".repeat(256));
        return {
          entries: [`v=DKIM1; k=rsa; t=y; p=${fakeKey}`],
          raw: `v=DKIM1; k=rsa; t=y; p=${fakeKey}`,
        };
      }
      return null;
    });

    const result = await analyzeDkim("example.com");
    expect(result.selectors["google"].testing).toBe(true);
    expect(result.validations.some((v) => v.status === "warn" && v.message.includes("testing mode"))).toBe(true);
  });

  it("merges custom selectors with common selectors (deduplication)", async () => {
    mockQueryTxt.mockImplementation(async (name: string) => {
      if (name === "myselector._domainkey.example.com") {
        const fakeKey = btoa("x".repeat(256));
        return {
          entries: [`v=DKIM1; p=${fakeKey}`],
          raw: `v=DKIM1; p=${fakeKey}`,
        };
      }
      return null;
    });

    const result = await analyzeDkim("example.com", ["myselector", "google"]);
    // "google" is in common selectors, should be deduplicated
    expect(result.selectors["myselector"]).toBeDefined();
    expect(result.selectors["myselector"].found).toBe(true);
    expect(result.selectors["google"]).toBeDefined();
  });

  it("reports multiple selectors found with plural message", async () => {
    mockQueryTxt.mockImplementation(async (name: string) => {
      if (name === "google._domainkey.example.com" || name === "selector1._domainkey.example.com") {
        const fakeKey = btoa("x".repeat(256));
        return {
          entries: [`v=DKIM1; k=rsa; p=${fakeKey}`],
          raw: `v=DKIM1; k=rsa; p=${fakeKey}`,
        };
      }
      return null;
    });

    const result = await analyzeDkim("example.com");
    expect(result.status).toBe("pass");
    expect(result.validations.some((v) => v.message.includes("2 DKIM selectors found"))).toBe(true);
  });

  it("handles rejected promise from queryTxt gracefully", async () => {
    mockQueryTxt.mockRejectedValue(new Error("DNS timeout"));
    const result = await analyzeDkim("example.com");
    // All selectors should be { found: false } due to Promise.allSettled
    const allNotFound = Object.values(result.selectors).every((s) => !s.found);
    expect(allNotFound).toBe(true);
    expect(result.status).toBe("fail");
  });

  it("finds Cloudflare Email Routing selector (cf2024-1)", async () => {
    mockQueryTxt.mockImplementation(async (name: string) => {
      if (name === "cf2024-1._domainkey.example.com") {
        const fakeKey = btoa("x".repeat(256));
        return {
          entries: [`v=DKIM1; k=rsa; p=${fakeKey}`],
          raw: `v=DKIM1; k=rsa; p=${fakeKey}`,
        };
      }
      return null;
    });

    const result = await analyzeDkim("example.com");
    expect(result.status).toBe("pass");
    expect(result.selectors["cf2024-1"].found).toBe(true);
    expect(result.selectors["cf2024-1"].key_bits).toBe(2048);
  });

  it("defaults key_type to rsa when k= tag is absent", async () => {
    mockQueryTxt.mockImplementation(async (name: string) => {
      if (name === "google._domainkey.example.com") {
        const fakeKey = btoa("x".repeat(256));
        return {
          entries: [`v=DKIM1; p=${fakeKey}`],
          raw: `v=DKIM1; p=${fakeKey}`,
        };
      }
      return null;
    });

    const result = await analyzeDkim("example.com");
    expect(result.selectors["google"].key_type).toBe("rsa");
  });
});
