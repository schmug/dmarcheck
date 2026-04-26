import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requireAuth } from "../src/auth/middleware.js";
import { createSessionToken } from "../src/auth/session.js";

const SECRET = "test-secret";

function createTestApp() {
  const app = new Hono<{ Bindings: { SESSION_SECRET: string } }>();
  app.use("/dashboard/*", requireAuth);
  app.get("/dashboard/home", (c) => {
    const user = c.get("user" as never);
    return c.json(user);
  });
  app.get("/public", (c) => c.text("ok"));
  return app;
}

describe("auth/middleware", () => {
  it("redirects to login when no session cookie", async () => {
    const app = createTestApp();
    const res = await app.request(
      "/dashboard/home",
      {},
      { SESSION_SECRET: SECRET },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/auth/login");
  });

  it("allows access with valid session cookie", async () => {
    const app = createTestApp();
    const token = await createSessionToken(
      { sub: "user_1", email: "alice@example.com" },
      SECRET,
    );
    const res = await app.request(
      "/dashboard/home",
      { headers: { Cookie: `session=${token}` } },
      { SESSION_SECRET: SECRET },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sub).toBe("user_1");
    expect(body.email).toBe("alice@example.com");
  });

  it("redirects on expired session", async () => {
    const app = createTestApp();
    const token = await createSessionToken(
      { sub: "user_1", email: "alice@example.com" },
      SECRET,
      -1,
    );
    const res = await app.request(
      "/dashboard/home",
      { headers: { Cookie: `session=${token}` } },
      { SESSION_SECRET: SECRET },
    );
    expect(res.status).toBe(302);
  });

  it("does not affect public routes", async () => {
    const app = createTestApp();
    const res = await app.request("/public", {}, { SESSION_SECRET: SECRET });
    expect(res.status).toBe(200);
  });
});
