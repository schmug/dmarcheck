import { describe, it, expect } from "vitest";
import { escapeCsvField, generateCsv } from "../src/csv.js";
import type { ScanResult } from "../src/analyzers/types.js";
import type { GradeBreakdown } from "../src/shared/scoring.js";

function makeScanResult(
  overrides: Partial<ScanResult> = {},
): ScanResult {
  return {
    domain: "example.com",
    timestamp: "2026-03-31T12:00:00.000Z",
    grade: "B",
    breakdown: {
      grade: "B",
      tier: "B",
      tierReason: "p=reject with SPF and DKIM passing",
      modifier: 0,
      modifierLabel: "",
      factors: [],
      recommendations: [
        {
          priority: 2,
          protocol: "spf",
          title: "Switch SPF from ~all to -all",
          description: "desc",
          impact: "Removes a scoring penalty",
        },
        {
          priority: 3,
          protocol: "bimi",
          title: "Add a BIMI record",
          description: "desc",
          impact: "Path to A tier",
        },
      ],
      protocolSummaries: {},
    } as GradeBreakdown,
    summary: {
      dmarc_policy: "reject",
      spf_result: "pass",
      spf_lookups: "3/10",
      dkim_selectors_found: 1,
      bimi_enabled: false,
      mta_sts_mode: null,
    },
    protocols: {
      dmarc: {
        status: "pass",
        record: "v=DMARC1; p=reject",
        tags: { v: "DMARC1", p: "reject" },
        validations: [
          { status: "pass", message: "DMARC record found" },
          { status: "pass", message: "Policy set to reject" },
        ],
      },
      spf: {
        status: "pass",
        record: "v=spf1 include:_spf.google.com ~all",
        lookups_used: 3,
        lookup_limit: 10,
        include_tree: null,
        validations: [
          { status: "pass", message: "SPF record found" },
          { status: "warn", message: "Uses ~all (softfail)" },
        ],
      },
      dkim: {
        status: "pass",
        selectors: {
          google: { found: true, key_type: "rsa", key_bits: 2048 },
          selector1: { found: false },
        },
        validations: [
          { status: "pass", message: "DKIM selector found: google" },
        ],
      },
      bimi: {
        status: "fail",
        record: null,
        tags: null,
        validations: [],
      },
      mta_sts: {
        status: "fail",
        dns_record: null,
        policy: null,
        validations: [],
      },
    },
    ...overrides,
  };
}

describe("escapeCsvField", () => {
  it("returns plain string unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("wraps field containing comma in double quotes", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("wraps field containing double quote and escapes it", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps field containing newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps field containing carriage return", () => {
    expect(escapeCsvField("a\rb")).toBe('"a\rb"');
  });

  it("handles empty string", () => {
    expect(escapeCsvField("")).toBe("");
  });
});

describe("generateCsv", () => {
  it("starts with UTF-8 BOM", () => {
    const csv = generateCsv(makeScanResult());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("has correct header row", () => {
    const csv = generateCsv(makeScanResult());
    const header = csv.split("\r\n")[0].replace("\uFEFF", "");
    expect(header).toBe(
      "Domain,Grade,Timestamp,Protocol,Status,Findings,Recommendations,Raw Record",
    );
  });

  it("produces 5 data rows (one per protocol)", () => {
    const csv = generateCsv(makeScanResult());
    const lines = csv.trim().split("\r\n");
    // header + 5 protocol rows
    expect(lines).toHaveLength(6);
  });

  it("uses CRLF line endings per RFC 4180", () => {
    const csv = generateCsv(makeScanResult());
    // Every line break should be \r\n
    const withoutBom = csv.replace("\uFEFF", "");
    expect(withoutBom).not.toMatch(/[^\r]\n/);
  });

  it("includes correct protocol names in order", () => {
    const csv = generateCsv(makeScanResult());
    const lines = csv.trim().split("\r\n").slice(1); // skip header
    const protocols = lines.map((l) => l.split(",")[3]);
    expect(protocols).toEqual([
      "DMARC",
      "SPF",
      "DKIM",
      "BIMI",
      "MTA-STS",
    ]);
  });

  it("formats findings with status prefix and semicolons", () => {
    const csv = generateCsv(makeScanResult());
    const lines = csv.trim().split("\r\n");
    // DMARC row (index 1) has 2 validations
    const dmarcRow = lines[1];
    expect(dmarcRow).toContain("[pass] DMARC record found");
    expect(dmarcRow).toContain("[pass] Policy set to reject");
  });

  it("filters recommendations by protocol", () => {
    const csv = generateCsv(makeScanResult());
    const lines = csv.trim().split("\r\n");
    // SPF row (index 2) should have the SPF recommendation
    const spfRow = lines[2];
    expect(spfRow).toContain("[P2] Switch SPF from ~all to -all");
    // BIMI row (index 4) should have the BIMI recommendation
    const bimiRow = lines[4];
    expect(bimiRow).toContain("[P3] Add a BIMI record");
    // DMARC row (index 1) should have no recommendations
    const dmarcRow = lines[1];
    // Recommendations field is 7th (index 6), should be empty
    // Parse carefully — just check it doesn't contain [P
    expect(dmarcRow).not.toContain("[P1]");
    expect(dmarcRow).not.toContain("[P2]");
    expect(dmarcRow).not.toContain("[P3]");
  });

  it("shows DKIM selector summary as raw record", () => {
    const csv = generateCsv(makeScanResult());
    const lines = csv.trim().split("\r\n");
    const dkimRow = lines[3];
    expect(dkimRow).toContain("google: rsa/2048bit");
  });

  it("handles null raw records as empty", () => {
    const csv = generateCsv(makeScanResult());
    const lines = csv.trim().split("\r\n");
    // BIMI row (index 4) has null record
    const bimiRow = lines[4];
    // Last field should be empty
    const fields = bimiRow.split(",");
    expect(fields[fields.length - 1]).toBe("");
  });

  it("handles empty validations", () => {
    const csv = generateCsv(makeScanResult());
    const lines = csv.trim().split("\r\n");
    // BIMI row (index 4) has empty validations
    const bimiFields = lines[4].split(",");
    // Findings field (index 5) should be empty
    expect(bimiFields[5]).toBe("");
  });

  it("escapes fields containing commas", () => {
    const result = makeScanResult();
    result.protocols.dmarc.record = "v=DMARC1; p=reject; rua=mailto:dmarc@example.com,mailto:admin@example.com";
    const csv = generateCsv(result);
    // The raw record field should be quoted
    expect(csv).toContain(
      '"v=DMARC1; p=reject; rua=mailto:dmarc@example.com,mailto:admin@example.com"',
    );
  });

  it("includes domain and grade in every row", () => {
    const csv = generateCsv(makeScanResult());
    const lines = csv.trim().split("\r\n").slice(1);
    for (const line of lines) {
      expect(line).toMatch(/^example\.com,B,/);
    }
  });
});
