import { describe, expect, it } from "vitest";
import {
  constructWebhookEvent,
  StripeSignatureError,
} from "../src/billing/stripe.js";

const SECRET = "whsec_test_0123456789";
const BODY = JSON.stringify({
  id: "evt_test_1",
  type: "customer.subscription.created",
  data: {
    object: {
      id: "sub_test_1",
      customer: "cus_test_1",
      status: "active",
    },
  },
});

// Produces a Stripe-Signature header identical to what Stripe would send.
async function signStripePayload(
  secret: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

describe("billing/stripe.constructWebhookEvent", () => {
  it("accepts a valid signature and returns the parsed event", async () => {
    const ts = 1_700_000_000;
    const header = await signStripePayload(SECRET, ts, BODY);

    const event = await constructWebhookEvent(BODY, header, SECRET, ts);

    expect(event.id).toBe("evt_test_1");
    expect(event.type).toBe("customer.subscription.created");
    expect(event.data.object.status).toBe("active");
  });

  it("rejects a missing header", async () => {
    await expect(constructWebhookEvent(BODY, null, SECRET)).rejects.toThrow(
      StripeSignatureError,
    );
  });

  it("rejects a malformed header", async () => {
    await expect(
      constructWebhookEvent(BODY, "nonsense", SECRET),
    ).rejects.toThrow(StripeSignatureError);
  });

  it("rejects a tampered body (same sig, different payload)", async () => {
    const ts = 1_700_000_000;
    const header = await signStripePayload(SECRET, ts, BODY);
    const tampered = BODY.replace('"active"', '"canceled"');

    await expect(
      constructWebhookEvent(tampered, header, SECRET, ts),
    ).rejects.toThrow(StripeSignatureError);
  });

  it("rejects the wrong secret", async () => {
    const ts = 1_700_000_000;
    const header = await signStripePayload("whsec_other", ts, BODY);

    await expect(
      constructWebhookEvent(BODY, header, SECRET, ts),
    ).rejects.toThrow(StripeSignatureError);
  });

  it("rejects a timestamp outside the 5-minute tolerance", async () => {
    const ts = 1_700_000_000;
    const header = await signStripePayload(SECRET, ts, BODY);

    // Simulate "now" 6 minutes after the signed timestamp
    await expect(
      constructWebhookEvent(BODY, header, SECRET, ts + 6 * 60),
    ).rejects.toThrow(/timestamp outside tolerance/);
  });

  it("accepts multiple v1 signatures and matches any", async () => {
    const ts = 1_700_000_000;
    const good = await signStripePayload(SECRET, ts, BODY);
    const sigPart = good.split(",")[1]; // "v1=..."
    // Stripe rotates secrets by sending multiple v1 signatures simultaneously.
    const header = `t=${ts},v1=deadbeef,${sigPart}`;

    const event = await constructWebhookEvent(BODY, header, SECRET, ts);
    expect(event.id).toBe("evt_test_1");
  });

  it("rejects a syntactically valid header with no v1 signature", async () => {
    await expect(
      constructWebhookEvent(BODY, "t=1700000000", SECRET, 1_700_000_000),
    ).rejects.toThrow(/malformed/);
  });
});
