# Freemium Monetization — Design Spec

> **Historical note (2026-04-18):** This spec was drafted on 2026-04-01 during the original monetization planning session but never committed. It is being committed now — unchanged in substance — alongside the Phase 1 implementation, as the PR it was written to support (`feat/freemium-auth-dashboard-v1`) was reworked into `feat/freemium-phase1` after a 17-day gap.

## Context

**dmarc.mx** is a polished, free, open-source DNS email security analyzer (DMARC, SPF, DKIM, BIMI, MTA-STS) deployed on Cloudflare Workers. It has zero monetization infrastructure today — no auth, no API keys, no payment processing, no premium tiers. The codebase is production-quality with a comprehensive test suite, strong UX (DMarcus mascot, confetti, gamification), and a clean architecture that naturally lends itself to tiered features.

**Why monetize now:** The tool already delivers real value (comprehensive multi-protocol analysis, actionable recommendations, multiple export formats). The existing rate limiter, API endpoint, and CSV export are natural seams where free/paid boundaries can be introduced with minimal architectural disruption.

**Competitive landscape:**

| Competitor | Model | Pricing |
|-----------|-------|---------|
| MXToolbox | Free basic + paid monitoring | $129–499/mo |
| Dmarcian | DMARC reporting SaaS | $100–500/mo |
| EasyDMARC | Freemium SaaS | $25–300/mo |
| PowerDMARC | MSP/MSSP-focused | $8–12/domain/mo |
| Valimail | Enterprise automation | Enterprise pricing |

dmarc.mx differentiates on: speed (edge-deployed), UX (creature branding, gamification), transparency (open-source scoring), and simplicity (zero signup for basic use).

## Shodan-style freemium model

