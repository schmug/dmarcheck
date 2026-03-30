# dmarcheck — DNS Email Security Analyzer

## Overview

A public-facing Cloudflare Worker that analyzes a domain's email security posture across five protocols: DMARC, SPF, DKIM, BIMI, and MTA-STS. Serves dual output from a single worker: JSON API for developers, interactive visual HTML report for browser users.

## Architecture

**Stack:** Hono framework on Cloudflare Workers, TypeScript, `node:dns` via `nodejs_compat`.

**Single worker, dual output** — content negotiation determines response format:
- `Accept: application/json`, `?format=json`, or `/api/*` path → JSON
- Everything else → HTML

### Project Structure

```
src/
  index.ts                 -- Hono app, routes, content negotiation
  dns/
    client.ts              -- DNS abstraction over node:dns (graceful NXDOMAIN/NODATA)
    types.ts               -- DNS response types
  analyzers/
    dmarc.ts               -- _dmarc TXT parsing + validation
    spf.ts                 -- Recursive include chain resolution + validation
    dkim.ts                -- Selector probing + key parsing
    bimi.ts                -- _bimi TXT parsing, l=/a= validation
    mta-sts.ts             -- DNS TXT + HTTPS policy file fetch and validation
    types.ts               -- Shared result interfaces (pass/fail/warn)
  orchestrator.ts          -- Parallel execution of all analyzers, aggregation, scoring
  views/
    html.ts                -- Full report page generator
    components.ts          -- Reusable UI fragments (score card, tooltip, expandable section)
    styles.ts              -- CSS as string constant
    scripts.ts             -- Client-side JS (expand/collapse, tooltips, SPF tree interaction)
  shared/
    scoring.ts             -- Grading logic
wrangler.toml
```

### Routes

| Route | Output | Description |
|-------|--------|-------------|
| `GET /` | HTML | Landing page with domain search form |
| `GET /check?domain=<domain>` | HTML or JSON | Content-negotiated results |
| `GET /api/check?domain=<domain>` | JSON | Always JSON |

**Query parameters (all routes):**
- `domain` (required) — domain to scan
- `format=json` — force JSON output
- `selectors=sel1,sel2` — additional DKIM selectors to probe (comma-separated)

## Protocol Analyzers

All five analyzers run in parallel via `Promise.allSettled()`.

### DMARC

- **Query:** 1 TXT lookup at `_dmarc.<domain>`
- **Parse:** Tags — v, p, sp, rua, ruf, pct, adkim, aspf, fo, ri
- **Validate:**
  - `v=DMARC1` required as first tag
  - `p=` (policy) required — flag `none` as unenforceable
  - Check for subdomain policy (`sp=`)
  - Check for reporting URIs (`rua`, `ruf`)
  - Flag `pct` < 100 as partial enforcement

### SPF

- **Query:** 1 TXT lookup at `<domain>`, then recursive resolution of `include:` and `redirect=`
- **Resolution:** Breadth-first traversal of the include chain. At each level, all targets resolve in parallel.
- **Parse:** Mechanisms (all, include, a, mx, ptr, ip4, ip6, exists) with qualifiers (+, -, ~, ?)
- **Validate:**
  - Count DNS-lookup mechanisms (include, a, mx, ptr, exists) toward RFC 7208 limit of 10
  - Detect: too many lookups (>10), void lookups, deprecated `ptr` mechanism, conflicting `all` qualifiers
  - Flag `~all` (softfail) vs `-all` (hardfail)

### DKIM

- **Query:** Probe ~30 common selectors at `<selector>._domainkey.<domain>` (all in parallel). Common selectors: google, selector1, selector2, default, dkim, s1, s2, k1, k2, k3, pm, protonmail, everlytickey1, mandrill, mxvault, etc.
- **User-provided selectors:** Also check any custom selectors the user specifies (GUI: input field; API: `?selectors=sel1,sel2` query param)
- **Parse:** Key tags — v, k (key type), p (public key), t (flags), h (hash algorithms)
- **Validate:**
  - Flag empty `p=` (revoked key)
  - Report key type and size (RSA 1024 is weak, 2048+ is good)
  - Flag testing mode (`t=y`)

### BIMI

- **Query:** 1 TXT lookup at `default._bimi.<domain>`
- **Parse:** Tags — v, l (logo URL), a (authority/VMC URL)
- **Validate:**
  - `v=BIMI1` required
  - `l=` must be an HTTPS URL pointing to an SVG
  - Cross-check: DMARC must have `p=quarantine` or `p=reject` for BIMI to work

### MTA-STS

- **Query:** 1 TXT lookup at `_mta-sts.<domain>` + 1 HTTPS fetch to `https://mta-sts.<domain>/.well-known/mta-sts.txt`
- **Parse DNS:** `v=STSv1; id=<id>`
- **Parse Policy File:** Fields — version, mode (enforce/testing/none), mx patterns, max_age
- **Validate:**
  - TXT record must exist with `v=STSv1`
  - Policy file must be reachable over HTTPS
  - `mode` should be `enforce` for full protection
  - `max_age` should be reasonable (>= 86400)
  - `mx` patterns should match the domain's actual MX records

## DNS Client

