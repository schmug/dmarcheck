import type {
  DkimSelectorResult,
  EmailProvider,
  MtaStsPolicy,
  MxRecord,
  ScanResult,
  SpfIncludeNode,
  Status,
  Validation,
} from "../analyzers/types.js";
import type { Recommendation, ScoringFactor } from "../shared/scoring.js";

const DMARC_TOOLTIPS: Record<string, string> = {
  v: "Version — must be DMARC1",
  p: "Policy — what to do with failing messages (none/quarantine/reject)",
  sp: "Subdomain policy — overrides p= for subdomains",
  rua: "Aggregate report URI — where to send daily XML reports",
  ruf: "Forensic report URI — where to send per-failure reports",
  pct: "Percentage — % of messages subject to the policy",
  adkim: "DKIM alignment — strict (s) or relaxed (r)",
  aspf: "SPF alignment — strict (s) or relaxed (r)",
  fo: "Failure options — when to generate forensic reports",
  ri: "Report interval — seconds between aggregate reports",
};

const HAS_ESCAPE_RE = /[&<>"']/;

export function esc(s: string): string {
  // ⚡ Bolt Optimization: Early return for strings that don't need escaping.
  // Avoids unconditional regex replacements for the vast majority of strings.
  // For strings that do need escaping, a single-pass loop avoids creating
  // 5 intermediate strings, reducing GC pressure and making HTML rendering
  // ~2-3x faster.
  if (!HAS_ESCAPE_RE.test(s)) return s;

  let res = "";
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 38) {
      res += `${s.substring(last, i)}&amp;`;
      last = i + 1;
    } else if (c === 60) {
      res += `${s.substring(last, i)}&lt;`;
      last = i + 1;
    } else if (c === 62) {
      res += `${s.substring(last, i)}&gt;`;
      last = i + 1;
    } else if (c === 34) {
      res += `${s.substring(last, i)}&quot;`;
      last = i + 1;
    } else if (c === 39) {
      res += `${s.substring(last, i)}&#39;`;
      last = i + 1;
    }
  }
  return res + s.substring(last);
}

export function gradeClass(grade: string): string {
  if (grade === "S") return "grade-s";
  const letter = grade.charAt(0).toUpperCase();
  if (letter === "A" || letter === "B") return "grade-a";
  if (letter === "C" || letter === "D") return "grade-c";
  return "grade-f";
}

export type CreatureSize = "lg" | "md" | "sm";
export type CreatureMood =
  | "celebrating"
  | "content"
  | "worried"
  | "scared"
  | "panicked";

export function generateCreature(
  size: CreatureSize,
  mood?: CreatureMood,
  partyHat?: boolean,
): string {
  const moodClass = mood ? ` creature-${mood}` : "";
  const hatClass = partyHat ? " creature-partying" : "";
  const hatHtml = partyHat ? '<div class="creature-hat"></div>' : "";
  return `<div class="creature creature-${size}${moodClass}${hatClass}" aria-hidden="true">
  ${hatHtml}<div class="creature-body">@<div class="creature-eyes"><div class="creature-eye"><div class="creature-pupil"></div></div><div class="creature-eye"><div class="creature-pupil"></div></div></div></div>
  <div class="creature-legs"><div class="creature-leg"></div><div class="creature-leg"></div><div class="creature-leg"></div></div>
</div>`;
}

export function themeToggle(): string {
  return '<button class="theme-toggle" aria-label="Toggle theme" title="Toggle theme"></button>';
}

// TODO: gate on session state once a request-scoped session helper exists
// outside src/auth/middleware.ts.
export function navLoginButton(): string {
  return `<a href="/auth/login" class="nav-login" aria-label="Log in to monitor a domain (free)">
  <span class="nav-login-avatar">${generateCreature("sm")}</span>
  <span class="nav-login-label">Log in to monitor</span>
  <span class="nav-login-arrow" aria-hidden="true">&#8599;</span>
</a>`;
}

