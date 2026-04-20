import * as Sentry from "@sentry/cloudflare";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { dispatchPendingAlerts } from "./alerts/dispatcher.js";
import { validateUnsubscribeToken } from "./alerts/unsubscribe.js";
import type {
  BimiResult,
  DkimResult,
  DmarcResult,
  MtaStsResult,
  MxResult,
  ScanResult,
  SpfResult,
} from "./analyzers/types.js";
import { API_CATALOG_JSON } from "./api/catalog.js";
import { OPENAPI_JSON } from "./api/openapi.js";
import { authRoutes } from "./auth/routes.js";
import { getCachedScan, setCachedScan } from "./cache.js";
import { runDueRescans } from "./cron/rescan.js";
import { generateCsv } from "./csv.js";
import { dashboardRoutes } from "./dashboard/routes.js";
import { setEmailAlertsEnabled } from "./db/users.js";
import type { Env } from "./env.js";
import type { ProtocolId, ProtocolResult } from "./orchestrator.js";
import { scan, scanStreaming } from "./orchestrator.js";
import { checkRateLimit, rateLimitHeaders } from "./rate-limit.js";
import { CSS_PATH, JS_PATH } from "./views/assets.js";
import {
  APPLE_TOUCH_ICON_BASE64,
  FAVICON_ICO_BASE64,
  FAVICON_SVG,
  ICON_192_BASE64,
  ICON_512_BASE64,
  OG_IMAGE_PNG_BASE64,
  webManifest,
} from "./views/favicon.js";
import {
  renderApiDocs,
  renderBimiCard,
  renderDkimCard,
  renderDmarcCard,
  renderError,
  renderLandingPage,
  renderMtaStsCard,
  renderMxCard,
  renderReport,
  renderReportFooter,
  renderReportHeader,
  renderScoreBreakdown,
  renderScoringRubric,
  renderSpfCard,
  renderStreamingLoading,
} from "./views/html.js";
import {
  renderLearnBimi,
  renderLearnDkim,
  renderLearnDmarc,
  renderLearnHub,
  renderLearnMtaSts,
  renderLearnSpf,
} from "./views/learn.js";
import {
  renderApiDocsMarkdown,
  renderErrorMarkdown,
  renderLandingMarkdown,
  renderLearnHubMarkdown,
  renderReportMarkdown,
  renderScoringRubricMarkdown,
} from "./views/markdown.js";
import { JS } from "./views/scripts.js";
import { CSS } from "./views/styles.js";

// The Hono app is exported for tests (which call `app.request(...)`).
// Runtime Workers use the Sentry-wrapped default export below, which adds
// cron (`scheduled`) alongside `fetch`.
export const app = new Hono<{ Bindings: Env }>();

// Set Sentry scope context for every request
app.use("*", async (c, next) => {
  const scope = Sentry.getCurrentScope();
  const domain = c.req.query("domain")?.trim().toLowerCase() || undefined;
  const format =
    c.req.query("format") ||
    (c.req.header("Accept")?.includes("application/json") ? "json" : "html");
  const selectors = c.req.query("selectors") || undefined;

  // Raw user input (not normalizeDomain) — shows what was actually typed, even for rejected requests
  if (domain) scope.setTag("domain", domain);
  scope.setTag("format", format);
  scope.setTag("path", c.req.path);
  scope.setContext("request", {
    selectors,
    method: c.req.method,
    path: c.req.path,
  });
  scope.setUser({
    ip_address: c.req.header("CF-Connecting-IP") || undefined,
  });

  await next();
});

// Security headers middleware (HSTS is handled at Cloudflare edge)

// Content types that should be hidden from search engines. HTML is the opposite:
// it's the whole point of the site and must stay crawlable. Images/CSS/JS are
// skipped because noindex on subresources is a no-op for how Googlebot renders
// pages. XML (sitemap) and text/plain (robots.txt) need to stay crawlable.
const NOINDEX_CONTENT_TYPES = [
  "application/json",
  "application/manifest+json",
  "application/linkset+json",
  "application/openapi+json",
  "text/csv",
  "text/event-stream",
  "text/markdown",
];

