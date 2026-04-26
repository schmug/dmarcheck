import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";

// Visible top-of-page ribbon + machine-readable noindex injected on every
// HTML response from the staging worker. Lives as middleware so individual
// view-render functions stay env-agnostic.
const BANNER_HTML = `<div role="alert" data-staging-banner style="position:sticky;top:0;left:0;right:0;z-index:9999;background:#dc2626;color:#fff;text-align:center;padding:0.4rem 1rem;font-family:system-ui,sans-serif;font-size:0.85rem;font-weight:600;letter-spacing:0.02em;box-shadow:0 1px 4px rgba(0,0,0,0.3)">⚠ STAGING — not production. <a href="https://dmarc.mx" style="color:#fff;text-decoration:underline">Go to dmarc.mx</a></div>`;

const NOINDEX_META = `<meta name="robots" content="noindex,nofollow">`;

export function isStaging(env: Env | undefined): boolean {
  return env?.IS_STAGING === "1";
}

// Hono middleware. Post-processes any HTML response when IS_STAGING=1:
//   - injects a noindex,nofollow meta tag right after `<head>` (in addition
//     to any per-page noindex already emitted by `page()`)
//   - prepends a sticky red banner inside `<body>` so anyone visiting
//     staging.dmarc.mx visually knows they aren't on prod
// Non-HTML responses pass through untouched.
export const stagingMarker: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  await next();
  if (!isStaging(c.env)) return;
  const ct = c.res.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("text/html")) return;
  const html = await c.res.text();
  const stamped = html
    .replace("<head>", `<head>\n${NOINDEX_META}`)
    .replace("<body>", `<body>\n${BANNER_HTML}`);
  // Hono's c.res is a getter/setter on a Response. Re-wrap with the same
  // status + headers but the new body.
  c.res = new Response(stamped, {
    status: c.res.status,
    headers: c.res.headers,
  });
};