export function monitorSnapshotCard(result: ScanResult): string {
  const { domain, protocols, timestamp } = result;
  const policy = protocols.dmarc.tags?.p;
  const dmarcOk = policy === "reject" || policy === "quarantine";
  const spfOk = protocols.spf.status === "pass";
  const dkimCount = Object.values(protocols.dkim.selectors).filter(
    (s) => s.found,
  ).length;
  const bimiOk = !!protocols.bimi.tags;
  const nextUrl = `/auth/login?next=/dashboard&prompt=monitor:${encodeURIComponent(domain)}`;
  const stamp = new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const row = (ok: boolean, label: string, value: string): string =>
    `<div class="snap-row${ok ? "" : " snap-row-muted"}">
      <span class="snap-mark">${ok ? "+" : "\u00b7"}</span>
      <span class="snap-label">${esc(label)}</span>
      <span class="snap-val">${esc(value)}</span>
    </div>`;

  const spfValue = protocols.spf.record
    ? `${protocols.spf.lookups_used}/${protocols.spf.lookup_limit} lookups`
    : "not set";
  const dkimValue =
    dkimCount > 0
      ? `${dkimCount} selector${dkimCount > 1 ? "s" : ""}`
      : "none found";
  const bimiValue = bimiOk ? "configured" : "not configured";
  const dmarcValue = policy ? `p=${policy}` : "not set";

  return `<section class="monitor-card" aria-labelledby="monitor-card-title">
  <div class="monitor-snap">
    <div class="monitor-eyebrow">Snapshot &middot; ${esc(stamp)}</div>
    <div id="monitor-card-title" class="monitor-snap-heading">We'd tell you if any of this changed:</div>
    <div class="snap-list">
      ${row(dmarcOk, "DMARC policy", dmarcValue)}
      ${row(spfOk, "SPF", spfValue)}
      ${row(dkimCount > 0, "DKIM", dkimValue)}
      ${row(bimiOk, "BIMI", bimiValue)}
    </div>
  </div>
  <div class="monitor-divider" aria-hidden="true"></div>
  <div class="monitor-pitch">
    <p class="monitor-pitch-lede">Monitor <strong>${esc(domain)}</strong> and we'll re-run this check every 24 hours. You'll get an email the moment anything drifts.</p>
    <div class="monitor-cta-row">
      <a href="${esc(nextUrl)}" class="monitor-cta">Start monitoring</a>
      <span class="monitor-cta-meta">free &middot; no card &middot; MIT open source</span>
    </div>
  </div>
</section>`;
}

export function gradeToMood(grade: string): CreatureMood {
  if (grade === "S") return "celebrating";
  const letter = grade.charAt(0).toUpperCase();
  if (letter === "A") return "celebrating";
  if (letter === "B") return "content";
  if (letter === "C") return "worried";
  if (letter === "D") return "scared";
  return "panicked";
}

export function statusDot(status: Status): string {
  const label =
    status === "pass"
      ? "Status: passing"
      : status === "warn"
        ? "Status: warning"
        : status === "info"
          ? "Status: informational"
          : "Status: failing";
  return `<div class="status-dot status-${status}" role="img" aria-label="${label}"></div>`;
}

export function validationList(validations: Validation[]): string {
  const items = validations
    .map((v) => {
      const icon =
        v.status === "pass"
          ? '<span class="icon-pass" aria-hidden="true">&#10003;</span>'
          : v.status === "warn"
            ? '<span class="icon-warn" aria-hidden="true">&#9888;</span>'
            : v.status === "info"
              ? '<span class="icon-info" aria-hidden="true">&#9432;</span>'
              : '<span class="icon-fail" aria-hidden="true">&#10007;</span>';
      return `<li>${icon} ${esc(v.message)}</li>`;
    })
    .join("");
  return `<ul class="validation-list">${items}</ul>`;
}

export function rawRecord(record: string | null): string {
  if (!record) return "";
  return `<div class="record-raw"><code>${esc(record)}</code><button class="copy-btn" data-copy="${esc(record)}" aria-label="Copy DNS record">Copy</button></div>`;
}

export function rawRecordExpand(record: string | null, label: string): string {
  if (!record) return "";
  return `<details class="record-expand"><summary>${esc(label)}</summary><div class="record-raw"><code>${esc(record)}</code></div></details>`;
}

