import { generateCreature } from "./components.js";
import { page } from "./html.js";

// Placeholder Terms of Service and Privacy Policy. Real legal text is
// escalate-only (see HANDOFF Escalate list) and lands in a follow-up PR
// before launch. `noindex` keeps the placeholders out of search.

const PLACEHOLDER_NOTE = `<div class="bd-card placeholder-banner" role="note" aria-label="Preview notice">
    <div class="bd-card-body">
      <strong>Preview &mdash; legal text pending.</strong> This page is a placeholder while final TOS and Privacy Policy text are drafted and reviewed. It's noindexed, not linked from search, and not a contract. <a href="/">Return home &rarr;</a>
    </div>
  </div>`;

export function renderLegalIndex(): string {
  const body = `<main class="breakdown">
  <div class="report-nav">
    <a href="/">${generateCreature("sm")} Home</a>
  </div>
  <h1 class="rubric-title">Legal</h1>
  <p class="rubric-intro">Terms, privacy, and contact info for the hosted service at <code>dmarc.mx</code>. The self-hosted OSS project is governed separately by its <a href="https://github.com/schmug/dmarcheck/blob/main/LICENSE">MIT license</a>.</p>

  ${PLACEHOLDER_NOTE}

  <div class="bd-card">
    <div class="bd-card-body">
      <ul>
        <li><a href="/legal/terms">Terms of Service</a> &mdash; governs your use of the hosted service</li>
        <li><a href="/legal/privacy">Privacy Policy</a> &mdash; what we collect, why, and how long we keep it</li>
        <li>Security disclosure: <a href="https://github.com/schmug/dmarcheck/blob/main/SECURITY.md">SECURITY.md</a></li>
        <li>Source code and license: <a href="https://github.com/schmug/dmarcheck">github.com/schmug/dmarcheck</a></li>
      </ul>
    </div>
  </div>
</main>`;

  return page({
    title: "Legal — dmarcheck",
    path: "/legal",
    description:
      "Legal information for the dmarcheck hosted service: Terms of Service, Privacy Policy, and security disclosure.",
    noindex: true,
    body,
  });
}

export function renderTermsPage(): string {
  const body = `<main class="breakdown">
  <div class="report-nav">
    <a href="/legal">${generateCreature("sm")} Legal</a>
  </div>
  <h1 class="rubric-title">Terms of Service</h1>
  <p class="rubric-intro"><em>[PLACEHOLDER] &mdash; final text pending attorney review.</em></p>

  ${PLACEHOLDER_NOTE}

  <div class="bd-card">
    <div class="bd-card-title">Outline</div>
    <div class="bd-card-body">
      <ol>
        <li>Scope &mdash; hosted service at <code>dmarc.mx</code>. The OSS project is MIT-licensed separately.</li>
        <li>Acceptable use &mdash; no abusive scanning, no circumventing rate limits, no use to harm third parties.</li>
        <li>Accounts &mdash; one human per account, accurate contact info.</li>
        <li>Billing &mdash; [PLACEHOLDER: cadence, refunds, taxes].</li>
        <li>Data &mdash; domain names and scan results are stored per the Privacy Policy.</li>
        <li>Warranty disclaimer &mdash; service is provided "as is".</li>
        <li>Limitation of liability &mdash; [PLACEHOLDER].</li>
        <li>Termination &mdash; either side may terminate; data export on request.</li>
        <li>Changes &mdash; we'll notify in-app or by email before material changes.</li>
        <li>Governing law &mdash; [PLACEHOLDER].</li>
      </ol>
      <p class="tier-text" style="margin-top:12px"><em>[PLACEHOLDER] This outline is not legally binding. Final Terms replace this text before launch.</em></p>
    </div>
  </div>

  <p class="tier-text"><a href="/legal">&larr; Back to legal index</a></p>
</main>`;

  return page({
    title: "Terms of Service — dmarcheck",
    path: "/legal/terms",
    description:
      "Terms of Service for the dmarcheck hosted service. (Placeholder text pending final legal review.)",
    noindex: true,
    body,
  });
}

export function renderPrivacyPage(): string {
  const body = `<main class="breakdown">
  <div class="report-nav">
    <a href="/legal">${generateCreature("sm")} Legal</a>
  </div>
  <h1 class="rubric-title">Privacy Policy</h1>
  <p class="rubric-intro"><em>[PLACEHOLDER] &mdash; final text pending review.</em></p>

  ${PLACEHOLDER_NOTE}

  <div class="bd-card">
    <div class="bd-card-title">Outline</div>
    <div class="bd-card-body">
      <ul>
        <li><strong>What we collect</strong> &mdash; domain names you scan, scan results, your account email (Pro), billing metadata via Stripe (Pro), error telemetry via Sentry.</li>
        <li><strong>Why</strong> &mdash; to run the service, save your history, send alerts you asked for, debug outages.</li>
        <li><strong>Retention</strong> &mdash; [PLACEHOLDER duration].</li>
        <li><strong>Sharing</strong> &mdash; we do not sell your data. Subprocessors: Cloudflare (hosting), WorkOS (auth), Stripe (billing), Resend/Cloudflare Email (transactional email), Sentry (errors).</li>
        <li><strong>Your rights</strong> &mdash; export, delete, opt out of alerts, contact support.</li>
        <li><strong>Cookies</strong> &mdash; only functional (session, theme preference). No third-party advertising trackers.</li>
        <li><strong>Contact</strong> &mdash; [PLACEHOLDER email].</li>
      </ul>
      <p class="tier-text" style="margin-top:12px"><em>[PLACEHOLDER] This outline is not a binding policy. Final Privacy Policy replaces this text before launch.</em></p>
    </div>
  </div>

  <p class="tier-text"><a href="/legal">&larr; Back to legal index</a></p>
</main>`;

  return page({
    title: "Privacy Policy — dmarcheck",
    path: "/legal/privacy",
    description:
      "Privacy Policy for the dmarcheck hosted service. (Placeholder text pending final review.)",
    noindex: true,
    body,
  });
}
