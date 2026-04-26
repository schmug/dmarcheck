import { afterEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "../src/billing/stripe.js";

const ENV = {
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_PRICE_ID_PRO: "price_pro_test",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("billing/stripe.createCheckoutSession", () => {
  it("requests Stripe Checkout with allow_promotion_codes enabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "cs_test_1", url: "https://stripe" }), {
        status: 200,
      }),
    );

    const result = await createCheckoutSession(ENV, {
      customerId: "cus_test_1",
      successUrl: "https://app/success",
      cancelUrl: "https://app/cancel",
      userId: "user-1",
    });

    expect(result.id).toBe("cs_test_1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const params = new URLSearchParams(String(init.body));
    expect(params.get("allow_promotion_codes")).toBe("true");
    // Sanity-check the rest of the request hasn't been broken.
    expect(params.get("mode")).toBe("subscription");
    expect(params.get("customer")).toBe("cus_test_1");
    expect(params.get("line_items[0][price]")).toBe("price_pro_test");
    expect(params.get("subscription_data[metadata][user_id]")).toBe("user-1");
  });
});
