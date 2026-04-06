# Sentry Full Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Sentry observability — handled error capture, request context, protocol tags, scan-flow breadcrumbs, smart trace sampling, and alert rules.

**Architecture:** Hybrid approach — a Hono middleware sets Sentry scope (tags/context/user) per request, route catch blocks explicitly capture handled errors, and an `onError` handler catches anything that slips through. Breadcrumbs are added at DNS, orchestrator, and route layers.

**Tech Stack:** `@sentry/cloudflare` (already installed), Hono middleware, Sentry MCP tools for alert rules.

---

### Task 1: Sentry Scope Middleware + onError Handler

**Files:**
- Modify: `src/index.ts:46-69` (add middleware after app creation, before security headers)
- Modify: `src/index.ts:519-525` (update `withSentry` config)

- [ ] **Step 1: Add Sentry scope middleware**

Insert after `const app = new Hono();` (line 46) and before the security headers middleware (line 50):

```typescript
// Set Sentry scope context for every request
app.use("*", async (c, next) => {
  const scope = Sentry.getCurrentScope();
  const domain = c.req.query("domain")?.trim().toLowerCase() || undefined;
  const format = c.req.query("format") || (c.req.header("Accept")?.includes("application/json") ? "json" : "html");
  const selectors = c.req.query("selectors") || undefined;

  if (domain) scope.setTag("domain", domain);
  scope.setTag("format", format);
  scope.setTag("path", c.req.path);
  scope.setContext("request", {
    selectors,
    method: c.req.method,
    path: c.req.path,
  });
  scope.setUser({
    ip_address: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || undefined,
  });

  await next();
});
```

- [ ] **Step 2: Add onError handler**

Insert after the middleware block, before the CORS middleware (line 71):

```typescript
// Safety net: capture any unhandled errors that bypass route catch blocks
app.onError((err, c) => {
  Sentry.captureException(err);
  const message = err instanceof Error ? err.message : "Internal error";
  const wantsJson = c.req.header("Accept")?.includes("application/json") || c.req.query("format") === "json";
  if (wantsJson) {
    return c.json({ error: message }, 500);
  }
  return c.html(renderError(message), 500);
});
```

- [ ] **Step 3: Replace tracesSampleRate with tracesSampler**

Replace the `withSentry` config at the bottom of `src/index.ts` (lines 519-525):

```typescript
export default Sentry.withSentry(
  (env?: { SENTRY_DSN?: string }) => ({
    dsn: env?.SENTRY_DSN ?? "",
    tracesSampler: (samplingContext: { parentSampled?: boolean }) => {
      if (samplingContext.parentSampled !== undefined) return samplingContext.parentSampled;
      return 0.3;
    },
  }),
  app,
);
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All 278 tests pass

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: No errors (run `npm run lint:fix` first if needed)

- [ ] **Step 7: Commit**

```bash
git add src/index.ts
git commit -m "feat(sentry): add scope middleware, onError handler, and tracesSampler"
```

---

### Task 2: tagScanResult Helper + captureException in Route Catch Blocks

**Files:**
- Modify: `src/index.ts` (add helper function, modify 5 catch blocks and success paths)

- [ ] **Step 1: Add tagScanResult helper**

Add this function before the route definitions (after `protocolRenderers`, around line 189):

```typescript
import type { ScanResult } from "./analyzers/types.js";

function tagScanResult(result: ScanResult): void {
  const scope = Sentry.getCurrentScope();
  scope.setTag("grade", result.grade);
  scope.setTag("dmarc.status", result.protocols.dmarc.status);
  scope.setTag("spf.status", result.protocols.spf.status);
  scope.setTag("dkim.status", result.protocols.dkim.status);
  scope.setTag("bimi.status", result.protocols.bimi.status);
  scope.setTag("mta_sts.status", result.protocols.mta_sts.status);
}
```

Note: `ScanResult` is already imported via `./analyzers/types.js` through the existing type imports at the top of the file. Check if a direct import is needed or if it can be accessed through the existing imports. The type is used in `cache.ts` so it's exported. Add it to the existing import block at lines 5-12:

```typescript
import type {
  BimiResult,
  DkimResult,
  DmarcResult,
  MtaStsResult,
  MxResult,
  ScanResult,
  SpfResult,
} from "./analyzers/types.js";
```

- [ ] **Step 2: Add captureException to all 5 catch blocks and tagScanResult to success paths**

**Catch block 1** — `/api/check` route (line 401-404):
```typescript
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Internal error";
    return c.json({ error: message }, 500);
  }
