import { Hono } from "hono";
import { generateApiKey } from "../auth/api-key.js";
import { requireAuth } from "../auth/middleware.js";
import type { SessionPayload } from "../auth/session.js";
import { dashboardBillingRoutes } from "../billing/routes.js";
import {
  createApiKey,
  listApiKeysByUser,
  revokeApiKey,
} from "../db/api-keys.js";
import {
  createDomain,
  deleteDomain,
  getDomainByUserAndName,
  getDomainsByUser,
} from "../db/domains.js";
import { recordScan } from "../db/scans.js";
import { getPlanForUser } from "../db/subscriptions.js";
import {
  acknowledgeApiKeyRetirement,
  getUserById,
  setEmailAlertsEnabled,
} from "../db/users.js";
import { scan } from "../orchestrator.js";
import { normalizeDomain } from "../shared/domain.js";
import {
  renderAddDomainPage,
  renderApiKeysPage,
  renderDashboardPage,
  renderDomainDetailPage,
  renderSettingsPage,
  toApiKeyListEntry,
} from "../views/dashboard.js";

export const dashboardRoutes = new Hono();

// All dashboard routes require auth
dashboardRoutes.use("*", requireAuth);

// Billing sub-routes (upgrade / portal). Self-gates on isBillingEnabled so a
// self-host deploy without Stripe env vars still 404s these cleanly.
dashboardRoutes.route("/billing", dashboardBillingRoutes);

// Domain list
dashboardRoutes.get("/", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const domains = await getDomainsByUser(db, session.sub);
  return c.html(
    renderDashboardPage({
      email: session.email,
      domains: domains.map((d) => ({
        domain: d.domain,
        grade: d.last_grade ?? "—",
        frequency: d.scan_frequency,
        lastScanned: d.last_scanned_at
          ? new Date(d.last_scanned_at * 1000).toLocaleDateString()
          : null,
        isFree: d.is_free === 1,
      })),
    }),
  );
});

// Add-domain form. Simple GET → form; POST → validate + insert.
// `/domain/add` is matched before `/domain/:domain` because Hono picks routes
// in registration order for literal-vs-param collisions.
dashboardRoutes.get("/domain/add", (c) => {
  const session = c.get("user" as never) as SessionPayload;
  return c.html(renderAddDomainPage({ email: session.email, error: null }));
});

dashboardRoutes.post("/domain/add", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const body = await c.req.parseBody();
  const normalized = normalizeDomain(body.domain as string | undefined);
  if (!normalized) {
    return c.html(
      renderAddDomainPage({
        email: session.email,
        error: "Enter a valid domain (e.g. example.com).",
      }),
      400,
    );
  }

  // Prevent duplicates per-user cleanly rather than surfacing the raw
  // UNIQUE(user_id, domain) constraint violation from D1.
  const existing = await getDomainByUserAndName(db, session.sub, normalized);
  if (existing) {
    return c.redirect(
      `/dashboard/domain/${encodeURIComponent(normalized)}`,
      303,
    );
  }

  await createDomain(db, {
    userId: session.sub,
    domain: normalized,
    isFree: false,
  });
  return c.redirect(`/dashboard/domain/${encodeURIComponent(normalized)}`, 303);
});

// Domain detail
dashboardRoutes.get("/domain/:domain", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const domainName = c.req.param("domain");
  const domain = await getDomainByUserAndName(db, session.sub, domainName);
  if (!domain) {
    return c.text("Domain not found", 404);
  }
  const history = await db
    .prepare(
      "SELECT grade, scanned_at FROM scan_history WHERE domain_id = ? ORDER BY scanned_at DESC LIMIT 12",
    )
    .bind(domain.id)
    .all<{ grade: string; scanned_at: number }>();
  return c.html(
    renderDomainDetailPage({
      email: session.email,
      domain: domain.domain,
      grade: domain.last_grade ?? "—",
      lastScanned: domain.last_scanned_at
        ? new Date(domain.last_scanned_at * 1000).toLocaleDateString()
        : null,
      isFree: domain.is_free === 1,
      scanFrequency: domain.scan_frequency,
      scanHistory: history.results.map((r) => ({
        date: new Date(r.scanned_at * 1000).toLocaleDateString(),
        grade: r.grade,
      })),
    }),
  );
});

// Manual scan trigger — runs the orchestrator for a user-owned domain and
// persists the result to scan_history + domains.last_*. Rate-limiting comes
// from the session cookie gating this path (plus D1 write volume per user).
dashboardRoutes.post("/domain/:domain/scan", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const domainName = c.req.param("domain");

  const owned = await getDomainByUserAndName(db, session.sub, domainName);
  if (!owned) {
    return c.text("Domain not found", 404);
  }

  const result = await scan(owned.domain);
  await recordScan(db, {
    domainId: owned.id,
    grade: result.grade,
    scoreFactors: result.breakdown.factors,
    protocolResults: result.protocols,
  });

  return c.redirect(`/dashboard/domain/${encodeURIComponent(domainName)}`, 303);
});

