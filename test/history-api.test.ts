import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub resolveBearer before importing app — keeps the route's bearer signal
// independent of api-key cryptography (mirrors test/bulk-scan-route.test.ts).
let bearerStub: { userId: string; keyId: string } | null = null;

vi.mock("../src/auth/api-key.js", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/api-key.js")>(
    "../src/auth/api-key.js",
  );
  return {
    ...actual,
    resolveBearer: vi.fn(async () => bearerStub),
  };
});

const { app } = await import("../src/index.js");

interface FakeDomain {
  id: number;
  user_id: string;
  domain: string;
  is_free: number;
  scan_frequency: string;
  last_scanned_at: number | null;
  last_grade: string | null;
}

interface FakeSubscription {
  user_id: string;
  status: string;
}

interface FakeScanRow {
  id: number;
  domain_id: number;
  grade: string;
  score_factors: string | null;
  protocol_results: string | null;
  scanned_at: number;
}

let domainStore: FakeDomain[];
let subStore: FakeSubscription[];
let scanStore: FakeScanRow[];
let nextId: number;

// Minimal D1 mock supporting subscription lookup, domain lookup, and the
// `getScanHistory` SELECT that `getScanHistoryWithProtocols` issues.
function makeDb(): D1Database {
  type Bound = {
    first: <T>() => Promise<T | null>;
    all: <T>() => Promise<{ results: T[] }>;
    run: () => Promise<{ success: true; meta: { changes: number } }>;
  };

  const makeBound = (sql: string, params: unknown[]): Bound => ({
    first: async <T>() => {
      if (sql.includes("SELECT status FROM subscriptions")) {
        const sub = subStore.find((s) => s.user_id === params[0]);
        return (sub ? { status: sub.status } : null) as T | null;
      }
      if (/SELECT \* FROM domains WHERE user_id = \? AND domain/i.test(sql)) {
        return (domainStore.find(
          (d) => d.user_id === params[0] && d.domain === params[1],
        ) ?? null) as T | null;
      }
      return null as T | null;
    },
    all: async <T>() => {
      if (/SELECT \* FROM scan_history WHERE domain_id/i.test(sql)) {
        const [domainId, limit] = params as [number, number];
        const results = scanStore
          .filter((r) => r.domain_id === domainId)
          .sort((a, b) => b.scanned_at - a.scanned_at)
          .slice(0, limit);
        return { results: results as T[] };
      }
      return { results: [] as T[] };
    },
    run: async () => ({ success: true as const, meta: { changes: 0 } }),
  });

  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => makeBound(sql, params),
    }),
    batch: async () => [],
  } as unknown as D1Database;
}

