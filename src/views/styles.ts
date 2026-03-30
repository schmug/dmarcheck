export const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #0a0a0f; color: #e4e4e7; min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
a { color: #f97316; text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 0.9em; }

/* Landing */
.landing {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 100vh; padding: 2rem;
}
.logo { font-size: 2.8rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 0.5rem; }
.logo span { color: #f97316; }
.tagline { color: #71717a; font-size: 1.1rem; margin-bottom: 2.5rem; text-align: center; }

.search-box {
  display: flex; width: 100%; max-width: 560px;
  background: #18181b; border: 1px solid #27272a; border-radius: 12px;
  overflow: hidden; transition: border-color 0.2s;
}
.search-box:focus-within { border-color: #f97316; }
.search-box input {
  flex: 1; padding: 16px 20px; background: transparent; border: none;
  color: #e4e4e7; font-size: 1.1rem; outline: none;
}
.search-box input::placeholder { color: #52525b; }
.search-box button {
  padding: 16px 28px; background: #f97316; color: white; border: none;
  font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s;
}
.search-box button:hover { background: #ea580c; }

.protocols { display: flex; gap: 12px; margin-top: 2rem; flex-wrap: wrap; justify-content: center; }
.protocol-tag {
  padding: 6px 14px; background: #18181b; border: 1px solid #27272a;
  border-radius: 999px; font-size: 0.8rem; color: #a1a1aa; font-weight: 500;
}
.examples { margin-top: 2rem; color: #52525b; font-size: 0.85rem; }
.api-hint {
  margin-top: 1.5rem; padding: 10px 16px; background: #18181b; border: 1px solid #27272a;
  border-radius: 8px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.78rem; color: #71717a;
}
.api-hint span { color: #f97316; }
.foss-callout { margin-top: 1.5rem; }
.foss-link {
  display: inline-flex; align-items: center; gap: 6px;
  color: #71717a; font-size: 0.8rem; text-decoration: none;
}
.foss-link:hover { color: #a1a1aa; text-decoration: none; }
.foss-link:hover svg { fill: #a1a1aa; }

/* Report */
.report { max-width: 800px; margin: 0 auto; padding: 2rem; }
.report-nav {
  display: flex; align-items: center; gap: 12px; margin-bottom: 2rem;
}
.report-nav a { font-size: 0.85rem; }
.report-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
.domain-name { font-size: 1.5rem; font-weight: 700; }
.overall-grade {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 10px; font-weight: 800; font-size: 1.2rem;
}
.grade-a { background: #052e16; color: #22c55e; border: 1px solid #166534; }
.grade-b { background: #052e16; color: #22c55e; border: 1px solid #166534; }
.grade-c { background: #451a03; color: #f59e0b; border: 1px solid #92400e; }
.grade-d { background: #451a03; color: #f59e0b; border: 1px solid #92400e; }
.grade-f { background: #450a0a; color: #ef4444; border: 1px solid #991b1b; }
.report-meta { color: #71717a; font-size: 0.85rem; margin-bottom: 2rem; }

/* Cards */
.card {
  background: #18181b; border: 1px solid #27272a; border-radius: 12px;
  margin-bottom: 12px; overflow: hidden; transition: border-color 0.2s;
}
.card:hover { border-color: #3f3f46; }
.card-header {
  display: flex; align-items: center; padding: 16px 20px; cursor: pointer; gap: 14px;
}
.status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.status-pass { background: #22c55e; box-shadow: 0 0 8px #22c55e40; }
.status-warn { background: #f59e0b; box-shadow: 0 0 8px #f59e0b40; }
.status-fail { background: #ef4444; box-shadow: 0 0 8px #ef444440; }
.card-title { font-weight: 600; flex: 1; }
.card-subtitle { color: #71717a; font-size: 0.85rem; }
.card-chevron { color: #52525b; transition: transform 0.2s; font-size: 0.8rem; }
.card-body { padding: 0 20px 20px; border-top: 1px solid #27272a; display: none; }
.card.expanded .card-body { display: block; }
.card.expanded .card-chevron { transform: rotate(90deg); }

/* Tag grid */
.tag-grid {
  display: grid; grid-template-columns: auto 1fr; gap: 6px 16px;
  margin-top: 12px; font-size: 0.9rem;
}
.tag-name { font-family: monospace; color: #f97316; font-weight: 600; }
.tag-value { color: #d4d4d8; }

/* Validation list */
.validation-list { margin-top: 12px; list-style: none; }
.validation-list li {
  padding: 6px 0; display: flex; align-items: flex-start; gap: 8px; font-size: 0.85rem;
}
.icon-pass { color: #22c55e; flex-shrink: 0; }
.icon-warn { color: #f59e0b; flex-shrink: 0; }
.icon-fail { color: #ef4444; flex-shrink: 0; }

/* Raw record */
.record-raw {
  background: #0a0a0f; padding: 12px 16px; border-radius: 8px;
  font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem;
  color: #a1a1aa; margin-top: 12px; overflow-x: auto; white-space: pre-wrap;
  word-break: break-all;
}

/* SPF tree */
.spf-tree { margin-top: 12px; }
.spf-tree ul { list-style: none; padding-left: 20px; }
.spf-tree > ul { padding-left: 0; }
.spf-tree li { padding: 4px 0; font-size: 0.85rem; }
.spf-node {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 8px; background: #27272a; border-radius: 4px;
  font-family: monospace; font-size: 0.8rem;
}
.spf-node.mechanism { color: #f97316; }
.spf-node.include { color: #3b82f6; cursor: pointer; }
.spf-node.include:hover { background: #1e3a5f; }
.lookup-count {
  display: inline-block; padding: 2px 8px; border-radius: 4px;
  font-size: 0.75rem; font-weight: 600; margin-top: 8px;
}
.lookup-ok { background: #052e16; color: #22c55e; }
.lookup-over { background: #450a0a; color: #ef4444; }

/* DKIM selectors */
.selector-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px; margin-top: 12px;
}
.selector-item {
  padding: 8px 12px; background: #0a0a0f; border-radius: 8px;
  font-family: monospace; font-size: 0.8rem; display: flex; align-items: center; gap: 8px;
}
.selector-found { border: 1px solid #166534; }
.selector-not-found { border: 1px solid #27272a; color: #52525b; }

/* MTA-STS policy table */
.policy-table { width: 100%; margin-top: 12px; border-collapse: collapse; }
.policy-table th {
  text-align: left; padding: 8px 12px; background: #0a0a0f;
  font-size: 0.8rem; color: #71717a; font-weight: 500; border-bottom: 1px solid #27272a;
}
.policy-table td {
  padding: 8px 12px; font-size: 0.85rem; border-bottom: 1px solid #27272a;
}
.policy-table td:first-child { font-family: monospace; color: #f97316; }

/* Tooltip */
.tooltip {
  position: relative; cursor: help; border-bottom: 1px dotted #f97316;
}
.tooltip .tooltip-text {
  visibility: hidden; opacity: 0; position: absolute; bottom: 125%; left: 50%;
  transform: translateX(-50%); background: #27272a; color: #e4e4e7;
  padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 400;
  white-space: nowrap; z-index: 10; transition: opacity 0.15s;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.tooltip:hover .tooltip-text { visibility: visible; opacity: 1; }

/* Error */
.error-box {
  background: #450a0a; border: 1px solid #991b1b; border-radius: 12px;
  padding: 20px; margin: 2rem auto; max-width: 560px; text-align: center;
}
.error-box h3 { color: #ef4444; margin-bottom: 0.5rem; }
.error-box p { color: #a1a1aa; font-size: 0.9rem; }

/* Loading */
.loading { text-align: center; padding: 4rem 2rem; }
.loading .spinner {
  display: inline-block; width: 32px; height: 32px; border: 3px solid #27272a;
  border-top-color: #f97316; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Responsive */
@media (max-width: 640px) {
  .logo { font-size: 2rem; }
  .search-box { flex-direction: column; border-radius: 12px; }
  .search-box button { padding: 14px; }
  .report { padding: 1rem; }
  .selector-grid { grid-template-columns: 1fr; }
}
`;
