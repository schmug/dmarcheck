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

// Bounded concurrency so a 30-domain bulk doesn't hit a single chat receiver
// with 30 simultaneous POSTs. Mirrors `BULK_BATCH_SIZE` in api/bulk-scan.
const WEBHOOK_BATCH_SIZE = 10;

// Fires one `scan.completed` event per successfully-scanned entry in a bulk
// outcome. Best-effort and bounded-parallel — callers should hand this to
// `waitUntil` so it never blocks the response. Queued/invalid/error entries
// are skipped (no scan happened, nothing to report).
//
// Parallel matters: a serial loop over N webhooks accumulates wall-clock
// time inside the waitUntil budget. Once the runtime decides to recycle the
// isolate, every pending fetch is aborted with the literal "operation
// aborted due to timeout" message — including ones whose request bytes
// already left and were acked by the chat platform. Batching keeps total
// wall-clock under budget while still capping the burst per receiver.
export async function fireBulkScanWebhooks(
  db: D1Database,
  userId: string,
  results: BulkResultEntry[],
  trigger: ScanCompletedData["trigger"],
): Promise<void> {
  const toFire = results.filter(
    (entry): entry is BulkResultEntry & { grade: string } =>
      entry.status === "scanned" && !!entry.grade,
  );
  for (let i = 0; i < toFire.length; i += WEBHOOK_BATCH_SIZE) {
    const batch = toFire.slice(i, i + WEBHOOK_BATCH_SIZE);
    await Promise.allSettled(
      batch.map((entry) =>
        fireScanCompletedWebhook(db, userId, {
          domain: entry.domain,
          grade: entry.grade,
          // Bulk scans don't surface a stable scan_history.id; receivers can
          // re-fetch by domain via /api/domain/:name/history.
          scanId: entry.domain,
          trigger,
        }),
      ),
    );
  }
}
