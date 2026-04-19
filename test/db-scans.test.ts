import { beforeEach, describe, expect, it } from "vitest";
import {
  getScanHistory,
  recordScan,
  type ScanHistoryRow,
} from "../src/db/scans.js";

interface DomainRow {
  id: number;
  last_grade: string | null;
  last_scanned_at: number | null;
}

let scanStore: Map<number, ScanHistoryRow>;
let domainStore: Map<number, DomainRow>;
let nextScanId: number;

function makeD1Mock(): D1Database {
  const prepare = (sql: string) => {
    return {
      bind: (...params: unknown[]) => ({
        sql,
        params,
        run: async () => {
          if (/^INSERT INTO scan_history/i.test(sql)) {
            const [domainId, grade, scoreFactors, protocolResults, scannedAt] =
              params as [number, string, string, string, number];
            const id = nextScanId++;
            scanStore.set(id, {
              id,
              domain_id: domainId,
              grade,
              score_factors: scoreFactors,
              protocol_results: protocolResults,
              scanned_at: scannedAt,
            });
          } else if (/^UPDATE domains SET last_grade/i.test(sql)) {
            const [grade, scannedAt, domainId] = params as [
              string,
              number,
              number,
            ];
            const row = domainStore.get(domainId);
            if (row) {
              domainStore.set(domainId, {
                ...row,
                last_grade: grade,
                last_scanned_at: scannedAt,
              });
            }
          }
          return { success: true };
        },
        all: async <T>(): Promise<{ results: T[] }> => {
          if (/FROM scan_history WHERE domain_id = \?/i.test(sql)) {
            const [domainId, limit] = params as [number, number];
            const results = [...scanStore.values()]
              .filter((r) => r.domain_id === domainId)
              .sort((a, b) => b.scanned_at - a.scanned_at)
              .slice(0, limit) as T[];
            return { results };
          }
          return { results: [] };
        },
      }),
    };
  };

  return {
    prepare,
    batch: async (
      stmts: Array<{ run: () => Promise<{ success: boolean }> }>,
    ) => {
      const out = [];
      for (const stmt of stmts) {
        out.push(await stmt.run());
      }
      return out;
    },
  } as unknown as D1Database;
}

describe("db/scans", () => {
  let db: D1Database;

  beforeEach(() => {
    scanStore = new Map();
    domainStore = new Map([
      [42, { id: 42, last_grade: null, last_scanned_at: null }],
    ]);
    nextScanId = 1;
    db = makeD1Mock();
  });

  describe("recordScan", () => {
    it("inserts history row and updates domain summary in one batch", async () => {
      await recordScan(db, {
        domainId: 42,
        grade: "B",
        scoreFactors: { dmarc: "pass", spf: "warn" },
        protocolResults: { dmarc: { status: "pass" } },
        scannedAt: 1_700_000_000,
      });

      expect(scanStore.size).toBe(1);
      const row = [...scanStore.values()][0];
      expect(row.domain_id).toBe(42);
      expect(row.grade).toBe("B");
      expect(row.score_factors).toBe(
        JSON.stringify({ dmarc: "pass", spf: "warn" }),
      );
      expect(row.protocol_results).toBe(
        JSON.stringify({ dmarc: { status: "pass" } }),
      );
      expect(row.scanned_at).toBe(1_700_000_000);

      const domain = domainStore.get(42);
      expect(domain?.last_grade).toBe("B");
      expect(domain?.last_scanned_at).toBe(1_700_000_000);
    });

    it("defaults scannedAt to current unix time when omitted", async () => {
      const before = Math.floor(Date.now() / 1000);
      await recordScan(db, {
        domainId: 42,
        grade: "A",
        scoreFactors: null,
        protocolResults: null,
      });
      const after = Math.floor(Date.now() / 1000);

      const row = [...scanStore.values()][0];
      expect(row.scanned_at).toBeGreaterThanOrEqual(before);
      expect(row.scanned_at).toBeLessThanOrEqual(after);
    });

    it("serializes null payloads safely", async () => {
      await recordScan(db, {
        domainId: 42,
        grade: "F",
        scoreFactors: undefined,
        protocolResults: undefined,
        scannedAt: 1,
      });
      const row = [...scanStore.values()][0];
      expect(row.score_factors).toBe("null");
      expect(row.protocol_results).toBe("null");
    });
  });

  describe("getScanHistory", () => {
    it("returns newest first, respects limit", async () => {
      for (let i = 0; i < 5; i++) {
        await recordScan(db, {
          domainId: 42,
          grade: "A",
          scoreFactors: null,
          protocolResults: null,
          scannedAt: 1000 + i,
        });
      }
      const history = await getScanHistory(db, 42, 3);
      expect(history).toHaveLength(3);
      expect(history.map((r) => r.scanned_at)).toEqual([1004, 1003, 1002]);
    });

    it("ignores scans for other domains", async () => {
      domainStore.set(99, { id: 99, last_grade: null, last_scanned_at: null });
      await recordScan(db, {
        domainId: 99,
        grade: "C",
        scoreFactors: null,
        protocolResults: null,
        scannedAt: 500,
      });
      const history = await getScanHistory(db, 42);
      expect(history).toHaveLength(0);
    });
  });
});
