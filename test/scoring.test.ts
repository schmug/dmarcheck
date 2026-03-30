import { describe, it, expect } from "vitest";
import { computeGrade } from "../src/shared/scoring.js";
import type {
  DmarcResult,
  SpfResult,
  DkimResult,
  BimiResult,
  MtaStsResult,
} from "../src/analyzers/types.js";

function makeDmarc(overrides: Partial<DmarcResult> = {}): DmarcResult {
  return {
    status: "pass",
    record: "v=DMARC1; p=reject",
    tags: { v: "DMARC1", p: "reject" },
    validations: [],
    ...overrides,
  };
}

function makeSpf(overrides: Partial<SpfResult> = {}): SpfResult {
  return {
    status: "pass",
    record: "v=spf1 -all",
    lookups_used: 3,
    lookup_limit: 10,
    include_tree: null,
    validations: [],
    ...overrides,
  };
}

function makeDkim(overrides: Partial<DkimResult> = {}): DkimResult {
  return {
    status: "pass",
    selectors: {
      google: { found: true, key_type: "rsa", key_bits: 2048 },
      selector1: { found: true, key_type: "rsa", key_bits: 2048 },
    },
    validations: [],
    ...overrides,
  };
}

function makeBimi(overrides: Partial<BimiResult> = {}): BimiResult {
  return {
    status: "warn",
    record: null,
    tags: null,
    validations: [],
    ...overrides,
  };
}

function makeMtaSts(overrides: Partial<MtaStsResult> = {}): MtaStsResult {
  return {
    status: "fail",
    dns_record: null,
    policy: null,
    validations: [],
    ...overrides,
  };
}

describe("computeGrade", () => {
  it("returns F when no DMARC record", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ status: "fail", tags: null }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade).toBe("F");
  });

  it("returns F when DMARC policy is none", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "none" } }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade).toBe("F");
  });

  it("returns D when quarantine but missing SPF", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf({ status: "fail" }),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade).toBe("D");
  });

  it("returns C-range when quarantine with SPF + DKIM", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade.charAt(0)).toBe("C");
  });

  it("returns B-range when reject with SPF + DKIM", () => {
    const grade = computeGrade({
      dmarc: makeDmarc(),
      spf: makeSpf({ record: "v=spf1 ~all" }),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade.charAt(0)).toBe("B");
  });

  it("returns A+ when all protocols fully configured", () => {
    const grade = computeGrade({
      dmarc: makeDmarc(),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi({ status: "pass" }),
      mta_sts: makeMtaSts({
        status: "pass",
        policy: { version: "STSv1", mode: "enforce", mx: ["*.example.com"], max_age: 86400 },
      }),
    });
    expect(grade).toBe("A+");
  });
});