```

Also add `tagScanResult(result);` after `const result = cached ?? (await scan(domain, selectors));` (line 387), before the format checks.

**Catch block 2** — `/check/score` route (line 418-421):
```typescript
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Internal error";
    return c.html(renderError(message), 500);
  }
```

Also add `tagScanResult(result);` after `const result = await scan(domain, selectors);` (line 416).

**Catch block 3** — `/check` JSON branch (line 441-444):
```typescript
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Internal error";
      return c.json({ error: message }, 500);
    }
```

Also add `tagScanResult(result);` after `const result = await scan(domain, selectors);` (line 439).

**Catch block 4** — `/check` CSV branch (line 454-457):
```typescript
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Internal error";
      return c.json({ error: message }, 500);
    }
```

Also add `tagScanResult(result);` after `const result = await scan(domain, selectors);` (line 449).

**Catch block 5** — `/check` HTML direct branch (line 467-470):
```typescript
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Internal error";
      return c.html(renderError(message), 500);
    }
```

Also add `tagScanResult(result);` after `const result = cached ?? (await scan(domain, selectors));` (line 464).

- [ ] **Step 3: Add tagScanResult to SSE streaming route**

In the `/api/check/stream` handler, add `tagScanResult(result);` after `scanStreaming` completes (after line 239, before `setCachedScan`):

```typescript
    const result = await scanStreaming(
      domain,
      selectors,
      (id: ProtocolId, protocolResult: ProtocolResult) => {
        const html = protocolRenderers[id](protocolResult);
        stream.writeSSE({
          event: "protocol",
          data: JSON.stringify({ id, html }),
        });
      },
    );

    tagScanResult(result);
    setCachedScan(domain, selectors, result);
```

Also add `tagScanResult(cached);` in the cached branch (after line 202):

```typescript
    if (cached) {
      tagScanResult(cached);
      const protocolIds: ProtocolId[] = [
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All 278 tests pass

- [ ] **Step 6: Run lint and commit**

```bash
npm run lint:fix
git add src/index.ts
git commit -m "feat(sentry): add error capture in route handlers and protocol tags"
```

---

### Task 3: Breadcrumbs in DNS Client

**Files:**
- Modify: `src/dns/client.ts:18-34` (queryTxt) and `src/dns/client.ts:37-44` (queryMx)

- [ ] **Step 1: Add Sentry import**

Add to top of `src/dns/client.ts`:

```typescript
import * as Sentry from "@sentry/cloudflare";
```

- [ ] **Step 2: Add breadcrumb to queryTxt**

Add at the start of the `queryTxt` function (after line 18, before the try):

```typescript
export async function queryTxt(name: string): Promise<TxtRecord | null> {
  Sentry.addBreadcrumb({
    category: "dns.query",
    message: `TXT ${name}`,
    data: { type: "TXT", hostname: name },
    level: "info",
  });
  try {
```

- [ ] **Step 3: Add breadcrumb to queryMx**

Add at the start of the `queryMx` function (after line 37, before the try):

```typescript
export async function queryMx(name: string): Promise<MxRecord[] | null> {
  Sentry.addBreadcrumb({
    category: "dns.query",
    message: `MX ${name}`,
    data: { type: "MX", hostname: name },
    level: "info",
  });
  try {
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All 278 tests pass (breadcrumbs are additive, don't change behavior)

- [ ] **Step 6: Run lint and commit**

```bash
npm run lint:fix
git add src/dns/client.ts
git commit -m "feat(sentry): add DNS query breadcrumbs"
```

---

### Task 4: Breadcrumbs in Orchestrator

**Files:**
- Modify: `src/orchestrator.ts` (add breadcrumbs after analyzer completions and cache checks)

- [ ] **Step 1: Add Sentry import**

Add to top of `src/orchestrator.ts`:

```typescript
import * as Sentry from "@sentry/cloudflare";
```

- [ ] **Step 2: Add analyzer.complete breadcrumbs to scan() function**

After `const mxResult = await analyzeMx(domain);` (line 80):

```typescript
  const mxResult = await analyzeMx(domain);
  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `mx: ${mxResult.status}`, data: { protocol: "mx", status: mxResult.status }, level: "info" });
