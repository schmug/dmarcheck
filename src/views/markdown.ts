import type { ScanResult, Validation } from "../analyzers/types.js";

// Markdown renderings for agent consumers that send `Accept: text/markdown`.
// Output is plain markdown with no HTML fragments — agents are expected to
// feed this straight into an LLM or a text diff.

const MD_SITE = "https://dmarc.mx";

function bullet(items: string[]): string {
  return items.length === 0 ? "" : items.map((s) => `- ${s}`).join("\n");
}

function validationLines(validations: Validation[]): string {
  if (validations.length === 0) return "- _(no findings)_";
  return validations.map((v) => `- **${v.status}** — ${v.message}`).join("\n");
}

export function renderLandingMarkdown(): string {
  return `# dmarcheck — DNS Email Security Analyzer

Free, open-source scanner that grades a domain's DMARC, SPF, DKIM, BIMI, and MTA-STS DNS posture.

## Scan a domain

\`\`\`
curl -H 'Accept: application/json' '${MD_SITE}/api/check?domain=example.com'
\`\`\`

Or render this page as a human report: <${MD_SITE}/check?domain=example.com>.

## API discovery

- Catalog: <${MD_SITE}/.well-known/api-catalog> (\`application/linkset+json\`, RFC 9727)
- OpenAPI 3.1: <${MD_SITE}/openapi.json>
- Human docs: <${MD_SITE}/docs/api>
- Health: <${MD_SITE}/health>

## Resources

- Scoring rubric: <${MD_SITE}/scoring>
- Learn: <${MD_SITE}/learn> (DMARC, SPF, DKIM, BIMI, MTA-STS)
- Source: <https://github.com/schmug/dmarcheck>

Rate limited to 10 requests per minute per IP.
`;
}

export function renderReportMarkdown(result: ScanResult): string {
  const { domain, timestamp, grade, breakdown, summary, protocols } = result;

  const recs = breakdown.recommendations
    .sort((a, b) => a.priority - b.priority)
    .map(
      (r) =>
        `- **P${r.priority} · ${r.protocol.toUpperCase()}** — ${r.title}. ${r.description} _(${r.impact})_`,
    )
    .join("\n");

  const factors = breakdown.factors
    .map(
      (f) =>
        `- ${f.protocol.toUpperCase()}: ${f.label} (${f.effect >= 0 ? "+" : ""}${f.effect})`,
    )
    .join("\n");

  return `# ${domain} — Grade ${grade}

_Scanned ${timestamp}_

**Tier:** ${breakdown.tier} — ${breakdown.tierReason}
**Modifier:** ${breakdown.modifierLabel} (${breakdown.modifier >= 0 ? "+" : ""}${breakdown.modifier})

## Summary

- MX records: ${summary.mx_records}${summary.mx_providers.length ? ` (${summary.mx_providers.join(", ")})` : ""}
- DMARC policy: ${summary.dmarc_policy ?? "_none_"}
- SPF: ${summary.spf_result} (${summary.spf_lookups})
- DKIM selectors found: ${summary.dkim_selectors_found}
- BIMI: ${summary.bimi_enabled ? "enabled" : "not configured"}
- MTA-STS mode: ${summary.mta_sts_mode ?? "_none_"}

## Recommendations

${recs || "- _(no recommendations — nicely done)_"}

## Scoring factors

${factors || "- _(no factors)_"}

## DMARC — ${protocols.dmarc.status}

${protocols.dmarc.record ? `\`\`\`\n${protocols.dmarc.record}\n\`\`\`` : "_No DMARC record found._"}

${validationLines(protocols.dmarc.validations)}

## SPF — ${protocols.spf.status}

${protocols.spf.record ? `\`\`\`\n${protocols.spf.record}\n\`\`\`` : "_No SPF record found._"}

Lookups used: ${protocols.spf.lookups_used} / ${protocols.spf.lookup_limit}

${validationLines(protocols.spf.validations)}

## DKIM — ${protocols.dkim.status}

${renderDkimSelectors(protocols.dkim.selectors)}

${validationLines(protocols.dkim.validations)}

## BIMI — ${protocols.bimi.status}

${protocols.bimi.record ? `\`\`\`\n${protocols.bimi.record}\n\`\`\`` : "_No BIMI record found._"}

${validationLines(protocols.bimi.validations)}

## MTA-STS — ${protocols.mta_sts.status}

${protocols.mta_sts.dns_record ? `\`\`\`\n${protocols.mta_sts.dns_record}\n\`\`\`` : "_No MTA-STS DNS record found._"}

${protocols.mta_sts.policy ? `Policy: mode=${protocols.mta_sts.policy.mode}, max_age=${protocols.mta_sts.policy.max_age}, mx=[${protocols.mta_sts.policy.mx.join(", ")}]` : ""}

${validationLines(protocols.mta_sts.validations)}

## MX — ${protocols.mx.status}

${bullet(protocols.mx.records.map((r) => `${r.priority} ${r.exchange}${r.provider ? ` _(${r.provider.name})_` : ""}`)) || "_No MX records found._"}

