import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { createDomain } from "../db/domains.js";
import { createUser, getUserByEmail } from "../db/users.js";
import { createSessionToken } from "./session.js";

export const authRoutes = new Hono();

authRoutes.get("/login", (c) => {
  const env = c.env as {
    WORKOS_CLIENT_ID: string;
    WORKOS_REDIRECT_URI: string;
  };
  const params = new URLSearchParams({
    client_id: env.WORKOS_CLIENT_ID,
    redirect_uri: env.WORKOS_REDIRECT_URI,
    response_type: "code",
    provider: "authkit",
  });
  return c.redirect(
    `https://api.workos.com/user_management/authorize?${params}`,
  );
});

authRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  const env = c.env as {
    WORKOS_CLIENT_ID: string;
    WORKOS_CLIENT_SECRET: string;
    SESSION_SECRET: string;
    DB: D1Database;
  };

  // Exchange code for user info
  const tokenRes = await fetch(
    "https://api.workos.com/user_management/authenticate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: env.WORKOS_CLIENT_ID,
        client_secret: env.WORKOS_CLIENT_SECRET,
        grant_type: "authorization_code",
      }),
    },
  );

  if (!tokenRes.ok) {
    return c.text("Authentication failed", 401);
  }

  const data = (await tokenRes.json()) as {
    user: { id: string; email: string };
  };
  const { id, email } = data.user;

  // Create or find user (handle race condition on duplicate signups)
  let user = await getUserByEmail(env.DB, email);
  if (!user) {
    try {
      await createUser(env.DB, { id, email });
      // Auto-provision free domain from email
      const emailDomain = email.split("@")[1];
      await createDomain(env.DB, {
        userId: id,
        domain: emailDomain,
        isFree: true,
      });
    } catch {
      // Unique constraint violation — user was created by a concurrent request
    }
    user = await getUserByEmail(env.DB, email);
    if (!user) {
      return c.text("Account creation failed", 500);
    }
  }

  // Create session
  const token = await createSessionToken(
    { sub: user.id, email: user.email },
    env.SESSION_SECRET,
  );

  setCookie(c, "session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return c.redirect("/dashboard");
});

authRoutes.get("/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/");
});
