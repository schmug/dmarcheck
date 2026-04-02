# SSE Cache + MX-Informed DKIM Prioritization

**Date**: 2026-04-02
**Issues**: #41, #42
**Execution**: Sequential — #41 first, then #42

## Context

Two performance improvements identified from codebase analysis:

1. The SSE streaming endpoint (`/api/check/stream`) never checks the scan cache, so every browser-based scan runs a full DNS rescan even if results were cached seconds ago.
2. DKIM analysis probes 38 selectors in parallel with no priority ordering. When the MX provider is known (e.g., Google Workspace), provider-relevant selectors could be probed first, reducing time-to-result.

These are implemented sequentially because both touch `src/orchestrator.ts`.

---

## Issue #41: SSE Cache-Aware Streaming

### Problem

`/api/check/stream` (src/index.ts:171-203) calls `scanStreaming()` directly without checking `getCachedScan()`. The non-streaming `/api/check` route does check cache (src/index.ts:322-324).

### Solution

Add a cache check at the top of the SSE handler. On cache hit, replay all protocol results as SSE events from the cached data, then send the `done` event. No scan runs.

### Changes

**`src/index.ts`** (~line 171, inside the `/api/check/stream` handler):

```typescript
return streamSSE(c, async (stream) => {
  const cached = await getCachedScan(domain, selectors);

  if (cached) {
    // Replay cached results as SSE events
    const protocolIds: ProtocolId[] = ["mx", "dmarc", "spf", "dkim", "bimi", "mta_sts"];
    for (const id of protocolIds) {
      const key = id as keyof typeof cached.protocols;
      const html = protocolRenderers[id](cached.protocols[key]);
      stream.writeSSE({
        event: "protocol",
        data: JSON.stringify({ id, html }),
      });
    }
    stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        grade: cached.grade,
        headerHtml: renderReportHeader(cached),
        footerHtml: renderReportFooter(),
      }),
    });
    return;
  }

  // Existing scanStreaming path (unchanged)
  const result = await scanStreaming(domain, selectors, ...);
  setCachedScan(domain, selectors, result);
  // ...
});
```

### Tests

Add to `test/index.test.ts`:
- SSE stream returns cached results when cache is populated
- SSE stream falls through to scanStreaming on cache miss
- Cached SSE emits all 6 protocol events + done event

---

## Issue #42: MX-Informed DKIM Selector Prioritization

### Problem

`analyzeDkim()` in `src/analyzers/dkim.ts` probes all 38 `COMMON_SELECTORS` with equal priority. For domains with known MX providers, the relevant selectors (e.g., `google` for Google Workspace) are buried among 37 others.

### Solution

Add a provider-to-selector mapping. When providers are known, reorder the selector array so provider-relevant selectors are first. All selectors are still probed (completeness preserved) — they just start in a better order.

### Changes

**`src/analyzers/dkim.ts`**:

1. Add provider-selector mapping:

```typescript
const PROVIDER_SELECTORS: Record<string, string[]> = {
  "Google Workspace": ["google"],
  "Microsoft 365": ["selector1", "selector2"],
  "Proton Mail": ["protonmail", "protonmail2", "protonmail3"],
  "Zoho Mail": ["default"],
  "Fastmail": ["fm1", "fm2", "fm3"],
  "Rackspace Email": ["mail"],
};
```

2. Change `analyzeDkim()` signature to accept optional provider names:

```typescript
export async function analyzeDkim(
  domain: string,
  customSelectors: string[] = [],
  providerNames: string[] = [],
): Promise<DkimResult>
```

3. Reorder selectors: provider-matched first, then remaining:

```typescript
const allSelectors = [...new Set([...customSelectors, ...COMMON_SELECTORS])];
const prioritized = providerNames.flatMap(name => PROVIDER_SELECTORS[name] ?? []);
const prioritySet = new Set(prioritized);
const reordered = [
  ...prioritized.filter(s => allSelectors.includes(s)),
  ...allSelectors.filter(s => !prioritySet.has(s)),
];
```

**`src/orchestrator.ts`**:

In both `scan()` and `scanStreaming()`, await MX result before starting DKIM, pass provider names:

```typescript
// scan()
const mxResult = await analyzeMx(domain);
const mxPromise = Promise.resolve(mxResult);
const providerNames = mxResult.providers.map(p => p.name);

const [dmarcResult, spfResult, dkimResult, mtaStsResult] = await Promise.all([
  analyzeDmarc(domain),
  analyzeSpf(domain),
  analyzeDkim(domain, customSelectors, providerNames),
  analyzeMtaSts(domain),
]);
```

Note: MX queries resolve fast (single DNS lookup, typically <50ms). Awaiting MX before DKIM adds minimal latency while allowing provider-informed ordering.

For `scanStreaming()`: fire all 5 promises as today, but add `.then()` on `mxPromise` to extract provider names, then pass them to a modified DKIM call. Since `analyzeDkim` is already started, the provider info needs to be available at call time. Restructure to:

```typescript
const mxResult = await analyzeMx(domain);
onResult("mx", mxResult);
const providerNames = mxResult.providers.map(p => p.name);

const dmarcPromise = analyzeDmarc(domain);
const spfPromise = analyzeSpf(domain);
const dkimPromise = analyzeDkim(domain, customSelectors, providerNames);
const mtaStsPromise = analyzeMtaSts(domain);
```

MX resolves first (single DNS query), then the remaining 4 analyzers fan out in parallel with DKIM having provider-informed selector ordering.

### Tests

Add to `test/dkim.test.ts`:
- Provider selectors appear first in probe order when providers are specified
- All selectors still probed regardless of providers
- Unknown provider names are ignored gracefully
- Empty providers list behaves identically to current behavior

---

## Verification

1. Run `npm test` — all existing tests pass
2. Run `npm run typecheck` — no type errors
3. Run `npm run lint` — clean
4. Manual test: `npm run dev`, then check a domain via browser (SSE path)
   - First scan: should see progressive loading (cache miss)
   - Refresh same domain within 5 minutes: should see near-instant results (cache hit)
   - Check console network tab: SSE events should arrive in rapid succession on cache hit
5. Compare DKIM timing: scan a Google Workspace domain (e.g., google.com) — the `google` selector should be among the first probed
