import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { resolveBearer } from "./api-key.js";
import { validateSessionToken } from "./session.js";

export async function requireAuth(c: Context, next: Next) {
  const sessionSecret = (c.env as { SESSION_SECRET: string }).SESSION_SECRET;
  const token = getCookie(c, "session");

  if (!token) {
    return c.redirect("/auth/login");
  }

  const payload = await validateSessionToken(token, sessionSecret);
  if (!payload) {
    return c.redirect("/auth/login");
  }

  c.set("user" as never, payload);
  await next();
}

// Auth middleware for API endpoints that allow EITHER a session cookie OR a
// bearer API key. Cookie wins when both are present (defensive — a browser
// request that happened to carry a stale bearer token should still be read
// as the logged-in user). The middleware never 401s: routes that want to
// enforce auth check `c.get("user")` / `c.get("bearer")` themselves. This
// keeps the anonymous path (current `/api/check` behavior) intact.
export async function requireAuthOrBearer(c: Context, next: Next) {
  const sessionSecret = (c.env as { SESSION_SECRET?: string }).SESSION_SECRET;
  const token = getCookie(c, "session");
  if (token && sessionSecret) {
    const payload = await validateSessionToken(token, sessionSecret);
    if (payload) {
      c.set("user" as never, payload);
      await next();
      return;
    }
  }

  const identity = await resolveBearer(c);
  if (identity) {
    c.set("bearer" as never, identity);
  }

  await next();
}
