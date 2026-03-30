import { Hono } from "hono";
import { cors } from "hono/cors";
import { scan } from "./orchestrator.js";
import { renderLandingPage, renderReport, renderError } from "./views/html.js";
import { checkRateLimit, rateLimitHeaders } from "./rate-limit.js";

const app = new Hono();

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

app.get("/", (c) => {
  return c.html(renderLandingPage());
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
  // Strip path/query
  domain = domain.split("/")[0].split("?")[0];
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