Wraps `node:dns` promises API (requires `nodejs_compat` compatibility flag in wrangler.toml). Each `resolveTxt`, `resolveMx`, etc. call is a subrequest routed to Cloudflare's 1.1.1.1 DoH.

Key behaviors:
- NXDOMAIN and NODATA return `null` instead of throwing
- All other errors propagate
- Typed return values per query type

**Total queries per scan:** ~30-80, well within the 10,000 subrequest limit. The 6-connection concurrency limit is handled transparently by the Workers runtime (excess connections are queued).

## JSON API Response

```json
{
  "domain": "github.com",
  "timestamp": "2026-03-30T15:30:00Z",
  "grade": "B+",
  "summary": {
    "dmarc_policy": "reject",
    "spf_result": "pass",
    "spf_lookups": "7/10",
    "dkim_selectors_found": 3,
    "bimi_enabled": false,
    "mta_sts_mode": null
  },
  "protocols": {
    "dmarc": {
      "status": "pass",
      "record": "v=DMARC1; p=reject; ...",
      "tags": { "v": "DMARC1", "p": "reject", "sp": "reject", "rua": "...", "pct": "100" },
      "validations": [
        { "status": "pass", "message": "DMARC record found" },
        { "status": "pass", "message": "Policy is set to reject" }
      ]
    },
    "spf": {
      "status": "pass",
      "record": "v=spf1 ... ~all",
      "lookups_used": 7,
      "lookup_limit": 10,
      "include_tree": {
        "domain": "github.com",
        "record": "v=spf1 ...",
        "includes": [
          { "domain": "_netblocks.google.com", "record": "...", "includes": [] }
        ]
      },
      "validations": [
        { "status": "pass", "message": "SPF record found" },
        { "status": "pass", "message": "Within 10-lookup limit" },
        { "status": "warn", "message": "Uses ~all (softfail) instead of -all" }
      ]
    },
    "dkim": {
      "status": "pass",
      "selectors": {
        "google": { "found": true, "key_type": "rsa", "key_bits": 2048 },
        "selector1": { "found": true, "key_type": "rsa", "key_bits": 2048 },
        "default": { "found": false }
      },
      "validations": [
        { "status": "pass", "message": "3 DKIM selectors found" }
      ]
    },
    "bimi": {
      "status": "warn",
      "record": null,
      "tags": null,
      "validations": [
        { "status": "warn", "message": "No BIMI record found" }
      ]
    },
    "mta_sts": {
      "status": "fail",
      "dns_record": null,
      "policy": null,
      "validations": [
        { "status": "fail", "message": "No _mta-sts TXT record found" },
        { "status": "fail", "message": "Policy file not accessible" }
      ]
    }
  }
}
```

## Grading Logic

DMARC is the gatekeeper — no DMARC or `p=none` is an automatic F.

| Grade | Criteria |
|-------|----------|
| **F** | No DMARC record, or `p=none` |
| **D** | DMARC `p=quarantine` but missing SPF or DKIM |
| **C** | DMARC `p=quarantine`, SPF + DKIM present |
| **B** | DMARC `p=reject`, SPF + DKIM present |
| **A** | DMARC `p=reject`, SPF valid (within limit, `-all`), DKIM found, + BIMI or MTA-STS |
| **A+** | All five protocols fully configured and validated |

**Modifiers (+/-):** Applied for finer distinctions:
- SPF softfail (`~all`) vs hardfail (`-all`)
- SPF lookup count proximity to limit
- DKIM key strength (1024-bit = minus, 2048+ = neutral)
- MTA-STS mode (testing vs enforce)

## GUI Design

**Theme:** Dark background (#0a0a0f), orange accent (#f97316), clean minimal aesthetic.

**Landing page:**
- Centered layout with "dmarcheck" logo (orange accent on "check")
- Domain search input with "Scan" button
- Protocol tags (DMARC, SPF, DKIM, BIMI, MTA-STS)
- Example domains as quick links
- curl API hint showing the JSON endpoint

**Results page:**
- Overall letter grade badge next to domain name
- Scan metadata (time, query count, "View JSON" link)
- Expandable protocol cards, each containing:
  - Color-coded status dot (green=pass, amber=warn, red=fail)
  - Protocol name + summary subtitle
  - Expand to reveal: parsed tag grid, validation checklist (✓/⚠/✗), raw record display
- **SPF-specific:** Interactive include chain tree (nested, collapsible nodes), lookup counter with limit indicator
- **DKIM-specific:** Selector grid (found/not-found), custom selector input field
- **Educational tooltips:** Hovering tag names (v, p, sp, rua, etc.) shows what each means

**Interactivity:** Minimal client-side JS for expand/collapse, tooltips, and SPF tree interaction. No framework — inline `<script>` block.

## Verification Plan

1. **Unit tests:** Each analyzer module tested with mock DNS responses (known good/bad records)
2. **Integration test:** Full scan against well-known domains (google.com, cloudflare.com) to verify real-world parsing
3. **Manual GUI test:** Deploy to Cloudflare, scan several domains in browser, verify:
   - Cards expand/collapse
   - Tooltips display
   - SPF tree renders correctly
   - DKIM custom selector input works
   - "View JSON" link returns proper JSON
4. **API test:** `curl` the JSON endpoint, verify response structure and content types
5. **Edge cases:** Test domains with no records, malformed records, SPF over 10 lookups, revoked DKIM keys
