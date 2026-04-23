import { generateCreature } from "./components.js";
import { page } from "./html.js";

// Placeholder pricing page — route plumbing ships now; copy + plan price land
// in a follow-up PR (see HANDOFF M6). `noindex` on the page keeps it out of
// search until real copy is in place.

const PLACEHOLDER_NOTE = `<div class="bd-card placeholder-banner" role="note" aria-label="Preview notice">
    <div class="bd-card-body">
      <strong>Preview &mdash; copy pending.</strong> This page is a placeholder while final pricing and feature copy are drafted. It's noindexed and not linked from search. <a href="/">Return home &rarr;</a>
    </div>
  </div>`;

export function renderPricingPage(): string {
  const body = `<main class="breakdown">
  <div class="report-nav">
    <a href="/">${generateCreature("sm")} Home</a>
  </div>
  <h1 class="rubric-title">Pricing</h1>
  <p class="rubric-intro">The free public scanner at <a href="/">dmarc.mx</a> stays free and open source forever. The <strong>Pro</strong> hosted tier adds saved history, nightly monitoring, email alerts, bulk scan, and higher API rate limits.</p>

  ${PLACEHOLDER_NOTE}

  <div class="bd-card">
    <div class="bd-card-title">Free</div>
    <div class="bd-card-body">
      <p class="tier-text"><strong>$0</strong> &mdash; public scanner, no account needed.</p>
      <ul>
        <li>Unlimited one-off scans from the web UI</li>
        <li>JSON API: <code>GET /api/check?domain=example.com</code></li>
        <li>10 requests per minute per IP</li>
        <li>All five analyzers: DMARC, SPF, DKIM, BIMI, MTA-STS</li>
        <li>Self-hostable &mdash; MIT-licensed, <a href="https://github.com/schmug/dmarcheck">clone &amp; deploy your own</a></li>
      </ul>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">Pro &mdash; <em>[PLACEHOLDER price/mo]</em></div>
    <div class="bd-card-body">
      <p class="tier-text"><strong>[PLACEHOLDER]</strong> &mdash; for teams that need continuous coverage.</p>
      <ul>
        <li>Saved scan history with per-domain trend views</li>
        <li>Nightly rescans of your watchlist (up to 25 domains)</li>
        <li>Email alerts on grade drop or protocol regression</li>
        <li>Bulk scan: up to 100 domains per request</li>
        <li>API keys with a higher rate-limit ceiling</li>
        <li>Cancel anytime via Stripe Customer Portal</li>
      </ul>
      <p class="tier-text" style="margin-top:12px"><em>[PLACEHOLDER: upgrade CTA &amp; final price land with real copy.]</em></p>
    </div>
  </div>

  <div class="bd-card">
    <div class="bd-card-title">FAQ</div>
    <div class="bd-card-body">
      <div class="rubric-protocol">
        <h3>Does the free scanner stay free?</h3>
        <p>Yes. The scanner, all five analyzers, and the JSON API remain free and open source. Pro adds hosted features (history, monitoring, alerts), not the scan itself.</p>
      </div>
      <div class="rubric-protocol">
        <h3>Can I self-host?</h3>
        <p>Yes. The repo is <a href="https://github.com/schmug/dmarcheck">MIT-licensed</a>. Clone, <code>wrangler deploy</code>, and run your own free instance. Pro-tier features gracefully disable when the D1/Stripe/WorkOS bindings aren't configured.</p>
      </div>
      <div class="rubric-protocol">
        <h3>How do I upgrade, cancel, or get a refund?</h3>
        <p><em>[PLACEHOLDER: billing and refund terms pending legal/copy review.]</em></p>
      </div>
    </div>
  </div>

  <div style="text-align:center;margin-top:2rem;margin-bottom:1rem">
    <a href="/" class="rubric-cta">Scan a domain &rarr;</a>
  </div>
</main>`;

  return page({
    title: "Pricing — dmarcheck",
    path: "/pricing",
    description:
      "dmarcheck pricing: free public scanner plus an optional Pro hosted tier with saved history, nightly monitoring, alerts, and bulk scan.",
    noindex: true,
    body,
  });
}
