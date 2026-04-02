# SSE Cache + MX-Informed DKIM Prioritization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scan results load faster by (1) serving cached results through the SSE streaming path and (2) reordering DKIM selector probes based on detected MX providers.

**Architecture:** Two sequential changes. Task 1-2 add cache-awareness to the SSE handler in `src/index.ts`. Tasks 3-5 add a provider-to-selector mapping in `src/analyzers/dkim.ts`, reorder probing, and update `src/orchestrator.ts` to pass MX provider info to DKIM.

**Tech Stack:** TypeScript, Hono framework, Vitest, Cloudflare Workers Cache API

**Spec:** `docs/superpowers/specs/2026-04-02-sse-cache-dkim-prioritization-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/index.ts` | Modify (~line 179) | Add cache check before `scanStreaming()` in SSE handler |
| `src/analyzers/dkim.ts` | Modify | Add `PROVIDER_SELECTORS` map; accept `providerNames` param; reorder selectors |
| `src/orchestrator.ts` | Modify | Await MX first, pass provider names to `analyzeDkim()` |
| `test/index.test.ts` | Modify | Add SSE cache-hit tests |
| `test/dkim.test.ts` | Modify | Add provider-informed selector ordering tests |

---

## Task 1: Test SSE cache-hit path

**Issue:** #41
**Files:**
- Modify: `test/index.test.ts`

- [ ] **Step 1: Write failing tests for SSE cache behavior**

Add a new `describe` block at the end of `test/index.test.ts`. These tests mock `getCachedScan` to return a cached result and verify the SSE stream replays it without calling `scanStreaming`.

```typescript
describe("SSE streaming cache", () => {
  it("replays cached result as SSE events on cache hit", async () => {
    const { getCachedScan } = await import("../src/cache.js");
    const { scanStreaming } = await import("../src/orchestrator.js");
    vi.mocked(getCachedScan).mockResolvedValueOnce({
      domain: "example.com",
      timestamp: "2026-04-02T00:00:00.000Z",
      grade: "A+",
      breakdown: { grade: "A+", score: 100, maxScore: 100, protocols: {} } as any,
      summary: {
        mx_records: 1,
        mx_providers: ["Google Workspace"],
        dmarc_policy: "reject",
        spf_result: "pass",
        spf_lookups: "3/10",
        dkim_selectors_found: 1,
        bimi_enabled: false,
        mta_sts_mode: null,
      },
      protocols: {
        mx: { status: "info", records: [], providers: [], validations: [] },
        dmarc: { status: "pass", record: "v=DMARC1; p=reject", tags: { p: "reject" }, validations: [] },
        spf: { status: "pass", record: "v=spf1 -all", lookups_used: 0, lookup_limit: 10, include_tree: null, validations: [] },
        dkim: { status: "pass", selectors: {}, validations: [] },
        bimi: { status: "fail", record: null, tags: null, validations: [] },
        mta_sts: { status: "fail", dns_record: null, policy: null, validations: [] },
      },
    });

    const res = await app.request("/api/check/stream?domain=example.com");
    expect(res.status).toBe(200);

    const text = await res.text();
    // Should contain all 6 protocol events
    expect(text).toContain('event: protocol\ndata: {"id":"mx"');
    expect(text).toContain('event: protocol\ndata: {"id":"dmarc"');
    expect(text).toContain('event: protocol\ndata: {"id":"spf"');
    expect(text).toContain('event: protocol\ndata: {"id":"dkim"');
    expect(text).toContain('event: protocol\ndata: {"id":"bimi"');
    expect(text).toContain('event: protocol\ndata: {"id":"mta_sts"');
    // Should contain done event with grade
    expect(text).toContain("event: done");
    expect(text).toContain('"grade":"A+"');
    // scanStreaming should NOT have been called
    expect(scanStreaming).not.toHaveBeenCalled();
  });
});
```

You need to add the mock imports at the top of the file. After the existing imports, add:

```typescript
vi.mock("../src/cache.js", () => ({
  getCachedScan: vi.fn().mockResolvedValue(null),
  setCachedScan: vi.fn(),
}));

vi.mock("../src/orchestrator.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/orchestrator.js")>();
  return {
    ...original,
    scanStreaming: vi.fn(original.scanStreaming),
  };
});
```

