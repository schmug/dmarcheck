import { beforeEach, describe, expect, it } from "vitest";
import {
  createDomain,
  type Domain,
  deleteDomain,
  getDomainByUserAndName,
  getDomainsByUser,
  listDomainsForUserPaged,
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

// Smarter mock for listDomainsForUserPaged that interprets the dynamic SQL
// (filters/order-by/limit) instead of pattern-matching the whole string. Lives
// here next to the tests so the coupling between the mock and the SQL the
// function emits is obvious.
function makePagedMock(seed: Domain[]): D1Database {
  const data: Domain[] = seed.map((d) => ({ ...d }));

  const gradeRank = (g: string | null): number => {
    const ranks: Record<string, number> = {
      "A+": 1,
      A: 2,
      "A-": 3,
      "B+": 4,
      B: 5,
      "B-": 6,
      "C+": 7,
      C: 8,
      "C-": 9,
      "D+": 10,
      D: 11,
      "D-": 12,
      F: 13,
    };
    if (g === null) return 99;
    return ranks[g] ?? 99;
  };

  const applyFilter = (sql: string, params: unknown[]): Domain[] => {
    let cursor = 0;
    const userId = params[cursor++] as string;
    let rows = data.filter((d) => d.user_id === userId);
    // Mirror SQLite's runtime check: ESCAPE expression must be a single
    // character. Catches the JS-string-literal trap where '\\\\' compiles to
    // two backslashes in the actual SQL and D1 rejects the whole query.
    const escapeMatch = sql.match(/ESCAPE '([^']*)'/);
    if (escapeMatch && escapeMatch[1].length !== 1) {
      throw new Error(
        `D1_ERROR: ESCAPE expression must be a single character: SQLITE_ERROR (got ${JSON.stringify(escapeMatch[1])})`,
      );
    }
    if (/LOWER\(domain\) LIKE \?/i.test(sql)) {
      const like = params[cursor++] as string;
      const inner = like.slice(1, -1).replace(/\\([\\%_])/g, "$1");
      rows = rows.filter((d) => d.domain.toLowerCase().includes(inner));
    }
    if (/last_grade IS NULL/i.test(sql)) {
      rows = rows.filter((d) => d.last_grade === null);
    } else if (/last_grade = \?/i.test(sql)) {
      const grade = params[cursor++] as string;
      rows = rows.filter((d) => d.last_grade === grade);
    }
    if (/scan_frequency = \?/i.test(sql)) {
      const freq = params[cursor++] as string;
      rows = rows.filter((d) => d.scan_frequency === freq);
    }
    return rows;
  };

  const applyOrder = (sql: string, rows: Domain[]): Domain[] => {
    const orderMatch = sql.match(/ORDER BY ([\s\S]+?) LIMIT/i);
    if (!orderMatch) return rows;
    const orderBy = orderMatch[1].trim();
    const desc = / DESC/i.test(orderBy);
    const sorted = [...rows];
    if (/CASE last_grade/i.test(orderBy)) {
      sorted.sort((a, b) => {
        const cmp = gradeRank(a.last_grade) - gradeRank(b.last_grade);
        return cmp !== 0
          ? desc
            ? -cmp
            : cmp
          : a.domain.localeCompare(b.domain);
      });
    } else if (/COALESCE\(last_scanned_at/i.test(orderBy)) {
      sorted.sort((a, b) => {
        const ax = a.last_scanned_at ?? 0;
        const bx = b.last_scanned_at ?? 0;
        const cmp = ax - bx;
        return cmp !== 0
          ? desc
            ? -cmp
            : cmp
          : a.domain.localeCompare(b.domain);
      });
    } else if (/created_at/i.test(orderBy)) {
      sorted.sort((a, b) => {
        const cmp = a.created_at - b.created_at;
        return cmp !== 0
          ? desc
            ? -cmp
            : cmp
          : a.domain.localeCompare(b.domain);
      });
    } else {
      sorted.sort((a, b) =>
        desc
          ? b.domain.localeCompare(a.domain)
          : a.domain.localeCompare(b.domain),
      );
    }
    return sorted;
  };

  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      all: async <T>(): Promise<{ results: T[] }> => {
        const filtered = applyFilter(sql, params);
        const ordered = applyOrder(sql, filtered);
        const limit = params[params.length - 2] as number;
        const offset = params[params.length - 1] as number;
        return { results: ordered.slice(offset, offset + limit) as T[] };
      },
      first: async <T>(): Promise<T | null> => {
        if (/^\s*SELECT COUNT/i.test(sql)) {
          const filtered = applyFilter(sql, params);
          return { n: filtered.length } as T;
        }
        return null;
      },
    }),
  });

  return { prepare } as unknown as D1Database;
}

