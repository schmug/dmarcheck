import type { ScanResult } from "./analyzers/types.js";

const HEADERS = [
  "Domain",
  "Grade",
  "Timestamp",
  "Protocol",
  "Status",
  "Findings",
  "Recommendations",
  "Raw Record",
];

const PROTOCOL_NAMES: Record<string, string> = {
  mx: "MX",
  dmarc: "DMARC",
  spf: "SPF",
  dkim: "DKIM",
  bimi: "BIMI",
  mta_sts: "MTA-STS",
};

export function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatFindings(
  validations: Array<{ status: string; message: string }>,
): string {
  if (validations.length === 0) return "";
  return validations.map((v) => `[${v.status}] ${v.message}`).join("; ");
}

function dkimRawSummary(
  selectors: Record<
    string,
    { found: boolean; key_type?: string; key_bits?: number }
  >,
): string {
  const found = Object.entries(selectors).filter(([, s]) => s.found);
  if (found.length === 0) return "";
  return found
    .map(
      ([name, s]) =>
        `${name}: ${s.key_type ?? "unknown"}/${s.key_bits ?? "?"}bit`,
    )
    .join("; ");
}

export function generateCsv(result: ScanResult): string {
  const rows: string[] = [];

  // BOM + header
  rows.push(`\uFEFF${HEADERS.map(escapeCsvField).join(",")}`);

  const protocols = ["mx", "dmarc", "spf", "dkim", "bimi", "mta_sts"] as const;

  for (const key of protocols) {
    const proto = result.protocols[key];
    const recs = result.breakdown.recommendations
      .filter((r) => r.protocol === key)
      .map((r) => `[P${r.priority}] ${r.title}`)
      .join("; ");

    let rawRecord: string;
    if (key === "mx") {
      rawRecord = result.protocols.mx.records
        .map((r) => `${r.priority} ${r.exchange}`)
        .join("; ");
    } else if (key === "dkim") {
      rawRecord = dkimRawSummary(result.protocols.dkim.selectors);
    } else if (key === "mta_sts") {
      rawRecord = result.protocols.mta_sts.dns_record ?? "";
    } else {
      rawRecord = (proto as { record?: string | null }).record ?? "";
    }

    const fields = [
      result.domain,
      result.grade,
      result.timestamp,
      PROTOCOL_NAMES[key],
      proto.status,
      formatFindings(proto.validations),
      recs,
      rawRecord,
    ];

    rows.push(fields.map(escapeCsvField).join(","));
  }

  return `${rows.join("\r\n")}\r\n`;
}
