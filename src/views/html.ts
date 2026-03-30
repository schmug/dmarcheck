import { CSS } from "./styles.js";
import { JS } from "./scripts.js";
import {
  esc,
  gradeClass,
  protocolCard,
  tagGrid,
  validationList,
  rawRecord,
  spfTree,
  lookupCounter,
  dkimSelectorGrid,
  mtaStsPolicyTable,
} from "./components.js";
import type { ScanResult } from "../analyzers/types.js";

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Free, open-source DNS email security analyzer. Check DMARC, SPF, DKIM, BIMI, and MTA-STS records for any domain.">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="Free, open-source DNS email security analyzer. Check DMARC, SPF, DKIM, BIMI, and MTA-STS records for any domain.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://dmarcheck.cortech.online">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 5 L90 25 L90 55 C90 75 70 92 50 97 C30 92 10 75 10 55 L10 25 Z' fill='none' stroke='%23f97316' stroke-width='8'/><path d='M30 52 L45 67 L72 37' fill='none' stroke='%23f97316' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/></svg>">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${body}
<script>${JS}</script>
</body>
</html>`;
}

export function renderLandingPage(): string {
  return page(
    "dmarcheck — DNS Email Security Analyzer",
    `<div class="landing">
  <div class="logo">dmar<span>check</span></div>
  <div class="tagline">DNS email security analyzer &mdash; DMARC, SPF, DKIM, BIMI &amp; MTA-STS</div>
  <form class="search-box" action="/check" method="GET">
    <input type="text" name="domain" placeholder="Enter a domain (e.g., google.com)" autofocus required>
    <button type="submit">Scan</button>
  </form>
  <div class="protocols">
    <span class="protocol-tag">DMARC</span>
    <span class="protocol-tag">SPF</span>
    <span class="protocol-tag">DKIM</span>
    <span class="protocol-tag">BIMI</span>
    <span class="protocol-tag">MTA-STS</span>
  </div>
  <div class="examples">
    Try: <a href="/check?domain=google.com">google.com</a> &middot;
    <a href="/check?domain=github.com">github.com</a> &middot;
    <a href="/check?domain=cloudflare.com">cloudflare.com</a>
  </div>
  <div class="api-hint">
    <span>curl</span> https://dmarcheck.cortech.online/api/check?domain=cloudflare.com
  </div>
  <div class="foss-callout">
    <a href="https://github.com/schmug/dmarcheck" class="foss-link">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#71717a" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Free and open source &mdash; MIT License
    </a>
  </div>
</div>`,
  );
}

export function renderReport(result: ScanResult): string {
  const { dmarc, spf, dkim, bimi, mta_sts } = result.protocols;

  // DMARC card
  const dmarcSubtitle = dmarc.tags?.p
    ? `Policy: ${dmarc.tags.p}`
    : "No record";
  const dmarcBody =
    tagGrid(dmarc.tags) + validationList(dmarc.validations) + rawRecord(dmarc.record);

  // SPF card
  const spfSubtitle = spf.record
    ? `${spf.lookups_used} of ${spf.lookup_limit} lookups used`
    : "No record";
  let spfBody = "";
  if (spf.include_tree) {
    spfBody += spfTree(spf.include_tree);
    spfBody += lookupCounter(spf.lookups_used, spf.lookup_limit);
  }
  spfBody += validationList(spf.validations);
  spfBody += rawRecord(spf.record);

  // DKIM card
  const dkimFound = Object.values(dkim.selectors).filter((s) => s.found).length;
  const dkimSubtitle =
    dkimFound > 0
      ? `${dkimFound} selector${dkimFound > 1 ? "s" : ""} found`
      : "No selectors found";
  const dkimBody =
    dkimSelectorGrid(dkim.selectors) + validationList(dkim.validations);

  // BIMI card
  const bimiSubtitle = bimi.record ? "Record found" : "No record found";
  const bimiBody =
    tagGrid(bimi.tags) + validationList(bimi.validations) + rawRecord(bimi.record);

  // MTA-STS card
  const mtaStsSubtitle = mta_sts.policy
    ? `Mode: ${mta_sts.policy.mode}`
    : "Not configured";
  let mtaStsBody = "";
  if (mta_sts.policy) {
    mtaStsBody += mtaStsPolicyTable(mta_sts.policy);
  }
  mtaStsBody += validationList(mta_sts.validations);
  if (mta_sts.dns_record) {
    mtaStsBody += rawRecord(mta_sts.dns_record);
  }

  const body = `<div class="report">
  <div class="report-nav">
    <a href="/">&larr; New scan</a>
  </div>
  <div class="report-header">
    <div class="overall-grade ${gradeClass(result.grade)}">${esc(result.grade)}</div>
    <div class="domain-name">${esc(result.domain)}</div>
  </div>
  <div class="report-meta">
    Scanned just now &middot;
    <a href="/api/check?domain=${encodeURIComponent(result.domain)}">View JSON &nearr;</a>
  </div>
  ${protocolCard("DMARC", dmarc.status, dmarcSubtitle, dmarcBody, true)}
  ${protocolCard("SPF", spf.status, spfSubtitle, spfBody, true)}
  ${protocolCard("DKIM", dkim.status, dkimSubtitle, dkimBody)}
  ${protocolCard("BIMI", bimi.status, bimiSubtitle, bimiBody)}
  ${protocolCard("MTA-STS", mta_sts.status, mtaStsSubtitle, mtaStsBody)}
</div>`;

  return page(`${result.domain} — dmarcheck`, body);
}

export function renderError(message: string): string {
  return page(
    "Error — dmarcheck",
    `<div class="landing">
  <div class="logo">dmar<span>check</span></div>
  <div class="error-box">
    <h3>Error</h3>
    <p>${esc(message)}</p>
  </div>
  <a href="/">&larr; Try again</a>
</div>`,
  );
}
