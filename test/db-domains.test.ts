import { beforeEach, describe, expect, it } from "vitest";
import {
  createDomain,
  type Domain,
  deleteDomain,
  getDomainByUserAndName,
  getDomainsByUser,
  updateLastScan,
} from "../src/db/domains.js";

// In-memory store for mock D1
let store: Map<number, Domain>;
let nextId: number;

function makeD1Mock(): D1Database {
  const prepare = (sql: string) => {
    return {
      bind: (...params: unknown[]) => {
        return {
          run: async () => {
            if (/^INSERT INTO domains/i.test(sql)) {
              const [userId, domain, isFree, scanFrequency] = params as [
                string,
                string,
                number,
                string,
              ];
              const id = nextId++;
              store.set(id, {
                id,
                user_id: userId,
                domain,
                is_free: isFree,
                scan_frequency: scanFrequency,
                last_scanned_at: null,
                last_grade: null,
                created_at: Math.floor(Date.now() / 1000),
              });
            } else if (/^DELETE FROM domains/i.test(sql)) {
              const [userId, domain] = params as [string, string];
              for (const [id, row] of store.entries()) {
                if (row.user_id === userId && row.domain === domain) {
                  store.delete(id);
                  break;
                }
              }
            } else if (/^UPDATE domains SET last_grade/i.test(sql)) {
              const [grade, scannedAt, domainId] = params as [
                string,
                number,
                number,
              ];
              const row = store.get(domainId);
              if (row) {
                store.set(domainId, {
                  ...row,
                  last_grade: grade,
                  last_scanned_at: scannedAt,
                });
              }
            }
            return { success: true };
          },
          first: async <T>(): Promise<T | null> => {
            if (/WHERE user_id = \? AND domain = \?/i.test(sql)) {
              const [userId, domain] = params as [string, string];
              for (const row of store.values()) {
                if (row.user_id === userId && row.domain === domain) {
                  return row as T;
                }
              }
              return null;
            }
            return null;
          },
          all: async <T>(): Promise<{ results: T[] }> => {
            if (/WHERE user_id = \? ORDER BY created_at/i.test(sql)) {
              const [userId] = params as [string];
              const results = [...store.values()]
                .filter((row) => row.user_id === userId)
                .sort((a, b) => a.created_at - b.created_at) as T[];
              return { results };
            }
            return { results: [] };
          },
        };
      },
    };
  };

  return { prepare } as unknown as D1Database;
}

describe("db/domains", () => {
  let db: D1Database;

  beforeEach(() => {
    store = new Map();
    nextId = 1;
    db = makeD1Mock();
  });

  describe("createDomain + getDomainsByUser", () => {
    it("creates a free domain and retrieves it with monthly frequency", async () => {
      await createDomain(db, {
        userId: "user-1",
        domain: "example.com",
        isFree: true,
      });
      const domains = await getDomainsByUser(db, "user-1");

      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe("example.com");
      expect(domains[0].user_id).toBe("user-1");
      expect(domains[0].is_free).toBe(1);
      expect(domains[0].scan_frequency).toBe("monthly");
      expect(domains[0].last_scanned_at).toBeNull();
      expect(domains[0].last_grade).toBeNull();
    });

    it("creates a paid domain with weekly frequency", async () => {
      await createDomain(db, {
        userId: "user-2",
        domain: "paid.com",
        isFree: false,
      });
      const domains = await getDomainsByUser(db, "user-2");

      expect(domains).toHaveLength(1);
      expect(domains[0].is_free).toBe(0);
      expect(domains[0].scan_frequency).toBe("weekly");
    });

    it("returns only domains belonging to the given user", async () => {
      await createDomain(db, {
        userId: "user-1",
        domain: "alice.com",
        isFree: true,
      });
      await createDomain(db, {
        userId: "user-2",
        domain: "bob.com",
        isFree: false,
      });

      const user1Domains = await getDomainsByUser(db, "user-1");
      expect(user1Domains).toHaveLength(1);
      expect(user1Domains[0].domain).toBe("alice.com");
    });
  });

  describe("getDomainByUserAndName", () => {
    it("retrieves a domain by user and name", async () => {
      await createDomain(db, {
        userId: "user-1",
        domain: "lookup.com",
        isFree: true,
      });
      const domain = await getDomainByUserAndName(db, "user-1", "lookup.com");

      expect(domain).not.toBeNull();
      expect(domain?.domain).toBe("lookup.com");
      expect(domain?.user_id).toBe("user-1");
    });

    it("returns null for a non-existent domain", async () => {
      const domain = await getDomainByUserAndName(db, "user-1", "notfound.com");
      expect(domain).toBeNull();
    });

    it("returns null when the domain belongs to a different user", async () => {
      await createDomain(db, {
        userId: "user-1",
        domain: "someone-elses.com",
        isFree: true,
      });
      const domain = await getDomainByUserAndName(
        db,
        "user-2",
        "someone-elses.com",
      );
      expect(domain).toBeNull();
    });
  });

  describe("deleteDomain", () => {
    it("deletes a domain so it no longer appears in queries", async () => {
      await createDomain(db, {
        userId: "user-1",
        domain: "to-delete.com",
        isFree: true,
      });
      expect(await getDomainsByUser(db, "user-1")).toHaveLength(1);

      await deleteDomain(db, "user-1", "to-delete.com");

      expect(await getDomainsByUser(db, "user-1")).toHaveLength(0);
      expect(
        await getDomainByUserAndName(db, "user-1", "to-delete.com"),
      ).toBeNull();
    });

    it("only deletes the matching domain, leaving others intact", async () => {
      await createDomain(db, {
        userId: "user-1",
        domain: "keep.com",
        isFree: true,
      });
      await createDomain(db, {
        userId: "user-1",
        domain: "remove.com",
        isFree: true,
      });

      await deleteDomain(db, "user-1", "remove.com");

      const remaining = await getDomainsByUser(db, "user-1");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].domain).toBe("keep.com");
    });
  });

  describe("updateLastScan", () => {
    it("updates last_grade and last_scanned_at for a domain", async () => {
      await createDomain(db, {
        userId: "user-1",
        domain: "scan.com",
        isFree: false,
      });
      const domains = await getDomainsByUser(db, "user-1");
      const domainId = domains[0].id;
      const scannedAt = 1700000000;

      await updateLastScan(db, domainId, "A", scannedAt);

      const updated = await getDomainByUserAndName(db, "user-1", "scan.com");
      expect(updated?.last_grade).toBe("A");
      expect(updated?.last_scanned_at).toBe(scannedAt);
    });

    it("can update scan info multiple times, keeping the latest values", async () => {
      await createDomain(db, {
        userId: "user-1",
        domain: "rescan.com",
        isFree: false,
      });
      const domains = await getDomainsByUser(db, "user-1");
      const domainId = domains[0].id;

      await updateLastScan(db, domainId, "B", 1700000000);
      await updateLastScan(db, domainId, "A+", 1700001000);

      const updated = await getDomainByUserAndName(db, "user-1", "rescan.com");
      expect(updated?.last_grade).toBe("A+");
      expect(updated?.last_scanned_at).toBe(1700001000);
    });
  });
});
