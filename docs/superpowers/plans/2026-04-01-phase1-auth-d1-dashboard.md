# Freemium Monetization Phase 1 — Auth + D1 + Dashboard Implementation Plan

> **Historical note (2026-04-18):** This plan was drafted on 2026-04-01 but never committed. It is committed now alongside the implementation. The original implementation lived on `feat/freemium-auth-dashboard-v1` and was rebuilt onto current main (which had since received ~30 commits) as `feat/freemium-phase1`.

**Goal:** Land the identity + persistence foundation for freemium monetization — WorkOS AuthKit login, D1-backed users/domains, and a minimal authenticated dashboard. No Stripe, no alerts, no API keys — those are Phases 2–3.

**Spec:** `docs/superpowers/specs/2026-04-01-freemium-monetization-design.md`

**Architecture:** Hand-rolled HS256 JWT sessions (`crypto.subtle`) — no library deps. WorkOS AuthKit via direct `fetch` to the user-management API — no SDK. D1 for persistence. Dashboard renders via existing template-literal HTML pattern.

---

### Task 1: D1 schema + Env types

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/env.ts`
- Modify: `wrangler.toml` (add `[[d1_databases]]` binding)

- [ ] Define the D1 schema with tables: `users`, `domains`, `scan_history`, `alerts`, `webhooks`. Include forward-compat columns (`stripe_customer_id`, `api_key` on users) even though Phase 1 does not populate them.
- [ ] Add indexes: `idx_domains_user_id`, `idx_scan_history_domain_id`, `idx_alerts_domain_id`, `idx_domains_last_scanned`.
- [ ] Export `Env` interface declaring `DB: D1Database`, `WORKOS_CLIENT_ID`, `WORKOS_CLIENT_SECRET`, `WORKOS_REDIRECT_URI`, `SESSION_SECRET`.
- [ ] Add D1 binding to `wrangler.toml` (binding `DB`, database `dmarcheck-db`, id `7e6e7e64-5477-458f-b206-941ea58b7dba`).

### Task 2: User query module

**Files:**
- Create: `src/db/users.ts`
- Create: `test/db-users.test.ts`

- [ ] `createUser({ id, email })` — INSERT derives `email_domain` from the email suffix. Throws on unique-constraint violation.
- [ ] `getUserByEmail(email)` — returns `{ id, email, email_domain, created_at } | null`.
- [ ] `getUserById(id)` — same shape.
- [ ] Tests cover: successful insert, duplicate email rejection, lookup by email, lookup by id, missing-user null return.

### Task 3: Domain query module

**Files:**
- Create: `src/db/domains.ts`
- Create: `test/db-domains.test.ts`

- [ ] `createDomain({ userId, domain, isFree })` — enforces `UNIQUE(user_id, domain)`.
- [ ] `getDomainsByUser(userId)` — returns array ordered by `created_at`.
- [ ] `getDomainById(id)` with `userId` ownership check.
- [ ] `deleteDomain(id, userId)` — ownership-checked delete.
- [ ] Tests cover: create, list, get-with-ownership-check, delete-with-ownership-check, UNIQUE-constraint rejection.

### Task 4: Session management (HS256 JWT via crypto.subtle)

**Files:**
- Create: `src/auth/session.ts`
- Create: `test/session.test.ts`

- [ ] `createSessionToken({ sub, email }, secret, ttlSeconds = 604800)` — returns `header.payload.signature` JWT string. Base64url-encodes each segment. Signs with HMAC-SHA256 via `crypto.subtle`.
- [ ] `validateSessionToken(token, secret)` — verifies signature, checks `exp`, returns decoded `SessionPayload` or null.
- [ ] Tests cover: round-trip (create → validate), expired token, tampered signature, malformed token (wrong segment count), wrong secret.

### Task 5: Auth middleware

**Files:**
- Create: `src/auth/middleware.ts`
- Create: `test/auth-middleware.test.ts`

- [ ] `requireAuth(c, next)` — reads `session` cookie, validates via `validateSessionToken`, attaches decoded payload to `c` via `c.set("user", payload)`. Redirects to `/auth/login` on missing/invalid.
- [ ] Tests cover: valid session passes through, missing cookie redirects, expired/tampered cookie redirects, downstream handler can read `c.get("user")`.

### Task 6: Auth routes (WorkOS login / callback / logout)

**Files:**
- Create: `src/auth/routes.ts`
- Create: `test/auth-routes.test.ts`

- [ ] `GET /login` — builds the WorkOS authorize URL with `client_id`, `redirect_uri`, `response_type=code`, `provider=authkit`; 302 redirect.
- [ ] `GET /callback` — exchanges the `code` param via `POST https://api.workos.com/user_management/authenticate`, upserts the user (handling the duplicate-email race with a try/catch around `createUser`), auto-provisions the free domain from the email suffix on first login, issues session cookie (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`), redirects to `/dashboard`.
- [ ] `GET /logout` — deletes the session cookie, redirects to `/`.
- [ ] Tests cover: login builds correct WorkOS URL, callback rejects missing code (400), callback rejects WorkOS token-exchange failure (401), callback creates user + free domain on first login, callback reuses user on repeat login, callback handles concurrent-signup race, logout clears cookie.

