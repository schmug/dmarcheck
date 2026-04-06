import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type {
  BimiResult,
  DkimResult,
  DmarcResult,
  MtaStsResult,
  MxResult,
  SpfResult,
} from "./analyzers/types.js";
import { getCachedScan, setCachedScan } from "./cache.js";
import { generateCsv } from "./csv.js";
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
  webManifest,
} from "./views/favicon.js";
import {
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
import { JS } from "./views/scripts.js";
import { CSS } from "./views/styles.js";

const app = new Hono();

// Security headers middleware (HSTS is handled at Cloudflare edge)

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  const isHtml = c.res.headers.get("content-type")?.includes("text/html");
  if (isHtml) {
    c.res.headers.set(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    );
  } else {
    c.res.headers.set("Content-Security-Policy", "default-src 'none'");
  }
});

app.use("/api/*", cors());

// Rate limit scan endpoints (not the landing page)
app.use("/check", async (c, next) => {
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

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
  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
  }
});

app.use("/check/score", async (c, next) => {
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

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
  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
  }
});

app.use("/api/check", async (c, next) => {
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    return c.json(
      { error: "Rate limit exceeded. Try again in 60 seconds." },
      { status: 429, headers },
    );
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
  }
});

// The SSE streaming endpoint fans out ~50 DNS lookups per request and is
// bypassed by the `/api/check` middleware above (Hono matches exact paths).
// Give it its own limiter so it cannot be used as a DNS amplification vector.
app.use("/api/check/stream", async (c, next) => {
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    return c.json(
      { error: "Rate limit exceeded. Try again in 60 seconds." },
      { status: 429, headers },
    );
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
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

app.get("/api/check/stream", async (c) => {
  const domain = normalizeDomain(c.req.query("domain"));
  if (!domain) {
    return c.json({ error: "Missing or invalid domain parameter" }, 400);
  }

  const selectors = parseSelectors(c.req.query("selectors"));

  return streamSSE(c, async (stream) => {
    const cached = await getCachedScan(domain, selectors);

    if (cached) {
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
          footerHtml: renderReportFooter(),
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

    setCachedScan(domain, selectors, result);

    stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        grade: result.grade,
        headerHtml: renderReportHeader(result),
        footerHtml: renderReportFooter(),
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

app.get("/", (c) => {
  return c.html(renderLandingPage());
});

app.get("/scoring", (c) => {
  return c.html(renderScoringRubric());
});

app.get("/api/check", async (c) => {
  const domain = normalizeDomain(c.req.query("domain"));
  if (!domain) {
    return c.json({ error: "Missing or invalid domain parameter" }, 400);
  }

  const selectors = parseSelectors(c.req.query("selectors"));

  try {
    const cached = await getCachedScan(domain, selectors);
    const result = cached ?? (await scan(domain, selectors));
    if (!cached) setCachedScan(domain, selectors, result);

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
    const result = await scan(domain, selectors);
    return c.html(renderScoreBreakdown(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return c.html(renderError(message), 500);
  }
});

app.get("/check", async (c) => {
  const domain = normalizeDomain(c.req.query("domain"));
  if (!domain) {
    return c.html(renderError("Please provide a valid domain name."), 400);
  }

  const format = c.req.query("format");
  const wantsJson =
    format === "json" || c.req.header("Accept")?.includes("application/json");
  const wantsCsv = format === "csv";

  const selectors = parseSelectors(c.req.query("selectors"));

  if (wantsJson) {
    try {
      const result = await scan(domain, selectors);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return c.json({ error: message }, 500);
    }
  }

  if (wantsCsv) {
    try {
      const result = await scan(domain, selectors);
      return c.body(generateCsv(result), 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${domain}-email-security.csv"`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return c.json({ error: message }, 500);
    }
  }

  // Fetch from loading page or noscript fallback — do the actual scan
  if (c.req.header("X-Scan-Fetch") === "1" || c.req.query("_direct") === "1") {
    try {
      const cached = await getCachedScan(domain, selectors);
      const result = cached ?? (await scan(domain, selectors));
      if (!cached) setCachedScan(domain, selectors, result);
      return c.html(renderReport(result));
    } catch (err) {
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

export default app;