// Delete monitored domain. POST-only (no idempotent DELETE since HTML forms
// can't send DELETE without JS). Ownership check is inherent: the SQL WHERE
// clause in deleteDomain keys on user_id, so one user can't delete another's
// row even if they guess the domain name.
dashboardRoutes.post("/domain/:domain/delete", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const domainName = c.req.param("domain");
  await deleteDomain(db, session.sub, domainName);
  return c.redirect("/dashboard", 303);
});

// Settings page
dashboardRoutes.get("/settings", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const user = await getUserById(db, session.sub);
  if (!user) {
    return c.redirect("/auth/logout");
  }
  const webhook = await db
    .prepare("SELECT url FROM webhooks WHERE user_id = ?")
    .bind(session.sub)
    .first<{ url: string }>();
  const plan = await getPlanForUser(db, session.sub);
  const env = c.env as { STRIPE_SECRET_KEY?: string };
  return c.html(
    renderSettingsPage({
      email: user.email,
      webhookUrl: webhook?.url ?? null,
      plan,
      billingEnabled: Boolean(env.STRIPE_SECRET_KEY),
      emailAlertsEnabled: user.email_alerts_enabled === 1,
      showRetirementBanner: user.api_key_retirement_acknowledged_at === null,
    }),
  );
});

// Toggle email alert preference. Presence of a "enabled" form field means on,
// absence means off (standard checkbox semantics from HTML forms).
dashboardRoutes.post("/settings/email-alerts", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const body = await c.req.parseBody();
  const enabled = body.enabled === "on" || body.enabled === "1";
  await setEmailAlertsEnabled(db, session.sub, enabled);
  return c.redirect("/dashboard/settings");
});

// API keys: list / generate / revoke. The cleartext `POST /settings/api-key`
// handler from Phase 1 is intentionally gone — keys are now hashed server-side
// and the raw value is surfaced only at generation time on this page.
dashboardRoutes.get("/settings/api-keys", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const user = await getUserById(db, session.sub);
  if (!user) {
    return c.redirect("/auth/logout");
  }
  const showRetirementBanner = user.api_key_retirement_acknowledged_at === null;
  // First visit dismisses the banner — the user has now seen the explanation
  // and can generate a replacement on this same page.
  if (showRetirementBanner) {
    c.executionCtx.waitUntil(
      acknowledgeApiKeyRetirement(db, session.sub).catch(() => {}),
    );
  }
  const rows = await listApiKeysByUser(db, session.sub);
  const justCreated =
    c.req.query("created") === "1" ? (c.req.query("raw") ?? null) : null;
  return c.html(
    renderApiKeysPage({
      email: user.email,
      keys: rows.map(toApiKeyListEntry),
      justCreated,
      showRetirementBanner,
    }),
  );
});

dashboardRoutes.post("/settings/api-keys/generate", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const body = await c.req.parseBody();
  const nameRaw =
    typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const name = nameRaw.length > 0 ? nameRaw : null;

  const generated = await generateApiKey();
  const id = crypto.randomUUID();
  await createApiKey(db, {
    id,
    userId: session.sub,
    name,
    prefix: generated.prefix,
    hash: generated.hash,
  });

  // Shuttle the raw value through a redirect URL so the GET renders it once.
  // Anyone capable of reading the user's browser history already owns the key,
  // so this is no weaker than rendering it inline after the POST.
  const params = new URLSearchParams({
    created: "1",
    raw: generated.raw,
  });
  return c.redirect(`/dashboard/settings/api-keys?${params.toString()}`, 303);
});

dashboardRoutes.post("/settings/api-keys/revoke", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const body = await c.req.parseBody();
  const id = typeof body.id === "string" ? body.id : null;
  if (id) {
    await revokeApiKey(db, id, session.sub);
  }
  return c.redirect("/dashboard/settings/api-keys", 303);
});

// Save webhook URL
dashboardRoutes.post("/settings/webhook", async (c) => {
  const session = c.get("user" as never) as SessionPayload;
  const db = (c.env as { DB: D1Database }).DB;
  const body = await c.req.parseBody();
  const url = body.webhookUrl as string;

  // Validate URL
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return c.redirect("/dashboard/settings");
    }
  } catch {
    return c.redirect("/dashboard/settings");
  }

  const existing = await db
    .prepare("SELECT id FROM webhooks WHERE user_id = ?")
    .bind(session.sub)
    .first<{ id: number }>();
  if (existing) {
    await db
      .prepare("UPDATE webhooks SET url = ? WHERE user_id = ?")
      .bind(url, session.sub)
      .run();
  } else {
    const secret = crypto.randomUUID();
    await db
      .prepare("INSERT INTO webhooks (user_id, url, secret) VALUES (?, ?, ?)")
      .bind(session.sub, url, secret)
      .run();
  }
  return c.redirect("/dashboard/settings");
});