function fetchHistory(path: string) {
  return app.request(
    path,
    { method: "GET" },
    {
      DB: makeDb(),
      RATE_LIMIT_KV: undefined,
    } as unknown as Record<string, unknown>,
    {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ExecutionContext,
  );
}

// Helper to seed `n` scan rows for a given domain at descending timestamps.
function seedScans(
  domainId: number,
  n: number,
  options: { protocols?: Record<string, { status: string }> } = {},
) {
  const defaultProtocols = {
    dmarc: { status: "pass" },
    spf: { status: "pass" },
    dkim: { status: "warn" },
    bimi: { status: "fail" },
    mta_sts: { status: "pass" },
  };
  const protocols = options.protocols ?? defaultProtocols;
  const protocolResults = JSON.stringify(protocols);
  for (let i = 0; i < n; i++) {
    scanStore.push({
      id: nextId++,
      domain_id: domainId,
      grade: "B+",
      score_factors: null,
      protocol_results: protocolResults,
      scanned_at: 1_700_000_000 + i,
    });
  }
}

beforeEach(() => {
  domainStore = [];
  subStore = [];
  scanStore = [];
  nextId = 1;
  bearerStub = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/domain/:name/history", () => {
  it("returns 401 when no bearer is presented", async () => {
    const res = await fetchHistory("/api/domain/example.com/history");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/bearer/i);
  });

  it("returns 402 for a free-plan bearer (Pro gate) with an upgrade link", async () => {
    bearerStub = { userId: "user_free", keyId: "k1" };
    // No subscription row → free plan.
    const res = await fetchHistory("/api/domain/example.com/history");
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string; upgrade?: string };
    expect(body.error).toMatch(/Pro/i);
    expect(body.upgrade).toContain("/dashboard/billing/subscribe");
  });

  it("treats a cancelled subscription as free (returns 402)", async () => {
    bearerStub = { userId: "user_was_pro", keyId: "k1" };
    subStore.push({ user_id: "user_was_pro", status: "canceled" });
    const res = await fetchHistory("/api/domain/example.com/history");
    expect(res.status).toBe(402);
  });

  it("returns 400 for an invalid domain (IPv4 literal rejected by normalizeDomain)", async () => {
    bearerStub = { userId: "user_pro", keyId: "k1" };
    subStore.push({ user_id: "user_pro", status: "active" });
    const res = await fetchHistory("/api/domain/1.2.3.4/history");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 404 when the bearer does not own the domain", async () => {
    bearerStub = { userId: "user_pro", keyId: "k1" };
    subStore.push({ user_id: "user_pro", status: "active" });
    // Seed domain under a *different* user_id — proves the 404 isn't just
    // "no domain exists with this name" but "no domain exists for THIS user".
    domainStore.push({
      id: 1,
      user_id: "someone_else",
      domain: "other.example",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: null,
      last_grade: null,
    });
    seedScans(1, 5);
    const res = await fetchHistory("/api/domain/other.example/history");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    // Must not leak "exists but not yours" — same 404 either way.
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 with the expected shape for a pro bearer + owned domain", async () => {
    bearerStub = { userId: "user_pro", keyId: "k1" };
    subStore.push({ user_id: "user_pro", status: "active" });
    domainStore.push({
      id: 1,
      user_id: "user_pro",
      domain: "example.com",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: null,
      last_grade: null,
    });
    seedScans(1, 3);

    const res = await fetchHistory("/api/domain/example.com/history");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      domain: string;
      scans: Array<{
        scanned_at: number;
        grade: string;
        protocols: Record<string, string | null>;
      }>;
    };
    expect(body.domain).toBe("example.com");
    expect(body.scans).toHaveLength(3);
    // Most-recent-first ordering.
    expect(body.scans[0].scanned_at).toBeGreaterThan(body.scans[2].scanned_at);
    // Snake-case on the wire (camelCase would be a regression).
    expect(body.scans[0]).toHaveProperty("scanned_at");
    expect(body.scans[0]).not.toHaveProperty("scannedAt");
    expect(body.scans[0].grade).toBe("B+");
    // Exactly the five scored protocols — no `mx`, no extras.
    expect(Object.keys(body.scans[0].protocols).sort()).toEqual([
      "bimi",
      "dkim",
      "dmarc",
      "mta_sts",
      "spf",
    ]);
    expect(body.scans[0].protocols.dmarc).toBe("pass");
    expect(body.scans[0].protocols.bimi).toBe("fail");
  });

  it("never surfaces `mx` even when the stored protocol_results JSON contains it", async () => {
    bearerStub = { userId: "user_pro", keyId: "k1" };
    subStore.push({ user_id: "user_pro", status: "active" });
    domainStore.push({
      id: 1,
      user_id: "user_pro",
      domain: "example.com",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: null,
      last_grade: null,
    });
    // Stored results include mx (info-only) + a made-up extra protocol.
    seedScans(1, 1, {
      protocols: {
        dmarc: { status: "pass" },
        spf: { status: "pass" },
        dkim: { status: "pass" },
        bimi: { status: "pass" },
        mta_sts: { status: "pass" },
        mx: { status: "info" },
        future_proto: { status: "pass" },
      },
    });
    const res = await fetchHistory("/api/domain/example.com/history");
    const body = (await res.json()) as {
      scans: Array<{ protocols: Record<string, unknown> }>;
    };
    expect(Object.keys(body.scans[0].protocols).sort()).toEqual([
      "bimi",
      "dkim",
      "dmarc",
      "mta_sts",
      "spf",
    ]);
  });

  describe("limit clamping", () => {
    beforeEach(() => {
      bearerStub = { userId: "user_pro", keyId: "k1" };
      subStore.push({ user_id: "user_pro", status: "active" });
      domainStore.push({
        id: 1,
        user_id: "user_pro",
        domain: "example.com",
        is_free: 0,
        scan_frequency: "weekly",
        last_scanned_at: null,
        last_grade: null,
      });
    });

    it("clamps limit=0 up to 1", async () => {
      seedScans(1, 5);
      const res = await fetchHistory("/api/domain/example.com/history?limit=0");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { scans: unknown[] };
      expect(body.scans).toHaveLength(1);
    });

    it("clamps negative limits up to 1", async () => {
      seedScans(1, 5);
      const res = await fetchHistory(
        "/api/domain/example.com/history?limit=-5",
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { scans: unknown[] };
      expect(body.scans).toHaveLength(1);
    });

    it("clamps limit=9999 down to 100", async () => {
      seedScans(1, 150);
      const res = await fetchHistory(
        "/api/domain/example.com/history?limit=9999",
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { scans: unknown[] };
      expect(body.scans).toHaveLength(100);
    });

    it("falls back to the default (30) on a non-integer limit", async () => {
      seedScans(1, 50);
      const res = await fetchHistory(
        "/api/domain/example.com/history?limit=abc",
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { scans: unknown[] };
      expect(body.scans).toHaveLength(30);
    });

    it("uses the default (30) when limit is omitted", async () => {
      seedScans(1, 50);
      const res = await fetchHistory("/api/domain/example.com/history");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { scans: unknown[] };
      expect(body.scans).toHaveLength(30);
    });
  });
});
