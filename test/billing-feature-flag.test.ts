import { describe, expect, it } from "vitest";
import { isBillingEnabled } from "../src/billing/feature-flag.js";
import type { Env } from "../src/env.js";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    WORKOS_CLIENT_ID: "x",
    WORKOS_CLIENT_SECRET: "x",
    WORKOS_REDIRECT_URI: "x",
    SESSION_SECRET: "x",
    ...overrides,
  };
}

describe("billing/feature-flag", () => {
  it("returns false when no Stripe env vars are set", () => {
    expect(isBillingEnabled(makeEnv())).toBe(false);
  });

  it("returns false when only some Stripe vars are set", () => {
    expect(isBillingEnabled(makeEnv({ STRIPE_SECRET_KEY: "sk_test_x" }))).toBe(
      false,
    );
    expect(
      isBillingEnabled(
        makeEnv({
          STRIPE_SECRET_KEY: "sk_test_x",
          STRIPE_WEBHOOK_SECRET: "whsec_x",
        }),
      ),
    ).toBe(false);
  });

  it("returns true when all three Stripe vars are set", () => {
    expect(
      isBillingEnabled(
        makeEnv({
          STRIPE_SECRET_KEY: "sk_test_x",
          STRIPE_WEBHOOK_SECRET: "whsec_x",
          STRIPE_PRICE_ID_PRO: "price_x",
        }),
      ),
    ).toBe(true);
  });

  it("treats empty strings as not set (Workers pattern)", () => {
    expect(
      isBillingEnabled(
        makeEnv({
          STRIPE_SECRET_KEY: "",
          STRIPE_WEBHOOK_SECRET: "",
          STRIPE_PRICE_ID_PRO: "",
        }),
      ),
    ).toBe(false);
  });
});
