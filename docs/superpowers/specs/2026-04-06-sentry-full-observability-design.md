# Sentry Full Observability — Design Spec

## Context

Sentry SDK (`@sentry/cloudflare`) was added in PR #79 with `withSentry()` wrapping the Hono app. The DSN is set as a Cloudflare secret and events flow to the `cortech/dmarcheck` project. However, no errors from the application reach Sentry because all route handlers catch exceptions and return friendly 500s. The current setup also lacks request context, protocol-level tags, breadcrumbs, and alerting.

This design adds full observability: handled error capture, request context, protocol outcome tags, scan-flow breadcrumbs, smart trace sampling, and alert rules.

## Approach: Hybrid Middleware + Explicit Capture

Middleware sets Sentry scope (context/tags) once per request. Route catch blocks explicitly capture handled errors. An `onError` handler catches anything that slips through.

## 1. Scope Middleware (`src/index.ts`)

A `app.use("*", ...)` middleware that runs early in the chain:

- Extracts from request: `domain`, `format` (json/csv/html/sse), `selectors`, path, method
- Sets Sentry tags: `domain`, `format`, `path`
- Sets Sentry context: `{ selectors }`
- Sets Sentry user: `{ ip_address }` (from request)

Uses `Sentry.getCurrentScope()` — no new dependencies.

## 2. Error Capture in Route Catch Blocks (`src/index.ts`)

Add `Sentry.captureException(err)` in each of the 5 existing catch blocks, before the friendly 500 return.

Add `app.onError` handler as safety net:

```typescript
app.onError((err, c) => {
    Sentry.captureException(err);
    return c.json({ error: "Internal error" }, 500);
});
```

## 3. Protocol Outcome Tags (`src/index.ts`)

A `tagScanResult(result: ScanResult)` helper that tags the Sentry scope after a scan:

- `dmarc.status`, `spf.status`, `dkim.status`, `bimi.status`, `mta_sts.status` — pass/warn/fail
- `grade` — S/A+/A/B/C/D/F

Called in route handlers after `scan()` resolves. Enables filtering in Sentry by protocol status or grade.

## 4. Traces Sampler (`src/index.ts`)

Replace `tracesSampleRate: 1.0` with `tracesSampler`:

- Respect parent sampling context if present
- Sample 30% of successful request transactions
- Error events are always sent (Sentry default — not subject to trace sampling)

## 5. Breadcrumbs

Manual breadcrumbs at key points in the scan flow:

| Breadcrumb | File | When |
|---|---|---|
| `scan.start` | `src/index.ts` | Route handler entry, data: domain, selectors |
| `dns.query` | `src/dns/client.ts` | In `queryTxt` and `queryMx`, data: query type, hostname |
| `analyzer.complete` | `src/orchestrator.ts` | After each analyzer returns, data: protocol name, status |
| `cache.hit` / `cache.miss` | `src/orchestrator.ts` | When cache is checked, data: domain |

## 6. Alert Rules (via Sentry MCP)

1. **First occurrence** — notify on first event of a new issue type (email to cory@coryrank.in)
2. **Error spike** — notify when >10 events in 5 minutes

## File Changes

| File | Changes |
|---|---|
| `src/index.ts` | Scope middleware, `captureException` in 5 catch blocks, `onError` handler, `tagScanResult` helper, `tracesSampler`, `scan.start` breadcrumb |
| `src/dns/client.ts` | `dns.query` breadcrumbs in `queryTxt` and `queryMx` |
| `src/orchestrator.ts` | `analyzer.complete` breadcrumbs, `cache.hit`/`cache.miss` breadcrumbs |
| Sentry (MCP) | Two alert rules: first occurrence + error spike |

No new files. No new dependencies.

## Verification

1. Run `npm test` — all existing tests pass (breadcrumbs/captures are additive, don't change behavior)
2. Run `npm run typecheck` — no type errors
3. Run `npm run lint` — biome passes
4. Deploy to Cloudflare, hit `dmarc.mx/check?domain=example.com`
5. Verify in Sentry dashboard: transaction appears with tags (domain, protocol statuses, grade)
6. Trigger an error (e.g. scan a domain that causes an unexpected exception) and verify it appears in Sentry with breadcrumb trail
7. Confirm both alert rules exist in Sentry project settings
