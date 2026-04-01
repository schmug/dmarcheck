# CLAUDE.md — dmarcheck

DNS email security analyzer (DMARC, SPF, DKIM, BIMI, MTA-STS).
Cloudflare Worker serving dual output: JSON API + interactive HTML report.
Live at dmarc.mx | Repo: github.com/schmug/dmarcheck

## Stack

- Hono framework on Cloudflare Workers
- TypeScript with `nodejs_compat` flag for `node:dns`
- Vitest for testing
- No build step for HTML — template literal strings in src/views/

## Commands

- `npm run dev` — local dev on port 8790
- `npm test` — vitest
- `npm run deploy` — wrangler deploy (use only if Git integration is disabled)
- Deployment is automatic via Cloudflare Git integration on push to main
- **Do NOT run `npm run deploy` after pushing** — it collides with the Git integration auto-deploy and causes intermittent stale deploys

## Architecture

- `src/index.ts` — Hono routes, content negotiation, rate limiting middleware
- `src/dns/client.ts` — DNS abstraction over node:dns (NXDOMAIN returns null)
- `src/analyzers/` — One module per protocol (dmarc, spf, dkim, bimi, mta-sts)
- `src/orchestrator.ts` — Runs all analyzers in parallel via Promise.allSettled
- `src/shared/scoring.ts` — Grade computation (F if no DMARC or p=none)
- `src/views/` — HTML generation via template literals (styles.ts, scripts.ts, components.ts, html.ts)
- `src/rate-limit.ts` — Cache API-based rate limiter (10 req/IP/60s)

## Conventions

- Each analyzer is a standalone async function returning a typed result
- DNS errors (NXDOMAIN/NODATA) return null, not exceptions
- Status is always `"pass"` | `"warn"` | `"fail"`
- HTML is generated server-side as template literal strings, no JSX or build step
- Client-side JS is minimal (expand/collapse, tooltips) — inline script tag
- Dark theme with orange accent (#f97316)

## Testing

- Tests in `test/` directory
- Mock DNS client for unit tests (`vi.mock`)
- Test scoring boundaries and analyzer parsing

## Cloudflare MCP

- Cloudflare MCP server (`@cloudflare/mcp-server-cloudflare`) is configured globally in `~/.claude.json`
- Provides tools for managing Workers, DNS, KV, D1, R2, and more from Claude Code
- Account ID: `f0fc4ca5b74274f7ba892e6c9ec411a7`
