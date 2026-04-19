import {
  esc,
  generateCreature,
  gradeClass,
  themeToggle,
} from "./components.js";
import { JS } from "./scripts.js";
import { CSS } from "./styles.js";

const DASHBOARD_CSS = `
.dashboard-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--clr-surface);
  border-bottom: 1px solid var(--clr-border);
  flex-wrap: wrap;
}
.dashboard-nav .nav-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--clr-text);
  font-weight: 700;
  font-size: 1rem;
}
.dashboard-nav .nav-links {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}
.dashboard-nav .nav-links a {
  color: var(--clr-text-muted);
  text-decoration: none;
  font-size: 0.875rem;
}
.dashboard-nav .nav-links a:hover {
  color: var(--clr-accent);
}
.dashboard-nav .nav-user {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
  font-size: 0.875rem;
  color: var(--clr-text-muted);
}
.dashboard-nav .nav-user a {
  color: var(--clr-text-muted);
  text-decoration: none;
}
.dashboard-nav .nav-user a:hover {
  color: var(--clr-accent);
}
.dashboard-body {
  max-width: 900px;
  margin: 2rem auto;
  padding: 0 1.5rem;
}
.dashboard-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--clr-text);
  margin-bottom: 1.5rem;
}
.domain-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  overflow: hidden;
}
.domain-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clr-text-muted);
  background: var(--clr-bg);
  border-bottom: 1px solid var(--clr-border);
}
.domain-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--clr-border);
  color: var(--clr-text);
  font-size: 0.9rem;
}
.domain-table tr:last-child td {
  border-bottom: none;
}
.domain-table tr:hover td {
  background: var(--clr-bg);
}
.domain-table a {
  color: var(--clr-accent);
  text-decoration: none;
  font-weight: 500;
}
.domain-table a:hover {
  text-decoration: underline;
}
.badge-free {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  background: var(--clr-accent-glow);
  color: var(--clr-accent);
  border: 1px solid var(--clr-accent);
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-left: 0.4rem;
  vertical-align: middle;
}
.grade-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 1.25rem;
  font-weight: 800;
  border: 3px solid currentColor;
}
.grade-badge.grade-a { color: var(--clr-pass); border-color: var(--clr-pass); }
.grade-badge.grade-c { color: var(--clr-warn); border-color: var(--clr-warn); }
.grade-badge.grade-f { color: var(--clr-fail); border-color: var(--clr-fail); }
.domain-detail-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.domain-detail-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--clr-text);
}
.domain-detail-meta {
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: var(--clr-text-muted);
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.domain-detail-meta strong {
  color: var(--clr-text);
}
.btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: var(--clr-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}
.btn:hover { background: var(--clr-accent-hover); }
.btn-secondary {
  background: var(--clr-surface);
  color: var(--clr-text);
  border: 1px solid var(--clr-border);
}
.btn-secondary:hover {
  background: var(--clr-bg);
  border-color: var(--clr-border-hover);
}
.btn-danger {
  background: var(--clr-fail);
  color: #fff;
}
.btn-danger:hover { opacity: 0.85; }
.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.history-list li {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--clr-border);
  font-size: 0.875rem;
}
.history-list li:last-child { border-bottom: none; }
.history-list .history-date {
  color: var(--clr-text-muted);
  flex: 1;
}
.settings-section {
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
}
.settings-section h2 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--clr-text);
  margin-bottom: 0.75rem;
}
.settings-section p {
  font-size: 0.875rem;
  color: var(--clr-text-muted);
  margin-bottom: 0.75rem;
}
.api-key-display {
  font-family: monospace;
  font-size: 0.85rem;
  background: var(--clr-bg);
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  color: var(--clr-text);
  word-break: break-all;
  margin-bottom: 0.75rem;
}
.settings-input {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-bg);
  color: var(--clr-text);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  box-sizing: border-box;
}
.settings-input:focus {
  outline: 2px solid var(--clr-accent);
  outline-offset: 1px;
  border-color: var(--clr-accent);
}
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--clr-text-muted);
  font-size: 0.95rem;
}
.empty-state p { margin-bottom: 1.25rem; }
.inline-grade {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 700;
}
.inline-grade.grade-a { color: var(--clr-pass); background: var(--clr-pass-bg); }
.inline-grade.grade-c { color: var(--clr-warn); background: var(--clr-warn-bg); }
.inline-grade.grade-f { color: var(--clr-fail); background: var(--clr-fail-bg); }
.section-card {
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
}
.section-card h2 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--clr-text);
  margin-bottom: 1rem;
}
.action-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}
`;

function dashboardPage(title: string, body: string, email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script>(function(){var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)})()</script>
<style>${CSS}</style>
<style>${DASHBOARD_CSS}</style>
</head>
<body>
<nav class="dashboard-nav">
  <a href="/" class="nav-logo">${generateCreature("sm")} dmarc.mx</a>
  <div class="nav-links">
    <a href="/dashboard">Domains</a>
    <a href="/dashboard/settings">Settings</a>
  </div>
  <div class="nav-user">
    <span>${esc(email)}</span>
    <a href="/auth/logout">Logout</a>
    ${themeToggle()}
  </div>
</nav>
<div class="dashboard-body">
${body}
</div>
<script>${JS}</script>
</body>
</html>`;
}

export interface DashboardDomain {
  domain: string;
  grade: string;
  frequency: string;
  lastScanned: string | null;
  isFree: boolean;
}

export interface ScanHistoryEntry {
  date: string;
  grade: string;
}

export function renderDashboardPage({
  email,
  domains,
}: {
  email: string;
  domains: DashboardDomain[];
}): string {
  let tableBody: string;

  if (domains.length === 0) {
    tableBody = `<div class="empty-state">
  <p>No domains yet. Add your first domain to start monitoring.</p>
  <a href="/dashboard/domain/add" class="btn">Add Domain</a>
