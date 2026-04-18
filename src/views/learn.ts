import { esc, generateCreature } from "./components.js";
import { page, SITE_ORIGIN } from "./html.js";

// Learn pages are tutorial/deep-dive content — distinct in shape from the
// /scoring page which owns the FAQPage schema. These pages emit TechArticle +
// BreadcrumbList so search engines treat them as a separate lane. Do not copy
// prose verbatim from SCORING_JSON_LD or the /scoring page — paraphrase.

// Bump when materially editing any learn page prose. It lives here rather than
// per-function so all five stay in sync by default.
const LEARN_PUBLISHED = "2026-04-11";

interface LearnPageOptions {
  protocol: string; // "DMARC"
  slug: string; // "dmarc" — matches the route
  title: string; // <title> / og:title
  headline: string; // TechArticle.headline (also rendered as the H1)
  description: string; // meta description + og:description
  body: string; // inner HTML for <main>
}

function learnJsonLd(opts: {
  protocol: string;
  slug: string;
  headline: string;
  description: string;
}): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: opts.headline,
        description: opts.description,
        datePublished: LEARN_PUBLISHED,
        dateModified: LEARN_PUBLISHED,
        author: {
          "@type": "Organization",
          name: "dmarcheck",
          url: `${SITE_ORIGIN}/`,
        },
        publisher: {
          "@type": "Organization",
          name: "dmarcheck",
          url: `${SITE_ORIGIN}/`,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_ORIGIN}/logo.svg`,
          },
        },
        image: `${SITE_ORIGIN}/og-image.png`,
        mainEntityOfPage: `${SITE_ORIGIN}/learn/${opts.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "dmarcheck",
            item: `${SITE_ORIGIN}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Learn",
            item: `${SITE_ORIGIN}/learn`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: opts.protocol,
            item: `${SITE_ORIGIN}/learn/${opts.slug}`,
          },
        ],
      },
    ],
  });
}

const LEARN_SIBLINGS: Array<{ slug: string; protocol: string; blurb: string }> =
  [
    {
      slug: "dmarc",
      protocol: "DMARC",
      blurb: "Policy records, alignment, and reporting.",
    },
    {
      slug: "spf",
      protocol: "SPF",
      blurb: "Authorized senders and the 10-lookup budget.",
    },
    {
      slug: "dkim",
      protocol: "DKIM",
      blurb: "Signing keys, selectors, and rotation.",
    },
    {
      slug: "bimi",
      protocol: "BIMI",
      blurb: "Logos in the inbox and VMC/CMC certificates.",
    },
    {
      slug: "mta-sts",
      protocol: "MTA-STS",
      blurb: "TLS enforcement for inbound mail.",
    },
  ];

function siblingLinks(currentSlug: string): string {
  const items = LEARN_SIBLINGS.filter((s) => s.slug !== currentSlug)
    .map(
      (s) =>
        `<li><a href="/learn/${s.slug}"><strong>${s.protocol}</strong> &mdash; ${s.blurb}</a></li>`,
    )
    .join("");
  return `<ul class="learn-siblings">${items}</ul>`;
}

function learnCta(placeholder: string): string {
  return `<div class="bd-card">
    <div class="bd-card-title">Check your domain</div>
    <div class="bd-card-body">
      <form action="/check" method="GET" class="learn-cta-form">
        <div class="search-box">
          <input type="text" name="domain" placeholder="${esc(placeholder)}" aria-label="Enter a domain" autocapitalize="none" autocorrect="off" spellcheck="false" required>
          <button type="submit">Scan</button>
        </div>
      </form>
    </div>
  </div>`;
}

const LEARN_FOOTER = `<div class="foss-callout">
    <a href="https://github.com/schmug/dmarcheck" class="foss-link">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Free and open source &mdash; MIT License
    </a>
  </div>`;

function renderLearnPage(opts: LearnPageOptions): string {
  const jsonLd = learnJsonLd({
    protocol: opts.protocol,
    slug: opts.slug,
    headline: opts.headline,
    description: opts.description,
  });

  const body = `<main class="breakdown learn">
  <nav class="report-nav" aria-label="Breadcrumb">
    <a href="/">${generateCreature("sm")} Home</a>
    <span class="breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
    <a href="/learn">Learn</a>
    <span class="breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
    <span class="breadcrumb-current">${esc(opts.protocol)}</span>
  </nav>
  <h1 class="rubric-title">${esc(opts.headline)}</h1>
  ${opts.body}
  <div class="bd-card">
    <div class="bd-card-title">Keep learning</div>
    <div class="bd-card-body">
      ${siblingLinks(opts.slug)}
      <p class="tier-text" style="margin-top:12px">Want the full grading rubric? See <a href="/scoring">how dmarcheck calculates your score</a>.</p>
    </div>
  </div>
  ${LEARN_FOOTER}
</main>`;

  return page({
    title: opts.title,
    path: `/learn/${opts.slug}`,
    description: opts.description,
    jsonLd,
    body,
  });
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

export function renderLearnHub(): string {
  const hubJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Learn email authentication — dmarcheck",
        description:
          "Plain-English guides to DMARC, SPF, DKIM, BIMI, and MTA-STS — what they do, how to read each record, and how to fix the most common misconfigurations.",
        url: `${SITE_ORIGIN}/learn`,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: LEARN_SIBLINGS.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_ORIGIN}/learn/${s.slug}`,
            name: s.protocol,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "dmarcheck",
            item: `${SITE_ORIGIN}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Learn",
            item: `${SITE_ORIGIN}/learn`,
          },
        ],
      },
    ],
  });

  const cards = LEARN_SIBLINGS.map(
    (s) =>
      `<li><a href="/learn/${s.slug}" class="learn-hub-card">
        <h2>${s.protocol}</h2>
        <p>${s.blurb}</p>
      </a></li>`,
  ).join("");

  const body = `<main class="breakdown learn">
  <nav class="report-nav" aria-label="Breadcrumb">
    <a href="/">${generateCreature("sm")} Home</a>
    <span class="breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
    <span class="breadcrumb-current">Learn</span>
  </nav>
  <h1 class="rubric-title">Learn email authentication</h1>
  <p class="rubric-intro">Five short guides to the DNS records dmarcheck scans. Each page walks through how the record works, how to read a real example, and how to fix the misconfigurations that lower your grade.</p>
  <ul class="learn-hub-grid">${cards}</ul>
  ${learnCta("Enter a domain to scan")}
  ${LEARN_FOOTER}
</main>`;

  return page({
    title: "Learn email authentication — dmarcheck",
    path: "/learn",
    description:
      "Plain-English guides to DMARC, SPF, DKIM, BIMI, and MTA-STS. Read each DNS record, understand the tags, and fix the common misconfigurations.",
    jsonLd: hubJsonLd,
    body,
  });
}

// ---------------------------------------------------------------------------
// DMARC
// ---------------------------------------------------------------------------

export function renderLearnDmarc(): string {
  const body = `
  <p class="rubric-intro">DMARC is the DNS TXT record at <code>_dmarc.yourdomain.com</code> that ties SPF and DKIM results together and tells receiving mail servers what to do with messages that fail authentication. It is the single most important record for protecting your domain from spoofing.</p>

  <div class="bd-card">
    <div class="bd-card-title">How to read a DMARC record</div>
    <div class="bd-card-body">
      <p class="tier-text">A DMARC record is a list of <code>tag=value</code> pairs separated by semicolons. Here is a typical strict policy:</p>
      <pre class="learn-example"><code>v=DMARC1; p=reject; rua=mailto:dmarc@example.com; pct=100; adkim=s; aspf=s</code></pre>
      <dl class="explainer-grid">
        <div><dt><code>v</code></dt><dd>Version. Must be <code>DMARC1</code> or the record is ignored.</dd></div>
        <div><dt><code>p</code></dt><dd>Policy. <code>none</code> is monitor-only, <code>quarantine</code> routes failing mail to spam, <code>reject</code> blocks it outright.</dd></div>
        <div><dt><code>sp</code></dt><dd>Subdomain policy. Overrides <code>p</code> for subdomains; if omitted, subdomains inherit <code>p</code>.</dd></div>
        <div><dt><code>rua</code></dt><dd>Aggregate report URI. Where receivers send daily XML reports so you can see who is sending on your behalf.</dd></div>
        <div><dt><code>ruf</code></dt><dd>Forensic report URI. Where to send per-failure reports (rarely honored by receivers today).</dd></div>
        <div><dt><code>pct</code></dt><dd>Percentage of messages the policy applies to. Anything below 100 is a partial rollout.</dd></div>
        <div><dt><code>adkim</code> / <code>aspf</code></dt><dd>Alignment mode. Strict (<code>s</code>) requires an exact match between the From domain and the signing/authenticated domain; relaxed (<code>r</code>) allows organizational-domain matching.</dd></div>
        <div><dt><code>fo</code></dt><dd>Failure-report options. Controls when forensic reports are generated.</dd></div>
      </dl>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">Common misconfigurations</div>
    <div class="bd-card-body">
      <ul class="learn-pitfalls">
        <li><strong>No record at all.</strong> Without <code>_dmarc.yourdomain.com</code>, receivers have no policy to apply and spoofers have a free pass. This is an automatic F in dmarcheck.</li>
        <li><strong><code>p=none</code> left in place forever.</strong> Monitor mode is useful for a few weeks of triage, but leaving it there means you are only watching the fire, not putting it out. dmarcheck treats <code>p=none</code> as a failing grade because it provides no real protection.</li>
        <li><strong>Missing <code>rua</code>.</strong> Without aggregate reports you cannot see which third-party senders are failing authentication, which makes the move from <code>none</code> to <code>quarantine</code> or <code>reject</code> a guessing game.</li>
        <li><strong><code>pct</code> below 100.</strong> A partial rollout is fine as a transition, but the unprotected slice is still spoofable. Increase it steadily and delete the tag once you are at 100.</li>
        <li><strong>Invalid tag at <code>_dmarc</code>.</strong> A TXT record exists but does not start with <code>v=DMARC1</code>. This usually means a wildcard DNS entry is returning the wrong value — receivers will ignore it.</li>
        <li><strong>Subdomain blind spot.</strong> Parent policy is strict but subdomains have no <code>sp</code> override and no record of their own, so attackers spoof <code>billing.yourdomain.com</code> instead of <code>yourdomain.com</code>.</li>
      </ul>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">What to fix first</div>
    <div class="bd-card-body">
      <ol class="learn-steps">
        <li>Publish <code>v=DMARC1; p=none; rua=mailto:you@yourdomain.com</code> and watch reports for two to four weeks.</li>
        <li>Fix the senders you see failing in the reports — usually marketing tools, ticketing systems, or forgotten forwarders.</li>
        <li>Move to <code>p=quarantine; pct=10</code>, then raise <code>pct</code> each week while watching for collateral damage.</li>
        <li>Once quarantine is clean at 100, switch to <code>p=reject</code> and delete <code>pct</code>.</li>
        <li>Add <code>sp=reject</code> so subdomains inherit the protection, and keep the <code>rua</code> tag in place permanently.</li>
      </ol>
    </div>
  </div>

  ${learnCta("Enter a domain to scan for DMARC")}
  `;

  return renderLearnPage({
    protocol: "DMARC",
    slug: "dmarc",
    title:
      "What is DMARC? Policy records, alignment, and reporting — dmarcheck",
    headline: "What is DMARC? Policy records, alignment, and reporting",
    description:
      "A plain-English guide to DMARC: how the _dmarc DNS TXT record works, what each tag means, the common misconfigurations, and the safe rollout path from p=none to p=reject.",
    body,
  });
}

// ---------------------------------------------------------------------------
// SPF
// ---------------------------------------------------------------------------

export function renderLearnSpf(): string {
  const body = `
  <p class="rubric-intro">SPF is a DNS TXT record on your root domain that lists the IP addresses and hostnames allowed to send mail as you. Receivers compare the envelope sender against the list and either accept, soft-fail, or reject depending on how your record ends.</p>

  <div class="bd-card">
    <div class="bd-card-title">How to read an SPF record</div>
    <div class="bd-card-body">
      <p class="tier-text">An SPF record starts with <code>v=spf1</code>, lists mechanisms, and ends with an <code>all</code> qualifier:</p>
      <pre class="learn-example"><code>v=spf1 ip4:198.51.100.10 include:_spf.google.com include:spf.protection.outlook.com -all</code></pre>
      <dl class="explainer-grid">
        <div><dt><code>ip4</code> / <code>ip6</code></dt><dd>Literal IP addresses or CIDR ranges authorized to send. Cheap — zero DNS lookups.</dd></div>
        <div><dt><code>a</code> / <code>mx</code></dt><dd>Authorize hosts whose A or MX records match. Each one counts as a DNS lookup.</dd></div>
        <div><dt><code>include</code></dt><dd>Delegate to another domain's SPF record (e.g. your email provider). One lookup per include, plus whatever lookups that record chains into.</dd></div>
        <div><dt><code>redirect</code></dt><dd>Hand off the entire policy to another domain. Counts as one lookup and replaces the rest of your record.</dd></div>
        <div><dt><code>-all</code></dt><dd>Hardfail. Anything not matched above should be rejected.</dd></div>
        <div><dt><code>~all</code></dt><dd>Softfail. Anything not matched is suspicious but not blocked — useful during rollout.</dd></div>
        <div><dt><code>?all</code></dt><dd>Neutral. No opinion. Provides essentially no protection.</dd></div>
        <div><dt><code>+all</code></dt><dd>Pass everything. <strong>Never use this</strong>; it authorizes every sender on the internet.</dd></div>
      </dl>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">Common misconfigurations</div>
    <div class="bd-card-body">
      <ul class="learn-pitfalls">
        <li><strong>Exceeding the 10 DNS lookup limit (RFC 7208 §4.6.4).</strong> <code>include</code>, <code>a</code>, <code>mx</code>, <code>exists</code>, and <code>redirect</code> each cost a lookup, and every include recursively spends lookups too. Once you cross 10, receivers return <code>permerror</code> and the entire policy is ignored. dmarcheck counts lookups recursively and flags this as a hard failure.</li>
        <li><strong>Circular includes.</strong> Two SPF records including each other produce a permerror. Usually happens after a migration leaves stale entries.</li>
        <li><strong>Using <code>+all</code>.</strong> Often a copy/paste mistake. It allows any host on the internet to pass SPF for your domain, which breaks DMARC alignment and actively harms you.</li>
        <li><strong>Using <code>?all</code> (neutral).</strong> Provides no guidance to receivers. Replace with <code>~all</code> or <code>-all</code>.</li>
        <li><strong>Leaving the deprecated <code>ptr</code> mechanism in place.</strong> RFC 7208 recommends against it: it is slow, expensive for receivers, and unreliable.</li>
        <li><strong>Forgetting a sender.</strong> A new marketing tool or transactional mail provider goes live, the SPF record is not updated, and their mail starts failing silently once DMARC is enforced. Aggregate (<code>rua</code>) reports catch this.</li>
      </ul>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">What to fix first</div>
    <div class="bd-card-body">
      <ol class="learn-steps">
        <li>Scan your domain and note the current lookup count. If you are over 10, the record is broken even if it looks fine.</li>
        <li>Replace heavy <code>include</code>s you do not need. Consolidate third-party senders, or use an SPF flattening service if your vendors insist on deep chains.</li>
        <li>Prefer <code>ip4</code>/<code>ip6</code> literals for infrastructure you control — they are free, lookup-wise.</li>
        <li>End with <code>-all</code> once you are confident, or <code>~all</code> if you still have stragglers. Both are treated equally when DMARC is enforced, per M3AAWG guidance.</li>
        <li>Keep the lookup count under 6 to earn the SPF bonus modifier in dmarcheck.</li>
      </ol>
    </div>
  </div>

  ${learnCta("Enter a domain to scan for SPF")}
  `;

  return renderLearnPage({
    protocol: "SPF",
    slug: "spf",
    title: "What is SPF? The 10 DNS lookup limit, explained — dmarcheck",
    headline: "What is SPF? Mechanisms, the 10-lookup limit, and fallouts",
    description:
      "A plain-English guide to SPF: how the v=spf1 record works, why the 10 DNS lookup limit matters, and how to fix permerrors, +all mistakes, and deprecated ptr mechanisms.",
    body,
  });
}

// ---------------------------------------------------------------------------
// DKIM
// ---------------------------------------------------------------------------

export function renderLearnDkim(): string {
  const body = `
  <p class="rubric-intro">DKIM attaches a cryptographic signature to every outgoing message using a private key that only your mail server holds. The matching public key lives in DNS under a named selector, so receivers can fetch it and verify nothing was altered in transit.</p>

  <div class="bd-card">
    <div class="bd-card-title">How to read a DKIM record</div>
    <div class="bd-card-body">
      <p class="tier-text">DKIM records live at <code>&lt;selector&gt;._domainkey.yourdomain.com</code> as TXT records. A minimal example:</p>
      <pre class="learn-example"><code>v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC...</code></pre>
      <dl class="explainer-grid">
        <div><dt><code>v</code></dt><dd>Version. Must be <code>DKIM1</code>.</dd></div>
        <div><dt><code>k</code></dt><dd>Key type. Defaults to <code>rsa</code>. Ed25519 (<code>k=ed25519</code>) is supported by most major receivers.</dd></div>
        <div><dt><code>p</code></dt><dd>The base64-encoded public key. An empty <code>p=</code> means the key has been revoked.</dd></div>
        <div><dt><code>t</code></dt><dd>Flags. <code>t=y</code> marks the selector as testing-only — receivers are expected to treat failures leniently.</dd></div>
        <div><dt>Selector</dt><dd>An arbitrary label you pick (e.g. <code>google</code>, <code>selector1</code>, <code>s1</code>) that lets you publish multiple keys simultaneously for rotation.</dd></div>
      </dl>
      <p class="tier-text" style="margin-top:12px">dmarcheck automatically probes 38 common selectors used by major providers (Google Workspace, Microsoft 365, Proton Mail, Fastmail, Zoho, Postmark, Amazon SES, and others), and you can pass a custom selector in the Advanced options on the home page if you use something unusual.</p>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">Common misconfigurations</div>
    <div class="bd-card-body">
      <ul class="learn-pitfalls">
        <li><strong>No selector found.</strong> If dmarcheck cannot locate a DKIM record at any of the common selectors, either you have not set DKIM up yet, the selector name is unusual, or the CNAME/TXT record is pointing at the wrong place. Try the Advanced options on the home page with your provider's selector name.</li>
        <li><strong>Weak 1024-bit RSA keys.</strong> Still legal per spec, but industry guidance is 2048 bits or larger. dmarcheck flags any key under 2048 bits and applies a grade penalty.</li>
        <li><strong>Revoked keys (empty <code>p=</code>).</strong> Usually the remnant of a rotation that never cleaned up. The record still resolves, so receivers treat signed mail from that selector as broken.</li>
        <li><strong>Stuck in testing mode.</strong> <code>t=y</code> is useful while you verify a new key, but leaving it in place permanently tells receivers to ignore DKIM failures — effectively disabling the protection.</li>
        <li><strong>Only one selector.</strong> Single-selector setups make rotation disruptive. Publishing a second selector lets you roll keys by changing which one the mail server signs with, with no downtime.</li>
      </ul>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">What to fix first</div>
    <div class="bd-card-body">
      <ol class="learn-steps">
        <li>Generate or obtain a 2048-bit (or larger) RSA key from your mail provider and publish it as a new selector in DNS.</li>
        <li>Enable signing in your mail platform and verify with a test message — most platforms include a "DKIM status" tool in the admin console.</li>
        <li>Publish a second selector so you can rotate without downtime. Two selectors earns a bonus modifier in dmarcheck.</li>
        <li>Rotate keys at least once a year. Sign with the new selector, leave the old one published for a cool-down period, then remove it.</li>
        <li>If you see a key under 2048 bits in your scan, upgrade it — most providers let you regenerate with a single click.</li>
      </ol>
    </div>
  </div>

  ${learnCta("Enter a domain to scan for DKIM")}
  `;

  return renderLearnPage({
    protocol: "DKIM",
    slug: "dkim",
    title:
      "What is DKIM? Selectors, key rotation, and 2048-bit keys — dmarcheck",
    headline: "What is DKIM? Selectors, key strength, and rotation",
    description:
      "A plain-English guide to DKIM: how signing selectors live in DNS, why 2048-bit keys matter, how to rotate without downtime, and why dmarcheck probes 38 common selectors.",
    body,
  });
}

// ---------------------------------------------------------------------------
// BIMI
// ---------------------------------------------------------------------------

export function renderLearnBimi(): string {
  const body = `
  <p class="rubric-intro">BIMI (Brand Indicators for Message Identification) lets your verified brand logo appear next to authenticated messages in supporting inboxes. It is effectively a reward for reaching <code>p=quarantine</code> or <code>p=reject</code> on DMARC — receivers will not honor a BIMI record without enforced authentication.</p>

  <div class="bd-card">
    <div class="bd-card-title">How to read a BIMI record</div>
    <div class="bd-card-body">
      <p class="tier-text">BIMI records live at <code>default._bimi.yourdomain.com</code> as TXT records:</p>
      <pre class="learn-example"><code>v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem</code></pre>
      <dl class="explainer-grid">
        <div><dt><code>v</code></dt><dd>Version. Must be <code>BIMI1</code>.</dd></div>
        <div><dt><code>l</code></dt><dd>Logo URL. Must be HTTPS and must point at an SVG Tiny PS file — not a full SVG, not a PNG.</dd></div>
        <div><dt><code>a</code></dt><dd>Authority evidence. The URL of a Verified Mark Certificate (VMC) or Common Mark Certificate (CMC). Gmail and Apple Mail require this to actually display the logo.</dd></div>
      </dl>
      <p class="tier-text" style="margin-top:12px">Selectors other than <code>default</code> are supported by the spec but rarely used — dmarcheck checks <code>default._bimi</code>.</p>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">Common misconfigurations</div>
    <div class="bd-card-body">
      <ul class="learn-pitfalls">
        <li><strong>DMARC is not enforced.</strong> BIMI is explicit about this: without <code>p=quarantine</code> or <code>p=reject</code>, receivers ignore your record entirely. Fix DMARC first, then come back to BIMI.</li>
        <li><strong>Logo URL is not HTTPS.</strong> The spec requires HTTPS, and receivers will not fetch an HTTP asset.</li>
        <li><strong>Wrong SVG profile.</strong> BIMI requires <em>SVG Tiny PS</em>, a constrained subset. A regular SVG exported from Illustrator will not pass validation — use a dedicated BIMI converter or a service like Entrust or DigiCert.</li>
        <li><strong>No <code>a=</code> tag.</strong> Without a VMC or CMC, Gmail and Apple Mail will not render your logo even if the BIMI record is otherwise valid. The logo may appear in other clients that do not require certification.</li>
        <li><strong>Self-signed or expired certificate.</strong> The authority evidence must chain to a trusted issuer and be currently valid. Certificates typically last one year.</li>
      </ul>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">What to fix first</div>
    <div class="bd-card-body">
      <ol class="learn-steps">
        <li>Confirm your DMARC policy is <code>quarantine</code> or <code>reject</code>. If not, BIMI will not display — start with the <a href="/learn/dmarc">DMARC guide</a>.</li>
        <li>Convert your logo to SVG Tiny PS and host it over HTTPS. Many CAs offer a converter as part of the VMC purchase flow.</li>
        <li>Obtain a VMC from a supported certificate authority (Entrust, DigiCert). You will need a trademark registration for the logo.</li>
        <li>Publish the <code>default._bimi</code> TXT record with <code>v=BIMI1</code>, <code>l=</code>, and <code>a=</code>.</li>
        <li>Test with a supporting inbox — Gmail shows BIMI logos in the message list once the record is valid and your domain has reputation.</li>
      </ol>
    </div>
  </div>

  ${learnCta("Enter a domain to scan for BIMI")}
  `;

  return renderLearnPage({
    protocol: "BIMI",
    slug: "bimi",
    title: "What is BIMI? Logos, VMCs, and DMARC requirements — dmarcheck",
    headline: "What is BIMI? Brand logos, VMCs, and DMARC requirements",
    description:
      "A plain-English guide to BIMI: how the default._bimi record works, why it requires enforced DMARC, what SVG Tiny PS is, and why Gmail and Apple Mail need a VMC or CMC certificate.",
    body,
  });
}

// ---------------------------------------------------------------------------
// MTA-STS
// ---------------------------------------------------------------------------

export function renderLearnMtaSts(): string {
  const body = `
  <p class="rubric-intro">MTA-STS (RFC 8461) tells other mail servers that your domain requires TLS when they deliver mail to you. It has two parts: a short DNS TXT record that announces the policy, and an HTTPS-hosted policy file that spells out which MX hosts are valid and whether the policy is enforced or still in testing.</p>

  <div class="bd-card">
    <div class="bd-card-title">How MTA-STS works</div>
    <div class="bd-card-body">
      <p class="tier-text">The DNS half lives at <code>_mta-sts.yourdomain.com</code>:</p>
      <pre class="learn-example"><code>v=STSv1; id=20260411000000</code></pre>
      <p class="tier-text">The policy file is served over HTTPS at a fixed path:</p>
      <pre class="learn-example"><code>https://mta-sts.yourdomain.com/.well-known/mta-sts.txt

version: STSv1
mode: enforce
mx: mx1.yourdomain.com
mx: mx2.yourdomain.com
max_age: 604800</code></pre>
      <dl class="explainer-grid">
        <div><dt><code>version</code></dt><dd>Must be <code>STSv1</code>.</dd></div>
        <div><dt><code>mode</code></dt><dd><code>enforce</code> requires TLS to valid MX hosts, <code>testing</code> reports failures without blocking, <code>none</code> disables the policy.</dd></div>
        <div><dt><code>mx</code></dt><dd>One line per MX host or wildcard. Only these hosts are accepted once enforcement is on.</dd></div>
        <div><dt><code>max_age</code></dt><dd>How long (in seconds) receiving servers should cache the policy. RFC 8461 recommends at least 604800 (one week) in production.</dd></div>
        <div><dt><code>id</code> (DNS)</dt><dd>An opaque identifier — usually a timestamp. Change it whenever you update the policy so receivers re-fetch.</dd></div>
      </dl>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">Common misconfigurations</div>
    <div class="bd-card-body">
      <ul class="learn-pitfalls">
        <li><strong>DNS record without the policy file.</strong> The TXT record claims MTA-STS is live, but <code>https://mta-sts.yourdomain.com/.well-known/mta-sts.txt</code> returns 404. Receivers treat this as no policy.</li>
        <li><strong>Policy file without the DNS record.</strong> The reverse: file exists, but receivers never discover it because the <code>_mta-sts</code> TXT record is missing.</li>
        <li><strong>Stuck in <code>mode: testing</code>.</strong> Testing mode is a useful pre-launch step, but it does not block any mail. dmarcheck applies a penalty to testing-only policies to nudge you to switch to <code>enforce</code>.</li>
        <li><strong>Too-short <code>max_age</code>.</strong> Anything under 86400 (one day) is flagged. Production deployments should be at least one week.</li>
        <li><strong>Missing <code>mx</code> lines.</strong> Without MX patterns the policy cannot actually validate hosts. dmarcheck warns when the list is empty.</li>
        <li><strong>Redirecting the policy fetch.</strong> RFC 8461 §3.3 forbids following redirects for the policy fetch. Serve the file directly from <code>mta-sts.&lt;domain&gt;</code>, not via a 301/302 from somewhere else.</li>
        <li><strong>Forgetting to bump <code>id</code>.</strong> You update the policy file but leave the DNS <code>id</code> unchanged, so receivers keep serving the cached old version until <code>max_age</code> expires.</li>
      </ul>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">What to fix first</div>
    <div class="bd-card-body">
      <ol class="learn-steps">
        <li>Publish the HTTPS policy file at <code>https://mta-sts.yourdomain.com/.well-known/mta-sts.txt</code> with <code>mode: testing</code> first.</li>
        <li>Add the <code>_mta-sts</code> TXT record with a fresh <code>id</code>.</li>
        <li>Watch TLS-RPT reports (via an <code>_smtp._tls</code> TXT record) for a week or two to catch senders that cannot negotiate TLS to your MX hosts.</li>
        <li>Switch the policy file from <code>testing</code> to <code>enforce</code> and bump <code>id</code>.</li>
        <li>Raise <code>max_age</code> to <code>604800</code> (one week) or longer once you are confident in the MX list.</li>
      </ol>
    </div>
  </div>

  ${learnCta("Enter a domain to scan for MTA-STS")}
  `;

  return renderLearnPage({
    protocol: "MTA-STS",
    slug: "mta-sts",
    title: "What is MTA-STS? Enforcing TLS for inbound mail — dmarcheck",
    headline: "What is MTA-STS? Enforcing TLS for inbound mail",
    description:
      "A plain-English guide to MTA-STS (RFC 8461): the _mta-sts DNS record, the HTTPS policy file, enforce vs testing mode, and how to roll out without breaking legitimate senders.",
    body,
  });
}
