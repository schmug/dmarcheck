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
  <div class="tagline">DNS email security analyzer &mdash; DMARC, SPF, DKIM, BIMI &amp; MTA-STS &mdash; open source on <a href="https://github.com/schmug/dmarcheck">GitHub</a></div>
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