describe("listDomainsForUserPaged", () => {
  const baseDomains: Domain[] = [
    {
      id: 1,
      user_id: "u1",
      domain: "alpha.com",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: 1700000000,
      last_grade: "A+",
      created_at: 1690000000,
    },
    {
      id: 2,
      user_id: "u1",
      domain: "beta.com",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: 1700050000,
      last_grade: "F",
      created_at: 1690001000,
    },
    {
      id: 3,
      user_id: "u1",
      domain: "gamma.example.com",
      is_free: 0,
      scan_frequency: "monthly",
      last_scanned_at: null,
      last_grade: null,
      created_at: 1690002000,
    },
    {
      id: 4,
      user_id: "u1",
      domain: "delta.io",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: 1700100000,
      last_grade: "B",
      created_at: 1690003000,
    },
    {
      id: 5,
      user_id: "u2",
      domain: "stranger.com",
      is_free: 0,
      scan_frequency: "weekly",
      last_scanned_at: 1700000000,
      last_grade: "A",
      created_at: 1690000500,
    },
  ];

  it("returns rows + total scoped to the user", async () => {
    const db = makePagedMock(baseDomains);
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      limit: 25,
      offset: 0,
    });
    expect(page.total).toBe(4);
    expect(page.rows.map((r) => r.domain)).toEqual([
      "alpha.com",
      "beta.com",
      "delta.io",
      "gamma.example.com",
    ]);
  });

  it("filters by case-insensitive domain substring", async () => {
    const db = makePagedMock(baseDomains);
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      search: "EXAMPLE",
      limit: 25,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.rows[0].domain).toBe("gamma.example.com");
  });

  it("filters by exact grade", async () => {
    const db = makePagedMock(baseDomains);
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      grade: "F",
      limit: 25,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.rows[0].domain).toBe("beta.com");
  });

  it("filters by 'ungraded' (NULL last_grade)", async () => {
    const db = makePagedMock(baseDomains);
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      grade: "ungraded",
      limit: 25,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.rows[0].domain).toBe("gamma.example.com");
  });

  it("filters by frequency", async () => {
    const db = makePagedMock(baseDomains);
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      frequency: "monthly",
      limit: 25,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.rows[0].domain).toBe("gamma.example.com");
  });

  it("sorts by grade ascending (A+ first, ungraded last)", async () => {
    const db = makePagedMock(baseDomains);
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      sort: "grade",
      direction: "asc",
      limit: 25,
      offset: 0,
    });
    expect(page.rows.map((r) => r.last_grade)).toEqual(["A+", "B", "F", null]);
  });

  it("sorts by last_scanned descending (most recent first)", async () => {
    const db = makePagedMock(baseDomains);
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      sort: "last_scanned",
      direction: "desc",
      limit: 25,
      offset: 0,
    });
    expect(page.rows.map((r) => r.domain)).toEqual([
      "delta.io",
      "beta.com",
      "alpha.com",
      "gamma.example.com",
    ]);
  });

  it("paginates via limit/offset while reporting full total", async () => {
    const db = makePagedMock(baseDomains);
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      limit: 2,
      offset: 2,
    });
    expect(page.total).toBe(4);
    expect(page.rows.map((r) => r.domain)).toEqual([
      "delta.io",
      "gamma.example.com",
    ]);
  });

  it("LIKE wildcards from user input are escaped (no '%' bypass)", async () => {
    const evil: Domain[] = [
      {
        id: 10,
        user_id: "u1",
        domain: "literal100pct.com",
        is_free: 0,
        scan_frequency: "weekly",
        last_scanned_at: null,
        last_grade: null,
        created_at: 1690000000,
      },
      {
        id: 11,
        user_id: "u1",
        domain: "other.com",
        is_free: 0,
        scan_frequency: "weekly",
        last_scanned_at: null,
        last_grade: null,
        created_at: 1690000000,
      },
    ];
    const db = makePagedMock(evil);
    // Searching for the literal "%" (which would otherwise be a wildcard) must
    // only match domains containing a literal '%' character — there are none.
    const page = await listDomainsForUserPaged(db, {
      userId: "u1",
      search: "%",
      limit: 25,
      offset: 0,
    });
    expect(page.total).toBe(0);
    expect(page.rows).toHaveLength(0);
  });
});