- **Free tier:** 1 domain per account (auto-provisioned from the user's email suffix), monthly scan cadence, grade badge, email alerts.
- **Paid tier:** $3/domain/month for weekly scans, webhook alerts, bulk API, no branding on embeds.
- **Auth:** WorkOS AuthKit (hosted login), JWT sessions signed with `crypto.subtle` HS256.
- **Payments:** Stripe Checkout (Phase 3).
- **Data:** Cloudflare D1 for users, domains, scan history, alerts, webhooks.
- **Alerts:** Resend email + webhook POST (Phase 2).

## Principles

1. **Keep the free tier generous.** The free tool is the top-of-funnel. Do not gate current functionality (single-domain scan, full protocol analysis, CSV export, rate limit, DMarcus).
2. **API-first monetization.** API consumers (automation tools, MSPs, security vendors) have the highest willingness to pay and the lowest support burden.
3. **Cloudflare-native.** Use KV/D1/R2/Cron/Email Workers to stay on one platform.
4. **Preserve open source.** The core scanning engine stays MIT-licensed. Monetize the hosted service layer (monitoring, storage, reports), not the analysis logic.

## What NOT to gate behind payment

- Single-domain scanning (HTML + JSON + CSV)
- Current 10 req/IP/60s rate limit
- Full protocol analysis (all 5 protocols)
- Scoring rubric and recommendations
- Embeddable badge (basic tier)
- DMarcus creature and all UX features
- Agent-readiness discovery (`/.well-known/api-catalog`, `/openapi.json`, `/docs/api`)

These stay free. They are the product's moat — the reason people discover and recommend dmarc.mx.

## Phased roadmap

```
Phase 1 (this spec): Auth + D1 + Dashboard
  └─ WorkOS AuthKit login
  └─ JWT sessions (crypto.subtle HS256)
  └─ D1 schema (users, domains, scan_history, alerts, webhooks)
  └─ Dashboard views: domain list, detail, settings
  └─ Free-tier auto-provisioning: 1 domain from email suffix

Phase 2: Monitoring + Alerts
  └─ Cloudflare Cron Trigger running existing orchestrator
  └─ Delta detection vs last scan
  └─ Resend email alerts (free tier)
  └─ Webhook POST alerts (paid tier)

Phase 3: Stripe Billing + Paid Features
  └─ Stripe Checkout subscription flow
  └─ Per-domain paid upgrades ($3/domain/mo)
  └─ API key issuance with tiered rate limits
  └─ Bulk /api/bulk endpoint (paid only)
  └─ White-label option: suppress dmarc.mx branding in API responses

Phase 4: Badge Endpoint
  └─ GET /badge/:domain returning SVG
  └─ Free: static grade badge, 24h cache
  └─ Paid: real-time, custom colors, click-through, no branding
```

## Phase 1 scope

Phase 1 builds only the identity + persistence foundation. It does NOT include Stripe, alerts, monitoring, API keys, or bulk endpoints — those are intentionally deferred.

### Components

- **`src/env.ts`** — typed bindings: `DB: D1Database`, `WORKOS_CLIENT_ID`, `WORKOS_CLIENT_SECRET`, `WORKOS_REDIRECT_URI`, `SESSION_SECRET`.
- **`src/auth/session.ts`** — hand-rolled HS256 JWT via `crypto.subtle` (no library deps). 7-day TTL. `createSessionToken`, `validateSessionToken`.
- **`src/auth/middleware.ts`** — `requireAuth` Hono middleware. Missing/invalid session → redirect to `/auth/login`.
- **`src/auth/routes.ts`** — `/auth/login` (redirect to WorkOS), `/auth/callback` (code exchange, user upsert, session cookie), `/auth/logout` (cookie delete). Exchanges auth code directly via `fetch` to `api.workos.com/user_management/authenticate` — no SDK needed.
- **`src/db/schema.sql`** — D1 schema (see below).
- **`src/db/users.ts`**, **`src/db/domains.ts`** — typed query modules.
- **`src/dashboard/routes.ts`** — mounted at `/dashboard`. Protected. Pages: list, detail, settings. Stubs "Scan Now" button as a Phase 2 placeholder.
- **`src/views/dashboard.ts`** — HTML template literals for the dashboard pages.

### D1 schema

Forward-compatible with Phases 2–3 (includes `api_key`, `stripe_customer_id` on `users`; `scan_history`, `alerts`, `webhooks` tables):

```sql
users(id, email UNIQUE, email_domain, stripe_customer_id, api_key UNIQUE, created_at)
domains(id, user_id, domain, is_free, scan_frequency, last_scanned_at, last_grade, created_at, UNIQUE(user_id, domain))
scan_history(id, domain_id, grade, score_factors, protocol_results, scanned_at)
alerts(id, domain_id, alert_type, previous_value, new_value, notified_via, created_at)
webhooks(id, user_id, url, secret, created_at)
```

### Free-tier auto-provisioning

On first successful `/auth/callback`, the callback handler:
1. Upserts the user keyed by email (ignores unique-constraint race on concurrent signups).
2. Creates one domain row for the user's email suffix (`alice@example.com` → `example.com`), `is_free = 1`.

This makes the free experience usable immediately after signup without a separate "add your first domain" step.

### Session cookie

`Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` (7 days).

### Rate limiting

Dashboard routes are authenticated; they do not share the anonymous 10/IP/60s limit applied to `/check`. Phase 1 does not introduce separate authenticated rate limits — the assumption is that a logged-in user hitting the dashboard cannot materially increase load beyond what the DNS scan cost already covers. Revisit in Phase 3 alongside API keys.

## Verification

- Unauthenticated flows unchanged: landing, `/check`, agent-discovery endpoints, /learn, /scoring, /docs/api all still work without a session.
- `/auth/login` redirects to WorkOS; `/auth/callback` issues a session cookie and lands on `/dashboard`.
- Dashboard without a valid session redirects to `/auth/login`.
- First login creates exactly one user row and one free domain row for the email suffix.
- Concurrent first-login requests (duplicate signup race) yield exactly one user row.
- Cookie is `HttpOnly; Secure; SameSite=Lax`.
- CI green: lint, typecheck, all tests pass.

## Open questions deferred to later phases

- How to handle users who want to monitor a domain that doesn't match their email suffix (upgrade path to paid, or ownership verification via DNS TXT / email challenge)?
- Rate limit tiering once API keys exist in Phase 3.
- DMARC aggregate report ingestion (rua parsing) — potentially the highest-revenue feature, but a major new subsystem; parked until Phase 3 validates willingness to pay.
