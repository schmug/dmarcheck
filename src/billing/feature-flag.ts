import type { Env } from "../env.js";

export interface BillingEnv {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID_PRO: string;
}

// Returns true when all three Stripe secrets are present. Every billing route
// and webhook handler must gate on this before doing anything — a self-host
// deploy with no Stripe config must still boot with the free tier intact.
export function isBillingEnabled(env: Env): env is Env & BillingEnv {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRICE_ID_PRO,
  );
}