// Link header (RFC 8288) pointing agents to discovery resources.
// Attached to HTML responses only — JSON/CSV/SSE consumers are already
// using the API directly.
const AGENT_DISCOVERY_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</openapi.json>; rel="service-desc"; type="application/openapi+json"',
  '</docs/api>; rel="service-doc"; type="text/html"',
  '</health>; rel="status"',
].join(", ");

// Origins permitted to embed the HTML report in an iframe. Anything not listed
// here (including subdomains) is blocked by the `frame-ancestors` directive
// below. X-Frame-Options is intentionally NOT set — older browsers honor it
// over `frame-ancestors`, which would defeat this allowlist.
const EMBED_ALLOWED_ORIGINS = ["https://cortech.online"];

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  const contentType = c.res.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");
  if (isHtml) {
    const frameAncestors = ["'self'", ...EMBED_ALLOWED_ORIGINS].join(" ");
    c.res.headers.set(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors ${frameAncestors}`,
    );
    if (!c.res.headers.has("Link")) {
      c.res.headers.set("Link", AGENT_DISCOVERY_LINK_HEADER);
    }
    // Short edge cache so Cloudflare can absorb landing/scoring/report traffic
    // without hitting the Worker on every request. Browsers still revalidate.
    if (!c.res.headers.has("Cache-Control")) {
      c.res.headers.set(
        "Cache-Control",
        "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      );
    }
  } else {
    // `frame-ancestors` does not inherit from `default-src`, so it must be
    // declared explicitly to keep JSON/CSV/SSE responses unframable.
    c.res.headers.set(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
  }

  // Keep the JSON API, CSV exports, the SSE stream, and the PWA manifest out
  // of Google's index. These showed up in Search Console as "Crawled - currently
  // not indexed" noise — no reason to spend crawl budget on them.
  if (NOINDEX_CONTENT_TYPES.some((t) => contentType.includes(t))) {
    c.res.headers.set("X-Robots-Tag", "noindex");
  }
});

// Safety net: capture any unhandled errors that bypass route catch blocks
app.onError((err, c) => {
  Sentry.captureException(err);
  const message = err instanceof Error ? err.message : "Internal error";
  const wantsJson =
    c.req.header("Accept")?.includes("application/json") ||
    c.req.query("format") === "json";
  if (wantsJson) {
    return c.json({ error: message }, 500);
  }
  return c.html(renderError(message), 500);
});

app.use("/api/*", cors());

// Auth routes (public) — login, WorkOS callback, logout
app.route("/auth", authRoutes);

// Dashboard routes (auth enforced inside dashboardRoutes via requireAuth)
app.route("/dashboard", dashboardRoutes);

function markdownResponse(c: Context, body: string, status = 200) {
  return c.body(body, status as 200, {
    "Content-Type": "text/markdown; charset=utf-8",
  });
}

// Returns true when the client explicitly asked for markdown (via `?format=md`
// or an `Accept` header that lists `text/markdown` before `text/html`). HTML
// stays the default for browsers that send wildcards like `*/*`.
function wantsMarkdown(c: Context): boolean {
  const format = c.req.query("format");
  if (format === "md" || format === "markdown") return true;
  const accept = c.req.header("Accept");
  if (!accept) return false;
  const types = accept.toLowerCase().split(",");
  const mdIndex = types.findIndex((t) => t.trim().startsWith("text/markdown"));
  if (mdIndex === -1) return false;
  const htmlIndex = types.findIndex((t) => t.trim().startsWith("text/html"));
  // Agents that send `Accept: text/markdown` (and nothing else, or markdown
  // first) get markdown. Browsers that prefer HTML keep getting HTML.
  return htmlIndex === -1 || mdIndex < htmlIndex;
}

function getClientIp(c: Context): string {
  const cfIp = c.req.header("CF-Connecting-IP");
  if (cfIp) return cfIp;

  return "unknown";
}

// Rate limit scan endpoints (not the landing page)
app.use("/check", async (c, next) => {
  const ip = getClientIp(c);
  const { allowed, remaining, pendingWrite } = await checkRateLimit(ip);
  if (pendingWrite) {
    c.executionCtx.waitUntil(pendingWrite.catch(() => {}));
  }

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    const format = c.req.query("format");
    const wantsJson =
      format === "json" || c.req.header("Accept")?.includes("application/json");

    if (wantsJson || format === "csv") {
      return c.json(
        { error: "Rate limit exceeded. Try again in 60 seconds." },
        { status: 429, headers },
      );
    }
    return c.html(
      renderError(
        "Rate limit exceeded. Please wait a minute before scanning again.",
      ),
      { status: 429, headers },
    );
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  // ⚡ Bolt Optimization: Use for...in instead of Object.entries() on hot paths.
  // Avoids allocating an array of key-value tuples for headers on every request,
  // reducing GC pressure for high-traffic middleware.
  for (const key in headers) {
    c.res.headers.set(key, headers[key]);
  }
});

app.use("/check/score", async (c, next) => {
  const ip = getClientIp(c);
  const { allowed, remaining, pendingWrite } = await checkRateLimit(ip);
  if (pendingWrite) {
    c.executionCtx.waitUntil(pendingWrite.catch(() => {}));
  }

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    return c.html(
      renderError(
        "Rate limit exceeded. Please wait a minute before scanning again.",
      ),
      { status: 429, headers },
    );
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  for (const key in headers) {
    c.res.headers.set(key, headers[key]);
  }
});

app.use("/api/check", async (c, next) => {
  const ip = getClientIp(c);
  const { allowed, remaining, pendingWrite } = await checkRateLimit(ip);
  if (pendingWrite) {
    c.executionCtx.waitUntil(pendingWrite.catch(() => {}));
  }

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    return c.json(
      { error: "Rate limit exceeded. Try again in 60 seconds." },
      { status: 429, headers },
    );
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  for (const key in headers) {
    c.res.headers.set(key, headers[key]);
  }
});

// The SSE streaming endpoint fans out ~50 DNS lookups per request and is
// bypassed by the `/api/check` middleware above (Hono matches exact paths).
// Give it its own limiter so it cannot be used as a DNS amplification vector.
app.use("/api/check/stream", async (c, next) => {
  const ip = getClientIp(c);
  const { allowed, remaining, pendingWrite } = await checkRateLimit(ip);
  if (pendingWrite) {
    c.executionCtx.waitUntil(pendingWrite.catch(() => {}));
  }

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    return c.json(
      { error: "Rate limit exceeded. Try again in 60 seconds." },
      { status: 429, headers },
    );
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  for (const key in headers) {
    c.res.headers.set(key, headers[key]);
  }
});

const protocolRenderers: Record<
  ProtocolId,
  (result: ProtocolResult) => string
> = {
  mx: (r) => renderMxCard(r as MxResult),
  dmarc: (r) => renderDmarcCard(r as DmarcResult),
  spf: (r) => renderSpfCard(r as SpfResult),
  dkim: (r) => renderDkimCard(r as DkimResult),
  bimi: (r) => renderBimiCard(r as BimiResult),
  mta_sts: (r) => renderMtaStsCard(r as MtaStsResult),
};

function tagScanResult(result: ScanResult): void {
  const scope = Sentry.getCurrentScope();
  scope.setTag("grade", result.grade);
  scope.setTag("dmarc.status", result.protocols.dmarc.status);
  scope.setTag("spf.status", result.protocols.spf.status);
  scope.setTag("dkim.status", result.protocols.dkim.status);
  scope.setTag("bimi.status", result.protocols.bimi.status);
  scope.setTag("mta_sts.status", result.protocols.mta_sts.status);
}

app.get("/api/check/stream", async (c) => {
  const domain = normalizeDomain(c.req.query("domain"));
  if (!domain) {
    return c.json({ error: "Missing or invalid domain parameter" }, 400);
  }

  const selectors = parseSelectors(c.req.query("selectors"));

  return streamSSE(c, async (stream) => {
    Sentry.addBreadcrumb({
      category: "scan.start",
      message: domain,
      data: { domain, selectors },
      level: "info",
    });
    const cached = await getCachedScan(domain, selectors);
    Sentry.addBreadcrumb({
      category: cached ? "cache.hit" : "cache.miss",
      message: domain,
      data: { domain },
      level: "info",
    });

    if (cached) {
      tagScanResult(cached);
      const protocolIds: ProtocolId[] = [
        "mx",
        "dmarc",
        "spf",
        "dkim",
        "bimi",
        "mta_sts",
      ];
      for (const id of protocolIds) {
        const html = protocolRenderers[id](cached.protocols[id]);
        await stream.writeSSE({
          event: "protocol",
          data: JSON.stringify({ id, html }),
        });
      }
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          grade: cached.grade,
          headerHtml: renderReportHeader(cached),
          footerHtml: renderReportFooter(cached),
        }),
      });
      return;
    }

    const result = await scanStreaming(
      domain,
      selectors,
      (id: ProtocolId, protocolResult: ProtocolResult) => {
        const html = protocolRenderers[id](protocolResult);
        stream.writeSSE({
          event: "protocol",
          data: JSON.stringify({ id, html }),
        });
      },
    );

    tagScanResult(result);
    const pendingCacheWrite = setCachedScan(domain, selectors, result);
    if (pendingCacheWrite) {
      c.executionCtx.waitUntil(pendingCacheWrite.catch(() => {}));
    }

    stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        grade: result.grade,
        headerHtml: renderReportHeader(result),
        footerHtml: renderReportFooter(result),
      }),
    });
  });
});

app.get("/logo.svg", (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="0 0 512 512">
  <title>dmarcheck</title>
  <rect width="512" height="512" rx="64" fill="#0a0a0a"/>
  <text x="256" y="310" font-family="monospace" font-size="220" fill="#f97316" text-anchor="middle">@</text>
  <circle cx="210" cy="210" r="28" fill="white"/>
  <circle cx="302" cy="210" r="28" fill="white"/>
  <circle cx="216" cy="218" r="14" fill="#0a0a0f"/>
  <circle cx="308" cy="218" r="14" fill="#0a0a0f"/>
  <rect x="196" y="380" width="20" height="40" rx="8" fill="#ea580c"/>
  <rect x="246" y="380" width="20" height="32" rx="8" fill="#ea580c"/>
  <rect x="296" y="380" width="20" height="40" rx="8" fill="#ea580c"/>
</svg>`;
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/og-image.svg", (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0f"/>
  <!-- Creature -->
  <text x="340" y="310" font-family="monospace" font-size="180" fill="#f97316" text-anchor="middle">@</text>
  <circle cx="300" cy="220" r="22" fill="white"/>
  <circle cx="375" cy="220" r="22" fill="white"/>
  <circle cx="305" cy="226" r="11" fill="#0a0a0f"/>
  <circle cx="380" cy="226" r="11" fill="#0a0a0f"/>
  <rect x="290" y="370" width="16" height="32" rx="6" fill="#ea580c"/>
  <rect x="330" y="370" width="16" height="26" rx="6" fill="#ea580c"/>
  <rect x="370" y="370" width="16" height="32" rx="6" fill="#ea580c"/>
  <!-- Wordmark -->
  <text x="500" y="300" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-weight="800" font-size="72">
    <tspan fill="#e4e4e7">dmar</tspan><tspan fill="#f97316">check</tspan>
  </text>
  <!-- Tagline -->
  <text x="500" y="350" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-size="24" fill="#71717a">DNS Email Security Analyzer</text>
  <!-- BIMI badge -->
  <text x="500" y="400" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-size="18" fill="#f97316">Meet DMarcus — your email security sidekick</text>
</svg>`;
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/og-image.png", (c) => {
  const buf = Uint8Array.from(atob(OG_IMAGE_PNG_BASE64), (ch) =>
    ch.charCodeAt(0),
  );
  return c.body(buf, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400",
  });
});

// Content-hashed static assets with immutable caching
app.get(CSS_PATH, (c) => {
  return c.body(CSS, 200, {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
});

app.get(JS_PATH, (c) => {
  return c.body(JS, 200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
});

app.get("/favicon.svg", (c) => {
  return c.body(FAVICON_SVG, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/manifest.webmanifest", (c) => {
  return c.body(webManifest(), 200, {
    "Content-Type": "application/manifest+json",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/favicon.ico", (c) => {
  const buf = Uint8Array.from(atob(FAVICON_ICO_BASE64), (ch) =>
    ch.charCodeAt(0),
  );
  return c.body(buf, 200, {
    "Content-Type": "image/x-icon",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/apple-touch-icon.png", (c) => {
  const buf = Uint8Array.from(atob(APPLE_TOUCH_ICON_BASE64), (ch) =>
    ch.charCodeAt(0),
  );
  return c.body(buf, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/icon-192.png", (c) => {
  const buf = Uint8Array.from(atob(ICON_192_BASE64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/icon-512.png", (c) => {
  const buf = Uint8Array.from(atob(ICON_512_BASE64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// RFC 9727 API catalog — agents discover this via the Link header on HTML
// pages or by fetching a well-known URI directly.
app.get("/.well-known/api-catalog", (c) => {
  return c.body(API_CATALOG_JSON, 200, {
    "Content-Type": "application/linkset+json",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get("/openapi.json", (c) => {
  return c.body(OPENAPI_JSON, 200, {
    "Content-Type": "application/openapi+json; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get("/docs/api", (c) => {
  if (wantsMarkdown(c)) return markdownResponse(c, renderApiDocsMarkdown());
  return c.html(renderApiDocs());
});

// Crawl guidance for search engines. Block the API namespace (Google was
// logging `/api/check?domain=dmarc.mx` as "Crawled - currently not indexed"
// noise) and point to the sitemap.
app.get("/robots.txt", (c) => {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://dmarc.mx/sitemap.xml
`;
  return c.body(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
});

// Static URLs worth reinforcing to search engines. The three example domains
// are already in Google's index and one of them ranks position 9 for a
// long-tail query — listing them as canonical crawl targets is a cheap
// authority signal.
const SITEMAP_URLS: Array<{ loc: string; priority: string }> = [
  { loc: "https://dmarc.mx/", priority: "1.0" },
  { loc: "https://dmarc.mx/scoring", priority: "0.8" },
  { loc: "https://dmarc.mx/learn", priority: "0.7" },
  { loc: "https://dmarc.mx/learn/dmarc", priority: "0.8" },
  { loc: "https://dmarc.mx/learn/spf", priority: "0.8" },
  { loc: "https://dmarc.mx/learn/dkim", priority: "0.7" },
  { loc: "https://dmarc.mx/learn/bimi", priority: "0.6" },
  { loc: "https://dmarc.mx/learn/mta-sts", priority: "0.7" },
  { loc: "https://dmarc.mx/check?domain=dmarc.mx", priority: "0.6" },
  { loc: "https://dmarc.mx/check?domain=google.com", priority: "0.6" },
  { loc: "https://dmarc.mx/check?domain=github.com", priority: "0.6" },
];
const SITEMAP_LASTMOD = "2026-04-11";

app.get("/sitemap.xml", (c) => {
  const urls = SITEMAP_URLS.map(
    ({ loc, priority }) =>
      `  <url><loc>${loc}</loc><lastmod>${SITEMAP_LASTMOD}</lastmod><priority>${priority}</priority></url>`,
  ).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/", (c) => {
  if (wantsMarkdown(c)) return markdownResponse(c, renderLandingMarkdown());
  return c.html(renderLandingPage());
});

app.get("/scoring", (c) => {
  if (wantsMarkdown(c))
    return markdownResponse(c, renderScoringRubricMarkdown());
  return c.html(renderScoringRubric());
});

app.get("/learn", (c) => {
  if (wantsMarkdown(c)) return markdownResponse(c, renderLearnHubMarkdown());
  return c.html(renderLearnHub());
});
app.get("/learn/dmarc", (c) => c.html(renderLearnDmarc()));
app.get("/learn/spf", (c) => c.html(renderLearnSpf()));
app.get("/learn/dkim", (c) => c.html(renderLearnDkim()));
app.get("/learn/bimi", (c) => c.html(renderLearnBimi()));
app.get("/learn/mta-sts", (c) => c.html(renderLearnMtaSts()));

app.get("/api/check", async (c) => {
  const domain = normalizeDomain(c.req.query("domain"));
  if (!domain) {
    return c.json({ error: "Missing or invalid domain parameter" }, 400);
  }

  const selectors = parseSelectors(c.req.query("selectors"));

  try {
    Sentry.addBreadcrumb({
      category: "scan.start",
      message: domain,
      data: { domain, selectors },
      level: "info",
    });
    const cached = await getCachedScan(domain, selectors);
    Sentry.addBreadcrumb({
      category: cached ? "cache.hit" : "cache.miss",
      message: domain,
      data: { domain },
      level: "info",
    });
    const result = cached ?? (await scan(domain, selectors));
    tagScanResult(result);
    if (!cached) {
      const pendingCacheWrite = setCachedScan(domain, selectors, result);
      if (pendingCacheWrite) {
        c.executionCtx.waitUntil(pendingCacheWrite.catch(() => {}));
      }
    }

    if (c.req.query("format") === "csv") {
      return c.body(generateCsv(result), 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${domain}-email-security.csv"`,
        ...(cached ? { "X-Cache": "HIT" } : {}),
      });
    }
    if (cached) {
      return c.json(result, { headers: { "X-Cache": "HIT" } });
    }
    return c.json(result);
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Internal error";
    return c.json({ error: message }, 500);
  }
});

app.get("/check/score", async (c) => {
  const domain = normalizeDomain(c.req.query("domain"));
  if (!domain) {
    return c.html(renderError("Please provide a valid domain name."), 400);
  }

  const selectors = parseSelectors(c.req.query("selectors"));

  try {
    Sentry.addBreadcrumb({
      category: "scan.start",
      message: domain,
      data: { domain, selectors },
      level: "info",
    });
    const result = await scan(domain, selectors);
    tagScanResult(result);
    return c.html(renderScoreBreakdown(result));
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Internal error";
    return c.html(renderError(message), 500);
  }
});

app.get("/check", async (c) => {
  const format = c.req.query("format");
  const wantsJson =
    format === "json" || c.req.header("Accept")?.includes("application/json");
  const wantsCsv = format === "csv";
  const wantsMd = !wantsJson && !wantsCsv && wantsMarkdown(c);

  const domain = normalizeDomain(c.req.query("domain"));
  if (!domain) {
    // API clients still get a structured error. Browsers get a 302 to `/` so
    // Google doesn't report `/check` (bare) as a crawl error — the human intent
    // of landing on `/check` with no query is "I want to scan something".
    if (wantsJson) {
      return c.json({ error: "Missing or invalid domain parameter" }, 400);
    }
    if (wantsCsv) {
      return c.body("error,Missing or invalid domain parameter\n", 400, {
        "Content-Type": "text/csv; charset=utf-8",
      });
    }
    if (wantsMd) {
      return markdownResponse(
        c,
        renderErrorMarkdown("Missing or invalid domain parameter"),
        400,
      );
    }
    return c.redirect("/", 302);
  }

  const selectors = parseSelectors(c.req.query("selectors"));

  if (wantsMd) {
    try {
      Sentry.addBreadcrumb({
        category: "scan.start",
        message: domain,
        data: { domain, selectors },
        level: "info",
      });
      const cached = await getCachedScan(domain, selectors);
      const result = cached ?? (await scan(domain, selectors));
      tagScanResult(result);
      if (!cached) {
        const pendingCacheWrite = setCachedScan(domain, selectors, result);
        if (pendingCacheWrite) {
          c.executionCtx.waitUntil(pendingCacheWrite.catch(() => {}));
        }
      }
      return markdownResponse(c, renderReportMarkdown(result));
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Internal error";
      return markdownResponse(c, renderErrorMarkdown(message), 500);
    }
  }

  if (wantsJson) {
    try {
      Sentry.addBreadcrumb({
        category: "scan.start",
        message: domain,
        data: { domain, selectors },
        level: "info",
      });
      const result = await scan(domain, selectors);
      tagScanResult(result);
      return c.json(result);
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Internal error";
      return c.json({ error: message }, 500);
    }
  }

  if (wantsCsv) {
    try {
      Sentry.addBreadcrumb({
        category: "scan.start",
        message: domain,
        data: { domain, selectors },
        level: "info",
      });
      const result = await scan(domain, selectors);
      tagScanResult(result);
      return c.body(generateCsv(result), 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${domain}-email-security.csv"`,
      });
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Internal error";
      return c.json({ error: message }, 500);
    }
  }

  // Fetch from loading page or noscript fallback — do the actual scan
  if (c.req.header("X-Scan-Fetch") === "1" || c.req.query("_direct") === "1") {
    try {
      Sentry.addBreadcrumb({
        category: "scan.start",
        message: domain,
        data: { domain, selectors },
        level: "info",
      });
      const cached = await getCachedScan(domain, selectors);
      Sentry.addBreadcrumb({
        category: cached ? "cache.hit" : "cache.miss",
        message: domain,
        data: { domain },
        level: "info",
      });
      const result = cached ?? (await scan(domain, selectors));
      tagScanResult(result);
      if (!cached) {
        const pendingCacheWrite = setCachedScan(domain, selectors, result);
        if (pendingCacheWrite) {
          c.executionCtx.waitUntil(pendingCacheWrite.catch(() => {}));
        }
      }
      return c.html(renderReport(result));
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Internal error";
      return c.html(renderError(message), 500);
    }
  }

  // Default: return streaming loading page with skeleton cards, JS opens SSE.
  // Pass the sanitized selectors (re-joined from parseSelectors) rather than
  // the raw query string so the loader only ever sees validated characters.
  return c.html(renderStreamingLoading(domain, selectors.join(",")));
});

export function normalizeDomain(raw: string | undefined): string | null {
  if (!raw) return null;
  let domain = raw.trim().toLowerCase();
  // Strip protocol if pasted as URL
  domain = domain.replace(/^https?:\/\//, "");
  // Use URL constructor to normalize (handles ports, userinfo, Punycode/IDN)
  try {
    domain = new URL(`http://${domain}`).hostname;
  } catch {
    // Fall back to manual parsing for inputs the URL constructor rejects
    domain = domain.split("/")[0].split("?")[0];
  }
  // RFC 1035: domain names must not exceed 253 characters
  if (domain.length > 253) return null;
  // Strip trailing dot
  domain = domain.replace(/\.$/, "");
  // Restrict to ASCII hostname charset. IDNs are Punycode-encoded by `new URL`
  // (e.g. münchen.de → xn--mnchen-3ya.de), so this set covers valid IDNs too.
  // Rejects anything exotic (quotes, spaces, brackets) that could break out of
  // an HTML attribute or JS literal downstream.
  if (!/^[a-z0-9.-]+$/.test(domain)) return null;
  // Must have at least one dot
  if (!domain.includes(".")) return null;
  // Reject IPv4 literals. DMARC/SPF/DKIM/BIMI/MTA-STS records are published
  // in DNS at domain names, not IPs — there is no legitimate dmarcheck use
  // case for scanning `1.2.3.4`. This also closes a defense-in-depth gap
  // around the MTA-STS fetch in `src/analyzers/mta-sts.ts`, which interpolates
  // the validated domain into a URL (flagged CWE-918 by static analysis);
  // previously, metadata-service IPs like 169.254.169.254 were only shielded
  // by the `mta-sts.` prefix happening to route them back through public DNS.
  // WHATWG URL (used above) normalizes hex, integer, and short-form IPv4
  // inputs into canonical dotted-decimal, so a single anchored check covers
  // `0xc0a80101`, `3232235777`, `127.1`, and `1.2.3` as well as plain forms.
  // `999.999.999.999` throws from `new URL` and is caught by the fallback
  // branch above, then rejected here by regex shape.
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(domain)) return null;
  return domain;
}

// DKIM selector charset per RFC 6376 §3.1: sub-domain syntax, which is
// letters / digits / hyphens, with dot-separated labels. We also allow
// underscores since some providers use them in practice. Anything else
// is dropped silently — an invalid selector cannot match a real DKIM key.
const VALID_SELECTOR = /^[A-Za-z0-9._-]+$/;

export function parseSelectors(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && VALID_SELECTOR.test(s));
}

// Cron handler — runs nightly per the `[triggers] crons` entry in wrangler.toml.
// Rescans domains whose cadence has come due (monthly or weekly), persists
// results, and records grade_drop / protocol_regression alerts. Fails soft
// when DB is unbound so self-host deploys without D1 don't fault.
async function scheduled(
  _controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  if (!env.DB) return;
  const work = (async () => {
    const rescanResult = await runDueRescans({
      db: env.DB,
      now: Math.floor(Date.now() / 1000),
    });
    const scope = Sentry.getCurrentScope();
    scope.setTag("cron.scanned", String(rescanResult.scanned));
    scope.setTag("cron.alerts", String(rescanResult.alerts));
    scope.setTag("cron.errors", String(rescanResult.errors));

    // Dispatch runs unconditionally — alerts from prior cron runs may still
    // be pending if the EMAIL binding was absent or failed previously.
    const dispatchResult = await dispatchPendingAlerts(env);
    scope.setTag("cron.emails_sent", String(dispatchResult.sent));
    scope.setTag("cron.emails_skipped", String(dispatchResult.skipped));
    scope.setTag("cron.emails_errors", String(dispatchResult.errors));
  })().catch((err) => {
    Sentry.captureException(err);
  });
  ctx.waitUntil(work);
}

// Public unsubscribe endpoint reached from email links. The token is the
// authentication — no session cookie required. Invalid / tampered tokens
// return a 400. Successful unsubscribe flips users.email_alerts_enabled to 0
// and renders a confirmation page.
app.get("/alerts/unsubscribe", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.html(renderError("Missing unsubscribe token."), 400);
  }
  const userId = await validateUnsubscribeToken(token, c.env.SESSION_SECRET);
  if (!userId) {
    return c.html(renderError("Invalid or expired unsubscribe link."), 400);
  }
  await setEmailAlertsEnabled(c.env.DB, userId, false);
  return c.html(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head><body style="font-family:system-ui;padding:32px;max-width:520px;margin:0 auto;line-height:1.5"><h1>Unsubscribed</h1><p>You will no longer receive grade-drop alerts from dmarc.mx.</p><p>You can re-enable alerts any time from <a href="/dashboard/settings">dashboard settings</a>.</p></body></html>`,
  );
});

const handler: ExportedHandler<Env> = {
  fetch: app.fetch.bind(app),
  scheduled,
};

export default Sentry.withSentry<Env>(
  (env) => ({
    dsn: env?.SENTRY_DSN ?? "",
    tracesSampler: (samplingContext: { parentSampled?: boolean }) => {
      if (samplingContext.parentSampled !== undefined)
        return samplingContext.parentSampled;
      return 0.3;
    },
  }),
  handler,
);