export function tagGrid(
  tags: Record<string, string> | null,
  tooltips: Record<string, string> = DMARC_TOOLTIPS,
): string {
  if (!tags) return "";
  let rows = "";
  // ⚡ Bolt Optimization: Use for...in instead of Object.entries().map()
  // Reduces GC pressure by avoiding array allocations on hot rendering paths
  for (const key in tags) {
    const value = tags[key];
    const tip = tooltips[key]
      ? `<span class="tooltip" tabindex="0" aria-label="${esc(key)}: ${esc(tooltips[key])}">${esc(key)}<span class="tooltip-text" aria-hidden="true">${esc(tooltips[key])}</span></span>`
      : esc(key);
    rows += `<span class="tag-name">${tip}</span><span class="tag-value">${esc(value)}</span>`;
  }
  return `<div class="tag-grid">${rows}</div>`;
}

export function protocolCard(
  name: string,
  status: Status,
  subtitle: string,
  body: string,
  expanded = false,
  learnSlug?: string,
): string {
  const learnLink = learnSlug
    ? `<div class="card-learn-link"><a href="/learn/${esc(learnSlug)}">Learn about ${esc(name)} &rarr;</a></div>`
    : "";
  return `<div class="card${expanded ? " expanded" : ""}">
  <div class="card-header" role="button" tabindex="0" aria-expanded="${expanded ? "true" : "false"}">
    ${statusDot(status)}
    <div class="card-title">${esc(name)}</div>
    <div class="card-subtitle">${esc(subtitle)}</div>
    <div class="card-chevron" aria-hidden="true">&#9654;</div>
  </div>
  <div class="card-body">${body}${learnLink}</div>
</div>`;
}

export function spfTree(node: SpfIncludeNode): string {
  const items = node.mechanisms
    .map((m) => {
      const bare = m.replace(/^[+\-~?]/, "");
      if (bare.startsWith("include:") || bare.startsWith("redirect=")) {
        return "";
      }
      return `<li><span class="spf-node mechanism">${esc(m)}</span></li>`;
    })
    .filter(Boolean)
    .join("");

  const includes = node.includes
    .map((child) => {
      const inner = spfTreeInner(child);
      const isExpandable = inner !== "";
      const attrs = isExpandable
        ? ` role="button" tabindex="0" aria-expanded="true"`
        : "";
      return `<li><span class="spf-node include"${attrs}>${esc(`include:${child.domain}`)}</span>${inner}</li>`;
    })
    .join("");

  return `<div class="spf-tree"><ul>${items}${includes}</ul></div>`;
}

function spfTreeInner(node: SpfIncludeNode): string {
  if (!node.record) return "";
  const items = node.mechanisms
    .map((m) => {
      const bare = m.replace(/^[+\-~?]/, "");
      if (bare.startsWith("include:") || bare.startsWith("redirect="))
        return "";
      return `<li><span class="spf-node mechanism">${esc(m)}</span></li>`;
    })
    .filter(Boolean)
    .join("");

  const includes = node.includes
    .map((child) => {
      const inner = spfTreeInner(child);
      const isExpandable = inner !== "";
      const attrs = isExpandable
        ? ` role="button" tabindex="0" aria-expanded="true"`
        : "";
      return `<li><span class="spf-node include"${attrs}>${esc(`include:${child.domain}`)}</span>${inner}</li>`;
    })
    .join("");

  if (!items && !includes) return "";
  return `<ul>${items}${includes}</ul>`;
}

export function lookupCounter(used: number, limit: number): string {
  const cls = used > limit ? "lookup-over" : "lookup-ok";
  return `<div class="lookup-count ${cls}">${used} / ${limit} DNS lookups used</div>`;
}

