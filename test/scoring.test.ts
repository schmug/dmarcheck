import { describe, expect, it } from "vitest";
import type {
  BimiResult,
  DkimResult,
  DmarcResult,
  MtaStsResult,
  SpfResult,
} from "../src/analyzers/types.js";
import { computeGrade, computeGradeBreakdown } from "../src/shared/scoring.js";

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
        policy: {
          version: "STSv1",
          mode: "enforce",
          mx: ["*.example.com"],
          max_age: 86400,
        },
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
        policy: {
          version: "STSv1",
          mode: "testing",
          mx: ["*.example.com"],
          max_age: 86400,
        },
      }),
    });
    // A tier: SPF +1 + DKIM weak(-1) + no ≥2 selectors(0) + testing MTA-STS(-1) → -1 → A-
    expect(grade).toBe("A-");
  });
});

describe("computeGradeBreakdown", () => {
  it("grade matches computeGrade for every tier", () => {
    const cases = [
      // F
      {
        dmarc: makeDmarc({ status: "fail", tags: null }),
        spf: makeSpf(),
        dkim: makeDkim(),
        bimi: makeBimi(),
        mta_sts: makeMtaSts(),
      },
      // D
      {
        dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
        spf: makeSpf({ status: "fail" }),
        dkim: makeDkim(),
        bimi: makeBimi(),
        mta_sts: makeMtaSts(),
      },
      // D+
      {
        dmarc: makeDmarc(),
        spf: makeSpf({ status: "fail" }),
        dkim: makeDkim(),
        bimi: makeBimi(),
        mta_sts: makeMtaSts(),
      },
      // C
      {
        dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
        spf: makeSpf(),
        dkim: makeDkim(),
        bimi: makeBimi(),
        mta_sts: makeMtaSts(),
      },
      // B
      {
        dmarc: makeDmarc(),
        spf: makeSpf({ record: "v=spf1 ~all" }),
        dkim: makeDkim(),
        bimi: makeBimi(),
        mta_sts: makeMtaSts(),
      },
      // A+
      {
        dmarc: makeDmarc(),
        spf: makeSpf(),
        dkim: makeDkim(),
        bimi: makeBimi({ status: "pass" }),
        mta_sts: makeMtaSts({
          status: "pass",
          policy: {
            version: "STSv1",
            mode: "enforce",
            mx: ["mx.example.com"],
            max_age: 86400,
          },
        }),
      },
    ];
    for (const protocols of cases) {
      const breakdown = computeGradeBreakdown(protocols);
      expect(breakdown.grade).toBe(computeGrade(protocols));
    }
  });

  it("returns correct tier for F grade", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc({ status: "fail", tags: null }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(bd.tier).toBe("F");
    expect(bd.factors).toHaveLength(0);
  });

  it("returns correct tier for C grade", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(bd.tier).toBe("C");
    expect(bd.tierReason).toContain("quarantine");
  });

  it("returns correct tier for A+ grade", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc(),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi({ status: "pass" }),
      mta_sts: makeMtaSts({
        status: "pass",
        policy: {
          version: "STSv1",
          mode: "enforce",
          mx: ["mx.example.com"],
          max_age: 86400,
        },
      }),
    });
    expect(bd.tier).toBe("A+");
    expect(bd.grade).toBe("A+");
    expect(bd.tierReason).toContain("perfect");
  });

  it("collects SPF factors", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf({ record: "v=spf1 ~all", lookups_used: 9 }),
      dkim: makeDkim({
        selectors: { s1: { found: true, key_type: "rsa", key_bits: 2048 } },
      }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    const spfFactors = bd.factors.filter((f) => f.protocol === "spf");
    expect(spfFactors.length).toBe(2); // ~all and >8 lookups
    expect(spfFactors.every((f) => f.effect === -1)).toBe(true);
  });

  it("collects DKIM factors", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf({ record: "v=spf1 ip4:10.0.0.0/24", lookups_used: 3 }),
      dkim: makeDkim({
        selectors: {
          google: { found: true, key_type: "rsa", key_bits: 1024 },
          selector1: { found: true, key_type: "rsa", key_bits: 2048 },
        },
      }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    const dkimFactors = bd.factors.filter((f) => f.protocol === "dkim");
    expect(dkimFactors.length).toBe(2); // weak key and ≥2 selectors
    expect(dkimFactors.find((f) => f.effect === -1)?.label).toContain("2048");
    expect(dkimFactors.find((f) => f.effect === 1)?.label).toContain(
      "selectors",
    );
  });

  it("generates P1 recommendation for F grade", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "none" } }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(bd.recommendations.length).toBeGreaterThan(0);
    expect(bd.recommendations[0].priority).toBe(1);
    expect(bd.recommendations[0].protocol).toBe("dmarc");
  });

  it("generates upgrade recommendation for C tier", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    const upgradeRec = bd.recommendations.find(
      (r) => r.protocol === "dmarc" && r.priority === 1,
    );
    expect(upgradeRec).toBeDefined();
    expect(upgradeRec?.title).toContain("reject");
  });

  it("generates no recommendations for A+", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc(),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi({ status: "pass" }),
      mta_sts: makeMtaSts({
        status: "pass",
        policy: {
          version: "STSv1",
          mode: "enforce",
          mx: ["mx.example.com"],
          max_age: 86400,
        },
      }),
    });
    expect(bd.recommendations).toHaveLength(0);
  });

  it("includes protocol summaries for all 5 protocols", () => {
    const bd = computeGradeBreakdown({
      dmarc: makeDmarc(),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(Object.keys(bd.protocolSummaries)).toEqual(
      expect.arrayContaining(["dmarc", "spf", "dkim", "bimi", "mta_sts"]),
    );
    expect(bd.protocolSummaries.dmarc.summary).toContain("reject");
  });

  it("sets modifierLabel correctly", () => {
    const bdPlus = computeGradeBreakdown({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf(),
      dkim: makeDkim(),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    // SPF +1 + DKIM ≥2 selectors +1 → modifier ≥1 → "+"
    expect(bdPlus.modifierLabel).toBe("+");

    const bdMinus = computeGradeBreakdown({
      dmarc: makeDmarc({ tags: { v: "DMARC1", p: "quarantine" } }),
      spf: makeSpf({ record: "v=spf1 ~all" }),
      dkim: makeDkim({
        selectors: { s1: { found: true, key_type: "rsa", key_bits: 1024 } },
      }),
      bimi: makeBimi(),
      mta_sts: makeMtaSts(),
    });
    expect(bdMinus.modifierLabel).toBe("−");
  });
});
