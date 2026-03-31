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
  min-height: 100vh; padding: 2rem;
}
.landing-main {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center;
}
.landing-footer {
  display: flex; flex-direction: column; align-items: center;
  padding-bottom: 1rem;
}
.logo { font-size: 2.8rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 12px; justify-content: center; }
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

/* Advanced options */
.advanced-options {
  width: 100%; max-width: 560px; margin-top: 0.75rem;
}
.advanced-options summary {
  color: #71717a; font-size: 0.8rem; cursor: pointer; text-align: right;
  list-style: none;
}
.advanced-options summary::-webkit-details-marker { display: none; }
.advanced-options summary::before { content: '\\25B8 '; }
.advanced-options[open] summary::before { content: '\\25BE '; }
.advanced-options summary:hover { color: #f97316; }
.advanced-body {
  margin-top: 0.5rem; padding: 12px 16px; background: #18181b;
  border: 1px solid #27272a; border-radius: 8px;
}
.advanced-body label {
  display: block; font-size: 0.8rem; color: #a1a1aa; margin-bottom: 4px;
}
.advanced-body input {
  width: 100%; padding: 10px 12px; background: #0a0a0f; border: 1px solid #27272a;
  border-radius: 6px; color: #e4e4e7; font-size: 0.9rem; outline: none;
  transition: border-color 0.2s;
}
.advanced-body input:focus { border-color: #f97316; }
.advanced-body input::placeholder { color: #52525b; }
.advanced-body small { display: block; margin-top: 6px; color: #52525b; font-size: 0.75rem; }

.learn-link { margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: #71717a; }
.landing-footer .learn-link { margin-top: 0; margin-bottom: 0.75rem; }
.landing-footer .api-hint { margin-top: 0; margin-bottom: 0.75rem; }
.landing-footer .foss-callout { margin-top: 0; }
.examples { margin-top: 2rem; color: #52525b; font-size: 0.85rem; }
.api-hint {
  margin-top: 1.5rem; padding: 10px 16px; background: #18181b; border: 1px solid #27272a;
  border-radius: 8px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.78rem; color: #71717a;
}
.api-hint span { color: #f97316; }
.foss-callout { margin-top: 1.5rem; text-align: center; }
.foss-link {
  display: inline-flex; align-items: center; gap: 6px;
  color: #71717a; font-size: 0.8rem; text-decoration: none;
}
.foss-link:hover { color: #a1a1aa; text-decoration: none; }
.foss-link:hover svg { fill: #a1a1aa; }
.footer-creature { margin-bottom: 0.75rem; opacity: 0.6; }
.footer-creature:hover { opacity: 1; transition: opacity 0.3s; }
.logo-text { display: inline; }
.creature-loading { display: inline-flex; }

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
.confetti-toggle {
  position: fixed; bottom: 1rem; left: 1rem; z-index: 100;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: #27272a; border: 1px solid #3f3f46;
  cursor: pointer; transition: background 0.15s, opacity 0.15s;
  font-size: 0.8rem; line-height: 1; padding: 0;
}
.confetti-toggle:hover { background: #3f3f46; }
.confetti-toggle.disabled { opacity: 0.4; }
.report-meta { color: #71717a; font-size: 0.85rem; margin-bottom: 2rem; }
.csv-download {
  padding: 2px 8px; background: #27272a; border-radius: 4px;
  font-size: 0.8rem; text-decoration: none; color: #a1a1aa;
  transition: background 0.15s, color 0.15s;
}
.csv-download:hover { background: #f97316; color: #fff; }

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
  word-break: break-all; display: flex; align-items: flex-start; gap: 12px;
}
.record-raw code { flex: 1; min-width: 0; }
.copy-btn {
  flex-shrink: 0; padding: 4px 10px; background: #27272a; color: #a1a1aa;
  border: 1px solid #3f3f46; border-radius: 6px; font-size: 0.75rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.copy-btn:hover { background: #f97316; color: #fff; border-color: #f97316; }
.record-expand { margin-top: 12px; }
.record-expand summary {
  cursor: pointer; color: #a1a1aa; font-size: 0.8rem;
  user-select: none; list-style: revert;
}
.record-expand summary:hover { color: #d4d4d8; }
.record-expand .record-raw { margin-top: 8px; }

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
  visibility: hidden; opacity: 0; position: absolute; bottom: 125%; left: 0;
  background: #27272a; color: #e4e4e7;
  padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 400;
  width: max-content; max-width: 220px; z-index: 10; transition: opacity 0.15s;
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
.scan-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 60vh;
}
.loading { text-align: center; padding: 4rem 2rem; }
.loading .spinner {
  display: inline-block; width: 32px; height: 32px; border: 3px solid #27272a;
  border-top-color: #f97316; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading p { color: #71717a; margin-top: 1rem; font-size: 0.9rem; }

/* Score snippet (inline on results page) */
.score-snippet {
  background: #18181b; border: 1px solid #27272a; border-radius: 10px;
  padding: 14px 18px; margin: 12px 0 20px 0;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  flex-wrap: wrap;
}
.snippet-left { display: flex; flex-direction: column; gap: 6px; }
.snippet-tier { font-size: 0.85rem; color: #e4e4e7; }
.tier-pass { color: #22c55e; font-weight: 600; }
.tier-warn { color: #f59e0b; font-weight: 600; }
.tier-fail { color: #ef4444; font-weight: 600; }
.snippet-protocols { display: flex; gap: 12px; align-items: center; }
.snippet-proto {
  display: flex; align-items: center; gap: 4px;
  font-size: 0.7rem; color: #a1a1aa;
}
.snippet-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.snippet-link {
  color: #f97316; font-size: 0.8rem; text-decoration: none; font-weight: 500;
  white-space: nowrap;
}
.snippet-link:hover { text-decoration: underline; }

/* Scoring breakdown page */
.breakdown { max-width: 700px; margin: 0 auto; padding: 2rem; }
.breakdown .report-nav { margin-bottom: 1.5rem; }
.breakdown .report-header { margin-bottom: 0.5rem; }
.breakdown .report-meta { margin-bottom: 1.5rem; }

.bd-card {
  background: #18181b; border: 1px solid #27272a; border-radius: 10px;
  margin-bottom: 16px; overflow: hidden;
}
.bd-card-title {
  font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1px; color: #a1a1aa; padding: 14px 18px 0;
}
.bd-card-body { padding: 12px 18px 16px; }
.tier-text { font-size: 0.9rem; line-height: 1.6; color: #e4e4e7; }

/* Factors table */
.factors-table { width: 100%; border-collapse: collapse; }
.factors-table td {
  padding: 8px 0; font-size: 0.8rem; border-bottom: 1px solid #27272a40;
  vertical-align: middle;
}
.factors-table tr:last-child td { border-bottom: none; }
.factor-proto {
  color: #a1a1aa; font-weight: 500; width: 70px;
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;
}
.factor-label { color: #e4e4e7; }
.factor-effect {
  text-align: right; font-weight: 700; font-size: 0.8rem; width: 40px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
.effect-plus { color: #22c55e; }
.effect-minus { color: #ef4444; }
.effect-neutral { color: #a1a1aa; }
.modifier-summary {
  margin-top: 10px; padding-top: 10px; border-top: 1px solid #27272a;
  font-size: 0.8rem; color: #a1a1aa;
  display: flex; justify-content: space-between;
}
.modifier-result { color: #22c55e; font-weight: 600; }

/* Protocol contribution grid */
.proto-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
}
.proto-cell {
  text-align: center; padding: 12px 6px; border-radius: 8px; background: #0a0a0f;
}
.proto-name {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: #e4e4e7; margin-bottom: 4px;
}
.proto-summary { font-size: 0.65rem; color: #a1a1aa; line-height: 1.3; }

/* Recommendations */
.rec-item {
  display: flex; gap: 12px; padding: 12px 0;
  border-bottom: 1px solid #27272a40;
}
.rec-item:last-child { border-bottom: none; }
.rec-priority {
  width: 28px; height: 28px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700; flex-shrink: 0; margin-top: 2px;
}
.priority-1 { background: #052e1680; color: #22c55e; border: 1px solid #22c55e40; }
.priority-2 { background: #451a0380; color: #f59e0b; border: 1px solid #f59e0b40; }
.priority-3 { background: #18181b; color: #a1a1aa; border: 1px solid #27272a; }
.rec-content { flex: 1; }
.rec-title { font-size: 0.85rem; font-weight: 500; color: #e4e4e7; margin-bottom: 3px; }
.rec-desc { font-size: 0.78rem; color: #a1a1aa; line-height: 1.4; }
.rec-impact { font-size: 0.7rem; color: #f97316; margin-top: 4px; font-weight: 500; }

/* Scoring rubric page */
.rubric-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
.rubric-intro { color: #a1a1aa; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.5rem; }
.rubric-table { width: 100%; border-collapse: collapse; }
.rubric-table th {
  text-align: left; padding: 8px 12px; background: #0a0a0f;
  font-size: 0.75rem; color: #71717a; font-weight: 500; text-transform: uppercase;
  letter-spacing: 0.5px; border-bottom: 1px solid #27272a;
}
.rubric-table td {
  padding: 10px 12px; font-size: 0.85rem; border-bottom: 1px solid #27272a40;
  vertical-align: middle;
}
.rubric-grade {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 28px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;
}
.rubric-protocol { padding: 10px 0; border-bottom: 1px solid #27272a40; }
.rubric-protocol:last-child { border-bottom: none; }
.rubric-protocol h3 { font-size: 0.9rem; font-weight: 600; color: #f97316; margin-bottom: 4px; }
.rubric-protocol p { font-size: 0.82rem; color: #a1a1aa; line-height: 1.5; }
.rubric-cta {
  display: inline-block; padding: 10px 24px; background: #f97316; color: white;
  border-radius: 8px; font-weight: 600; font-size: 0.9rem; text-decoration: none;
  transition: background 0.2s;
}
.rubric-cta:hover { background: #ea580c; text-decoration: none; }

/* @ Creature easter egg */
.at-creature {
  position: fixed; z-index: 9998; cursor: pointer;
  display: flex; flex-direction: column; align-items: center;
  user-select: none; outline: none;
  will-change: transform, left, top;
  transition: left 0s linear, top 0s linear;
}
.at-creature .creature-body {
  font-size: 48px; font-family: monospace; color: #f97316; line-height: 1;
  text-shadow: 0 4px 12px rgba(249,115,22,0.3);
  position: relative; transition: transform 0.15s;
}
.at-creature .creature-eyes {
  position: absolute; top: 6px; left: 12px;
  display: flex; gap: 6px; pointer-events: none;
}
.at-creature .creature-eye {
  width: 10px; height: 10px; background: white; border-radius: 50%;
  position: relative; overflow: hidden;
}
.at-creature .creature-pupil {
  width: 5px; height: 5px; background: #0a0a0f; border-radius: 50%;
  position: absolute; top: 3px; left: 3px;
  transition: left 0.15s, top 0.15s;
}
.at-creature .creature-legs {
  display: flex; gap: 6px; margin-top: -4px; pointer-events: none;
}
.at-creature .creature-leg {
  width: 6px; height: 12px; background: #ea580c; border-radius: 0 0 3px 3px;
}
.at-creature.walking .creature-leg:nth-child(odd) {
  animation: creature-walk 0.3s ease-in-out infinite alternate;
}
.at-creature.walking .creature-leg:nth-child(even) {
  animation: creature-walk 0.3s ease-in-out infinite alternate-reverse;
}
.at-creature .creature-body.chomping {
  animation: creature-chomp 0.3s ease-in-out;
}
.at-creature.panicking .creature-eye {
  transform: scale(1.4);
}
.at-creature.panicking .creature-pupil {
  width: 3px; height: 3px; top: 4px; left: 4px;
}
.at-creature.panicking .creature-leg {
  animation-duration: 0.12s !important;
}
@keyframes creature-walk {
  from { height: 12px; }
  to { height: 6px; }
}
@keyframes creature-chomp {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2) rotate(-5deg); }
}
/* Static creature (brand mascot) */
.creature {
  display: inline-flex; flex-direction: column; align-items: center;
  vertical-align: middle;
}
.creature .creature-body {
  font-family: 'SF Mono', 'Fira Code', monospace; color: #f97316; line-height: 1;
  text-shadow: 0 2px 8px rgba(249,115,22,0.3);
  position: relative;
}
.creature .creature-eyes {
  position: absolute; display: flex; pointer-events: none;
}
.creature .creature-eye {
  background: white; border-radius: 50%; position: relative; overflow: hidden;
}
.creature .creature-pupil {
  background: #0a0a0f; border-radius: 50%; position: absolute;
}
.creature .creature-legs {
  display: flex; pointer-events: none;
}
.creature .creature-leg {
  background: #ea580c; border-radius: 0 0 3px 3px;
}

/* Sizes */
.creature-lg .creature-body { font-size: 48px; }
.creature-lg .creature-eyes { top: 6px; left: 12px; gap: 6px; }
.creature-lg .creature-eye { width: 10px; height: 10px; }
.creature-lg .creature-pupil { width: 5px; height: 5px; top: 3px; left: 3px; }
.creature-lg .creature-legs { gap: 6px; margin-top: -4px; }
.creature-lg .creature-leg { width: 6px; height: 12px; }

.creature-md .creature-body { font-size: 30px; }
.creature-md .creature-eyes { top: 4px; left: 7px; gap: 4px; }
.creature-md .creature-eye { width: 7px; height: 7px; }
.creature-md .creature-pupil { width: 3px; height: 3px; top: 2px; left: 2px; }
.creature-md .creature-legs { gap: 4px; margin-top: -3px; }
.creature-md .creature-leg { width: 4px; height: 8px; }

.creature-sm .creature-body { font-size: 20px; }
.creature-sm .creature-eyes { top: 3px; left: 5px; gap: 3px; }
.creature-sm .creature-eye { width: 5px; height: 5px; }
.creature-sm .creature-pupil { width: 2px; height: 2px; top: 2px; left: 2px; }
.creature-sm .creature-legs { gap: 3px; margin-top: -2px; }
.creature-sm .creature-leg { width: 3px; height: 6px; }

/* Moods — pupil position changes */
.creature-celebrating .creature-pupil { top: 1px; left: 1px; }
.creature-content .creature-pupil { /* default centered — no change */ }
.creature-worried .creature-pupil { top: 4px; }
.creature-worried .creature-eye:first-child .creature-pupil { left: 1px; }
.creature-scared .creature-eye { transform: scale(1.2); }
.creature-scared .creature-pupil { width: 3px; height: 3px; top: 3px; left: 3px; }
.creature-panicked .creature-eye { transform: scale(1.4); }
.creature-panicked .creature-pupil { width: 2px; height: 2px; top: 4px; left: 4px; }

/* Loading creature — walking animation */
.creature-loading .creature-leg:nth-child(odd) {
  animation: creature-walk 0.3s ease-in-out infinite alternate;
}
.creature-loading .creature-leg:nth-child(even) {
  animation: creature-walk 0.3s ease-in-out infinite alternate-reverse;
}
@media (prefers-reduced-motion: reduce) {
  .at-creature { display: none !important; }
}

/* Responsive */
@media (max-width: 640px) {
  .logo { font-size: 2rem; }
  .search-box { flex-direction: column; border-radius: 12px; }
  .search-box button { padding: 14px; }
  .report { padding: 1rem; }
  .breakdown { padding: 1rem; }
  .selector-grid { grid-template-columns: 1fr; }
  .proto-grid { grid-template-columns: repeat(3, 1fr); }
  .score-snippet { flex-direction: column; align-items: flex-start; }
}
`;
