import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hmacSha256Hex } from "../src/shared/hmac.js";
import { dispatchWebhook } from "../src/webhooks/dispatcher.js";

interface FakeWebhookRow {
  id: number;
  user_id: string;
  url: string;
  secret: string | null;
  created_at: number;
}

interface DeliveryRow {
  user_id: string;
  webhook_id: number;
  event_id: string;
  event_type: string;
  url: string;
  status_code: number | null;
  ok: number;
  error: string | null;
  request_body_sha256: string;
}

let webhooksByUser: Map<string, FakeWebhookRow>;
let deliveries: DeliveryRow[];

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
          const [
            userId,
            webhookId,
            eventId,
            eventType,
            url,
            statusCode,
            ok,
            error,
            sha,
          ] = params as [
            string,
            number,
            string,
            string,
            string,
            number | null,
            number,
            string | null,
            string,
          ];
          deliveries.push({
            user_id: userId,
            webhook_id: webhookId,
            event_id: eventId,
            event_type: eventType,
            url,
            status_code: statusCode,
            ok,
            error,
            request_body_sha256: sha,
          });
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
  deliveries = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webhooks/dispatcher.dispatchWebhook", () => {
  it("returns null and does not fetch when the user has no webhook configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const db = makeDb();

    const result = await dispatchWebhook(db, "user-without-hook", {
      type: "webhook.test",
      data: { message: "ping" },
    });

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(deliveries).toHaveLength(0);
  });

  it("POSTs a signed envelope and records a successful delivery", async () => {
    webhooksByUser.set("u1", {
      id: 42,
      user_id: "u1",
      url: "https://hook.example/receive",
      secret: "shhh",
      created_at: 0,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 202 }));
    const db = makeDb();

    const result = await dispatchWebhook(
      db,
      "u1",
      { type: "webhook.test", data: { message: "ping" } },
      { now: 1_700_000_000 },
    );

    expect(result?.ok).toBe(true);
    expect(result?.status).toBe(202);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://hook.example/receive");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    const sig = headers["Dmarcheck-Signature"];
    expect(sig).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);

    const body = String(init.body);
    const envelope = JSON.parse(body) as {
      id: string;
      type: string;
      created: number;
      data: { message: string };
    };
    expect(envelope.type).toBe("webhook.test");
    expect(envelope.created).toBe(1_700_000_000);
    expect(envelope.id).toMatch(/^evt_/);
    expect(envelope.data.message).toBe("ping");

    // Signature must validate against the webhook's secret.
    const expectedV1 = await hmacSha256Hex("shhh", `1700000000.${body}`);
    expect(sig).toBe(`t=1700000000,v1=${expectedV1}`);

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].ok).toBe(1);
    expect(deliveries[0].status_code).toBe(202);
    expect(deliveries[0].webhook_id).toBe(42);
    expect(deliveries[0].event_type).toBe("webhook.test");
    expect(deliveries[0].request_body_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("records a failed delivery when the receiver returns 500", async () => {
    webhooksByUser.set("u1", {
      id: 7,
      user_id: "u1",
      url: "https://hook.example/receive",
      secret: "shhh",
      created_at: 0,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );
    const db = makeDb();

    const result = await dispatchWebhook(db, "u1", {
      type: "webhook.test",
      data: { message: "ping" },
    });

    expect(result?.ok).toBe(false);
    expect(result?.status).toBe(500);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].ok).toBe(0);
    expect(deliveries[0].status_code).toBe(500);
  });

  it("records a failed delivery when fetch throws (network/timeout)", async () => {
    webhooksByUser.set("u1", {
      id: 9,
      user_id: "u1",
      url: "https://hook.example/receive",
      secret: "shhh",
      created_at: 0,
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const db = makeDb();

    const result = await dispatchWebhook(db, "u1", {
      type: "webhook.test",
      data: { message: "ping" },
    });

    expect(result?.ok).toBe(false);
    expect(result?.status).toBeNull();
    expect(result?.error).toMatch(/ECONNREFUSED/);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].ok).toBe(0);
    expect(deliveries[0].status_code).toBeNull();
    expect(deliveries[0].error).toMatch(/ECONNREFUSED/);
  });

  it("skips dispatch and records an error when the webhook row has no secret", async () => {
    webhooksByUser.set("u1", {
      id: 11,
      user_id: "u1",
      url: "https://hook.example/receive",
      secret: null,
      created_at: 0,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const db = makeDb();

    const result = await dispatchWebhook(db, "u1", {
      type: "webhook.test",
      data: { message: "ping" },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/secret/i);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].ok).toBe(0);
    expect(deliveries[0].status_code).toBeNull();
  });
});
