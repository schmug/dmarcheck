import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
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
