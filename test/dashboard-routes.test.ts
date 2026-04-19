import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createSessionToken } from "../src/auth/session.js";
import { dashboardRoutes } from "../src/dashboard/routes.js";

vi.mock("../src/orchestrator.js", () => ({
  scan: vi.fn(async (domain: string) => ({
    domain,
    timestamp: "2026-04-19T00:00:00.000Z",
    grade: "B",
    breakdown: {
      grade: "B",
      tier: "B",
      tierReason: "test",
      modifier: 0,
      modifierLabel: "",
      factors: [{ name: "dmarc", status: "pass", weight: 1 }],
      recommendations: [],
      protocolSummaries: {},
    },
    summary: {
      mx_records: 0,
      mx_providers: [],
      dmarc_policy: "none",
    },
    protocols: {
      mx: { status: "info" },
      dmarc: { status: "pass" },
      spf: { status: "pass" },
      dkim: { status: "pass" },
      bimi: { status: "pass" },
      mta_sts: { status: "pass" },
    },
  })),
}));

const SECRET = "test-session-secret";

// Minimal D1-like mock that routes calls to in-memory data
function createMockDB(data: {
  domains?: Array<{
    id: number;
    user_id: string;
    domain: string;
    is_free: number;
    scan_frequency: string;
    last_scanned_at: number | null;
    last_grade: string | null;
    created_at: number;
  }>;
  users?: Array<{
    id: string;
    email: string;
    email_domain: string;
    stripe_customer_id: string | null;
    api_key: string | null;
    created_at: number;
  }>;
  scanHistory?: Array<{ grade: string; scanned_at: number }>;
  webhooks?: Array<{
    id: number;
    user_id: string;
    url: string;
    secret: string;
  }>;
  writes?: Array<{ sql: string; bindings: unknown[] }>;
}) {
  const domains = data.domains ?? [];
  const users = data.users ?? [];
  const scanHistory = data.scanHistory ?? [];
  const webhooks = data.webhooks ?? [];
  const writes = data.writes;

  const makeStatement = (sql: string, bindings: unknown[]) => ({
    bind: (...args: unknown[]) => makeStatement(sql, args),
    first: async <T>() => {
      if (sql.includes("SELECT * FROM users WHERE id")) {
        return (users.find((u) => u.id === bindings[0]) ?? null) as T | null;
      }
      if (sql.includes("SELECT * FROM users WHERE email")) {
        return (users.find((u) => u.email === bindings[0]) ?? null) as T | null;
      }
      if (sql.includes("SELECT * FROM domains WHERE user_id = ? AND domain")) {
        return (domains.find(
          (d) => d.user_id === bindings[0] && d.domain === bindings[1],
        ) ?? null) as T | null;
      }
      if (sql.includes("SELECT url FROM webhooks WHERE user_id")) {
        const wh = webhooks.find((w) => w.user_id === bindings[0]);
        return (wh ? { url: wh.url } : null) as T | null;
      }
      if (sql.includes("SELECT id FROM webhooks WHERE user_id")) {
        const wh = webhooks.find((w) => w.user_id === bindings[0]);
        return (wh ? { id: wh.id } : null) as T | null;
      }
      return null as T | null;
    },
    all: async <T>() => {
      if (sql.includes("SELECT * FROM domains WHERE user_id")) {
        return {
          results: domains.filter((d) => d.user_id === bindings[0]) as T[],
        };
      }
      if (sql.includes("SELECT grade, scanned_at FROM scan_history")) {
        return { results: scanHistory as T[] };
      }
      return { results: [] as T[] };
    },
    run: async () => {
      writes?.push({ sql, bindings });
      return { success: true };
    },
  });

  return {
    prepare: (sql: string) => makeStatement(sql, []),
    batch: async (
      stmts: Array<{ run: () => Promise<{ success: boolean }> }>,
    ) => {
      const out = [];
      for (const stmt of stmts) {
        out.push(await stmt.run());
      }
      return out;
    },
  };
}

function createTestApp(db: ReturnType<typeof createMockDB>) {
  const app = new Hono();
  app.route("/dashboard", dashboardRoutes);
  // Inject the mock DB into requests via env
  return {
    request: (url: string, init?: RequestInit) =>
      app.request(url, init, {
        SESSION_SECRET: SECRET,
        DB: db,
      }),
  };
}

async function makeSessionCookie(sub: string, email: string): Promise<string> {
  const token = await createSessionToken({ sub, email }, SECRET);
  return `session=${token}`;
}