${validationLines(protocols.mx.validations)}

---

JSON: <${MD_SITE}/api/check?domain=${encodeURIComponent(domain)}>
`;
}

function renderDkimSelectors(
  selectors: ScanResult["protocols"]["dkim"]["selectors"],
): string {
  const entries = Object.entries(selectors);
  if (entries.length === 0) return "_No DKIM selectors probed._";
  return entries
    .map(([name, r]) => {
      if (!r.found) return `- \`${name}\` — not found`;
      const parts: string[] = [];
      if (r.key_type) parts.push(r.key_type);
      if (r.key_bits) parts.push(`${r.key_bits} bits`);
      if (r.testing) parts.push("testing");
      if (r.revoked) parts.push("revoked");
      return `- \`${name}\` — ${parts.join(", ") || "found"}`;
    })
    .join("\n");
}

export function renderApiDocsMarkdown(): string {
  return `# dmarcheck API

Public, unauthenticated HTTP API for grading a domain's email-security DNS posture.

**Base URL:** \`${MD_SITE}\`
**Rate limit:** 10 requests per minute per IP (see \`X-RateLimit-*\` response headers).

## Discovery

- **Catalog** (RFC 9727): \`GET /.well-known/api-catalog\` → \`application/linkset+json\`
- **OpenAPI 3.1**: \`GET /openapi.json\` → \`application/openapi+json\`
- **Health**: \`GET /health\` → \`{ "status": "ok", "timestamp": "..." }\`

## Endpoints

### \`GET /api/check\`

Scan a domain and return the graded result as JSON.

Query params:

- \`domain\` _(required)_ — \`[a-z0-9.-]+\`, e.g. \`example.com\`
- \`selectors\` _(optional)_ — comma-separated extra DKIM selectors
- \`format\` _(optional)_ — \`json\` (default) or \`csv\`

Example:

\`\`\`
curl -H 'Accept: application/json' '${MD_SITE}/api/check?domain=dmarc.mx'
\`\`\`

### \`GET /api/check/stream\`

Same scan but Server-Sent Events. Emits \`protocol\` events per analyzer, then a \`done\` event with header/footer HTML fragments.

### \`GET /check\`

Content-negotiated human endpoint.

- Default: HTML
- \`Accept: application/json\` → JSON (same shape as \`/api/check\`)
- \`Accept: text/markdown\` → this rendering, for agents
- \`format=csv\` → CSV download

## Response shape

See \`ScanResult\` in <${MD_SITE}/openapi.json>. Summary:

\`\`\`
{
  "domain": "example.com",
  "timestamp": "2026-04-17T12:00:00Z",
  "grade": "A",
  "breakdown": { "grade", "tier", "factors", "recommendations", ... },
  "summary": { "dmarc_policy", "spf_result", "dkim_selectors_found", ... },
  "protocols": {
    "mx":      { "status", "records", "providers", "validations" },
    "dmarc":   { "status", "record", "tags", "validations" },
    "spf":     { "status", "record", "lookups_used", "include_tree", ... },
    "dkim":    { "status", "selectors", "validations" },
    "bimi":    { "status", "record", "tags", "validations" },
    "mta_sts": { "status", "dns_record", "policy", "validations" }
  }
}
\`\`\`

## Errors

- \`400\` — missing or invalid \`domain\` param
- \`429\` — rate limit exceeded

## Source

<https://github.com/schmug/dmarcheck>
`;
}

export function renderScoringRubricMarkdown(): string {
  return `# dmarcheck scoring rubric

The grade (S, A+, A, B, C, D, F) is computed from a tier + modifier model. Full logic: <https://github.com/schmug/dmarcheck/blob/main/src/shared/scoring.ts>.

- **F** — domain has no DMARC record or DMARC \`p=none\`.
- **D / C** — DMARC present but weak; SPF/DKIM issues.
- **B** — DMARC enforced (quarantine/reject) with SPF + DKIM aligned.
- **A / A+** — Full DMARC enforcement, SPF + DKIM correct, MTA-STS enforced.
- **S** — All of the above plus BIMI with a valid VMC.

Run a scan: \`${MD_SITE}/check?domain=example.com\` (add \`Accept: text/markdown\` for this format).
`;
}

export function renderLearnHubMarkdown(): string {
  return `# Learn — email security DNS records

- [DMARC](${MD_SITE}/learn/dmarc) — policy layer on top of SPF + DKIM
- [SPF](${MD_SITE}/learn/spf) — authorized sending IPs
- [DKIM](${MD_SITE}/learn/dkim) — cryptographic signatures
- [BIMI](${MD_SITE}/learn/bimi) — brand logos in inboxes
- [MTA-STS](${MD_SITE}/learn/mta-sts) — TLS enforcement for inbound mail

Run a scan: ${MD_SITE}/check?domain=example.com
`;
}

export function renderErrorMarkdown(message: string): string {
  return `# Error

${message}

Try again: <${MD_SITE}>
`;
}
