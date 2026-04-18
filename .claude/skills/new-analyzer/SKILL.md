---
name: new-analyzer
description: Scaffold a new protocol analyzer for dmarcheck. Creates the analyzer module, types, orchestrator wiring, scoring hook-in, HTML component, and a test file — all matching the existing shape of src/analyzers/spf.ts and test/spf.test.ts. Use when adding support for a new DNS/email-security protocol (e.g. ARC, TLS-RPT, DANE).
---

# Scaffolding a new protocol analyzer

Adding a protocol analyzer to dmarcheck touches six places in a predictable pattern. This skill walks through them in order. Skip nothing — the orchestrator, scoring, and HTML report all assume the same contract.

## Prerequisites

Ask the user for:
1. **Protocol name** — short lowercase identifier (e.g. `arc`, `tls_rpt`, `dane`). Use snake_case if multi-word.
2. **Human label** — for UI (e.g. "ARC", "TLS-RPT").
3. **Informational or scored?** — informational protocols (like MX) use `status: "info"` and don't feed the grade. Scored protocols can affect the grade tier in `src/shared/scoring.ts`.
4. **Data source** — TXT lookup, fetched policy, MX chain, etc.

If unclear, ask before generating anything.

## Reference implementations

Before writing, Read these as templates:
- Pure DNS-lookup analyzer: `src/analyzers/dmarc.ts` + `test/analyzers.test.ts`
- DNS + HTTP fetch: `src/analyzers/mta-sts.ts` + `test/mta-sts.test.ts`
- Informational (no grade impact): `src/analyzers/mx.ts` + `test/mx.test.ts`
- Result types: `src/analyzers/types.ts`
- Orchestrator pattern: `src/orchestrator.ts`
- Scoring integration: `src/shared/scoring.ts`

## Steps

### 1. Add the result type

Edit `src/analyzers/types.ts`. Add:

```ts
export interface FooResult {
  status: Status;
  record: string | null;
  // ...protocol-specific fields...
  validations: Validation[];
}
```

Then add `foo: FooResult` to `ScanResult.protocols`.

### 2. Create the analyzer module

Create `src/analyzers/foo.ts`:

```ts
import { queryTxt } from "../dns/client.js";
import type { FooResult, Validation } from "./types.js";

export async function analyzeFoo(domain: string): Promise<FooResult> {
  const validations: Validation[] = [];

  const txt = await queryTxt(`_foo.${domain}`);
  if (!txt) {
    return {
      status: "fail",
      record: null,
      validations: [{ status: "fail", message: "No _foo record found" }],
    };
  }

  const record = txt.entries.find((e) => e.startsWith("v=FOO1"));
  if (!record) {
    return {
      status: "fail",
      record: null,
      validations: [{ status: "fail", message: "No v=FOO1 record" }],
    };
  }

  validations.push({ status: "pass", message: "Foo record found" });
  // ...protocol-specific validations...

  const hasFailure = validations.some((v) => v.status === "fail");
  const hasWarn = validations.some((v) => v.status === "warn");
  const status = hasFailure ? "fail" : hasWarn ? "warn" : "pass";

  return { status, record, validations };
}
```

**Critical contract rules** (the `analyzer-reviewer` subagent will enforce these):
- DNS errors (NXDOMAIN/NODATA) come back from `queryTxt` etc. as `null`. Return a `fail` validation — never throw.
- If the analyzer uses `fetch()`, wrap in try/catch and convert errors to `fail` validations. Always specify `redirect:` explicitly. For any policy fetch, `redirect: "manual"` is the safe default.
- Derive the final `status` from validations using the pattern above.
- The function must be safe to run inside `Promise.allSettled` — no module-scope mutable state.

### 3. Wire into the orchestrator

Edit `src/orchestrator.ts`:

1. Import: `import { analyzeFoo } from "./analyzers/foo.js";`
2. Add `"foo"` to `ProtocolId` union and `FooResult` to `ProtocolResult` union.
3. In `scan()`:
   ```ts
   const fooPromise = analyzeFoo(domain);
   ```
   Add it to the `Promise.all([...])` array and destructure the result.
4. In `scanStreaming()`, do the same AND add:
   ```ts
   fooPromise.then((r) => {
     Sentry.addBreadcrumb({
       category: "analyzer.complete",
       message: `foo: ${r.status}`,
       data: { protocol: "foo", status: r.status },
       level: "info",
     });
     onResult("foo", r);
   });
   ```
5. Pass `foo: fooResult` into `buildScanResult`.

### 4. Wire into scoring (skip if informational-only)

Edit `src/shared/scoring.ts`:

1. Add `foo: FooResult` to the `Protocols` interface and to the `ScoringFactor["protocol"]` / `Recommendation["protocol"]` unions.
2. Add a `buildProtocolSummaries` entry:
   ```ts
   foo: {
     status: foo.status,
     summary: foo.record ? "Configured" : "Not configured",
   },
   ```
3. If the protocol affects tier: update `resolveScoring`. If it only contributes a ±1 modifier: add a `fooFactors(...)` helper and call it from the relevant tier branches.
4. If it warrants a recommendation: extend `generateRecommendations` with appropriate `priority`, `title`, `description`, `impact`.

### 5. Register the HTML label and card

Edit `src/views/components.ts`:

1. Add `foo: "FOO"` (or human label) to `PROTO_LABELS`.
2. If the report needs a custom body (tag grid, MX-style table, SPF-tree-style visualization), add a helper here; otherwise the default `protocolCard` will render validations via `validationList`.

Edit `src/views/html.ts` (or wherever protocol cards are rendered — search for a sibling protocol like `dkim` to find the exact location).

### 6. Test

Create `test/foo.test.ts` modeled on `test/mta-sts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn(),
}));

import { analyzeFoo } from "../src/analyzers/foo.js";
import { queryTxt } from "../src/dns/client.js";

const mockQueryTxt = vi.mocked(queryTxt);

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("analyzeFoo", () => {
  it("returns fail when no record", async () => {
    mockQueryTxt.mockResolvedValue(null);
    const result = await analyzeFoo("example.com");
    expect(result.status).toBe("fail");
    expect(result.record).toBeNull();
  });

  it("returns pass for a valid record", async () => {
    mockQueryTxt.mockResolvedValue({
      entries: ["v=FOO1; ..."],
    });
    const result = await analyzeFoo("example.com");
    expect(result.status).toBe("pass");
  });

  // Add one malformed-input case and any protocol-specific edge cases.
});
```

### 7. Verify

Run:
```
npm test
npm run lint
npm run typecheck
```

If any of these fail, fix before committing. The pre-commit hook will re-run them anyway.

### 8. Update docs

- Add the new analyzer to `CLAUDE.md` §Architecture (analyzers list).
- If user-facing: add a brief explanation to `README.md` and the `/learn` markdown page.

## When you're done

Invoke the `analyzer-reviewer` subagent on the diff — it checks the analyzer contract and catches drift.
