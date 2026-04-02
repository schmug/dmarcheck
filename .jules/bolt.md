## 2024-05-18 - Avoid Promise Waterfalls in High-Latency Scans
**Learning:** In the `scan` function (`src/orchestrator.ts`), waiting for all initial scans (including the notoriously slow DKIM analysis) to complete before starting BIMI analysis (which only depends on DMARC) creates an unnecessary promise waterfall.
**Action:** Chain dependent promises directly off the specific promises they depend on (e.g., `dmarcPromise.then(...)`) rather than `Promise.all` results to maximize concurrency and overall throughput.

## 2024-05-18 - Clear lingering timeouts
**Learning:** `Promise.race` with a `setTimeout` (as seen in `src/dns/client.ts`) doesn't automatically clear the timer if the main promise resolves first. In a high-concurrency environment (like 30+ DKIM lookups), these lingering timers keep the event loop busy and delay garbage collection.
**Action:** Always capture the `setTimeout` reference and explicitly `clearTimeout` in a `.finally()` block when using timeouts with `Promise.race`.
