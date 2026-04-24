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
.badge-alert {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  background: var(--clr-fail);
  color: white;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-left: 0.4rem;
  vertical-align: middle;
}
.alerts-needs-attention {
  background: var(--clr-surface);
  border: 1px solid var(--clr-fail);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}
.alerts-needs-attention h2 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--clr-fail);
}
.alerts-needs-attention ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.alerts-needs-attention li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--clr-border);
  font-size: 0.875rem;
  flex-wrap: wrap;
}
.alerts-needs-attention li:first-child {
  border-top: none;
}
.alerts-needs-attention .alert-domain {
  font-weight: 600;
}
.alerts-needs-attention .alert-domain a {
  color: var(--clr-accent);
  text-decoration: none;
}
.alerts-needs-attention .alert-domain a:hover {
  text-decoration: underline;
}
.alerts-needs-attention .alert-message {
  color: var(--clr-text);
  flex: 1;
  min-width: 200px;
}
.alerts-needs-attention .alert-time {
  color: var(--clr-text-muted);
  font-size: 0.75rem;
}
.alerts-needs-attention form {
  margin: 0;
}
.alerts-needs-attention .btn-dismiss {
  background: transparent;
  border: 1px solid var(--clr-border);
  color: var(--clr-text-muted);
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
}
.alerts-needs-attention .btn-dismiss:hover {
  border-color: var(--clr-fail);
  color: var(--clr-fail);
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
.bulk-textarea {
  display: block;
  width: 100%;
  min-height: 12rem;
  padding: 0.75rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-bg);
  color: var(--clr-text);
  font-family: monospace;
  font-size: 0.875rem;
  box-sizing: border-box;
  resize: vertical;
}
.bulk-results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.bulk-results-table th,
.bulk-results-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--clr-border);
  text-align: left;
}
.bulk-results-table tr:last-child td {
  border-bottom: none;
}
.bulk-status {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.bulk-status.scanned { color: var(--clr-pass); background: var(--clr-pass-bg); }
.bulk-status.queued { color: var(--clr-text-muted); background: var(--clr-bg); border: 1px solid var(--clr-border); }
.bulk-status.invalid { color: var(--clr-warn); background: var(--clr-warn-bg); }
.bulk-status.error { color: var(--clr-fail); background: var(--clr-fail-bg); }
.bulk-summary {
  font-size: 0.875rem;
  color: var(--clr-text-muted);
  margin-bottom: 1rem;
}
.bulk-error {
  background: var(--clr-fail-bg);
  color: var(--clr-fail);
  border: 1px solid var(--clr-fail);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
.sparkline {
  width: 100%;
  height: 80px;
  display: block;
}
.sparkline .sparkline-line {
  fill: none;
  stroke: var(--clr-accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.sparkline .sparkline-dot {
  fill: var(--clr-accent);
}
.sparkline .sparkline-grid {
  stroke: var(--clr-border);
  stroke-width: 1;
  stroke-dasharray: 2 4;
}
.drift-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.drift-table th,
.drift-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--clr-border);
  text-align: left;
}
.drift-table th {
  font-weight: 600;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  background: var(--clr-bg);
}
.drift-table td.drift-date {
  color: var(--clr-text-muted);
  white-space: nowrap;
}
.drift-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.drift-dot {
  display: inline-block;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--clr-text-muted);
}
.drift-dot.status-pass { background: var(--clr-pass); }
.drift-dot.status-warn { background: var(--clr-warn); }
.drift-dot.status-fail { background: var(--clr-fail); }
.drift-dot.status-info { background: var(--clr-text-muted); }
.drift-changed {
  border-left: 2px solid var(--clr-accent);
  padding-left: 0.5rem;
}
.upgrade-prompt {
  background: var(--clr-surface);
  border: 1px solid var(--clr-accent);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  margin-top: 1.5rem;
  text-align: center;
}
.upgrade-prompt h2 {
  color: var(--clr-accent);
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}
.upgrade-prompt p {
  color: var(--clr-text-muted);
  font-size: 0.875rem;
  margin-bottom: 1rem;
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
    <a href="/dashboard/bulk">Bulk Scan</a>
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
  unacknowledgedAlerts?: number;
}

export interface DashboardAlert {
  id: number;
  domain: string;
  alertType: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: number;
}

export interface ScanHistoryEntry {
  date: string;
  grade: string;
}

function describeAlert(alert: DashboardAlert): string {
  const prev = alert.previousValue ?? "";
  const next = alert.newValue ?? "";
  if (alert.alertType === "grade_drop") {
    return `Grade dropped from ${prev || "—"} to ${next || "—"}`;
  }
  if (alert.alertType === "protocol_regression") {
    // Detector writes values shaped as "${proto}:${status}" — strip protocol
    // names to keep the message scannable, fall back to raw if shape changes.
    const prevColon = prev.indexOf(":");
    const nextColon = next.indexOf(":");
    const proto =
      prevColon > 0
        ? prev.slice(0, prevColon)
        : nextColon > 0
          ? next.slice(0, nextColon)
          : "";
    const prevStatus = prevColon > 0 ? prev.slice(prevColon + 1) : prev;
    const nextStatus = nextColon > 0 ? next.slice(nextColon + 1) : next;
    const protoLabel = proto
      ? proto.toUpperCase().replace(/_/g, "-")
      : "Protocol";
    return `${protoLabel} regressed: ${prevStatus || "—"} → ${nextStatus || "—"}`;
  }
  return `${alert.alertType}: ${prev} → ${next}`;
}

function relativeTime(unixSeconds: number, now: number): string {
  const deltaSec = Math.max(0, now - unixSeconds);
  if (deltaSec < 60) return "just now";
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  return `${Math.floor(deltaSec / 86400)}d ago`;
}

export function renderAlertsSection(
  alerts: DashboardAlert[],
  now: number = Math.floor(Date.now() / 1000),
): string {
  if (alerts.length === 0) return "";
  const items = alerts
    .map((a) => {
      const domainHref = `/dashboard/domain/${encodeURIComponent(a.domain)}`;
      const ackHref = `/dashboard/alerts/${a.id}/acknowledge`;
      return `<li>
  <span class="alert-domain"><a href="${domainHref}">${esc(a.domain)}</a></span>
  <span class="alert-message">${esc(describeAlert(a))}</span>
  <span class="alert-time">${esc(relativeTime(a.createdAt, now))}</span>
  <form method="post" action="${ackHref}">
    <button type="submit" class="btn-dismiss" aria-label="Dismiss alert for ${esc(a.domain)}">Dismiss</button>
  </form>
</li>`;
    })
    .join("");
  return `<section class="alerts-needs-attention" aria-label="Domain regressions needing attention">
  <h2>Needs attention</h2>
  <ul>${items}</ul>
</section>`;
}

export function renderDashboardPage({
  email,
  alerts = [],
  domains,
}: {
  email: string;
  alerts?: DashboardAlert[];
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
      .map((d) => {
        const alertCount = d.unacknowledgedAlerts ?? 0;
        const alertBadge =
          alertCount > 0
            ? `<span class="badge-alert">${alertCount} alert${alertCount === 1 ? "" : "s"}</span>`
            : "";
        return `<tr>
  <td>
    <a href="/dashboard/domain/${encodeURIComponent(d.domain)}">${esc(d.domain)}</a>
    ${d.isFree ? '<span class="badge-free">Free</span>' : ""}
    ${alertBadge}
  </td>
  <td><span class="inline-grade ${gradeClass(d.grade)}">${esc(d.grade)}</span></td>
  <td>${esc(d.frequency)}</td>
  <td>${d.lastScanned ? esc(d.lastScanned) : '<span style="color:var(--clr-text-muted)">Never</span>'}</td>
</tr>`;
      })
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
${renderAlertsSection(alerts)}
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
  <form method="POST" action="/dashboard/domain/${encodeURIComponent(domain)}/delete" style="display:inline" onsubmit="return confirm('Stop monitoring ${esc(domain)}?');">
    <button type="submit" class="btn btn-secondary" aria-label="Delete domain ${esc(domain)}">Delete</button>
  </form>
</div>
<div class="section-card">
  <h2>Grade History</h2>
  ${historySection}
  <div style="margin-top:0.75rem">
    <a href="/dashboard/domain/${encodeURIComponent(domain)}/history" style="color:var(--clr-accent);font-size:0.875rem;text-decoration:none">See full history &rarr;</a>
  </div>
</div>`;

  return dashboardPage(`${domain} — dmarc.mx`, body, email);
}

export type HistoryProtocolStatus = "pass" | "warn" | "fail" | "info" | null;

export interface HistoryScanEntry {
  date: string;
  scannedAt: number;
  grade: string;
  protocols: {
    dmarc: HistoryProtocolStatus;
    spf: HistoryProtocolStatus;
    dkim: HistoryProtocolStatus;
    bimi: HistoryProtocolStatus;
    mta_sts: HistoryProtocolStatus;
  };
}

// Higher = better. Matches src/alerts/detector.ts GRADE_RANK. Duplicated here
// because the detector file is policy; the view is presentation — keeping
// them decoupled avoids pulling a dep chain through the render path.
const GRADE_RANK_FOR_SPARKLINE: Record<string, number> = {
  F: 0,
  "D-": 1,
  D: 2,
  "D+": 3,
  "C-": 4,
  C: 5,
  "C+": 6,
  "B-": 7,
  B: 8,
  "B+": 9,
  "A-": 10,
  A: 11,
  "A+": 12,
  S: 13,
};

function renderSparkline(entries: HistoryScanEntry[]): string {
  if (entries.length === 0) {
    return `<p style="color:var(--clr-text-muted);font-size:0.875rem;padding:0.75rem 0">No scans yet to chart.</p>`;
  }
  const width = 600;
  const height = 80;
  const pad = 8;
  // Chart oldest → newest left-to-right, so reverse the newest-first input.
  const ordered = [...entries].reverse();
  const n = ordered.length;
  const maxRank = 13;
  const points = ordered.map((entry, i) => {
    const rank = GRADE_RANK_FOR_SPARKLINE[entry.grade] ?? 0;
    const x = n === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1);
    const y = pad + (1 - rank / maxRank) * (height - pad * 2);
    return { x, y };
  });
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const dots = points
    .map(
      (p) =>
        `<circle class="sparkline-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" />`,
    )
    .join("");
  const midY = pad + (height - pad * 2) / 2;
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Grade trend sparkline">
  <line class="sparkline-grid" x1="${pad}" y1="${midY}" x2="${width - pad}" y2="${midY}" />
  <path class="sparkline-line" d="${path}" />
  ${dots}
</svg>`;
}

function statusLabel(status: HistoryProtocolStatus): string {
  if (status === null) return "—";
  return status;
}

function renderDriftCell(
  status: HistoryProtocolStatus,
  previous: HistoryProtocolStatus,
): string {
  const changed = previous !== null && status !== previous;
  const cls = `drift-cell${changed ? " drift-changed" : ""}`;
  const dotCls = status ? `drift-dot status-${status}` : "drift-dot";
  const title = changed ? ` title="changed from ${previous}"` : "";
  return `<span class="${cls}"${title}><span class="${dotCls}"></span>${esc(statusLabel(status))}</span>`;
}

function renderDriftTable(entries: HistoryScanEntry[]): string {
  if (entries.length === 0) {
    return `<p style="color:var(--clr-text-muted);font-size:0.875rem;padding:0.75rem 0">No scans yet.</p>`;
  }
  // Rows are newest-first. To highlight "changed vs the prior (older) scan",
  // we compare each row to the NEXT row in the list (which is chronologically
  // older). The oldest row has no "previous" — its cells never highlight.
  const rows = entries
    .map((entry, i) => {
      const prev: HistoryScanEntry["protocols"] | null =
        i + 1 < entries.length ? entries[i + 1].protocols : null;
      const protos = entry.protocols;
      return `<tr>
  <td class="drift-date">${esc(entry.date)}</td>
  <td><span class="inline-grade ${gradeClass(entry.grade)}">${esc(entry.grade)}</span></td>
  <td>${renderDriftCell(protos.dmarc, prev?.dmarc ?? null)}</td>
  <td>${renderDriftCell(protos.spf, prev?.spf ?? null)}</td>
  <td>${renderDriftCell(protos.dkim, prev?.dkim ?? null)}</td>
  <td>${renderDriftCell(protos.bimi, prev?.bimi ?? null)}</td>
  <td>${renderDriftCell(protos.mta_sts, prev?.mta_sts ?? null)}</td>
</tr>`;
    })
    .join("");
  return `<table class="drift-table">
  <thead>
    <tr>
      <th>Scanned</th>
      <th>Grade</th>
      <th>DMARC</th>
      <th>SPF</th>
      <th>DKIM</th>
      <th>BIMI</th>
      <th>MTA-STS</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

export function renderDomainHistoryPage({
  email,
  domain,
  plan,
  history,
}: {
  email: string;
  domain: string;
  plan: "free" | "pro";
  history: HistoryScanEntry[];
}): string {
  const sparkline = renderSparkline(history);
  const drift = renderDriftTable(history);

  const upgradePrompt =
    plan === "free"
      ? `<div class="upgrade-prompt">
  <h2>Upgrade to see the full history</h2>
  <p>Pro unlocks 30 scans of grade-trend and protocol-drift detail per domain, plus nightly monitoring and higher API rate limits.</p>
  <a href="/dashboard/billing/subscribe" class="btn">Upgrade to Pro</a>
</div>`
      : "";

  const body = `<h1 class="dashboard-title">History — ${esc(domain)}</h1>
<div class="section-card">
  <h2>Grade trend</h2>
  ${sparkline}
</div>
<div class="section-card">
  <h2>Protocol drift</h2>
  ${drift}
</div>
${upgradePrompt}
<div style="margin-top:1rem">
  <a href="/dashboard/domain/${encodeURIComponent(domain)}" style="color:var(--clr-accent);font-size:0.875rem;text-decoration:none">&larr; Back to ${esc(domain)}</a>
</div>`;

  return dashboardPage(`History — ${domain} — dmarc.mx`, body, email);
}

export function renderAddDomainPage({
  email,
  error,
}: {
  email: string;
  error: string | null;
}): string {
  const errorBlock = error
    ? `<div class="settings-section" style="border-color:var(--clr-danger, #b91c1c);color:var(--clr-danger, #b91c1c)">${esc(error)}</div>`
    : "";

  const body = `<h1 class="dashboard-title">Add Domain</h1>
${errorBlock}
<form method="POST" action="/dashboard/domain/add" class="settings-section">
  <label for="domain-input" style="display:block;font-size:0.875rem;color:var(--clr-text-muted);margin-bottom:0.4rem">Domain to monitor</label>
  <input
    id="domain-input"
    class="settings-input"
    type="text"
    name="domain"
    placeholder="example.com"
    autofocus
    required
    autocapitalize="none"
    autocorrect="off"
    spellcheck="false"
    aria-describedby="domain-help"
  >
  <p id="domain-help" style="font-size:0.8125rem;color:var(--clr-text-muted);margin:0.5rem 0 1rem">
    We'll run a full DMARC/SPF/DKIM/BIMI/MTA-STS scan and notify you if the grade drops.
  </p>
  <div class="action-row">
    <button type="submit" class="btn">Add Domain</button>
    <a href="/dashboard" class="btn btn-secondary">Cancel</a>
  </div>
</form>`;

  return dashboardPage("Add Domain — dmarc.mx", body, email);
}

export interface BulkResultRow {
  domain: string;
  status: "scanned" | "queued" | "error" | "invalid";
  grade?: string;
  error?: string;
}

export interface BulkRenderResults {
  accepted: number;
  rejected: number;
  results: BulkResultRow[];
}

export function renderBulkScanPage({
  email,
  plan,
  submitted,
  results,
  error,
  totalCap,
  inBandCap,
}: {
  email: string;
  plan: "free" | "pro";
  submitted: number | null;
  results: BulkRenderResults | null;
  error: string | null;
  totalCap: number;
  inBandCap: number;
}): string {
  if (plan !== "pro") {
    const body = `<h1 class="dashboard-title">Bulk Scan</h1>
<div class="upgrade-prompt">
  <h2>Pro feature</h2>
  <p>Bulk scan accepts up to ${totalCap} domains per request and runs the first ${inBandCap} immediately. Available on the Pro plan.</p>
  <a href="/dashboard/billing/subscribe" class="btn">Upgrade to Pro</a>
</div>
${error ? `<div class="bulk-error">${esc(error)}</div>` : ""}`;
    return dashboardPage("Bulk Scan — dmarc.mx", body, email);
  }

  const errorBlock = error ? `<div class="bulk-error">${esc(error)}</div>` : "";

  const resultsBlock = results
    ? `<div class="section-card">
  <h2>Results</h2>
  <p class="bulk-summary">
    ${submitted ?? results.results.length} submitted —
    <strong>${results.accepted}</strong> accepted,
    <strong>${results.rejected}</strong> rejected.
    First ${inBandCap} scanned in-band; the rest queued for the next nightly cron pass.
  </p>
  ${
    results.results.length === 0
      ? `<p class="bulk-summary">No domains parsed from the submission.</p>`
      : `<table class="bulk-results-table">
    <thead>
      <tr>
        <th>Domain</th>
        <th>Status</th>
        <th>Grade / Error</th>
      </tr>
    </thead>
    <tbody>${results.results.map(renderBulkRow).join("")}</tbody>
  </table>`
  }
</div>`
    : "";

  const body = `<h1 class="dashboard-title">Bulk Scan</h1>
<p class="bulk-summary">
  Paste up to <strong>${totalCap}</strong> domains (one per line, or comma-separated). The first
  <strong>${inBandCap}</strong> will be scanned immediately; the rest queue for the next cron pass.
</p>
${errorBlock}
<form method="POST" action="/dashboard/bulk" class="settings-section">
  <label for="bulk-input" style="display:block;font-size:0.875rem;color:var(--clr-text-muted);margin-bottom:0.4rem">Domains</label>
  <textarea
    id="bulk-input"
    class="bulk-textarea"
    name="domains"
    placeholder="example.com&#10;another.org&#10;corp.example"
    autocapitalize="none"
    autocorrect="off"
    spellcheck="false"
    required
  ></textarea>
  <div class="action-row">
    <button type="submit" class="btn">Scan</button>
    <a href="/dashboard" class="btn btn-secondary">Cancel</a>
  </div>
</form>
${resultsBlock}`;

  return dashboardPage("Bulk Scan — dmarc.mx", body, email);
}

function renderBulkRow(row: BulkResultRow): string {
  const detail =
    row.status === "scanned" && row.grade
      ? `<span class="inline-grade ${gradeClass(row.grade)}">${esc(row.grade)}</span>`
      : row.error
        ? esc(row.error)
        : row.status === "queued"
          ? '<span style="color:var(--clr-text-muted)">Queued for cron</span>'
          : "";
  return `<tr>
  <td><a href="/dashboard/domain/${encodeURIComponent(row.domain)}">${esc(row.domain)}</a></td>
  <td><span class="bulk-status ${row.status}">${row.status}</span></td>
  <td>${detail}</td>
</tr>`;
}

export function renderSettingsPage({
  email,
  webhookUrl,
  plan,
  billingEnabled,
  emailAlertsEnabled,
  showRetirementBanner,
}: {
  email: string;
  webhookUrl: string | null;
  plan: "free" | "pro";
  billingEnabled: boolean;
  emailAlertsEnabled: boolean;
  showRetirementBanner: boolean;
}): string {
  const retirementBanner = showRetirementBanner
    ? `<div class="settings-section" style="border-color:var(--clr-accent);background:var(--clr-accent-muted, rgba(249,115,22,0.08))">
  <h2 style="color:var(--clr-accent)">Your API key was retired</h2>
  <p>We rebuilt API keys to store only a hash, so any key you had before has been invalidated. Generate a new one to keep using the dmarc.mx API.</p>
  <a href="/dashboard/settings/api-keys" class="btn">Manage API Keys</a>
</div>`
    : "";

  const planLabel = plan === "pro" ? "Pro" : "Free";
  const billingSection = !billingEnabled
    ? `<p>Billing is not configured on this deployment.</p>`
    : plan === "pro"
      ? `<p>You're on the <strong>${planLabel}</strong> plan.</p>
<a href="/dashboard/billing/portal" class="btn btn-secondary">Manage Billing</a>`
      : `<p>You're on the <strong>${planLabel}</strong> plan.</p>
<a href="/dashboard/billing/subscribe" class="btn">Upgrade to Pro</a>`;

  const body = `<h1 class="dashboard-title">Settings</h1>
${retirementBanner}
<div class="settings-section">
  <h2>Account</h2>
  <p>Signed in as <strong>${esc(email)}</strong></p>
</div>

<div class="settings-section">
  <h2>API Keys</h2>
  <p>Generate a bearer token to call the dmarc.mx API. Keys are hashed at rest; the raw value is shown only once at creation.</p>
  <a href="/dashboard/settings/api-keys" class="btn btn-secondary">Manage API Keys</a>
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
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
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

export interface ApiKeyListEntry {
  id: string;
  name: string | null;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

function formatEpochSeconds(ts: number | null | undefined): string | null {
  if (ts === null || ts === undefined) return null;
  return new Date(ts * 1000).toLocaleDateString();
}

export function toApiKeyListEntry(row: {
  id: string;
  name: string | null;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}): ApiKeyListEntry {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: formatEpochSeconds(row.created_at) ?? "—",
    lastUsedAt: formatEpochSeconds(row.last_used_at),
    revoked: row.revoked_at !== null,
  };
}

export function renderApiKeysPage({
  email,
  keys,
  justCreated,
  showRetirementBanner,
}: {
  email: string;
  keys: ApiKeyListEntry[];
  justCreated: string | null;
  showRetirementBanner: boolean;
}): string {
  const retirementBanner = showRetirementBanner
    ? `<div class="settings-section" style="border-color:var(--clr-accent);background:var(--clr-accent-muted, rgba(249,115,22,0.08))">
  <h2 style="color:var(--clr-accent)">Your old API key was retired</h2>
  <p>We now store only a hash of each key, so anything you generated before has been invalidated. Generate a replacement below.</p>
</div>`
    : "";

  // The raw key is shown exactly once — reload and it's gone. Copy button
  // reuses the `.copy-btn[data-copy]` handler in src/views/scripts.ts.
  const justCreatedBanner = justCreated
    ? `<div class="settings-section" style="border-color:var(--clr-accent);background:var(--clr-accent-muted, rgba(249,115,22,0.08))">
  <h2 style="color:var(--clr-accent)">Save this key now</h2>
  <p>This is the only time the full key will be shown. Copy it somewhere safe before navigating away.</p>
  <div class="api-key-display" style="display:flex;gap:0.5rem;align-items:center">
    <span style="flex:1;overflow-x:auto">${esc(justCreated)}</span>
    <button type="button" class="copy-btn" data-copy="${esc(justCreated)}" aria-label="Copy API key">Copy</button>
  </div>
</div>`
    : "";

  let table: string;
  if (keys.length === 0) {
    table = `<p style="color:var(--clr-text-muted);font-size:0.875rem">No API keys yet.</p>`;
  } else {
    const rows = keys
      .map((k) => {
        const name = k.name ? esc(k.name) : "<em>(unnamed)</em>";
        const status = k.revoked
          ? '<span style="color:var(--clr-fail)">Revoked</span>'
          : '<span style="color:var(--clr-pass)">Active</span>';
        const lastUsed = k.lastUsedAt
          ? esc(k.lastUsedAt)
          : '<span style="color:var(--clr-text-muted)">Never</span>';
        const actions = k.revoked
          ? ""
          : `<form method="POST" action="/dashboard/settings/api-keys/revoke" style="display:inline" onsubmit="return confirm('Revoke this key? Requests using it will start failing.');">
              <input type="hidden" name="id" value="${esc(k.id)}">
              <button type="submit" class="btn btn-secondary" aria-label="Revoke API key ${name}" style="padding:0.25rem 0.6rem;font-size:0.8125rem">Revoke</button>
            </form>`;
        return `<tr>
  <td>${name}</td>
  <td><code>${esc(k.prefix)}…</code></td>
  <td>${esc(k.createdAt)}</td>
  <td>${lastUsed}</td>
  <td>${status}</td>
  <td>${actions}</td>
</tr>`;
      })
      .join("");

    table = `<table class="domain-table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Prefix</th>
      <th>Created</th>
      <th>Last Used</th>
      <th>Status</th>
      <th></th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  const body = `<h1 class="dashboard-title">API Keys</h1>
${retirementBanner}
${justCreatedBanner}
<div class="settings-section">
  <h2>Generate a new key</h2>
  <p>Bearer tokens authenticate <code>/api/check</code> requests. Free and Pro plans share key generation; Pro users get higher per-key rate limits.</p>
  <form method="POST" action="/dashboard/settings/api-keys/generate">
    <label for="api-key-name" style="display:block;font-size:0.875rem;color:var(--clr-text-muted);margin-bottom:0.4rem">Label (optional)</label>
    <input id="api-key-name" class="settings-input" type="text" name="name" placeholder="ci-pipeline" maxlength="60" autocapitalize="none" autocorrect="off" spellcheck="false">
    <div class="action-row">
      <button type="submit" class="btn">Generate API Key</button>
      <a href="/dashboard/settings" class="btn btn-secondary">Back to Settings</a>
    </div>
  </form>
</div>

<div class="settings-section">
  <h2>Your keys</h2>
  ${table}
</div>`;

  return dashboardPage("API Keys — dmarc.mx", body, email);
}
