import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn(),
  queryMx: vi.fn(),
}));

import { analyzeMtaSts } from "../src/analyzers/mta-sts.js";
import { queryTxt } from "../src/dns/client.js";

const mockQueryTxt = vi.mocked(queryTxt);

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

function mockFetchPolicy(body: string | null, ok = true) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    body === null
      ? ({ ok: false, text: async () => "" } as Response)
      : ({ ok, text: async () => body } as Response),
  );
}

function mockFetchError() {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
}

const validPolicy = `version: STSv1
mode: enforce
mx: *.example.com
mx: mail.example.com
max_age: 86400`;

describe("analyzeMtaSts", () => {
  it("returns fail when no DNS record and no policy file", async () => {
    mockQueryTxt.mockResolvedValue(null);
    mockFetchError();

    const result = await analyzeMtaSts("example.com");
    expect(result.status).toBe("fail");
    expect(result.dns_record).toBeNull();
    expect(result.policy).toBeNull();
    expect(
      result.validations.some(
        (v) =>
          v.status === "fail" && v.message.includes("No _mta-sts TXT record"),
      ),
    ).toBe(true);
    expect(
      result.validations.some(
        (v) =>
          v.status === "fail" &&
          v.message.includes("Policy file not accessible"),
      ),
    ).toBe(true);
  });

  it("passes when DNS record found with v=STSv1", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(validPolicy);

    const result = await analyzeMtaSts("example.com");
    expect(result.dns_record).toBe("v=STSv1; id=20240101");
    expect(
      result.validations.some(
        (v) =>
          v.status === "pass" && v.message.includes("MTA-STS DNS record found"),
      ),
    ).toBe(true);
  });

  it("fails when TXT record exists but missing v=STSv1", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["some other txt record"],
      raw: "some other txt record",
    });
    mockFetchPolicy(validPolicy);

    const result = await analyzeMtaSts("example.com");
    expect(result.dns_record).toBeNull();
    expect(
      result.validations.some(
        (v) => v.status === "fail" && v.message.includes("missing v=STSv1"),
      ),
    ).toBe(true);
  });

  it("detects enforce mode as pass", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(validPolicy);

    const result = await analyzeMtaSts("example.com");
    expect(result.policy?.mode).toBe("enforce");
    expect(
      result.validations.some(
        (v) => v.status === "pass" && v.message.includes("enforce"),
      ),
    ).toBe(true);
  });

  it("warns on testing mode", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(
      `version: STSv1\nmode: testing\nmx: *.example.com\nmax_age: 86400`,
    );

    const result = await analyzeMtaSts("example.com");
    expect(result.policy?.mode).toBe("testing");
    expect(
      result.validations.some(
        (v) => v.status === "warn" && v.message.includes("testing"),
      ),
    ).toBe(true);
  });

  it("warns on none mode", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(
      `version: STSv1\nmode: none\nmx: *.example.com\nmax_age: 86400`,
    );

    const result = await analyzeMtaSts("example.com");
    expect(result.policy?.mode).toBe("none");
    expect(
      result.validations.some(
        (v) => v.status === "warn" && v.message.includes("none"),
      ),
    ).toBe(true);
  });

  it("warns on low max_age (less than 1 day)", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(
      `version: STSv1\nmode: enforce\nmx: *.example.com\nmax_age: 3600`,
    );

    const result = await analyzeMtaSts("example.com");
    expect(result.policy?.max_age).toBe(3600);
    expect(
      result.validations.some(
        (v) => v.status === "warn" && v.message.includes("max_age"),
      ),
    ).toBe(true);
  });

  it("warns when no MX patterns in policy", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(`version: STSv1\nmode: enforce\nmax_age: 86400`);

    const result = await analyzeMtaSts("example.com");
    expect(result.policy?.mx).toEqual([]);
    expect(
      result.validations.some(
        (v) => v.status === "warn" && v.message.includes("No MX patterns"),
      ),
    ).toBe(true);
  });

  it("handles fetch failure gracefully", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchError();

    const result = await analyzeMtaSts("example.com");
    expect(result.policy).toBeNull();
    expect(
      result.validations.some(
        (v) =>
          v.status === "fail" &&
          v.message.includes("Policy file not accessible"),
      ),
    ).toBe(true);
  });

  it("handles redirect as error per RFC 8461", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("redirect mode is set to error"),
    );

    const result = await analyzeMtaSts("example.com");
    expect(result.policy).toBeNull();
    expect(
      result.validations.some(
        (v) =>
          v.status === "fail" &&
          v.message.includes("Policy file not accessible"),
      ),
    ).toBe(true);
  });

  it("handles non-ok HTTP response gracefully", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(null);

    const result = await analyzeMtaSts("example.com");
    expect(result.policy).toBeNull();
  });

  it("parses policy with multiple MX entries", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(validPolicy);

    const result = await analyzeMtaSts("example.com");
    expect(result.policy?.mx).toEqual(["*.example.com", "mail.example.com"]);
    expect(result.policy?.version).toBe("STSv1");
    expect(result.policy?.max_age).toBe(86400);
  });

  it("returns pass status when DNS and policy are both valid with enforce mode", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=STSv1; id=20240101"],
      raw: "v=STSv1; id=20240101",
    });
    mockFetchPolicy(validPolicy);

    const result = await analyzeMtaSts("example.com");
    expect(result.status).toBe("pass");
  });
});