```

After `Promise.all` resolves (line 86-93), add breadcrumbs for each result:

```typescript
  const [dmarcResult, spfResult, dkimResult, mtaStsResult, bimiDns] =
    await Promise.all([
      dmarcPromise,
      spfPromise,
      dkimPromise,
      mtaStsPromise,
      bimiDnsPromise,
    ]);

  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `dmarc: ${dmarcResult.status}`, data: { protocol: "dmarc", status: dmarcResult.status }, level: "info" });
  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `spf: ${spfResult.status}`, data: { protocol: "spf", status: spfResult.status }, level: "info" });
  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `dkim: ${dkimResult.status}`, data: { protocol: "dkim", status: dkimResult.status }, level: "info" });
  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `mta_sts: ${mtaStsResult.status}`, data: { protocol: "mta_sts", status: mtaStsResult.status }, level: "info" });
```

After `const bimiResult = await analyzeBimi(...)` (line 96):

```typescript
  const bimiResult = await analyzeBimi(domain, dmarcPolicy, bimiDns);
  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `bimi: ${bimiResult.status}`, data: { protocol: "bimi", status: bimiResult.status }, level: "info" });
```

- [ ] **Step 3: Add analyzer.complete breadcrumbs to scanStreaming() function**

Same pattern as scan(). After `const mxResult = await analyzeMx(domain);` (line 119):

```typescript
  const mxResult = await analyzeMx(domain);
  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `mx: ${mxResult.status}`, data: { protocol: "mx", status: mxResult.status }, level: "info" });
```

Update the `.then()` callbacks (lines 126-128) to include breadcrumbs:

```typescript
  spfPromise.then((r) => { Sentry.addBreadcrumb({ category: "analyzer.complete", message: `spf: ${r.status}`, data: { protocol: "spf", status: r.status }, level: "info" }); onResult("spf", r); });
  dkimPromise.then((r) => { Sentry.addBreadcrumb({ category: "analyzer.complete", message: `dkim: ${r.status}`, data: { protocol: "dkim", status: r.status }, level: "info" }); onResult("dkim", r); });
  mtaStsPromise.then((r) => { Sentry.addBreadcrumb({ category: "analyzer.complete", message: `mta_sts: ${r.status}`, data: { protocol: "mta_sts", status: r.status }, level: "info" }); onResult("mta_sts", r); });
```

After `onResult("dmarc", dmarcResult);` (line 134):

```typescript
  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `dmarc: ${dmarcResult.status}`, data: { protocol: "dmarc", status: dmarcResult.status }, level: "info" });
```

After `const bimiResult = await analyzeBimi(...)` (line 137):

```typescript
  const bimiResult = await analyzeBimi(domain, dmarcPolicy, bimiDns);
  Sentry.addBreadcrumb({ category: "analyzer.complete", message: `bimi: ${bimiResult.status}`, data: { protocol: "bimi", status: bimiResult.status }, level: "info" });
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All 278 tests pass

- [ ] **Step 6: Run lint and commit**

```bash
npm run lint:fix
git add src/orchestrator.ts
git commit -m "feat(sentry): add analyzer completion breadcrumbs"
```

---

### Task 5: Breadcrumbs in Route Handlers (scan.start + cache)

**Files:**
- Modify: `src/index.ts` (add scan.start breadcrumbs at route entry, cache breadcrumbs)

- [ ] **Step 1: Add scan.start breadcrumb to /api/check route**

