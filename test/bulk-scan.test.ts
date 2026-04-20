import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BULK_IN_BAND_CAP,
  BULK_TOTAL_CAP,
  isCapExceeded,
  processBulkScan,
} from "../src/api/bulk-scan.js";

interface DomainRow {
  id: number;
  user_id: string;
  domain: string;
  is_free: number;
  scan_frequency: string;
  last_scanned_at: number | null;
  last_grade: string | null;
}

interface ScanHistoryRow {
  domain_id: number;
  grade: string;
  scanned_at: number;
}

let domainStore: DomainRow[];
let scanHistory: ScanHistoryRow[];
let nextId: number;

// recordScan uses db.batch([prepare(...).bind(...), prepare(...).bind(...)]).
// To make that resolve in tests, .bind() returns a thunk that captures sql +
// params and `batch` invokes each thunk's `run`. .first() also reads from the
// captured sql/params.
function makeDb(): D1Database {
  type BoundStmt = {
    sql: string;
    params: unknown[];
    run: () => Promise<{ success: true; meta: { changes: number } }>;
    first: <T>() => Promise<T | null>;
  };

  const applyWrite = async (sql: string, params: unknown[]) => {
    if (/^INSERT INTO domains/i.test(sql)) {
      const [userId, domain, isFree, frequency] = params as [
        string,
        string,
        number,
        string,
      ];
      domainStore.push({
        id: nextId++,
        user_id: userId,
        domain,
        is_free: isFree,
        scan_frequency: frequency,
        last_scanned_at: null,
        last_grade: null,
      });
    } else if (/^INSERT INTO scan_history/i.test(sql)) {
      const [domainId, grade, , , scannedAt] = params as [
        number,
        string,
        string,
        string,
        number,
      ];
      scanHistory.push({ domain_id: domainId, grade, scanned_at: scannedAt });
    } else if (/^UPDATE domains SET last_grade/i.test(sql)) {
      const [grade, scannedAt, domainId] = params as [string, number, number];
      const row = domainStore.find((d) => d.id === domainId);
      if (row) {
        row.last_grade = grade;
        row.last_scanned_at = scannedAt;
      }
    }
    return { success: true as const, meta: { changes: 1 } };
  };

  const makeBound = (sql: string, params: unknown[]): BoundStmt => ({
    sql,
    params,
    run: () => applyWrite(sql, params),
    first: async <T>() => {
      if (/SELECT \* FROM domains WHERE user_id = \? AND domain/i.test(sql)) {
        return (domainStore.find(
          (d) => d.user_id === params[0] && d.domain === params[1],
        ) ?? null) as T | null;
      }
      return null as T | null;
    },
  });

  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => makeBound(sql, params),
    }),
    batch: async (stmts: BoundStmt[]) => {
      const out = [];
      for (const stmt of stmts) {
        out.push(await stmt.run());
      }
      return out;
    },
  } as unknown as D1Database;
}

const okScan = (domain: string) => ({
  grade: "B",
  breakdown: { factors: [{ name: "dmarc", status: "pass" }] },
  protocols: { dmarc: { status: "pass" } },
  domain,
});

beforeEach(() => {
  domainStore = [];
  scanHistory = [];
  nextId = 1;
});

