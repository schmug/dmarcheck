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
- `npm run lint` — biome check (lint + format check)
- `npm run lint:fix` — biome auto-fix
- `npm run typecheck` — tsc --noEmit
- `npm run deploy` — wrangler deploy (use only if Git integration is disabled)
- Deployment is automatic via Cloudflare Git integration on push to main
- **Do NOT run `npm run deploy` after pushing** — it collides with the Git integration auto-deploy and causes intermittent stale deploys

## Architecture

- `src/index.ts` — Hono routes, content negotiation, rate limiting middleware
- `src/dns/client.ts` — DNS abstraction over node:dns (NXDOMAIN returns null)
- `src/analyzers/` — One module per protocol (dmarc, spf, dkim, bimi, mta-sts)
- `src/orchestrator.ts` — Runs all analyzers in parallel via Promise.allSettled
- `src/shared/scoring.ts` — Grade computation (F if no DMARC or p=none)
- `src/cache.ts` — SSE result caching
- `src/csv.ts` — CSV export for scan results
- `src/views/` — HTML generation via template literals (styles.ts, scripts.ts, components.ts, html.ts, favicon.ts)
  - `components.ts` — `generateCreature(size, mood, partyHat?)` helper and `gradeToMood()` mapping
- `src/rate-limit.ts` — Cache API-based rate limiter (10 req/IP/60s)

## Conventions

- Each analyzer is a standalone async function returning a typed result
- DNS errors (NXDOMAIN/NODATA) return null, not exceptions
- Status is `"pass"` | `"warn"` | `"fail"` for scored protocols, `"info"` for informational (MX)
- HTML is generated server-side as template literal strings, no JSX or build step
- Client-side JS is minimal (expand/collapse, tooltips) — inline script tag
- Dark/light theme with OS-aware switching and manual toggle; orange accent (#f97316)

## Brand / DMarcus

- **DMarcus** is the site mascot — an orange `@` character with googly eyes and three legs (pun on DMARC)
- Rendered by `generateCreature(size, mood, partyHat?)` in `src/views/components.ts`
- **Moods** map to scan grades via `gradeToMood()`: celebrating (A+/A), content (B), worried (C), scared (D), panicked (F)
- **Party hat** variant with dance animation for S (perfect) grade
- **Sizes:** lg (landing page logo), md (grade reactions, footer), sm (nav links)
- Appears in landing page, report header, loading state, error page, and nav
- **Easter egg:** idle-triggered (60s) creature walks around eating page elements, panics on interaction; respects `prefers-reduced-motion`
- Name appears in footer ("Guarded by DMarcus"), loading text, aria labels, and README

## Quality Gates

- Biome handles linting and formatting (`biome.json`)
- Claude Code hooks auto-format on edit and run tests + typecheck before commits
- Run `npm run lint` to check, `npm run lint:fix` to auto-fix

## Testing

- Tests in `test/` directory
- Mock DNS client for unit tests (`vi.mock`)
- Test scoring boundaries and analyzer parsing

## Releases

- Automated via GitHub Actions on push to main (after CI passes)
- CalVer versioning: vYYYY.M.serial (e.g., v2026.4.1)
- Changelog generated from commit history by git-cliff (`cliff.toml`)
- GitHub Releases page is the project changelog
- Tags are created automatically; do not create manual tags

## GitHub Issues

- After committing or merging work, check open issues (`gh issue list`) to see if any were resolved and should be closed
- When a commit addresses an issue, close it with a comment referencing the commit hash

## Documentation

- Keep `CLAUDE.md` and `README.md` up to date when adding features, changing architecture, or modifying conventions
- `CLAUDE.md` is for AI assistants and contributors; `README.md` is for users and self-hosters

## Cloudflare MCP

- Cloudflare MCP server (`@cloudflare/mcp-server-cloudflare`) is configured globally in `~/.claude.json`
- Provides tools for managing Workers, DNS, KV, D1, R2, and more from Claude Code
- Account ID: `f0fc4ca5b74274f7ba892e6c9ec411a7`
