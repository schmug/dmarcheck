import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { authRoutes } from "../src/auth/routes.js";

function createTestApp() {
  const app = new Hono();
  app.route("/auth", authRoutes);
  return app;
}

const ENV = {
  WORKOS_CLIENT_ID: "test-client-id",
  WORKOS_REDIRECT_URI: "https://example.com/auth/callback",
  SESSION_SECRET: "test-session-secret",
};

describe("auth/routes", () => {
  describe("GET /auth/login", () => {
    it("redirects to WorkOS authorization URL", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/login", {}, ENV);
      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).not.toBeNull();
      const url = new URL(location as string);
      expect(url.origin + url.pathname).toBe(
        "https://api.workos.com/user_management/authorize",
      );
    });

    it("includes client_id in the authorization URL", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/login", {}, ENV);
      const location = res.headers.get("Location") as string;
      const url = new URL(location);
      expect(url.searchParams.get("client_id")).toBe(ENV.WORKOS_CLIENT_ID);
    });

    it("includes redirect_uri in the authorization URL", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/login", {}, ENV);
      const location = res.headers.get("Location") as string;
      const url = new URL(location);
      expect(url.searchParams.get("redirect_uri")).toBe(
        ENV.WORKOS_REDIRECT_URI,
      );
    });

    it("includes response_type=code in the authorization URL", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/login", {}, ENV);
      const location = res.headers.get("Location") as string;
      const url = new URL(location);
      expect(url.searchParams.get("response_type")).toBe("code");
    });

    it("includes provider=authkit in the authorization URL", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/login", {}, ENV);
      const location = res.headers.get("Location") as string;
      const url = new URL(location);
      expect(url.searchParams.get("provider")).toBe("authkit");
    });

    it("sets oauth_state cookie and includes state in authorization URL", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/login", {}, ENV);

      const setCookieHeader = res.headers.get("Set-Cookie");
      expect(setCookieHeader).not.toBeNull();
      expect(setCookieHeader).toMatch(/oauth_state=[a-f0-9-]+;/);

      const cookieMatch = setCookieHeader?.match(/oauth_state=([a-f0-9-]+);/);
      const cookieState = cookieMatch?.[1];
      expect(cookieState).toBeDefined();

      const location = res.headers.get("Location") as string;
      const url = new URL(location);
      const urlState = url.searchParams.get("state");
      expect(urlState).toBeDefined();
      expect(urlState).toBe(cookieState);
    });
  });

  describe("GET /auth/callback", () => {
    it("returns 400 when code query param is missing", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/callback", {}, ENV);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe("Missing authorization code");
    });

    it("returns 400 when state query param is missing", async () => {
      const app = createTestApp();
      const req = new Request("http://localhost/auth/callback?code=test-code");
      req.headers.set("Cookie", "oauth_state=test-state");
      const res = await app.request(req, ENV);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe("Invalid or missing state parameter");
    });

    it("returns 400 when oauth_state cookie is missing", async () => {
      const app = createTestApp();
      const req = new Request("http://localhost/auth/callback?code=test-code&state=test-state");
      const res = await app.request(req, ENV);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe("Invalid or missing state parameter");
    });

    it("returns 400 when state values do not match", async () => {
      const app = createTestApp();
      const req = new Request("http://localhost/auth/callback?code=test-code&state=query-state");
      req.headers.set("Cookie", "oauth_state=cookie-state");
      const res = await app.request(req, ENV);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe("Invalid or missing state parameter");
    });
  });

  describe("GET /auth/logout", () => {
    it("clears the session cookie", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/logout", {}, ENV);
      const setCookieHeader = res.headers.get("Set-Cookie");
      expect(setCookieHeader).not.toBeNull();
      // Cookie should be cleared (Max-Age=0 or expires in the past)
      expect(setCookieHeader).toMatch(/session=/);
      expect(setCookieHeader).toMatch(/Max-Age=0/);
    });

    it("redirects to /", async () => {
      const app = createTestApp();
      const res = await app.request("/auth/logout", {}, ENV);
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/");
    });
  });
});