describe("dashboard/routes", () => {
  describe("GET /dashboard (domain list)", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard");
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("returns 200 and contains Dashboard with valid session", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            api_key: null,
            created_at: 1700000000,
          },
        ],
        domains: [
          {
            id: 1,
            user_id: "user_1",
            domain: "example.com",
            is_free: 1,
            scan_frequency: "monthly",
            last_scanned_at: null,
            last_grade: null,
            created_at: 1700000000,
          },
        ],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Your Domains");
    });

    it("shows domain names in the list", async () => {
      const db = createMockDB({
        domains: [
          {
            id: 1,
            user_id: "user_1",
            domain: "example.com",
            is_free: 1,
            scan_frequency: "monthly",
            last_scanned_at: null,
            last_grade: "A",
            created_at: 1700000000,
          },
        ],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard", {
        headers: { Cookie: cookie },
      });
      const body = await res.text();
      expect(body).toContain("example.com");
    });

    it("shows empty state when user has no domains", async () => {
      const db = createMockDB({ domains: [] });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard", {
        headers: { Cookie: cookie },
      });
      const body = await res.text();
      expect(body).toContain("No domains");
    });
  });

  describe("GET /dashboard/domain/:domain", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/domain/example.com");
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("returns 404 when domain does not belong to the user", async () => {
      const db = createMockDB({ domains: [] });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/notmine.com", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });

    it("returns 200 and contains domain name with valid session", async () => {
      const db = createMockDB({
        domains: [
          {
            id: 1,
            user_id: "user_1",
            domain: "example.com",
            is_free: 0,
            scan_frequency: "weekly",
            last_scanned_at: 1700000000,
            last_grade: "B",
            created_at: 1700000000,
          },
        ],
        scanHistory: [{ grade: "B", scanned_at: 1700000000 }],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/example.com", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("example.com");
    });

    it("shows grade history section", async () => {
      const db = createMockDB({
        domains: [
          {
            id: 1,
            user_id: "user_1",
            domain: "example.com",
            is_free: 0,
            scan_frequency: "weekly",
            last_scanned_at: null,
            last_grade: null,
            created_at: 1700000000,
          },
        ],
        scanHistory: [],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/example.com", {
        headers: { Cookie: cookie },
      });
      const body = await res.text();
      expect(body).toContain("Grade History");
    });
  });

  describe("GET /dashboard/settings", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/settings");
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("returns 200 and contains email and Settings with valid session", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            api_key: null,
            created_at: 1700000000,
          },
        ],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/settings", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Settings");
      expect(body).toContain("alice@example.com");
    });

    it("shows API key when one exists", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            api_key: "dmarc_abc123",
            created_at: 1700000000,
          },
        ],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/settings", {
        headers: { Cookie: cookie },
      });
      const body = await res.text();
      expect(body).toContain("dmarc_abc123");
      expect(body).toContain("Regenerate");
    });

    it("shows webhook URL when one is configured", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            api_key: null,
            created_at: 1700000000,
          },
        ],
        webhooks: [
          {
            id: 1,
            user_id: "user_1",
            url: "https://hooks.example.com/notify",
            secret: "sec",
          },
        ],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/settings", {
        headers: { Cookie: cookie },
      });
      const body = await res.text();
      expect(body).toContain("https://hooks.example.com/notify");
    });

    it("redirects to logout when user record is missing", async () => {
      const db = createMockDB({ users: [] });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("ghost_user", "ghost@example.com");
      const res = await app.request("/dashboard/settings", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/logout");
    });
  });

  describe("POST /dashboard/settings/api-key", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/settings/api-key", {
        method: "POST",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("redirects to /dashboard/settings after generating a key", async () => {
      const updatedKey: { value: string | null } = { value: null };
      const db = createMockDB({});
      // Override run to capture the key
      const origPrepare = db.prepare.bind(db);
      db.prepare = (sql: string) => {
        const stmt = origPrepare(sql);
        if (sql.includes("UPDATE users SET api_key")) {
          return {
            ...stmt,
            bind: (...args: unknown[]) => ({
              ...stmt,
              run: async () => {
                updatedKey.value = args[0] as string;
                return { success: true };
              },
            }),
          };
        }
        return stmt;
      };
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/settings/api-key", {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/dashboard/settings");
    });
  });

  describe("POST /dashboard/domain/:domain/scan", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/domain/example.com/scan", {
        method: "POST",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("returns 404 when domain does not belong to the user", async () => {
      const db = createMockDB({ domains: [] });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/notmine.com/scan", {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });

    it("runs the scan, persists history, and 303-redirects to the detail page", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({
        domains: [
          {
            id: 7,
            user_id: "user_1",
            domain: "example.com",
            is_free: 1,
            scan_frequency: "monthly",
            last_scanned_at: null,
            last_grade: null,
            created_at: 1700000000,
          },
        ],
        writes,
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");

      const res = await app.request("/dashboard/domain/example.com/scan", {
        method: "POST",
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/dashboard/domain/example.com");

      const insertSql = writes.find((w) =>
        w.sql.includes("INSERT INTO scan_history"),
      );
      expect(insertSql).toBeDefined();
      expect(insertSql?.bindings[0]).toBe(7); // domain_id
      expect(insertSql?.bindings[1]).toBe("B"); // grade

      const updateSql = writes.find((w) =>
        w.sql.includes("UPDATE domains SET last_grade"),
      );
      expect(updateSql).toBeDefined();
      expect(updateSql?.bindings[0]).toBe("B");
    });
  });

  describe("POST /dashboard/settings/email-alerts", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/settings/email-alerts", {
        method: "POST",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("flips email_alerts_enabled to 0 when checkbox is unchecked", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({ writes });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");

      const res = await app.request("/dashboard/settings/email-alerts", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      });

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/dashboard/settings");
      const update = writes.find((w) =>
        w.sql.includes("UPDATE users SET email_alerts_enabled"),
      );
      expect(update?.bindings[0]).toBe(0);
    });

    it("flips email_alerts_enabled to 1 when checkbox is checked", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({ writes });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");

      const res = await app.request("/dashboard/settings/email-alerts", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "enabled=on",
      });

      expect(res.status).toBe(302);
      const update = writes.find((w) =>
        w.sql.includes("UPDATE users SET email_alerts_enabled"),
      );
      expect(update?.bindings[0]).toBe(1);
    });
  });

  describe("POST /dashboard/settings/webhook", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/settings/webhook", {
        method: "POST",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("redirects to /dashboard/settings after saving webhook", async () => {
      const db = createMockDB({ webhooks: [] });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const body = new URLSearchParams({
        webhookUrl: "https://example.com/hook",
      });
      const res = await app.request("/dashboard/settings/webhook", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/dashboard/settings");
    });
  });
});
