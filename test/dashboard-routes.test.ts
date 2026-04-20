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
    email_alerts_enabled: number;
    api_key_retirement_acknowledged_at: number | null;
    created_at: number;
  }>;
  scanHistory?: Array<{
    grade: string;
    scanned_at: number;
    protocol_results?: string | null;
    score_factors?: string | null;
    id?: number;
    domain_id?: number;
  }>;
  subscriptions?: Array<{
    user_id: string;
    status: string;
  }>;
  webhooks?: Array<{
    id: number;
    user_id: string;
    url: string;
    secret: string;
  }>;
  apiKeys?: Array<{
    id: string;
    user_id: string;
    name: string | null;
    prefix: string;
    hash: string;
    created_at: number;
    last_used_at: number | null;
    revoked_at: number | null;
  }>;
  writes?: Array<{ sql: string; bindings: unknown[] }>;
}) {
  const domains = data.domains ?? [];
  const users = data.users ?? [];
  const scanHistory = data.scanHistory ?? [];
  const webhooks = data.webhooks ?? [];
  const apiKeys = data.apiKeys ?? [];
  const subscriptions = data.subscriptions ?? [];
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
      if (sql.includes("SELECT status FROM subscriptions")) {
        const sub = subscriptions.find((s) => s.user_id === bindings[0]);
        return (sub ? { status: sub.status } : null) as T | null;
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
      if (sql.includes("SELECT * FROM scan_history")) {
        const [, limit] = bindings as [number, number];
        const sorted = [...scanHistory].sort(
          (a, b) => b.scanned_at - a.scanned_at,
        );
        return {
          results: sorted.slice(0, limit).map((r, i) => ({
            id: r.id ?? i + 1,
            domain_id: r.domain_id ?? 1,
            grade: r.grade,
            score_factors: r.score_factors ?? null,
            protocol_results: r.protocol_results ?? null,
            scanned_at: r.scanned_at,
          })) as T[],
        };
      }
      if (sql.includes("SELECT * FROM api_keys WHERE user_id")) {
        return {
          results: apiKeys.filter((k) => k.user_id === bindings[0]) as T[],
        };
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
      app.request(
        url,
        init,
        { SESSION_SECRET: SECRET, DB: db },
        // Stub ExecutionContext so handlers that fire-and-forget writes via
        // `c.executionCtx.waitUntil(...)` don't blow up in tests.
        {
          waitUntil: () => {},
          passThroughOnException: () => {},
        } as ExecutionContext,
      ),
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
            email_alerts_enabled: 1,
            api_key_retirement_acknowledged_at: 1700000000,
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

  describe("GET /dashboard/domain/:domain/history", () => {
    const domainFixture = {
      id: 1,
      user_id: "user_1",
      domain: "example.com",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: 1700000000,
      last_grade: "B",
      created_at: 1700000000,
    };

    const makeScan = (
      at: number,
      grade: string,
      statuses: Record<string, string>,
    ) => ({
      grade,
      scanned_at: at,
      protocol_results: JSON.stringify(
        Object.fromEntries(
          Object.entries(statuses).map(([k, v]) => [k, { status: v }]),
        ),
      ),
    });

    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/domain/example.com/history");
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("returns 404 when the domain does not belong to the user", async () => {
      const db = createMockDB({ domains: [] });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/notmine.com/history", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });

    it("renders the full 30-row table and no upgrade prompt for Pro users", async () => {
      const scans = Array.from({ length: 12 }, (_, i) =>
        makeScan(1_700_000_000 + i * 86_400, "B", {
          dmarc: "pass",
          spf: "pass",
          dkim: "pass",
          bimi: "warn",
          mta_sts: "pass",
        }),
      );
      const db = createMockDB({
        domains: [domainFixture],
        scanHistory: scans,
        subscriptions: [{ user_id: "user_1", status: "active" }],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/example.com/history", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("History — example.com");
      expect(body).toContain("Protocol drift");
      expect(body).toContain("Grade trend");
      expect(body).not.toContain("Upgrade to see the full history");
      // Should render a sparkline SVG
      expect(body).toContain("sparkline-line");
      // All 12 scans show up (there's at least 12 distinct status-pass dots
      // since every scan has multiple pass protocols).
      const rowCount = (body.match(/class="drift-date"/g) || []).length;
      expect(rowCount).toBe(12);
    });

    it("shows an upgrade prompt for free users", async () => {
      const scans = Array.from({ length: 10 }, (_, i) =>
        makeScan(1_700_000_000 + i * 86_400, "C", {
          dmarc: "warn",
          spf: "pass",
          dkim: "pass",
          bimi: "fail",
          mta_sts: "pass",
        }),
      );
      const db = createMockDB({
        domains: [domainFixture],
        scanHistory: scans,
        // no subscriptions row → free plan
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/example.com/history", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Upgrade to see the full history");
      expect(body).toContain("/dashboard/billing/subscribe");
      // Free users get only 5 rows even when 10 scans exist.
      const rowCount = (body.match(/class="drift-date"/g) || []).length;
      expect(rowCount).toBe(5);
    });

    it("treats a cancelled subscription as free", async () => {
      const db = createMockDB({
        domains: [domainFixture],
        scanHistory: [
          makeScan(1_700_000_000, "A", {
            dmarc: "pass",
            spf: "pass",
            dkim: "pass",
            bimi: "pass",
            mta_sts: "pass",
          }),
        ],
        subscriptions: [{ user_id: "user_1", status: "canceled" }],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/example.com/history", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Upgrade to see the full history");
    });

    it("handles domains with no scans yet without crashing", async () => {
      const db = createMockDB({
        domains: [domainFixture],
        scanHistory: [],
        subscriptions: [{ user_id: "user_1", status: "active" }],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/example.com/history", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("No scans yet to chart");
      expect(body).toContain("No scans yet.");
    });

    it("marks protocol-status transitions with drift-changed", async () => {
      const db = createMockDB({
        domains: [domainFixture],
        scanHistory: [
          // newest first: dmarc regressed pass→fail between the two scans
          makeScan(1_700_000_100, "F", {
            dmarc: "fail",
            spf: "pass",
            dkim: "pass",
            bimi: "pass",
            mta_sts: "pass",
          }),
          makeScan(1_700_000_000, "A", {
            dmarc: "pass",
            spf: "pass",
            dkim: "pass",
            bimi: "pass",
            mta_sts: "pass",
          }),
        ],
        subscriptions: [{ user_id: "user_1", status: "active" }],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/example.com/history", {
        headers: { Cookie: cookie },
      });
      const body = await res.text();
      expect(body).toContain("drift-changed");
      expect(body).toContain('title="changed from pass"');
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
            email_alerts_enabled: 1,
            api_key_retirement_acknowledged_at: 1700000000,
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

    it("links to the API keys management page (hashed-key flow)", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            email_alerts_enabled: 1,
            api_key_retirement_acknowledged_at: 1700000000,
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
      expect(body).toContain("/dashboard/settings/api-keys");
      expect(body).toContain("Manage API Keys");
    });

    it("renders the retirement banner when the user has not acked", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            email_alerts_enabled: 1,
            api_key_retirement_acknowledged_at: null,
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
      expect(body).toContain("API key was retired");
    });

    it("shows webhook URL when one is configured", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            email_alerts_enabled: 1,
            api_key_retirement_acknowledged_at: 1700000000,
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

  describe("GET /dashboard/settings/api-keys", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/settings/api-keys");
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("lists existing keys by prefix and omits raw values on a normal visit", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            email_alerts_enabled: 1,
            api_key_retirement_acknowledged_at: 1700000000,
            created_at: 1700000000,
          },
        ],
        apiKeys: [
          {
            id: "k1",
            user_id: "user_1",
            name: "ci-pipeline",
            prefix: "dmk_abcd1234",
            hash: "a".repeat(64),
            created_at: 1700000000,
            last_used_at: null,
            revoked_at: null,
          },
        ],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/settings/api-keys", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("ci-pipeline");
      expect(body).toContain("dmk_abcd1234");
      expect(body).toContain("Active");
      expect(body).not.toContain("Save this key now");
    });

    it("shows the raw key banner only on the created=1 redirect", async () => {
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            email_alerts_enabled: 1,
            api_key_retirement_acknowledged_at: 1700000000,
            created_at: 1700000000,
          },
        ],
        apiKeys: [],
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const raw = `dmk_${"a".repeat(32)}`;
      const res = await app.request(
        `/dashboard/settings/api-keys?created=1&raw=${encodeURIComponent(raw)}`,
        { headers: { Cookie: cookie } },
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Save this key now");
      expect(body).toContain(raw);
    });

    it("acks the retirement banner via waitUntil on first visit", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            email_domain: "example.com",
            stripe_customer_id: null,
            email_alerts_enabled: 1,
            api_key_retirement_acknowledged_at: null,
            created_at: 1700000000,
          },
        ],
        writes,
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/settings/api-keys", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("old API key was retired");
      // Ack is scheduled via waitUntil; in tests we can observe the write.
      const ack = writes.find((w) =>
        w.sql.includes("UPDATE users SET api_key_retirement_acknowledged_at"),
      );
      expect(ack).toBeDefined();
    });
  });

  describe("POST /dashboard/settings/api-keys/generate", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/settings/api-keys/generate", {
        method: "POST",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("creates an api_keys row and redirects with the raw key in the query string (shown once)", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({ writes });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");

      const res = await app.request("/dashboard/settings/api-keys/generate", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "name=ci-pipeline",
      });

      expect(res.status).toBe(303);
      const loc = res.headers.get("Location") ?? "";
      expect(loc.startsWith("/dashboard/settings/api-keys?")).toBe(true);
      expect(loc).toContain("created=1");
      expect(loc).toContain("raw=dmk_");

      const insert = writes.find((w) => w.sql.includes("INSERT INTO api_keys"));
      expect(insert).toBeDefined();
      // bindings: id, userId, name, prefix, hash
      expect(insert?.bindings[1]).toBe("user_1");
      expect(insert?.bindings[2]).toBe("ci-pipeline");
      expect(String(insert?.bindings[3] ?? "")).toMatch(/^dmk_.{8}$/);
      expect(String(insert?.bindings[4] ?? "")).toMatch(/^[0-9a-f]{64}$/);
    });

    it("stores name as null when the form field is blank", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({ writes });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");

      const res = await app.request("/dashboard/settings/api-keys/generate", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "name=",
      });
      expect(res.status).toBe(303);

      const insert = writes.find((w) => w.sql.includes("INSERT INTO api_keys"));
      expect(insert?.bindings[2]).toBeNull();
    });
  });

  describe("POST /dashboard/settings/api-keys/revoke", () => {
    it("writes UPDATE api_keys SET revoked_at keyed on id + user_id", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({ writes });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");

      const res = await app.request("/dashboard/settings/api-keys/revoke", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "id=some-key-id",
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/dashboard/settings/api-keys");

      const update = writes.find(
        (w) =>
          w.sql.includes("UPDATE api_keys") && w.sql.includes("revoked_at"),
      );
      expect(update).toBeDefined();
      expect(update?.bindings).toEqual(["some-key-id", "user_1"]);
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

  describe("GET /dashboard/domain/add", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/domain/add");
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("renders the add-domain form with a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/add", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Add Domain");
      expect(body).toContain('name="domain"');
    });
  });

  describe("POST /dashboard/domain/add", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/domain/add", {
        method: "POST",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("rejects an invalid domain with 400 and re-renders the form", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const body = new URLSearchParams({ domain: "not a domain" });
      const res = await app.request("/dashboard/domain/add", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain("valid domain");
    });

    it("creates the domain and 303-redirects to the detail page", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({ writes });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const body = new URLSearchParams({ domain: "example.com" });
      const res = await app.request("/dashboard/domain/add", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/dashboard/domain/example.com");
      const inserted = writes.find((w) =>
        w.sql.includes("INSERT INTO domains"),
      );
      expect(inserted).toBeDefined();
      expect(inserted?.bindings).toEqual([
        "user_1",
        "example.com",
        0, // isFree=false → 0
        "weekly",
      ]);
    });

    it("does not create a duplicate when the user already owns the domain", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
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
            created_at: 1_700_000_000,
          },
        ],
        writes,
      });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const body = new URLSearchParams({ domain: "example.com" });
      const res = await app.request("/dashboard/domain/add", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/dashboard/domain/example.com");
      const inserted = writes.find((w) =>
        w.sql.includes("INSERT INTO domains"),
      );
      expect(inserted).toBeUndefined();
    });

    it("normalizes protocol-prefixed input to a bare domain", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({ writes });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const body = new URLSearchParams({
        domain: "https://Example.COM/path",
      });
      const res = await app.request("/dashboard/domain/add", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/dashboard/domain/example.com");
      const inserted = writes.find((w) =>
        w.sql.includes("INSERT INTO domains"),
      );
      expect(inserted?.bindings[1]).toBe("example.com");
    });
  });

  describe("POST /dashboard/domain/:domain/delete", () => {
    it("redirects to /auth/login without a session cookie", async () => {
      const db = createMockDB({});
      const app = createTestApp(db);
      const res = await app.request("/dashboard/domain/example.com/delete", {
        method: "POST",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/auth/login");
    });

    it("deletes the domain and 303-redirects to /dashboard", async () => {
      const writes: Array<{ sql: string; bindings: unknown[] }> = [];
      const db = createMockDB({ writes });
      const app = createTestApp(db);
      const cookie = await makeSessionCookie("user_1", "alice@example.com");
      const res = await app.request("/dashboard/domain/example.com/delete", {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/dashboard");
      const deleted = writes.find((w) => w.sql.includes("DELETE FROM domains"));
      expect(deleted).toBeDefined();
      expect(deleted?.bindings).toEqual(["user_1", "example.com"]);
    });
  });
});
