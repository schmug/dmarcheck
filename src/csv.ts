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

const CSV_DANGEROUS_START_RE = /^[=+\-@\t\r\n]/;
const CSV_NEEDS_QUOTING_RE = /[,"\r\n]/;

export function escapeCsvField(value: string): string {
  // ⚡ Bolt Optimization: Use pre-compiled regex for fast path.
  // Avoids evaluating multiple `.includes()` for strings that don't need escaping.
  // Prevent CSV Formula Injection
  let safeValue = value;
  if (CSV_DANGEROUS_START_RE.test(safeValue)) {
    safeValue = `'${safeValue}`;
  }

  if (CSV_NEEDS_QUOTING_RE.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
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
  // ⚡ Bolt Optimization: Use for...in instead of Object.entries().filter().map()
  // Avoids multiple intermediate array allocations.
  let result = "";
  for (const name in selectors) {
    const s = selectors[name];
    if (s.found) {
      if (result.length > 0) result += "; ";
      result += `${name}: ${s.key_type ?? "unknown"}/${s.key_bits ?? "?"}bit`;
    }
  }
  return result;
}

export function generateCsv(result: ScanResult): string {
  const rows: string[] = [];

  // BOM + header
  rows.push(`\uFEFF${HEADERS.map(escapeCsvField).join(",")}`);

  // security_txt is intentionally omitted — it's an informational analyzer
  // (status always "info", does not contribute scoring factors or
  // recommendations), so CSV consumers focused on the email-security grade
  // get a tighter export. The full security.txt findings are still
  // available on the JSON response and the HTML report.
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