export function dkimSelectorGrid(
  selectors: Record<string, DkimSelectorResult>,
): string {
  const found = Object.entries(selectors).filter(([, v]) => v.found);
  const notFound = Object.entries(selectors).filter(([, v]) => !v.found);

  const foundItems = found
    .map(
      ([name, info]) =>
        `<div class="selector-item selector-found"><span class="icon-pass" style="font-size:0.7rem">&#10003;</span> ${esc(name)}${info.key_bits ? ` <span style="color:var(--clr-text-dim);font-size:0.7rem">${info.key_bits}bit</span>` : ""}</div>`,
    )
    .join("");

  // Only show first 6 not-found to keep it manageable
  const notFoundItems = notFound
    .slice(0, 6)
    .map(
      ([name]) =>
        `<div class="selector-item selector-not-found"><span style="font-size:0.7rem;color:var(--clr-text-faint)">&#10007;</span> ${esc(name)}</div>`,
    )
    .join("");

  const extra =
    notFound.length > 6
      ? `<div class="selector-item selector-not-found" style="color:var(--clr-text-faint)">+${notFound.length - 6} more not found</div>`
      : "";

  return `<div class="selector-grid">${foundItems}${notFoundItems}${extra}</div>`;
}

export function mtaStsPolicyTable(policy: MtaStsPolicy): string {
  return `<table class="policy-table">
  <tr><th>Field</th><th>Value</th></tr>
  <tr><td>version</td><td>${esc(policy.version)}</td></tr>
  <tr><td>mode</td><td>${esc(policy.mode)}</td></tr>
  <tr><td>mx</td><td>${policy.mx.map(esc).join(", ") || "—"}</td></tr>
  <tr><td>max_age</td><td>${policy.max_age.toLocaleString()}s</td></tr>
</table>`;
}

const CATEGORY_LABELS: Record<EmailProvider["category"], string> = {
  "security-gateway": "Gateway",
  "email-platform": "Platform",
  hosting: "Hosting",
};

export function providerBadge(provider: EmailProvider): string {
  const label = CATEGORY_LABELS[provider.category];
  return `<span class="provider-badge">${esc(provider.name)} <span class="badge-category">${label}</span></span>`;
}

export function mxTable(records: MxRecord[]): string {
  if (records.length === 0) return "";

  const rows = records
    .map((r) => {
      const providerCell = r.provider ? providerBadge(r.provider) : "";
      return `<tr class="mx-row"><td class="mx-priority">${r.priority}</td><td class="mx-exchange">${esc(r.exchange)}</td><td class="mx-provider">${providerCell}</td></tr>`;
    })
    .join("");

  return `<table class="mx-table">
  <thead><tr><th>Priority</th><th>Exchange</th><th>Provider</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

// ── Scoring breakdown components ───────────────────────────────

const PROTO_LABELS: Record<string, string> = {
  dmarc: "DMARC",
  spf: "SPF",
  dkim: "DKIM",
  bimi: "BIMI",
  mta_sts: "MTA-STS",
};

export function scoreSnippet(result: ScanResult): string {
  const { breakdown, domain } = result;
  const selectors = new URL(
    `https://x/check?domain=${encodeURIComponent(domain)}`,
  ).search;
  const scoreUrl = `/check/score${selectors}`;

  let dots = "";
  // ⚡ Bolt Optimization: Use for...in instead of Object.entries().map()
  // Reduces GC pressure by avoiding array allocations on hot rendering paths
  for (const key in breakdown.protocolSummaries) {
    const status = breakdown.protocolSummaries[key].status;
    dots += `<span class="snippet-proto"><span class="snippet-dot status-${status}"></span>${PROTO_LABELS[key] ?? key}</span>`;
  }

  const tierClass =
    breakdown.tier === "F"
      ? "tier-fail"
      : breakdown.tier === "D"
        ? "tier-warn"
        : "tier-pass";

  return `<div class="score-snippet">
  <div class="snippet-left">
    <div class="snippet-tier"><span class="${tierClass}">${esc(breakdown.tier)} tier</span> &mdash; ${esc(breakdown.tierReason)}</div>
    <div class="snippet-protocols">${dots}</div>
  </div>
  <a class="snippet-link" href="${scoreUrl}">View scoring breakdown &rarr;</a>
</div>`;
}

