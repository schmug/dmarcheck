import { describe, expect, it } from "vitest";
import {
  detectGradeDrop,
  detectProtocolRegressions,
  gradeRank,
} from "../src/alerts/detector.js";

describe("gradeRank", () => {
  it("ranks S highest", () => {
    expect(gradeRank("S")).toBeGreaterThan(gradeRank("A+"));
  });

  it("ranks A+ above A above A-", () => {
    expect(gradeRank("A+")).toBeGreaterThan(gradeRank("A"));
    expect(gradeRank("A")).toBeGreaterThan(gradeRank("A-"));
  });

  it("ranks F lowest", () => {
    expect(gradeRank("F")).toBe(0);
  });

  it("returns -1 for unknown or missing grades", () => {
    expect(gradeRank(null)).toBe(-1);
    expect(gradeRank(undefined)).toBe(-1);
    expect(gradeRank("Z")).toBe(-1);
    expect(gradeRank("")).toBe(-1);
  });
});

describe("detectGradeDrop", () => {
  it("returns null when previous grade is null (first scan)", () => {
    expect(detectGradeDrop(null, "A")).toBeNull();
    expect(detectGradeDrop(undefined, "A")).toBeNull();
  });

  it("returns null when grade is unchanged", () => {
    expect(detectGradeDrop("B", "B")).toBeNull();
  });

  it("returns null when grade improves", () => {
    expect(detectGradeDrop("B", "A")).toBeNull();
    expect(detectGradeDrop("F", "D")).toBeNull();
    expect(detectGradeDrop("A", "A+")).toBeNull();
  });

  it("flags a drop across letter tiers", () => {
    const alert = detectGradeDrop("A", "B");
    expect(alert).toEqual({
      type: "grade_drop",
      previousValue: "A",
      newValue: "B",
    });
  });

  it("flags a drop within a letter tier (A+ → A)", () => {
    expect(detectGradeDrop("A+", "A")).toEqual({
      type: "grade_drop",
      previousValue: "A+",
      newValue: "A",
    });
  });

  it("flags a drop from S all the way down to F", () => {
    const alert = detectGradeDrop("S", "F");
    expect(alert?.type).toBe("grade_drop");
  });

  it("returns null when one side is unknown", () => {
    expect(detectGradeDrop("A", "Z")).toBeNull();
    expect(detectGradeDrop("Q", "F")).toBeNull();
  });
});

describe("detectProtocolRegressions", () => {
  it("returns [] when previous is missing", () => {
    expect(
      detectProtocolRegressions(null, { dmarc: "pass", spf: "pass" }),
    ).toEqual([]);
  });

  it("returns [] when nothing changed", () => {
    expect(
      detectProtocolRegressions(
        { dmarc: "pass", spf: "warn", dkim: "pass" },
        { dmarc: "pass", spf: "warn", dkim: "pass" },
      ),
    ).toEqual([]);
  });

  it("returns [] when protocols improved", () => {
    expect(
      detectProtocolRegressions(
        { dmarc: "warn", spf: "fail" },
        { dmarc: "pass", spf: "pass" },
      ),
    ).toEqual([]);
  });

  it("flags pass → fail as a regression", () => {
    const regressions = detectProtocolRegressions(
      { dmarc: "pass" },
      { dmarc: "fail" },
    );
    expect(regressions).toHaveLength(1);
    expect(regressions[0]).toEqual({
      type: "protocol_regression",
      previousValue: "dmarc:pass",
      newValue: "dmarc:fail",
    });
  });

  it("flags pass → warn and warn → fail", () => {
    const regressions = detectProtocolRegressions(
      { dmarc: "pass", spf: "warn" },
      { dmarc: "warn", spf: "fail" },
    );
    expect(regressions.map((r) => r.previousValue)).toEqual([
      "dmarc:pass",
      "spf:warn",
    ]);
  });

  it("returns regressions in canonical protocol order", () => {
    const regressions = detectProtocolRegressions(
      { mta_sts: "pass", dmarc: "pass" },
      { mta_sts: "fail", dmarc: "fail" },
    );
    expect(regressions.map((r) => r.previousValue.split(":")[0])).toEqual([
      "dmarc",
      "mta_sts",
    ]);
  });

  it("ignores MX (informational, not scored)", () => {
    const regressions = detectProtocolRegressions(
      { dmarc: "pass" } as Record<string, string>,
      { dmarc: "pass" } as Record<string, string>,
    );
    expect(regressions).toEqual([]);
  });

  it("ignores unknown status values", () => {
    const regressions = detectProtocolRegressions(
      { dmarc: "weird" },
      { dmarc: "fail" },
    );
    expect(regressions).toEqual([]);
  });
});