### Task 7: Dashboard views

**Files:**
- Create: `src/views/dashboard.ts`
- Create: `test/dashboard-views.test.ts`

- [ ] `renderDashboardList(user, domains)` — domain list page with grade badges, scan frequency, last-scanned time, and an "Add domain" form (free tier enforces one domain).
- [ ] `renderDashboardDetail(user, domain)` — per-domain detail view with placeholder for scan history (Phase 2) and webhook configuration (Phase 2 stubs).
- [ ] `renderDashboardSettings(user)` — account settings (email, logout link, placeholder for Phase 3 billing).
- [ ] All views reuse the existing `generateCreature`, navigation, and styles from `src/views/components.ts` / `src/views/styles.ts` so the dashboard visually matches the public site.
- [ ] Tests cover: list renders domain rows, detail renders domain, settings renders email, all pages escape user-controlled strings.

### Task 8: Dashboard routes + wiring

**Files:**
- Create: `src/dashboard/routes.ts`
- Create: `test/dashboard-routes.test.ts`
- Modify: `src/index.ts` (mount `app.route("/auth", authRoutes)` and `app.route("/dashboard", dashboardRoutes)`; change `new Hono()` to `new Hono<{ Bindings: Env }>()`)

- [ ] Sub-app applies `requireAuth` middleware to all routes.
- [ ] `GET /` (dashboard index) → domain list.
- [ ] `GET /:id` → domain detail.
- [ ] `POST /domains` → create domain (validates free-tier single-domain rule).
- [ ] `POST /domains/:id/delete` → delete domain (ownership-checked).
- [ ] `POST /:id/scan` → stub returning 501 "Coming in Phase 2" (placeholder for scan-now button).
- [ ] `GET /settings` → settings page.
- [ ] `POST /settings/webhook` → stub accepting webhookUrl, validating HTTPS URL, persisting to `webhooks` table (Phase 1 stores; Phase 2 consumes).
- [ ] Mount in `src/index.ts` after existing agent-discovery / content-negotiation routes but before the catch-all.
- [ ] Tests cover: unauthenticated redirect, authenticated list, add-domain validation, delete ownership, webhook URL validation (reject non-HTTPS), scan-stub 501.

### Task 9: Login link on landing page

**Files:**
- Modify: `src/views/components.ts` (or wherever the landing nav lives on current main)
- Create: `test/nav-link.test.ts`

- [ ] Add a "Log in" link to the landing page navigation, styled consistently with other nav links (use `--clr-accent`, not `--accent`).
- [ ] The link points to `/auth/login`.
- [ ] Test verifies the link renders on the landing page and has the correct href.

### Task 10: WorkOS configuration + end-to-end verification

**Files:** (no code files — secrets + D1 schema application + manual flow)

- [ ] Provision a WorkOS application with AuthKit enabled; configure redirect URI to `http://localhost:8790/auth/callback` (dev) and `https://dmarc.mx/auth/callback` (prod).
- [ ] `wrangler secret put WORKOS_CLIENT_ID` — paste WorkOS client ID.
- [ ] `wrangler secret put WORKOS_CLIENT_SECRET` — paste WorkOS client secret.
- [ ] `wrangler secret put WORKOS_REDIRECT_URI` — paste prod redirect URI.
- [ ] `wrangler secret put SESSION_SECRET` — paste a fresh random 32-byte secret.
- [ ] `wrangler d1 execute dmarcheck-db --remote --file=src/db/schema.sql` — apply schema to production D1.
- [ ] `wrangler d1 execute dmarcheck-db --local --file=src/db/schema.sql` — apply to local dev D1.
- [ ] Create `.dev.vars` with the same four secrets pointing to localhost redirect for `npm run dev`.
- [ ] Exercise the full flow locally: landing → "Log in" → WorkOS AuthKit → callback → dashboard → add domain → logout. Capture + fix any runtime issues.

## Verification

- Unauthenticated paths unchanged: `/`, `/check`, `/learn/*`, `/scoring`, `/docs/api`, `/.well-known/api-catalog`, `/openapi.json`.
- `/auth/login` 302s to `api.workos.com/user_management/authorize`.
- `/auth/callback?code=...` with a valid code creates a user, creates one free domain, issues a session cookie, lands on `/dashboard`.
- `/dashboard` without a session 302s to `/auth/login`.
- `/dashboard` with a valid session renders the domain list.
- `/auth/logout` clears the cookie and lands on `/`.
- Duplicate login does not create duplicate users.
- `npm run lint`, `npm run typecheck`, `npm test` all green.
- PR opened against main; CI `check` status passes.