**Important:** Check if `vi.mock("../src/dns/client.js")` already exists at the top. If so, place the new mocks after it. If not, add the dns mock too since orchestrator imports analyzers that need it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/index.test.ts`
Expected: FAIL — `getCachedScan` is called but the SSE handler doesn't check the cache yet, so `scanStreaming` is still called.

**Note:** The test may fail differently (mock wiring issues, etc.). The key is that `scanStreaming` IS called when it shouldn't be. Fix any mock wiring issues before proceeding.

- [ ] **Step 3: Commit failing tests**

```bash
git add test/index.test.ts
git commit -m "test: add SSE cache-hit tests for #41"
```

---

## Task 2: Implement SSE cache-hit path

**Issue:** #41
**Files:**
- Modify: `src/index.ts` (~lines 179-202)

- [ ] **Step 1: Add cache check to SSE handler**

In `src/index.ts`, replace the body of the `streamSSE` callback (lines 180-201) with a cache-first version. The `getCachedScan` import already exists at line 13.

Replace:
```typescript
  return streamSSE(c, async (stream) => {
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

    setCachedScan(domain, selectors, result);

    stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        grade: result.grade,
        headerHtml: renderReportHeader(result),
        footerHtml: renderReportFooter(),
      }),
    });
  });
```

With:
```typescript
  return streamSSE(c, async (stream) => {
    const cached = await getCachedScan(domain, selectors);

    if (cached) {
      const protocolIds: ProtocolId[] = ["mx", "dmarc", "spf", "dkim", "bimi", "mta_sts"];
      for (const id of protocolIds) {
        const html = protocolRenderers[id](cached.protocols[id]);
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

    setCachedScan(domain, selectors, result);

    stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        grade: result.grade,
        headerHtml: renderReportHeader(result),
        footerHtml: renderReportFooter(),
      }),
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run test/index.test.ts`
Expected: All tests PASS including the new SSE cache test.

- [ ] **Step 3: Run full test suite + typecheck + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: serve cached results through SSE streaming path (#41)"
```

---

## Task 3: Test MX-informed DKIM selector ordering

**Issue:** #42
**Files:**
- Modify: `test/dkim.test.ts`

- [ ] **Step 1: Write failing tests for provider-informed selector ordering**

Add tests at the end of the `describe("analyzeDkim")` block in `test/dkim.test.ts`:

```typescript
  it("probes provider-relevant selectors first when providerNames given", async () => {
    const callOrder: string[] = [];
    mockQueryTxt.mockImplementation(async (name: string) => {
      callOrder.push(name);
      if (name === "google._domainkey.example.com") {
        const fakeKey = btoa("x".repeat(294));
        return {
          entries: [`v=DKIM1; k=rsa; p=${fakeKey}`],
          raw: `v=DKIM1; k=rsa; p=${fakeKey}`,
        };
      }
      return null;
    });

    await analyzeDkim("example.com", [], ["Google Workspace"]);

    // "google" selector should be probed first
    expect(callOrder[0]).toBe("google._domainkey.example.com");
  });

  it("probes Microsoft selectors first when Microsoft 365 detected", async () => {
    const callOrder: string[] = [];
    mockQueryTxt.mockImplementation(async (name: string) => {
      callOrder.push(name);
      return null;
    });

    await analyzeDkim("example.com", [], ["Microsoft 365"]);

    // selector1 and selector2 should be first two probes
    expect(callOrder[0]).toBe("selector1._domainkey.example.com");
    expect(callOrder[1]).toBe("selector2._domainkey.example.com");
  });

  it("still probes all selectors when providerNames given", async () => {
    mockQueryTxt.mockResolvedValue(null);

    const result = await analyzeDkim("example.com", [], ["Google Workspace"]);

    // All common selectors should still be present in results
    expect(Object.keys(result.selectors)).toContain("google");
    expect(Object.keys(result.selectors)).toContain("selector1");
    expect(Object.keys(result.selectors)).toContain("default");
  });

  it("ignores unknown provider names gracefully", async () => {
    mockQueryTxt.mockResolvedValue(null);

    const result = await analyzeDkim("example.com", [], ["Unknown Provider"]);

    // Should behave like no providers — all selectors present
    expect(Object.keys(result.selectors).length).toBeGreaterThanOrEqual(38);
  });

  it("behaves identically with empty providerNames", async () => {
    mockQueryTxt.mockResolvedValue(null);

    const resultDefault = await analyzeDkim("example.com");
    const resultEmpty = await analyzeDkim("example.com", [], []);

    expect(Object.keys(resultDefault.selectors)).toEqual(
      Object.keys(resultEmpty.selectors),
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/dkim.test.ts`
Expected: FAIL — `analyzeDkim` doesn't accept a third parameter yet, and selector ordering isn't provider-aware.

- [ ] **Step 3: Commit failing tests**

```bash
git add test/dkim.test.ts
git commit -m "test: add provider-informed DKIM selector ordering tests for #42"
```

---

## Task 4: Implement DKIM provider-informed selector ordering

**Issue:** #42
**Files:**
- Modify: `src/analyzers/dkim.ts`

- [ ] **Step 1: Add provider-to-selector mapping and reorder logic**

In `src/analyzers/dkim.ts`, add the `PROVIDER_SELECTORS` map after `COMMON_SELECTORS` (after line 39):

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

Then modify the `analyzeDkim` function signature and selector ordering. Replace:
```typescript
export async function analyzeDkim(
  domain: string,
  customSelectors: string[] = [],
): Promise<DkimResult> {
  const allSelectors = [...new Set([...COMMON_SELECTORS, ...customSelectors])];
```

With:
```typescript
export async function analyzeDkim(
  domain: string,
  customSelectors: string[] = [],
  providerNames: string[] = [],
): Promise<DkimResult> {
  const unique = [...new Set([...COMMON_SELECTORS, ...customSelectors])];
  const prioritized = providerNames.flatMap(
    (name) => PROVIDER_SELECTORS[name] ?? [],
  );
  const prioritySet = new Set(prioritized);
  const allSelectors = [
    ...prioritized.filter((s) => unique.includes(s)),
    ...unique.filter((s) => !prioritySet.has(s)),
  ];
```

- [ ] **Step 2: Run DKIM tests to verify they pass**

Run: `npx vitest run test/dkim.test.ts`
Expected: All tests PASS including the new provider-ordering tests.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All 307+ tests pass. The orchestrator still calls `analyzeDkim(domain, customSelectors)` with 2 args, which works because `providerNames` defaults to `[]`.

- [ ] **Step 4: Commit**

```bash
git add src/analyzers/dkim.ts
git commit -m "feat: add provider-informed DKIM selector prioritization (#42)"
```

---

## Task 5: Wire MX providers into DKIM via orchestrator

**Issue:** #42
**Files:**
- Modify: `src/orchestrator.ts`

- [ ] **Step 1: Update `scan()` to pass MX providers to DKIM**

In `src/orchestrator.ts`, replace the `scan()` function:

```typescript
export async function scan(
  domain: string,
  customSelectors: string[] = [],
): Promise<ScanResult> {
  const mxResult = await analyzeMx(domain);
  const providerNames = mxResult.providers.map((p) => p.name);

  const [dmarcResult, spfResult, dkimResult, mtaStsResult] = await Promise.all([
    analyzeDmarc(domain),
    analyzeSpf(domain),
    analyzeDkim(domain, customSelectors, providerNames),
    analyzeMtaSts(domain),
  ]);

  const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
  const bimiResult = await analyzeBimi(domain, dmarcPolicy);

  return buildScanResult(domain, {
    mx: mxResult,
    dmarc: dmarcResult,
    spf: spfResult,
    dkim: dkimResult,
    bimi: bimiResult,
    mta_sts: mtaStsResult,
  });
}
```

- [ ] **Step 2: Update `scanStreaming()` to pass MX providers to DKIM**

Replace the `scanStreaming()` function:

```typescript
export async function scanStreaming(
  domain: string,
  customSelectors: string[],
  onResult: (id: ProtocolId, result: ProtocolResult) => void,
): Promise<ScanResult> {
  const mxResult = await analyzeMx(domain);
  onResult("mx", mxResult);
  const providerNames = mxResult.providers.map((p) => p.name);

  const dmarcPromise = analyzeDmarc(domain);
  const spfPromise = analyzeSpf(domain);
  const dkimPromise = analyzeDkim(domain, customSelectors, providerNames);
  const mtaStsPromise = analyzeMtaSts(domain);

  spfPromise.then((r) => onResult("spf", r));
  dkimPromise.then((r) => onResult("dkim", r));
  mtaStsPromise.then((r) => onResult("mta_sts", r));

  const dmarcResult = await dmarcPromise;
  onResult("dmarc", dmarcResult);

  const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
  const bimiResult = await analyzeBimi(domain, dmarcPolicy);
  onResult("bimi", bimiResult);

  const [spfResult, dkimResult, mtaStsResult] = await Promise.all([
    spfPromise,
    dkimPromise,
    mtaStsPromise,
  ]);

  return buildScanResult(domain, {
    mx: mxResult,
    dmarc: dmarcResult,
    spf: spfResult,
    dkim: dkimResult,
    bimi: bimiResult,
    mta_sts: mtaStsResult,
  });
}
```

Key changes from the original:
- MX is awaited first and emitted immediately (it's fast — single DNS query)
- Provider names extracted from MX result
- Remaining 4 analyzers fan out in parallel, with DKIM receiving provider info
- The `Promise.all` at the end now awaits 3 promises (MX already resolved)

- [ ] **Step 3: Run full test suite + typecheck + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/orchestrator.ts
git commit -m "feat: wire MX provider info into DKIM selector ordering (#42)"
```

---

## Verification

After all tasks are complete:

1. `npm test` — all tests pass
2. `npm run typecheck` — clean
3. `npm run lint` — clean
4. Manual test with `npm run dev`:
   - Visit `http://localhost:8790`, scan a domain
   - First scan: progressive skeleton loading (cache miss)
   - Refresh within 5 minutes: near-instant results (cache hit, all SSE events fire immediately)
   - Scan a Google Workspace domain: DKIM `google` selector should appear in results
