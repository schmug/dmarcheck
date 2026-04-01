import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn(),
  queryMx: vi.fn(),
}));

import { analyzeBimi } from "../src/analyzers/bimi.js";
import { queryTxt } from "../src/dns/client.js";

const mockQueryTxt = vi.mocked(queryTxt);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("analyzeBimi", () => {
  it("returns warn when no BIMI record found", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeBimi("example.com", "reject");
    expect(result.status).toBe("warn");
    expect(result.record).toBeNull();
    expect(result.tags).toBeNull();
    expect(
      result.validations.some((v) => v.message.includes("No BIMI record")),
    ).toBe(true);
  });

  it("shows DMARC policy pass when no record but policy is reject", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeBimi("example.com", "reject");
    expect(
      result.validations.some(
        (v) =>
          v.status === "pass" &&
          v.message.includes("DMARC policy meets BIMI requirement"),
      ),
    ).toBe(true);
  });

  it("shows DMARC policy pass when no record but policy is quarantine", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeBimi("example.com", "quarantine");
    expect(
      result.validations.some(
        (v) =>
          v.status === "pass" &&
          v.message.includes("DMARC policy meets BIMI requirement"),
      ),
    ).toBe(true);
  });

  it("warns about DMARC policy when no record and policy is none", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeBimi("example.com", "none");
    expect(
      result.validations.some(
        (v) => v.status === "warn" && v.message.includes("BIMI requires"),
      ),
    ).toBe(true);
  });

  it("warns about DMARC policy when no record and policy is null", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeBimi("example.com", null);
    expect(
      result.validations.some(
        (v) => v.status === "warn" && v.message.includes("BIMI requires"),
      ),
    ).toBe(true);
  });

  it("parses valid BIMI record with logo and authority", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: [
        "v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem",
      ],
      raw: "v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem",
    });

    const result = await analyzeBimi("example.com", "reject");
    expect(result.status).toBe("pass");
    expect(result.tags?.l).toBe("https://example.com/logo.svg");
    expect(result.tags?.a).toBe("https://example.com/vmc.pem");
    expect(
      result.validations.some((v) => v.message.includes("BIMI record found")),
    ).toBe(true);
    expect(
      result.validations.some(
        (v) => v.message.includes("Logo URL") && v.message.includes("HTTPS"),
      ),
    ).toBe(true);
    expect(
      result.validations.some((v) => v.message.includes("Authority evidence")),
    ).toBe(true);
  });

  it("warns when logo URL does not use HTTPS", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=BIMI1; l=http://example.com/logo.svg"],
      raw: "v=BIMI1; l=http://example.com/logo.svg",
    });

    const result = await analyzeBimi("example.com", "reject");
    expect(
      result.validations.some(
        (v) => v.status === "warn" && v.message.includes("should use HTTPS"),
      ),
    ).toBe(true);
  });

  it("warns when no logo URL specified", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=BIMI1"],
      raw: "v=BIMI1",
    });

    const result = await analyzeBimi("example.com", "reject");
    expect(
      result.validations.some(
        (v) => v.status === "warn" && v.message.includes("No logo URL"),
      ),
    ).toBe(true);
  });

  it("fails when DMARC policy is none with BIMI record present", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=BIMI1; l=https://example.com/logo.svg"],
      raw: "v=BIMI1; l=https://example.com/logo.svg",
    });

    const result = await analyzeBimi("example.com", "none");
    expect(
      result.validations.some(
        (v) =>
          v.status === "fail" && v.message.includes("DMARC policy must be"),
      ),
    ).toBe(true);
  });

  it("fails when DMARC policy is null with BIMI record present", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=BIMI1; l=https://example.com/logo.svg"],
      raw: "v=BIMI1; l=https://example.com/logo.svg",
    });

    const result = await analyzeBimi("example.com", null);
    expect(
      result.validations.some(
        (v) =>
          v.status === "fail" && v.message.includes("DMARC policy must be"),
      ),
    ).toBe(true);
  });

  it("handles TXT record that exists but is not valid BIMI", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["some random text record"],
      raw: "some random text record",
    });

    const result = await analyzeBimi("example.com", "reject");
    expect(result.status).toBe("warn");
    expect(
      result.validations.some((v) =>
        v.message.includes("not a valid BIMI record"),
      ),
    ).toBe(true);
  });

  it("returns pass status when all checks pass", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: [
        "v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem",
      ],
      raw: "v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem",
    });

    const result = await analyzeBimi("example.com", "reject");
    expect(result.status).toBe("pass");
  });
});
