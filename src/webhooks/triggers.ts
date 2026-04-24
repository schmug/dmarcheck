import type { BulkResultEntry } from "../api/bulk-scan.js";
import { CANONICAL_ORIGIN } from "../api/catalog.js";
import { dispatchWebhook, type ScanCompletedData } from "./dispatcher.js";

// Convenience wrapper used by every scan trigger (dashboard / cron / bulk).
// Centralizes the `scan.completed` payload shape so adding a field later
// (e.g. an alert summary) only touches one place.
export async function fireScanCompletedWebhook(
  db: D1Database,
  userId: string,
  input: {
    domain: string;
    grade: string;
    scanId: string | number;
    trigger: ScanCompletedData["trigger"];
  },
): Promise<void> {
  try {
    await dispatchWebhook(db, userId, {
      type: "scan.completed",
      data: {
        domain: input.domain,
        grade: input.grade,
        scan_id: input.scanId,
        trigger: input.trigger,
        report_url: `${CANONICAL_ORIGIN}/check?domain=${encodeURIComponent(input.domain)}`,
      },
    });
  } catch {
    // Dispatcher already records its own failures into webhook_deliveries; the
    // `try` here exists only so an unexpected throw can't bubble out of a
    // `waitUntil` and crash an unrelated request handler.
  }
}

// Fires one `scan.completed` event per successfully-scanned entry in a bulk
// outcome. Best-effort and serial — callers should hand this to `waitUntil`
// so it never blocks the response. Queued/invalid/error entries are skipped
// (no scan happened, nothing to report).
export async function fireBulkScanWebhooks(
  db: D1Database,
  userId: string,
  results: BulkResultEntry[],
  trigger: ScanCompletedData["trigger"],
): Promise<void> {
  for (const entry of results) {
    if (entry.status !== "scanned" || !entry.grade) continue;
    await fireScanCompletedWebhook(db, userId, {
      domain: entry.domain,
      grade: entry.grade,
      // Bulk scans don't surface a stable scan_history.id; receivers can
      // re-fetch by domain via /api/domain/:name/history.
      scanId: entry.domain,
      trigger,
    });
  }
}
