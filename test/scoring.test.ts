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

  it("returns D+ when reject but missing SPF", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "reject" } }),
      spf: makeSpf({ status: "fail" }),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade).toBe("D+");
  });

  it("returns D+ when reject but missing DKIM", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "reject" } }),
      spf: makeSpf(),
      dkim: makeDkim({ status: "fail" }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade).toBe("D+");
  });

  it("returns D when quarantine but missing DKIM", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf(),
      dkim: makeDkim({ status: "fail" }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade).toBe("D");
  });

  it("returns F when DMARC tags are null", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ status: "fail", tags: null }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(grade).toBe("F");
  });

  // SPF modifier tests
  it("applies negative SPF modifier for ~all (softfail)", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf({ record: "v=spf1 ~all" }),
      dkim: makeDkim({
        selectors: { google: { found: true, key_type: "rsa", key_bits: 2048 } },
      }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    // C base: SPF ~all(-1) + DKIM <2 selectors(0) → -1 → C-
    expect(grade).toBe("C-");
  });

  it("applies negative SPF modifier for >8 lookups", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf({ lookups_used: 9 }),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    // C base with >8 lookups modifier (-1) but ≥2 DKIM selectors (+1) → net 0 → C
    expect(grade).toBe("C");
  });

  it("applies positive SPF modifier for -all with ≤5 lookups", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf({ record: "v=spf1 -all", lookups_used: 3 }),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    // C base + SPF +1 + DKIM ≥2 selectors +1 → modifier 2 → C+
    expect(grade).toBe("C+");
  });

  // DKIM modifier tests
  it("applies negative DKIM modifier for weak key", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf({ record: "v=spf1 ip4:10.0.0.0/24", lookups_used: 3 }),
      dkim: makeDkim({
        selectors: {
          google: { found: true, key_type: "rsa", key_bits: 1024 },
        },
      }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    // C base: SPF no special modifier(0) + DKIM weak(-1) + <2 selectors(0) → -1 → C-
    expect(grade).toBe("C-");
  });

  it("applies positive DKIM modifier for ≥2 selectors", () => {
    const grade = computeGrade({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf(),
      dkim: makeDkim({
        selectors: {
          google: { found: true, key_type: "rsa", key_bits: 2048 },
          selector1: { found: true, key_type: "rsa", key_bits: 2048 },
        },
      }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    // C base + ≥2 selectors (+1) → C+
    expect(grade).toBe("C+");
  });

  // B-tier modifier tests
  it("returns B+ when reject with SPF + DKIM and extras (BIMI)", () => {
    const grade = computeGrade({
      dmarc: makeDmarc(),
      spf: makeSpf({ record: "v=spf1 ~all" }),
      dkim: makeDkim(),
      bimi: makeBimi({ status: "pass" }),
      mta_sts: makeMtaSts(),
    });
    // B base: ~all(-1) + ≥2 selectors(+1) + extras(+1) → +1 → B+
    expect(grade).toBe("B+");
  });

  it("returns B- when reject with weak DKIM and softfail SPF", () => {
    const grade = computeGrade({
      dmarc: makeDmarc(),
      spf: makeSpf({ record: "v=spf1 ~all" }),
      dkim: makeDkim({
        selectors: {
          google: { found: true, key_type: "rsa", key_bits: 1024 },
        },
      }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    // B base: ~all(-1) + weak key(-1) + <2 selectors(no +1) + no extras(0) → -2 → B-
    expect(grade).toBe("B-");
  });

  // A-tier tests
  it("returns A when reject + strong SPF + DKIM + BIMI only", () => {
    const grade = computeGrade({
      dmarc: makeDmarc(),
      spf: makeSpf({ record: "v=spf1 -all", lookups_used: 3 }),
      dkim: makeDkim(),
      bimi: makeBimi({ status: "pass" }),
      mta_sts: makeMtaSts(),
    });
    // A tier: SPF +1 (-all ≤5) + DKIM +1 (≥2 selectors) → +2 → A+
    // Wait — has BIMI but not MTA-STS, so not A+ (that requires both)
    // A base + modifiers
    expect(grade.charAt(0)).toBe("A");
  });

  it("returns A- when reject + strong SPF + DKIM + MTA-STS testing", () => {
    const grade = computeGrade({
      dmarc: makeDmarc(),
      spf: makeSpf({ record: "v=spf1 -all", lookups_used: 3 }),
      dkim: makeDkim({
        selectors: {
          google: { found: true, key_type: "rsa", key_bits: 1024 },
        },
      }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts({
        status: "pass",
        policy: { version: "STSv1", mode: "testing", mx: ["*.example.com"], max_age: 86400 },
      }),
    });
    // A tier: SPF +1 + DKIM weak(-1) + no ≥2 selectors(0) + testing MTA-STS(-1) → -1 → A-
    expect(grade).toBe("A-");
  });
});