At the start of the `/api/check` try block (after line 385):

```typescript
  try {
    Sentry.addBreadcrumb({ category: "scan.start", message: domain, data: { domain, selectors }, level: "info" });
    const cached = await getCachedScan(domain, selectors);
```

- [ ] **Step 2: Add scan.start breadcrumb to /check/score route**

At the start of the `/check/score` try block (after line 415):

```typescript
  try {
    Sentry.addBreadcrumb({ category: "scan.start", message: domain, data: { domain, selectors }, level: "info" });
    const result = await scan(domain, selectors);
```

- [ ] **Step 3: Add scan.start breadcrumb to /check route branches**

At the start of each try block in the `/check` route (JSON branch line 438, CSV branch line 448, HTML direct branch line 462):

```typescript
    try {
      Sentry.addBreadcrumb({ category: "scan.start", message: domain, data: { domain, selectors }, level: "info" });
```

- [ ] **Step 4: Add scan.start breadcrumb to /api/check/stream route**

At the start of the streamSSE callback (after line 199):

```typescript
  return streamSSE(c, async (stream) => {
    Sentry.addBreadcrumb({ category: "scan.start", message: domain, data: { domain, selectors }, level: "info" });
    const cached = await getCachedScan(domain, selectors);
```

- [ ] **Step 5: Add cache.hit/cache.miss breadcrumbs**

In routes that check cache, add breadcrumbs after the cache check. In `/api/check` (after line 387):

```typescript
    const cached = await getCachedScan(domain, selectors);
    Sentry.addBreadcrumb({ category: cached ? "cache.hit" : "cache.miss", message: domain, data: { domain }, level: "info" });
```

In `/check` HTML direct branch (after line 463):

```typescript
      const cached = await getCachedScan(domain, selectors);
      Sentry.addBreadcrumb({ category: cached ? "cache.hit" : "cache.miss", message: domain, data: { domain }, level: "info" });
```

In `/api/check/stream` (after line 200):

```typescript
    const cached = await getCachedScan(domain, selectors);
    Sentry.addBreadcrumb({ category: cached ? "cache.hit" : "cache.miss", message: domain, data: { domain }, level: "info" });
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: All 278 tests pass

- [ ] **Step 8: Run lint and commit**

```bash
npm run lint:fix
git add src/index.ts
git commit -m "feat(sentry): add scan.start and cache breadcrumbs"
```

---

### Task 6: Sentry Alert Rules

**Files:**
- None (Sentry configuration via MCP tools)

- [ ] **Step 1: Create first-occurrence alert**

Use Sentry MCP tools to create an alert rule on the `cortech/dmarcheck` project:
- **Name:** "New Issue Detected"
- **Condition:** A new issue is created
- **Action:** Send notification to default (email: cory@coryrank.in)
- **Frequency:** At most once per hour per issue

- [ ] **Step 2: Create error spike alert**

Use Sentry MCP tools to create an alert rule on the `cortech/dmarcheck` project:
- **Name:** "Error Spike"
- **Condition:** More than 10 events in 5 minutes
- **Action:** Send notification to default (email: cory@coryrank.in)

- [ ] **Step 3: Verify alerts exist**

Use Sentry MCP `find_projects` or check project settings to confirm both alert rules are active.

- [ ] **Step 4: Commit a note (optional)**

No code to commit for this task — alerts are configured in Sentry, not in code.

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All 278 tests pass

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Verify locally with dev server**

Run: `npm run dev`
Hit: `http://localhost:8790/check?domain=example.com`
Expected: Page loads normally, no console errors. (Sentry events won't send locally without the DSN, but no errors should be thrown.)

- [ ] **Step 5: Push and verify in Sentry**

After merge to main and auto-deploy, hit `dmarc.mx/check?domain=example.com` and check:
- Sentry dashboard shows a transaction with tags (`domain`, `grade`, protocol statuses)
- Breadcrumb trail shows: `scan.start` → `cache.miss` → `dns.query` (multiple) → `analyzer.complete` (multiple)
- Alert rules are visible in project settings
