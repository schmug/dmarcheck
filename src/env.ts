export interface Env {
  DB: D1Database;
  WORKOS_CLIENT_ID: string;
  WORKOS_CLIENT_SECRET: string;
  WORKOS_REDIRECT_URI: string;
  SESSION_SECRET: string;
  SENTRY_DSN?: string;
  // Cloudflare Email Sending binding. Optional so self-host deploys without
  // a verified sender still boot; the dispatcher no-ops when absent.
  EMAIL?: SendEmail;
  // Stripe billing (Phase 3 M2). All three must be present for billing to
  // activate; isBillingEnabled() in src/billing/feature-flag.ts gates paid
  // code paths so self-hosters without Stripe keys still get a working
  // free-tier deploy.
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID_PRO?: string;
}