</div>`;
  } else {
    const rows = domains
      .map(
        (d) => `<tr>
  <td>
    <a href="/dashboard/domain/${encodeURIComponent(d.domain)}">${esc(d.domain)}</a>
    ${d.isFree ? '<span class="badge-free">Free</span>' : ""}
  </td>
  <td><span class="inline-grade ${gradeClass(d.grade)}">${esc(d.grade)}</span></td>
  <td>${esc(d.frequency)}</td>
  <td>${d.lastScanned ? esc(d.lastScanned) : '<span style="color:var(--clr-text-muted)">Never</span>'}</td>
</tr>`,
      )
      .join("");

    tableBody = `<table class="domain-table">
  <thead>
    <tr>
      <th>Domain</th>
      <th>Grade</th>
      <th>Frequency</th>
      <th>Last Scan</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  return dashboardPage(
    "Domains — dmarc.mx",
    `<h1 class="dashboard-title">Your Domains</h1>
${tableBody}`,
    email,
  );
}

export function renderDomainDetailPage({
  email,
  domain,
  grade,
  lastScanned,
  isFree,
  scanFrequency,
  scanHistory,
}: {
  email: string;
  domain: string;
  grade: string;
  lastScanned: string | null;
  isFree: boolean;
  scanFrequency: string;
  scanHistory: ScanHistoryEntry[];
}): string {
  const historyItems = scanHistory
    .slice(0, 12)
    .map(
      (entry) => `<li>
  <span class="history-date">${esc(entry.date)}</span>
  <span class="inline-grade ${gradeClass(entry.grade)}">${esc(entry.grade)}</span>
</li>`,
    )
    .join("");

  const historySection =
    scanHistory.length > 0
      ? `<ul class="history-list">${historyItems}</ul>`
      : `<p style="color:var(--clr-text-muted);font-size:0.875rem;padding:0.75rem 0">No scan history yet.</p>`;

  const body = `<div class="domain-detail-header">
  <span class="grade-badge ${gradeClass(grade)}">${esc(grade)}</span>
  <span class="domain-detail-name">${esc(domain)}</span>
  ${isFree ? '<span class="badge-free">Free</span>' : ""}
</div>
<div class="domain-detail-meta">
  <span><strong>Scan Frequency:</strong> ${esc(scanFrequency)}</span>
  <span><strong>Last Scanned:</strong> ${lastScanned ? esc(lastScanned) : "Never"}</span>
</div>
<div class="action-row" style="margin-bottom:1.5rem">
  <form method="POST" action="/dashboard/domain/${encodeURIComponent(domain)}/scan" style="display:inline">
    <button type="submit" class="btn">Scan Now</button>
  </form>
  <a href="/check?domain=${encodeURIComponent(domain)}" class="btn btn-secondary">View Full Report</a>
</div>
<div class="section-card">
  <h2>Grade History</h2>
  ${historySection}
</div>`;

  return dashboardPage(`${domain} — dmarc.mx`, body, email);
}

export function renderSettingsPage({
  email,
  apiKey,
  webhookUrl,
  hasStripe,
  emailAlertsEnabled,
}: {
  email: string;
  apiKey: string | null;
  webhookUrl: string | null;
  hasStripe: boolean;
  emailAlertsEnabled: boolean;
}): string {
  const apiKeySection = apiKey
    ? `<div class="api-key-display">${esc(apiKey)}</div>
<form method="POST" action="/dashboard/settings/api-key">
  <button type="submit" class="btn btn-secondary">Regenerate API Key</button>
</form>`
    : `<p>No API key yet. Generate one to use the dmarc.mx API.</p>
<form method="POST" action="/dashboard/settings/api-key">
  <button type="submit" class="btn">Generate API Key</button>
</form>`;

  const billingSection = hasStripe
    ? `<a href="/dashboard/billing" class="btn btn-secondary">Manage Billing</a>`
    : `<p>You have no active subscription.</p>
<a href="/dashboard/billing/subscribe" class="btn">Upgrade</a>`;

  const body = `<h1 class="dashboard-title">Settings</h1>

<div class="settings-section">
  <h2>Account</h2>
  <p>Signed in as <strong>${esc(email)}</strong></p>
</div>

<div class="settings-section">
  <h2>API Key</h2>
  ${apiKeySection}
</div>

<div class="settings-section">
  <h2>Webhook</h2>
  <form method="POST" action="/dashboard/settings/webhook">
    <label for="webhook-url" style="display:block;font-size:0.875rem;color:var(--clr-text-muted);margin-bottom:0.4rem">Webhook URL</label>
    <input
      id="webhook-url"
      class="settings-input"
      type="url"
      name="webhookUrl"
      placeholder="https://your-server.example/webhook"
      value="${webhookUrl ? esc(webhookUrl) : ""}"
    >
    <button type="submit" class="btn">Save Webhook</button>
  </form>
</div>

<div class="settings-section">
  <h2>Email Alerts</h2>
  <p style="font-size:0.875rem;color:var(--clr-text-muted);margin-bottom:0.75rem">
    We email you when a monitored domain's grade drops or a protocol regresses.
  </p>
  <form method="POST" action="/dashboard/settings/email-alerts">
    <label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">
      <input type="checkbox" name="enabled" ${emailAlertsEnabled ? "checked" : ""}>
      <span>Send me grade-drop alerts by email</span>
    </label>
    <button type="submit" class="btn btn-secondary">Save Preference</button>
  </form>
</div>

<div class="settings-section">
  <h2>Billing</h2>
  ${billingSection}
</div>`;

  return dashboardPage("Settings — dmarc.mx", body, email);
}
