export interface ScanHistoryRow {
  id: number;
  domain_id: number;
  grade: string;
  score_factors: string | null;
  protocol_results: string | null;
  scanned_at: number;
}

export interface RecordScanInput {
  domainId: number;
  grade: string;
  scoreFactors: unknown;
  protocolResults: unknown;
  scannedAt?: number;
}

// Writes one scan_history row and updates the owning domain's last_grade /
// last_scanned_at in a single D1 batch. Batch is atomic at the D1 layer, so
// the history row and the domain summary stay in sync even if the request is
// cancelled mid-flight.
export async function recordScan(
  db: D1Database,
  input: RecordScanInput,
): Promise<void> {
  const scannedAt = input.scannedAt ?? Math.floor(Date.now() / 1000);
  const scoreFactorsJson = JSON.stringify(input.scoreFactors ?? null);
  const protocolResultsJson = JSON.stringify(input.protocolResults ?? null);

  await db.batch([
    db
      .prepare(
        "INSERT INTO scan_history (domain_id, grade, score_factors, protocol_results, scanned_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        input.domainId,
        input.grade,
        scoreFactorsJson,
        protocolResultsJson,
        scannedAt,
      ),
    db
      .prepare(
        "UPDATE domains SET last_grade = ?, last_scanned_at = ? WHERE id = ?",
      )
      .bind(input.grade, scannedAt, input.domainId),
  ]);
}

export async function getScanHistory(
  db: D1Database,
  domainId: number,
  limit = 12,
): Promise<ScanHistoryRow[]> {
  const result = await db
    .prepare(
      "SELECT * FROM scan_history WHERE domain_id = ? ORDER BY scanned_at DESC LIMIT ?",
    )
    .bind(domainId, limit)
    .all<ScanHistoryRow>();
  return result.results;
}

export type ProtocolStatus = "pass" | "warn" | "fail" | "info" | null;

export interface ScanHistoryWithProtocols {
  grade: string;
  scannedAt: number;
  protocols: {
    dmarc: ProtocolStatus;
    spf: ProtocolStatus;
    dkim: ProtocolStatus;
    bimi: ProtocolStatus;
    mta_sts: ProtocolStatus;
  };
}

function asStatus(value: unknown): ProtocolStatus {
  return value === "pass" ||
    value === "warn" ||
    value === "fail" ||
    value === "info"
    ? value
    : null;
}

// Parses the JSON blob in `protocol_results` into a flat per-protocol status
// map so history views don't have to reach into the orchestrator shape. Any
// protocol missing or unparseable is returned as null — the view renders that
// as "—" rather than failing the whole row.
export async function getScanHistoryWithProtocols(
  db: D1Database,
  domainId: number,
  limit: number,
): Promise<ScanHistoryWithProtocols[]> {
  const rows = await getScanHistory(db, domainId, limit);
  return rows.map((row) => {
    let parsed: Record<string, { status?: unknown } | undefined> | null = null;
    if (row.protocol_results) {
      try {
        parsed = JSON.parse(row.protocol_results) as Record<
          string,
          { status?: unknown } | undefined
        >;
      } catch {
        parsed = null;
      }
    }
    return {
      grade: row.grade,
      scannedAt: row.scanned_at,
      protocols: {
        dmarc: asStatus(parsed?.dmarc?.status),
        spf: asStatus(parsed?.spf?.status),
        dkim: asStatus(parsed?.dkim?.status),
        bimi: asStatus(parsed?.bimi?.status),
        mta_sts: asStatus(parsed?.mta_sts?.status),
      },
    };
  });
}
