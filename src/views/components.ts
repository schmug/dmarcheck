import type {
  Status,
  Validation,
  SpfIncludeNode,
  DkimSelectorResult,
  MtaStsPolicy,
} from "../analyzers/types.js";

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

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function gradeClass(grade: string): string {
  const letter = grade.charAt(0).toUpperCase();
  if (letter === "A" || letter === "B") return "grade-a";
  if (letter === "C" || letter === "D") return "grade-c";
  return "grade-f";
}

export function statusDot(status: Status): string {
  return `<div class="status-dot status-${status}"></div>`;
}

export function validationList(validations: Validation[]): string {
  const items = validations
    .map((v) => {
      const icon =
        v.status === "pass"
          ? '<span class="icon-pass">&#10003;</span>'
          : v.status === "warn"
            ? '<span class="icon-warn">&#9888;</span>'
            : '<span class="icon-fail">&#10007;</span>';
      return `<li>${icon} ${esc(v.message)}</li>`;
    })
    .join("");
  return `<ul class="validation-list">${items}</ul>`;
}

export function rawRecord(record: string | null): string {
  if (!record) return "";
  return `<div class="record-raw"><code>${esc(record)}</code><button class="copy-btn" data-copy="${esc(record)}" aria-label="Copy DNS record">Copy</button></div>`;
}

export function tagGrid(
  tags: Record<string, string> | null,
  tooltips: Record<string, string> = DMARC_TOOLTIPS,
): string {
  if (!tags) return "";
  const rows = Object.entries(tags)
    .map(([key, value]) => {
      const tip = tooltips[key]
        ? `<span class="tooltip">${esc(key)}<span class="tooltip-text">${esc(tooltips[key])}</span></span>`
        : esc(key);
      return `<span class="tag-name">${tip}</span><span class="tag-value">${esc(value)}</span>`;
    })
    .join("");
  return `<div class="tag-grid">${rows}</div>`;
}

export function protocolCard(
  name: string,
  status: Status,
  subtitle: string,
  body: string,
  expanded = false,
): string {
  return `<div class="card${expanded ? " expanded" : ""}">
  <div class="card-header">
    ${statusDot(status)}
    <div class="card-title">${esc(name)}</div>
    <div class="card-subtitle">${esc(subtitle)}</div>
    <div class="card-chevron">&#9654;</div>
  </div>
  <div class="card-body">${body}</div>
</div>`;
}

export function spfTree(node: SpfIncludeNode): string {
  const items = node.mechanisms
    .map((m) => {
      const bare = m.replace(/^[+\-~?]/, "");
      if (
        bare.startsWith("include:") ||
        bare.startsWith("redirect=")
      ) {
        return "";
      }
      return `<li><span class="spf-node mechanism">${esc(m)}</span></li>`;
    })
    .filter(Boolean)
    .join("");

  const includes = node.includes
    .map(
      (child) =>
        `<li><span class="spf-node include">${esc(`include:${child.domain}`)}</span>${spfTreeInner(child)}</li>`,
    )
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
    .map(
      (child) =>
        `<li><span class="spf-node include">${esc(`include:${child.domain}`)}</span>${spfTreeInner(child)}</li>`,
    )
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
        `<div class="selector-item selector-found"><span class="icon-pass" style="font-size:0.7rem">&#10003;</span> ${esc(name)}${info.key_bits ? ` <span style="color:#71717a;font-size:0.7rem">${info.key_bits}bit</span>` : ""}</div>`,
    )
    .join("");

  // Only show first 6 not-found to keep it manageable
  const notFoundItems = notFound
    .slice(0, 6)
    .map(
      ([name]) =>
        `<div class="selector-item selector-not-found"><span style="font-size:0.7rem;color:#52525b">&#10007;</span> ${esc(name)}</div>`,
    )
    .join("");

  const extra =
    notFound.length > 6
      ? `<div class="selector-item selector-not-found" style="color:#52525b">+${notFound.length - 6} more not found</div>`
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
