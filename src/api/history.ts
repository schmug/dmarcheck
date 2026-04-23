import { getDomainByUserAndName } from "../db/domains.js";
import {
  getScanHistoryWithProtocols,
  type ProtocolStatus,
} from "../db/scans.js";

// Phase 4d — public scan-history API core. Thin wrapper around the same
// `getScanHistoryWithProtocols` helper the dashboard uses, so the HTML
// history view and the JSON API can never drift.

export const HISTORY_DEFAULT_LIMIT = 30;
export const HISTORY_MAX_LIMIT = 100;

export interface DomainHistoryScan {
  // Unix seconds. Snake-case because this is the on-the-wire JSON contract —
  // `getScanHistoryWithProtocols` returns camelCase `scannedAt` internally.
  scanned_at: number;
  grade: string;
  protocols: {
    dmarc: ProtocolStatus;
    spf: ProtocolStatus;
    dkim: ProtocolStatus;
    bimi: ProtocolStatus;
    mta_sts: ProtocolStatus;
  };
}

export interface DomainHistoryResponse {
  domain: string;
  scans: DomainHistoryScan[];
}

// Clamps the user-supplied `limit` query into [1, 100]. Non-integer, missing,
// and NaN inputs all fall back to the default. Negative / zero clamp to 1 so
// callers that pass `?limit=0` still get a well-formed (if short) response
// rather than a 400 — keeps the contract forgiving for dashboards that wire
// their page size to a slider.
export function clampHistoryLimit(raw: string | undefined): number {
  if (raw === undefined) return HISTORY_DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return HISTORY_DEFAULT_LIMIT;
  if (n < 1) return 1;
  if (n > HISTORY_MAX_LIMIT) return HISTORY_MAX_LIMIT;
  return n;
}

// Returns null when the user doesn't own the domain — caller maps that to 404
// (not 403) so cross-user existence isn't leaked through status codes.
// `domain` is assumed already normalized by the caller (normalizeDomain in
// the route handler). The returned `domain` field echoes the stored row
// value, which matches what the user registered (already normalized at
// create time in src/dashboard/routes.ts addDomain).
export async function fetchDomainHistory(
  db: D1Database,
  userId: string,
  domain: string,
  limit: number,
): Promise<DomainHistoryResponse | null> {
  const owned = await getDomainByUserAndName(db, userId, domain);
  if (!owned) return null;
  const rows = await getScanHistoryWithProtocols(db, owned.id, limit);
  return {
    domain: owned.domain,
    scans: rows.map((row) => ({
      scanned_at: row.scannedAt,
      grade: row.grade,
      protocols: row.protocols,
    })),
  };
}
