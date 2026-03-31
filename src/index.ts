import { Hono } from "hono";
import { cors } from "hono/cors";
import { scan } from "./orchestrator.js";
import { renderLandingPage, renderReport, renderScoreBreakdown, renderScoringRubric, renderError } from "./views/html.js";
import { checkRateLimit, rateLimitHeaders } from "./rate-limit.js";

const app = new Hono();

// Security headers middleware (HSTS is handled at Cloudflare edge)

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  const isHtml = c.res.headers.get("content-type")?.includes("text/html");
  if (isHtml) {
    c.res.headers.set(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    );
  } else {
    c.res.headers.set("Content-Security-Policy", "default-src 'none'");
  }
});

app.use("/api/*", cors());

// Rate limit scan endpoints (not the landing page)
app.use("/check", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    const wantsJson =
      c.req.query("format") === "json" ||
      c.req.header("Accept")?.includes("application/json");

    if (wantsJson) {
      return c.json({ error: "Rate limit exceeded. Try again in 60 seconds." }, { status: 429, headers });
    }
    return c.html(renderError("Rate limit exceeded. Please wait a minute before scanning again."), { status: 429, headers });
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
  }
});

app.use("/check/score", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    return c.html(renderError("Rate limit exceeded. Please wait a minute before scanning again."), { status: 429, headers });
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
  }
});

app.use("/api/check", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

  if (!allowed) {
    const headers = rateLimitHeaders(remaining);
    return c.json({ error: "Rate limit exceeded. Try again in 60 seconds." }, { status: 429, headers });
  }

  const headers = rateLimitHeaders(remaining);
  await next();
  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
  }
});

app.get("/logo.svg", (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="0 0 512 512">
  <title>dmarcheck</title>
  <rect width="512" height="512" rx="64" fill="#0a0a0a"/>
  <path d="M256 80 L420 160 L420 280 Q420 380 256 440 Q92 380 92 280 L92 160 Z" fill="none" stroke="#f97316" stroke-width="28" stroke-linejoin="round"/>
  <path d="M192 260 L232 300 L320 212" fill="none" stroke="#f97316" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
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
    const result = await scan(domain, selectors);
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

  const wantsJson =
    c.req.query("format") === "json" ||
    c.req.header("Accept")?.includes("application/json");

  const selectors = parseSelectors(c.req.query("selectors"));

  try {
    const result = await scan(domain, selectors);

    if (wantsJson) {
      return c.json(result);
    }
    return c.html(renderReport(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (wantsJson) {
      return c.json({ error: message }, 500);
    }
    return c.html(renderError(message), 500);
  }
});

export function normalizeDomain(raw: string | undefined): string | null {
  if (!raw) return null;
  let domain = raw.trim().toLowerCase();
  // Strip protocol if pasted as URL
  domain = domain.replace(/^https?:\/\//, "");
  // Use URL constructor to normalize (handles ports, userinfo, Punycode/IDN)
  try {
    domain = new URL("http://" + domain).hostname;
  } catch {
    // Fall back to manual parsing for inputs the URL constructor rejects
    domain = domain.split("/")[0].split("?")[0];
  }
  // RFC 1035: domain names must not exceed 253 characters
  if (domain.length > 253) return null;
  // Basic validation: must have at least one dot, no spaces
  if (!domain.includes(".") || /\s/.test(domain)) return null;
  // Strip trailing dot
  domain = domain.replace(/\.$/, "");
  return domain;
}

export function parseSelectors(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default app;
