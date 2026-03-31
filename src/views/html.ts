import { CSS } from "./styles.js";
import { JS } from "./scripts.js";
import {
  esc,
  gradeClass,
  protocolCard,
  tagGrid,
  validationList,
  rawRecord,
  rawRecordExpand,
  spfTree,
  lookupCounter,
  dkimSelectorGrid,
  mtaStsPolicyTable,
  scoreSnippet,
  tierExplanationCard,
  scoringFactorsTable,
  protocolContributionGrid,
  recommendationList,
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
  <div class="landing-main">
    <div class="logo">dmar<span>check</span></div>
    <div class="tagline">DNS email security analyzer &mdash; DMARC, SPF, DKIM, BIMI &amp; MTA-STS</div>
    <form action="/check" method="GET">
      <div class="search-box">
        <input type="text" name="domain" placeholder="Enter a domain (e.g., google.com)" autofocus required>
        <button type="submit">Scan</button>
      </div>
      <details class="advanced-options">
        <summary>Advanced options</summary>
        <div class="advanced-body">
          <label for="selectors">Custom DKIM selectors</label>
          <input type="text" id="selectors" name="selectors"
                 placeholder="e.g. myselector, custom2"
                 autocomplete="off" />
          <small>Comma-separated. These are checked in addition to the 38 common selectors.</small>
        </div>
      </details>
    </form>
    <div class="examples">
      Try: <a href="/check?domain=google.com">google.com</a> &middot;
      <a href="/check?domain=github.com">github.com</a> &middot;
      <a href="/check?domain=cloudflare.com">cloudflare.com</a>
    </div>
    <div class="learn-link">Analyze message headers: <a href="https://toolbox.googleapps.com/apps/messageheader/" target="_blank" rel="noopener">Google &#8599;</a> &middot; <a href="https://mha.azurewebsites.net/" target="_blank" rel="noopener">Microsoft &#8599;</a></div>
  </div>
  <div class="landing-footer">
    <div class="api-hint">
      <span>curl</span> https://dmarcheck.cortech.online/api/check?domain=cloudflare.com
    </div>
    <div class="learn-link"><a href="/scoring">How is my score calculated?</a> &middot; <a href="https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/" target="_blank" rel="noopener">What is email security? &#8599;</a></div>
    <div class="foss-callout">
      <a href="https://github.com/schmug/dmarcheck" class="foss-link">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="#71717a" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        Free and open source &mdash; MIT License
      </a>
    </div>
  </div>
</div>`,
  );
}

function reportBody(result: ScanResult): string {
  const { dmarc, spf, dkim, bimi, mta_sts } = result.protocols;

  // DMARC card
  const dmarcSubtitle = dmarc.tags?.p
    ? `Policy: ${dmarc.tags.p}`
    : "No record";
  const dmarcRaw = dmarc.tags
    ? rawRecord(dmarc.record)
    : rawRecordExpand(dmarc.record, "Show TXT records found");
  const dmarcBody =
    tagGrid(dmarc.tags) + validationList(dmarc.validations) + dmarcRaw;

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
  const bimiRaw = bimi.tags
    ? rawRecord(bimi.record)
    : rawRecordExpand(bimi.record, "Show TXT records found");
  const bimiBody =
    tagGrid(bimi.tags) + validationList(bimi.validations) + bimiRaw;

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

  return `<div class="report">
  <div class="report-nav">
    <a href="/">&larr; New scan</a>
  </div>
  <div class="report-header">
    <div class="overall-grade ${gradeClass(result.grade)}">${esc(result.grade)}</div>
    <div class="domain-name">${esc(result.domain)}</div>
  </div>
  ${scoreSnippet(result)}
  <button class="confetti-toggle" data-grade="${esc(result.grade)}"
          aria-label="Toggle confetti" aria-pressed="false" title="Toggle confetti">&#127881;</button>
  <div class="report-meta">
    <time datetime="${esc(result.timestamp)}">Scanned ${esc(new Date(result.timestamp).toUTCString())}</time> &middot;
    <a href="/api/check?domain=${encodeURIComponent(result.domain)}">View JSON &nearr;</a> &middot;
    <a href="/check?domain=${encodeURIComponent(result.domain)}&format=csv" class="csv-download">Download CSV &darr;</a>
  </div>
  ${protocolCard("DMARC", dmarc.status, dmarcSubtitle, dmarcBody, true)}
  ${protocolCard("SPF", spf.status, spfSubtitle, spfBody, true)}
  ${protocolCard("DKIM", dkim.status, dkimSubtitle, dkimBody)}
  ${protocolCard("BIMI", bimi.status, bimiSubtitle, bimiBody)}
  ${protocolCard("MTA-STS", mta_sts.status, mtaStsSubtitle, mtaStsBody)}
  <div class="learn-link" style="margin-top:2.5rem">Analyze message headers: <a href="https://toolbox.googleapps.com/apps/messageheader/" target="_blank" rel="noopener">Google &#8599;</a> &middot; <a href="https://mha.azurewebsites.net/" target="_blank" rel="noopener">Microsoft &#8599;</a></div>
  <div class="learn-link" style="margin-top:0.4rem;margin-bottom:1rem"><a href="/scoring">How is my score calculated?</a> &middot; <a href="https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/" target="_blank" rel="noopener">What is email security? &#8599;</a></div>
  <div class="foss-callout">
    <a href="https://github.com/schmug/dmarcheck" class="foss-link">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#71717a" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Free and open source &mdash; MIT License
    </a>
  </div>
</div>`;
}

export function renderReport(result: ScanResult): string {
  return page(`${result.domain} — dmarcheck`, reportBody(result));
}

export function renderCheckLoading(domain: string, selectors: string): string {
  const qs = selectors
    ? `domain=${encodeURIComponent(domain)}&selectors=${encodeURIComponent(selectors)}`
    : `domain=${encodeURIComponent(domain)}`;

  return page(
    `Scanning ${domain} — dmarcheck`,
    `<div class="scan-loading">
  <div class="logo">dmar<span>check</span></div>
  <div class="loading">
    <div class="spinner"></div>
    <p>Scanning ${esc(domain)}&hellip;</p>
  </div>
  <noscript><meta http-equiv="refresh" content="0;url=/check?${qs}&_direct=1"></noscript>
</div>
<script>
fetch('/check?${qs}', { headers: { 'X-Scan-Fetch': '1' } })
  .then(function(r) { if (!r.ok) throw new Error(r.status); return r.text(); })
  .then(function(html) {
    var newDoc = new DOMParser().parseFromString(html, 'text/html');
    document.replaceChild(document.adoptNode(newDoc.documentElement), document.documentElement);
    Array.from(document.querySelectorAll('script')).forEach(function(old) {
      var s = document.createElement('script');
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  })
  .catch(function() { window.location.href = '/check?${qs}&_direct=1'; });
</script>`,
  );
}

export function renderScoreBreakdown(result: ScanResult): string {
  const { breakdown } = result;
  const backUrl = `/check?domain=${encodeURIComponent(result.domain)}`;

  const body = `<div class="breakdown">
  <div class="report-nav">
    <a href="${backUrl}">&larr; Back to results</a>
  </div>
  <div class="report-header">
    <div class="overall-grade ${gradeClass(result.grade)}">${esc(result.grade)}</div>
    <div class="domain-name">${esc(result.domain)}</div>
  </div>
  <div class="report-meta">
    <time datetime="${esc(result.timestamp)}">Scanned ${esc(new Date(result.timestamp).toUTCString())}</time>
  </div>
  ${tierExplanationCard(breakdown.tier, breakdown.tierReason, breakdown.grade, breakdown.modifierLabel)}
  ${scoringFactorsTable(breakdown.factors, breakdown.modifier, breakdown.modifierLabel)}
  ${protocolContributionGrid(breakdown.protocolSummaries)}
  ${recommendationList(breakdown.recommendations)}
  <div class="learn-link" style="margin-top:2rem;margin-bottom:1rem"><a href="/scoring">How is my score calculated?</a> &middot; <a href="https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/" target="_blank" rel="noopener">What is email security? &#8599;</a></div>
</div>`;

  return page(`Scoring breakdown — ${result.domain} — dmarcheck`, body);
}

export function renderScoringRubric(): string {
  const body = `<div class="breakdown">
  <div class="report-nav">
    <a href="/">&larr; Home</a>
  </div>
  <h1 class="rubric-title">Email Security Scoring</h1>
  <p class="rubric-intro">dmarcheck grades domains on five email authentication protocols. The grade is determined by a tier system based on your DMARC policy strength, then adjusted with modifiers from SPF, DKIM, and extras.</p>

  <div class="bd-card">
    <div class="bd-card-title">How the grade works</div>
    <div class="bd-card-body">
      <p class="tier-text">Your grade has two parts: a <strong>base tier</strong> determined by your DMARC policy and authentication setup, and <strong>modifiers</strong> that adjust the grade up (+) or down (&minus;) based on the quality of your configuration.</p>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">Grade tiers</div>
    <div class="bd-card-body">
      <table class="rubric-table">
        <thead><tr><th>Grade</th><th>Requirements</th></tr></thead>
        <tbody>
          <tr class="rubric-row-a">
            <td><span class="rubric-grade grade-a">A+</span></td>
            <td>DMARC p=reject + strong SPF + DKIM + <em>both</em> BIMI and MTA-STS configured</td>
          </tr>
          <tr class="rubric-row-a">
            <td><span class="rubric-grade grade-a">A</span></td>
            <td>DMARC p=reject + strong SPF (-all, within lookup limit) + DKIM + at least one extra (BIMI or MTA-STS)</td>
          </tr>
          <tr class="rubric-row-b">
            <td><span class="rubric-grade grade-a">B</span></td>
            <td>DMARC p=reject + SPF passing + DKIM passing</td>
          </tr>
          <tr class="rubric-row-c">
            <td><span class="rubric-grade grade-c">C</span></td>
            <td>DMARC p=quarantine + SPF passing + DKIM passing</td>
          </tr>
          <tr class="rubric-row-d">
            <td><span class="rubric-grade grade-c">D/D+</span></td>
            <td>DMARC policy set but missing SPF or DKIM (D+ for p=reject, D for p=quarantine)</td>
          </tr>
          <tr class="rubric-row-f">
            <td><span class="rubric-grade grade-f">F</span></td>
            <td>No DMARC record, DMARC validation failed, or policy set to none</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">Modifiers</div>
    <div class="bd-card-body">
      <p class="tier-text" style="margin-bottom:12px">Grades C through A can receive a + or &minus; modifier based on configuration quality. The modifier is the sum of these factors:</p>
      <table class="rubric-table">
        <thead><tr><th>Factor</th><th>Effect</th></tr></thead>
        <tbody>
          <tr><td>SPF uses ~all (softfail)</td><td class="effect-minus">&minus;1</td></tr>
          <tr><td>SPF uses more than 8 DNS lookups</td><td class="effect-minus">&minus;1</td></tr>
          <tr><td>SPF uses -all with &le;5 lookups</td><td class="effect-plus">+1</td></tr>
          <tr><td>Any DKIM key under 2048 bits</td><td class="effect-minus">&minus;1</td></tr>
          <tr><td>2 or more DKIM selectors found</td><td class="effect-plus">+1</td></tr>
          <tr><td>BIMI or MTA-STS configured (B tier)</td><td class="effect-plus">+1</td></tr>
          <tr><td>MTA-STS in testing mode (A tier)</td><td class="effect-minus">&minus;1</td></tr>
        </tbody>
      </table>
      <p class="tier-text" style="margin-top:12px">If the total is +1 or higher, you get a +. If &minus;1 or lower, you get a &minus;. Zero means no modifier.</p>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">The five protocols</div>
    <div class="bd-card-body">
      <div class="rubric-protocol">
        <h3>DMARC</h3>
        <p>Domain-based Message Authentication, Reporting &amp; Conformance. The policy layer that ties SPF and DKIM together and tells receivers what to do with unauthenticated mail. This is the most important factor in your grade.</p>
      </div>
      <div class="rubric-protocol">
        <h3>SPF</h3>
        <p>Sender Policy Framework. A DNS record listing which IP addresses are authorized to send mail for your domain. Receivers check the sending server's IP against this list.</p>
      </div>
      <div class="rubric-protocol">
        <h3>DKIM</h3>
        <p>DomainKeys Identified Mail. Adds a cryptographic signature to outgoing messages, proving they haven't been tampered with in transit. Key strength (2048+ bits) and multiple selectors improve your score.</p>
      </div>
      <div class="rubric-protocol">
        <h3>BIMI</h3>
        <p>Brand Indicators for Message Identification. Displays your brand logo next to authenticated messages in supporting email clients. Requires DMARC p=reject.</p>
      </div>
      <div class="rubric-protocol">
        <h3>MTA-STS</h3>
        <p>Mail Transfer Agent Strict Transport Security. Forces TLS encryption for inbound mail delivery, preventing downgrade attacks. Modes: testing (report only) and enforce (reject unencrypted).</p>
      </div>
    </div>
  </div>

  <div style="text-align:center;margin-top:2rem;margin-bottom:1rem">
    <a href="/" class="rubric-cta">Scan a domain &rarr;</a>
  </div>

  <div class="foss-callout">
    <a href="https://github.com/schmug/dmarcheck" class="foss-link">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#71717a" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Free and open source &mdash; MIT License
    </a>
  </div>
</div>`;

  return page("Email Security Scoring — dmarcheck", body);
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
