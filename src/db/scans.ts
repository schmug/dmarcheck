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