describe("processBulkScan", () => {
  it("rejects when more than BULK_TOTAL_CAP domains submitted", async () => {
    const tooMany = Array.from(
      { length: BULK_TOTAL_CAP + 1 },
      (_, i) => `d${i}.example`,
    );
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: tooMany,
      scanFn: vi.fn(async (d) => okScan(d)),
    });
    expect(isCapExceeded(out)).toBe(true);
    if (isCapExceeded(out)) {
      expect(out.cap).toBe(BULK_TOTAL_CAP);
      expect(out.submitted).toBe(BULK_TOTAL_CAP + 1);
    }
  });

  it("returns one invalid entry per malformed input, dedup'd", async () => {
    const scanFn = vi.fn(async (d: string) => okScan(d));
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: ["not a domain", "not a domain", "  ", "@@@"],
      scanFn,
    });
    if (isCapExceeded(out)) throw new Error("unexpected cap");
    expect(out.results.filter((r) => r.status === "invalid")).toHaveLength(2);
    expect(out.accepted).toBe(0);
    expect(scanFn).not.toHaveBeenCalled();
  });

  it("scans valid domains in-band (status=scanned, with grade)", async () => {
    const scanFn = vi.fn(async (d: string) => okScan(d));
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: ["a.example", "b.example", "c.example"],
      scanFn,
    });
    if (isCapExceeded(out)) throw new Error("unexpected cap");
    expect(out.accepted).toBe(3);
    expect(out.rejected).toBe(0);
    const scanned = out.results.filter((r) => r.status === "scanned");
    expect(scanned).toHaveLength(3);
    expect(scanned.every((r) => r.grade === "B")).toBe(true);
    expect(scanHistory).toHaveLength(3);
    expect(domainStore).toHaveLength(3);
    expect(domainStore.every((d) => d.is_free === 0)).toBe(true);
  });

  it("queues anything beyond inBandCap and flips status=queued", async () => {
    const scanFn = vi.fn(async (d: string) => okScan(d));
    const submitted = Array.from({ length: 35 }, (_, i) => `d${i}.example`);
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: submitted,
      scanFn,
      inBandCap: 30,
      batchSize: 10,
    });
    if (isCapExceeded(out)) throw new Error("unexpected cap");
    expect(out.accepted).toBe(35);
    expect(out.rejected).toBe(0);
    const scanned = out.results.filter((r) => r.status === "scanned");
    const queued = out.results.filter((r) => r.status === "queued");
    expect(scanned).toHaveLength(30);
    expect(queued).toHaveLength(5);
    // Queued entries land as watchlist rows with last_scanned_at = null so the
    // cron picks them up on the next pass (NULLS FIRST in getDueDomains).
    for (const q of queued) {
      const row = domainStore.find((d) => d.domain === q.domain);
      expect(row).toBeDefined();
      expect(row?.last_scanned_at).toBeNull();
    }
    expect(scanHistory).toHaveLength(30);
  });

  it("isolates per-domain scan failures", async () => {
    const scanFn = vi.fn(async (d: string) => {
      if (d === "broken.example") throw new Error("DNS exploded");
      return okScan(d);
    });
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: ["a.example", "broken.example", "c.example"],
      scanFn,
      batchSize: 10,
    });
    if (isCapExceeded(out)) throw new Error("unexpected cap");
    const scanned = out.results.filter((r) => r.status === "scanned");
    const errors = out.results.filter((r) => r.status === "error");
    expect(scanned.map((r) => r.domain).sort()).toEqual([
      "a.example",
      "c.example",
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].domain).toBe("broken.example");
    expect(out.accepted).toBe(2);
    expect(out.rejected).toBe(1);
  });

  it("reuses an existing watchlist row instead of creating a duplicate", async () => {
    domainStore.push({
      id: 99,
      user_id: "user_1",
      domain: "already.example",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: 1700000000,
      last_grade: "A",
    });
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: ["already.example"],
      scanFn: async (d) => okScan(d),
    });
    if (isCapExceeded(out)) throw new Error("unexpected cap");
    expect(
      domainStore.filter(
        (d) => d.user_id === "user_1" && d.domain === "already.example",
      ),
    ).toHaveLength(1);
    expect(scanHistory).toHaveLength(1);
    expect(scanHistory[0].domain_id).toBe(99);
  });

  it("normalizes input and dedupes (case + whitespace)", async () => {
    const scanFn = vi.fn(async (d: string) => okScan(d));
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: [
        "Example.com",
        "EXAMPLE.com",
        "example.com",
        "  example.com  ",
      ],
      scanFn,
    });
    if (isCapExceeded(out)) throw new Error("unexpected cap");
    const scanned = out.results.filter((r) => r.status === "scanned");
    expect(scanned).toHaveLength(1);
    expect(scanned[0].domain).toBe("example.com");
    expect(scanFn).toHaveBeenCalledTimes(1);
  });

  it("processes the full inBandCap when exactly at the limit", async () => {
    const scanFn = vi.fn(async (d: string) => okScan(d));
    const submitted = Array.from(
      { length: BULK_IN_BAND_CAP },
      (_, i) => `d${i}.example`,
    );
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: submitted,
      scanFn,
      batchSize: 10,
    });
    if (isCapExceeded(out)) throw new Error("unexpected cap");
    expect(out.accepted).toBe(BULK_IN_BAND_CAP);
    expect(scanFn).toHaveBeenCalledTimes(BULK_IN_BAND_CAP);
    expect(out.results.every((r) => r.status === "scanned")).toBe(true);
  });

  it("returns empty results for an empty submission", async () => {
    const out = await processBulkScan({
      db: makeDb(),
      userId: "user_1",
      rawDomains: [],
      scanFn: vi.fn(),
    });
    if (isCapExceeded(out)) throw new Error("unexpected cap");
    expect(out.accepted).toBe(0);
    expect(out.rejected).toBe(0);
    expect(out.results).toEqual([]);
  });
});
