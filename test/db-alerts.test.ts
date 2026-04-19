import { beforeEach, describe, expect, it } from "vitest";
import {
  type AlertRow,
  listUnsentAlerts,
  markAlertNotified,
  recordAlert,
} from "../src/db/alerts.js";

let alertStore: Map<number, AlertRow>;
let domainStore: Map<number, { id: number; user_id: string; domain: string }>;
let nextId: number;

function makeD1Mock(): D1Database {
  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      run: async () => {
        if (/^INSERT INTO alerts/i.test(sql)) {
          const [domainId, type, prevVal, newVal, createdAt] = params as [
            number,
            string,
            string,
            string,
            number,
          ];
          const id = nextId++;
          alertStore.set(id, {
            id,
            domain_id: domainId,
            alert_type: type,
            previous_value: prevVal,
            new_value: newVal,
            notified_via: null,
            created_at: createdAt,
          });
        } else if (/^UPDATE alerts SET notified_via/i.test(sql)) {
          const [channel, id] = params as [string, number];
          const row = alertStore.get(id);
          if (row) alertStore.set(id, { ...row, notified_via: channel });
        }
        return { success: true };
      },
      all: async <T>(): Promise<{ results: T[] }> => {
        if (/FROM alerts[\s\S]*JOIN domains/i.test(sql)) {
          const [limit] = params as [number];
          const rows = [...alertStore.values()]
            .filter((a) => a.notified_via === null)
            .sort((a, b) => a.created_at - b.created_at)
            .slice(0, limit)
            .map((a) => {
              const d = domainStore.get(a.domain_id);
              return {
                ...a,
                user_id: d?.user_id ?? "",
                domain: d?.domain ?? "",
              };
            });
          return { results: rows as T[] };
        }
        return { results: [] };
      },
    }),
  });
  return { prepare } as unknown as D1Database;
}

describe("db/alerts", () => {
  let db: D1Database;

  beforeEach(() => {
    alertStore = new Map();
    domainStore = new Map([
      [7, { id: 7, user_id: "user_1", domain: "example.com" }],
      [9, { id: 9, user_id: "user_2", domain: "other.com" }],
    ]);
    nextId = 1;
    db = makeD1Mock();
  });

  describe("recordAlert", () => {
    it("inserts a grade_drop alert with the given values", async () => {
      await recordAlert(db, {
        domainId: 7,
        type: "grade_drop",
        previousValue: "A",
        newValue: "C",
        createdAt: 1_700_000_000,
      });

      expect(alertStore.size).toBe(1);
      const row = [...alertStore.values()][0];
      expect(row.domain_id).toBe(7);
      expect(row.alert_type).toBe("grade_drop");
      expect(row.previous_value).toBe("A");
      expect(row.new_value).toBe("C");
      expect(row.notified_via).toBeNull();
      expect(row.created_at).toBe(1_700_000_000);
    });

    it("defaults createdAt to current unix time", async () => {
      const before = Math.floor(Date.now() / 1000);
      await recordAlert(db, {
        domainId: 7,
        type: "protocol_regression",
        previousValue: "dmarc:pass",
        newValue: "dmarc:fail",
      });
      const after = Math.floor(Date.now() / 1000);
      const row = [...alertStore.values()][0];
      expect(row.created_at).toBeGreaterThanOrEqual(before);
      expect(row.created_at).toBeLessThanOrEqual(after);
    });
  });

  describe("listUnsentAlerts", () => {
    it("returns only alerts with notified_via IS NULL, oldest first", async () => {
      await recordAlert(db, {
        domainId: 7,
        type: "grade_drop",
        previousValue: "A",
        newValue: "B",
        createdAt: 100,
      });
      await recordAlert(db, {
        domainId: 9,
        type: "grade_drop",
        previousValue: "B",
        newValue: "C",
        createdAt: 50,
      });
      await recordAlert(db, {
        domainId: 7,
        type: "grade_drop",
        previousValue: "C",
        newValue: "D",
        createdAt: 200,
      });

      await markAlertNotified(db, 1, "email");

      const unsent = await listUnsentAlerts(db);
      expect(unsent.map((a) => a.id)).toEqual([2, 3]);
      expect(unsent[0].user_id).toBe("user_2");
      expect(unsent[0].domain).toBe("other.com");
    });

    it("respects the limit", async () => {
      for (let i = 0; i < 5; i++) {
        await recordAlert(db, {
          domainId: 7,
          type: "grade_drop",
          previousValue: "A",
          newValue: "B",
          createdAt: 100 + i,
        });
      }
      const unsent = await listUnsentAlerts(db, 2);
      expect(unsent).toHaveLength(2);
    });
  });

  describe("markAlertNotified", () => {
    it("sets notified_via on the target row only", async () => {
      await recordAlert(db, {
        domainId: 7,
        type: "grade_drop",
        previousValue: "A",
        newValue: "B",
        createdAt: 100,
      });
      await recordAlert(db, {
        domainId: 7,
        type: "grade_drop",
        previousValue: "B",
        newValue: "C",
        createdAt: 101,
      });

      await markAlertNotified(db, 1, "email");

      expect(alertStore.get(1)?.notified_via).toBe("email");
      expect(alertStore.get(2)?.notified_via).toBeNull();
    });
  });
});