export function tierExplanationCard(
  tier: string,
  tierReason: string,
  grade: string,
  modifierLabel: string,
): string {
  const tierText =
    tier === "A+"
      ? `Your domain achieves a <span class="tier-pass">perfect score</span>. DMARC policy is set to reject, SPF and DKIM are strong, and both BIMI and MTA-STS are configured.`
      : tier === "F"
        ? `<span class="tier-fail">${esc(tierReason)}</span>. DMARC is the foundation of email authentication &mdash; without it, receivers have no policy for handling unauthenticated mail from your domain.`
        : `${esc(tierReason)} &mdash; this earns a <span class="tier-pass">${esc(tier)}-tier</span> base grade.${modifierLabel ? ` Scoring modifiers adjusted the final grade to <span class="tier-pass">${esc(grade)}</span>.` : ""}`;

  return `<div class="bd-card">
  <div class="bd-card-title">Why you got this grade</div>
  <div class="bd-card-body">
    <div class="tier-text">${tierText}</div>
  </div>
</div>`;
}

export function scoringFactorsTable(
  factors: ScoringFactor[],
  modifier: number,
  modifierLabel: string,
): string {
  if (factors.length === 0) {
    return "";
  }

  const rows = factors
    .map((f) => {
      const effectClass =
        f.effect > 0
          ? "effect-plus"
          : f.effect < 0
            ? "effect-minus"
            : "effect-neutral";
      const effectText = f.effect > 0 ? "+1" : f.effect < 0 ? "\u22121" : "0";
      return `<tr>
      <td class="factor-proto">${esc(PROTO_LABELS[f.protocol] ?? f.protocol)}</td>
      <td class="factor-label">${esc(f.label)}</td>
      <td class="factor-effect ${effectClass}">${effectText}</td>
    </tr>`;
    })
    .join("");

  const summary =
    factors.length > 1
      ? `<div class="modifier-summary">
      <span>Net modifier: ${factors.map((f) => (f.effect > 0 ? "+1" : f.effect < 0 ? "\u22121" : "0")).join(" ")} = ${modifier > 0 ? "+" : ""}${modifier}</span>
      <span class="modifier-result">&rarr; ${modifierLabel ? modifierLabel : "no change"}</span>
    </div>`
      : "";

  return `<div class="bd-card">
  <div class="bd-card-title">Scoring factors</div>
  <div class="bd-card-body">
    <table class="factors-table">
      ${rows}
    </table>
    ${summary}
  </div>
</div>`;
}

export function protocolContributionGrid(
  summaries: Record<string, { status: Status; summary: string }>,
): string {
  let cells = "";
  // ⚡ Bolt Optimization: Use for...in instead of Object.entries().map()
  // Reduces GC pressure by avoiding array allocations on hot rendering paths
  for (const key in summaries) {
    const { status, summary } = summaries[key];
    cells += `<div class="proto-cell">
      <div class="snippet-dot status-${status}" style="margin:0 auto 6px"></div>
      <div class="proto-name">${esc(PROTO_LABELS[key] ?? key)}</div>
      <div class="proto-summary">${esc(summary)}</div>
    </div>`;
  }

  return `<div class="bd-card">
  <div class="bd-card-title">Protocol contributions</div>
  <div class="bd-card-body">
    <div class="proto-grid">${cells}</div>
  </div>
</div>`;
}

export function recommendationList(recommendations: Recommendation[]): string {
  if (recommendations.length === 0) {
    return `<div class="bd-card">
  <div class="bd-card-title">How to improve</div>
  <div class="bd-card-body">
    <div class="tier-text">Nothing to improve &mdash; your email security configuration is fully optimized.</div>
  </div>
</div>`;
  }

  const items = recommendations
    .map(
      (r) =>
        `<div class="rec-item">
      <div class="rec-priority priority-${r.priority}">P${r.priority}</div>
      <div class="rec-content">
        <div class="rec-title">${esc(r.title)}</div>
        <div class="rec-desc">${esc(r.description)}</div>
        <div class="rec-impact">${esc(r.impact)}</div>
      </div>
    </div>`,
    )
    .join("");

  return `<div class="bd-card">
  <div class="bd-card-title">How to improve</div>
  <div class="bd-card-body">${items}</div>
</div>`;
}
