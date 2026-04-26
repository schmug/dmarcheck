import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkResultEntry } from "../src/api/bulk-scan.js";
import { fireBulkScanWebhooks } from "../src/webhooks/triggers.js";

interface FakeWebhookRow {
  id: number;
  user_id: string;
  url: string;
  secret: string | null;
  format: "raw" | "slack" | "google_chat";
  created_at: number;
}

let webhooksByUser: Map<string, FakeWebhookRow>;
let deliveriesInserted: number;

function makeDb(): D1Database {
  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      first: async <T>() => {
        if (/^SELECT \* FROM webhooks WHERE user_id = \?/i.test(sql)) {
          const [userId] = params as [string];
          return (webhooksByUser.get(userId) as T | undefined) ?? null;
        }
        return null;
      },
      run: async () => {
        if (/^INSERT INTO webhook_deliveries/i.test(sql)) {
          deliveriesInserted += 1;
        }
        return { meta: {} } as never;
      },
      all: async <T>() => ({ results: [] as T[] }),
    }),
  });
  return { prepare } as unknown as D1Database;
}

beforeEach(() => {
  webhooksByUser = new Map();
  deliveriesInserted = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webhooks/triggers.fireBulkScanWebhooks", () => {
  it("dispatches all scan.completed webhooks concurrently rather than serially", async () => {
    webhooksByUser.set("u1", {
      id: 1,
      user_id: "u1",
      url: "https://hook.example/receive",
      secret: "shhh",
      format: "raw",
      created_at: 0,
    });

    // Track in-flight fetch count to prove concurrency: if dispatch is
    // serial, max in-flight will be 1; if parallel, it climbs to N.
    let inFlight = 0;
    let maxInFlight = 0;
    let resolveAll: (() => void) | null = null;
    const allStarted = new Promise<void>((resolve) => {
      resolveAll = resolve;
    });
    const STARTED_THRESHOLD = 5;

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        if (inFlight >= STARTED_THRESHOLD && resolveAll) {
          const r = resolveAll;
          resolveAll = null;
          r();
        }
        // Hold each fetch open until all 5 are observed in-flight. A serial
        // implementation would deadlock here; a parallel one resolves.
        await allStarted;
        inFlight -= 1;
        return new Response("", { status: 202 });
      });

    const db = makeDb();
    const results: BulkResultEntry[] = Array.from({ length: 5 }, (_, i) => ({
      domain: `example${i}.com`,
      status: "scanned",
      grade: "A",
    })) as BulkResultEntry[];

    await fireBulkScanWebhooks(db, "u1", results, "dashboard");

    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(maxInFlight).toBe(5);
    expect(deliveriesInserted).toBe(5);
  });

  it("skips entries that did not produce a scanned grade", async () => {
    webhooksByUser.set("u1", {
      id: 1,
      user_id: "u1",
      url: "https://hook.example/receive",
      secret: "shhh",
      format: "raw",
      created_at: 0,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 202 }));

    const db = makeDb();
    const results: BulkResultEntry[] = [
      { domain: "ok.example", status: "scanned", grade: "A" },
      { domain: "queued.example", status: "queued" },
      { domain: "invalid.example", status: "invalid", reason: "format" },
      { domain: "errored.example", status: "error", error: "boom" },
    ] as BulkResultEntry[];

    await fireBulkScanWebhooks(db, "u1", results, "bulk_api");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(deliveriesInserted).toBe(1);
  });

  it("does not let one failed dispatch abort the rest of the batch", async () => {
    webhooksByUser.set("u1", {
      id: 1,
      user_id: "u1",
      url: "https://hook.example/receive",
      secret: "shhh",
      format: "raw",
      created_at: 0,
    });

    let call = 0;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        call += 1;
        if (call === 2) throw new Error("ECONNRESET");
        return new Response("", { status: 202 });
      });

    const db = makeDb();
    const results: BulkResultEntry[] = Array.from({ length: 3 }, (_, i) => ({
      domain: `example${i}.com`,
      status: "scanned",
      grade: "B",
    })) as BulkResultEntry[];

    await fireBulkScanWebhooks(db, "u1", results, "dashboard");

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    // Every attempt — including the rejected one — must be recorded.
    expect(deliveriesInserted).toBe(3);
  });
});
