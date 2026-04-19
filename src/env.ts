export interface Env {
  DB: D1Database;
  WORKOS_CLIENT_ID: string;
  WORKOS_CLIENT_SECRET: string;
  WORKOS_REDIRECT_URI: string;
  SESSION_SECRET: string;
  SENTRY_DSN?: string;
}
