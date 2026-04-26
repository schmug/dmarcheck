import { beforeEach, describe, expect, it } from "vitest";
import {
  getPlanForUser,
  getSubscriptionByUserId,
  recordStripeEventOnce,
  type Subscription,
  statusToPlan,
  upsertSubscription,
} from "../src/db/subscriptions.js";

// Minimal in-memory D1 mock targeted at the subscriptions + stripe_events
// SQL used by src/db/subscriptions.ts. Modeled after test/db-users.test.ts.
function makeD1Mock(): {
  db: D1Database;
  subs: Map<string, Subscription>;
  events: Set<string>;
} {
  const subs = new Map<string, Subscription>();
  const events = new Set<string>();
  let nextId = 1;

  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      run: async () => {
        if (/^INSERT INTO subscriptions/i.test(sql)) {
          const [
            user_id,
            stripe_subscription_id,
            stripe_price_id,
            status,
            current_period_end,
            cancel_at_period_end,
          ] = params as [string, string, string, string, number | null, number];
          const now = Math.floor(Date.now() / 1000);
          const existing = subs.get(user_id);
          subs.set(user_id, {
            id: existing?.id ?? nextId++,
            user_id,
            stripe_subscription_id,
            stripe_price_id,
            status,
            current_period_end,
            cancel_at_period_end,
            created_at: existing?.created_at ?? now,
            updated_at: now,
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (/^INSERT OR IGNORE INTO stripe_events/i.test(sql)) {
          const [eventId] = params as [string];
          if (events.has(eventId)) {
            return { success: true, meta: { changes: 0 } };
          }
          events.add(eventId);
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 0 } };
      },
      first: async <T>(): Promise<T | null> => {
        if (/FROM subscriptions WHERE user_id = \?/i.test(sql)) {
          const [userId] = params as [string];
          const sub = subs.get(userId);
          if (!sub) return null;
          if (/^SELECT status FROM/i.test(sql)) {
            return { status: sub.status } as T;
          }
          return sub as T;
        }
        return null;
      },
    }),
  });

  return {
    db: { prepare } as unknown as D1Database,
    subs,
    events,
  };
}

describe("db/subscriptions.statusToPlan", () => {
  it("maps active statuses to 'pro'", () => {
    expect(statusToPlan("active")).toBe("pro");
    expect(statusToPlan("trialing")).toBe("pro");
    expect(statusToPlan("past_due")).toBe("pro");
  });

  it("maps canceled and unpaid to 'free'", () => {
    expect(statusToPlan("canceled")).toBe("free");
    expect(statusToPlan("unpaid")).toBe("free");
    expect(statusToPlan("incomplete")).toBe("free");
    expect(statusToPlan("incomplete_expired")).toBe("free");
  });

  it("maps null/undefined/empty to 'free'", () => {
    expect(statusToPlan(null)).toBe("free");
    expect(statusToPlan(undefined)).toBe("free");
    expect(statusToPlan("")).toBe("free");
  });
});

describe("db/subscriptions.upsertSubscription", () => {
  let db: D1Database;
  let subs: Map<string, Subscription>;

  beforeEach(() => {
    ({ db, subs } = makeD1Mock());
  });

  it("inserts a new subscription", async () => {
    await upsertSubscription(db, {
      user_id: "u1",
      stripe_subscription_id: "sub_1",
      stripe_price_id: "price_1",
      status: "active",
      current_period_end: 1_700_000_000,
      cancel_at_period_end: false,
    });

    const row = await getSubscriptionByUserId(db, "u1");
    expect(row).not.toBeNull();
    expect(row?.stripe_subscription_id).toBe("sub_1");
    expect(row?.status).toBe("active");
    expect(row?.cancel_at_period_end).toBe(0);
  });

  it("updates an existing subscription (idempotent on replay)", async () => {
    await upsertSubscription(db, {
      user_id: "u1",
      stripe_subscription_id: "sub_1",
      stripe_price_id: "price_1",
      status: "active",
      current_period_end: 1_700_000_000,
      cancel_at_period_end: false,
    });
    await upsertSubscription(db, {
      user_id: "u1",
      stripe_subscription_id: "sub_1",
      stripe_price_id: "price_1",
      status: "canceled",
      current_period_end: 1_700_000_000,
      cancel_at_period_end: true,
    });

    expect(subs.size).toBe(1);
    const row = await getSubscriptionByUserId(db, "u1");
    expect(row?.status).toBe("canceled");
    expect(row?.cancel_at_period_end).toBe(1);
  });
});

describe("db/subscriptions.getPlanForUser", () => {
  it("returns 'free' when no subscription row exists", async () => {
    const { db } = makeD1Mock();
    expect(await getPlanForUser(db, "unknown")).toBe("free");
  });

  it("returns 'pro' when status is active", async () => {
    const { db } = makeD1Mock();
    await upsertSubscription(db, {
      user_id: "u1",
      stripe_subscription_id: "sub_1",
      stripe_price_id: "price_1",
      status: "active",
      current_period_end: null,
      cancel_at_period_end: false,
    });
    expect(await getPlanForUser(db, "u1")).toBe("pro");
  });

  it("returns 'free' after a downgrade to canceled", async () => {
    const { db } = makeD1Mock();
    await upsertSubscription(db, {
      user_id: "u1",
      stripe_subscription_id: "sub_1",
      stripe_price_id: "price_1",
      status: "active",
      current_period_end: null,
      cancel_at_period_end: false,
    });
    await upsertSubscription(db, {
      user_id: "u1",
      stripe_subscription_id: "sub_1",
      stripe_price_id: "price_1",
      status: "canceled",
      current_period_end: null,
      cancel_at_period_end: false,
    });
    expect(await getPlanForUser(db, "u1")).toBe("free");
  });
});

describe("db/subscriptions.recordStripeEventOnce", () => {
  it("returns true the first time an event id is seen", async () => {
    const { db } = makeD1Mock();
    expect(await recordStripeEventOnce(db, "evt_1")).toBe(true);
  });

  it("returns false on a replay of the same event id", async () => {
    const { db } = makeD1Mock();
    expect(await recordStripeEventOnce(db, "evt_1")).toBe(true);
    expect(await recordStripeEventOnce(db, "evt_1")).toBe(false);
  });

  it("distinguishes different event ids", async () => {
    const { db } = makeD1Mock();
    expect(await recordStripeEventOnce(db, "evt_1")).toBe(true);
    expect(await recordStripeEventOnce(db, "evt_2")).toBe(true);
    expect(await recordStripeEventOnce(db, "evt_1")).toBe(false);
  });
});
