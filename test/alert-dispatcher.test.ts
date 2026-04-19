import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchPendingAlerts } from "../src/alerts/dispatcher.js";
import type { Env } from "../src/env.js";

interface AlertRow {
  id: number;
  domain_id: number;
  user_id: string;
  domain: string;
  alert_type: string;
  previous_value: string | null;
  new_value: string | null;
  notified_via: string | null;
  created_at: number;
}

interface UserRow {
  id: string;
  email: string;
  email_domain: string;
  stripe_customer_id: string | null;
  api_key: string | null;
  email_alerts_enabled: number;
  created_at: number;
}

let alerts: Map<number, AlertRow>;
let users: Map<string, UserRow>;

function makeD1Mock(): D1Database {
  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      first: async <T>() => {
        if (sql.includes("SELECT * FROM users WHERE id")) {
          const [id] = params as [string];
          return (users.get(id) ?? null) as T | null;
        }
        return null as T | null;
      },
      all: async <T>(): Promise<{ results: T[] }> => {
        if (/FROM alerts[\s\S]*JOIN domains/i.test(sql)) {
          const [limit] = params as [number];
          const rows = [...alerts.values()]
            .filter((a) => a.notified_via === null)
            .sort((a, b) => a.created_at - b.created_at)
            .slice(0, limit);
          return { results: rows as T[] };
        }
        return { results: [] };
      },
      run: async () => {
        if (/^UPDATE alerts SET notified_via/i.test(sql)) {
          const [channel, id] = params as [string, number];
          const row = alerts.get(id);
          if (row) alerts.set(id, { ...row, notified_via: channel });
        }
        return { success: true };
      },
    }),
  });
  return { prepare } as unknown as D1Database;
}

function makeEnv(opts: {
  hasEmailBinding?: boolean;
  sendImpl?: SendEmail["send"];
}): Env {
  const email: SendEmail | undefined = opts.hasEmailBinding
    ? ({
        send:
          opts.sendImpl ??
          vi.fn().mockResolvedValue({ messageId: "msg-fake-1" }),
      } as SendEmail)
    : undefined;
  return {
    DB: makeD1Mock(),
    WORKOS_CLIENT_ID: "",
    WORKOS_CLIENT_SECRET: "",
    WORKOS_REDIRECT_URI: "",
    SESSION_SECRET: "test-secret",
    EMAIL: email,
  };
}

function seedAlert(id: number, overrides: Partial<AlertRow> = {}): void {
  alerts.set(id, {
    id,
    domain_id: 1,
    user_id: "user_1",
    domain: "example.com",
    alert_type: "grade_drop",
    previous_value: "A",
    new_value: "C",
    notified_via: null,
    created_at: 1_700_000_000 + id,
    ...overrides,
  });
}

function seedUser(overrides: Partial<UserRow> = {}): void {
  const id = overrides.id ?? "user_1";
  users.set(id, {
    id,
    email: "alice@example.com",
    email_domain: "example.com",
    stripe_customer_id: null,
    api_key: null,
    email_alerts_enabled: 1,
    created_at: 1,
    ...overrides,
  });
}

describe("alerts/dispatchPendingAlerts", () => {
  beforeEach(() => {
    alerts = new Map();
    users = new Map();
  });

  it("no-ops when there are no unsent alerts", async () => {
    const env = makeEnv({ hasEmailBinding: true });
    const result = await dispatchPendingAlerts(env);
    expect(result).toEqual({ considered: 0, sent: 0, skipped: 0, errors: 0 });
  });

  it("sends an email and marks the alert notified_via='email'", async () => {
    seedAlert(1);
    seedUser();
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg-1" });
    const env = makeEnv({ hasEmailBinding: true, sendImpl: sendMock });

    const result = await dispatchPendingAlerts(env);

    expect(result.sent).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("alice@example.com");
    expect(call.from).toBe("alerts@dmarc.mx");
    expect(call.subject).toContain("example.com");
    expect(call.html).toContain("example.com");
    expect(alerts.get(1)?.notified_via).toBe("email");
  });

  it("is idempotent — a second dispatch with no new alerts does nothing", async () => {
    seedAlert(1);
    seedUser();
    const sendMock = vi.fn().mockResolvedValue({ messageId: "m" });
    const env = makeEnv({ hasEmailBinding: true, sendImpl: sendMock });

    await dispatchPendingAlerts(env);
    sendMock.mockClear();
    const result = await dispatchPendingAlerts(env);

    expect(result.considered).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips users who opted out and marks the alert 'skipped:opt_out'", async () => {
    seedAlert(1);
    seedUser({ email_alerts_enabled: 0 });
    const sendMock = vi.fn();
    const env = makeEnv({ hasEmailBinding: true, sendImpl: sendMock });

    const result = await dispatchPendingAlerts(env);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
    expect(alerts.get(1)?.notified_via).toBe("skipped:opt_out");
  });

  it("skips orphaned alerts (user deleted) without crashing", async () => {
    seedAlert(1, { user_id: "ghost" });
    const env = makeEnv({ hasEmailBinding: true });

    const result = await dispatchPendingAlerts(env);

    expect(result.skipped).toBe(1);
    expect(alerts.get(1)?.notified_via).toBe("skipped:no_user");
  });

  it("leaves alerts unsent when the EMAIL binding is missing", async () => {
    seedAlert(1);
    seedUser();
    const env = makeEnv({ hasEmailBinding: false });

    const result = await dispatchPendingAlerts(env);

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    // Row NOT marked — so a later run (once the binding is configured) can
    // retry delivery.
    expect(alerts.get(1)?.notified_via).toBeNull();
  });

  it("counts send failures as errors and leaves the alert unsent for retry", async () => {
    seedAlert(1);
    seedUser();
    const sendMock = vi.fn().mockRejectedValue(new Error("E_RATE_LIMIT"));
    const env = makeEnv({ hasEmailBinding: true, sendImpl: sendMock });

    const result = await dispatchPendingAlerts(env);

    expect(result.errors).toBe(1);
    expect(result.sent).toBe(0);
    expect(alerts.get(1)?.notified_via).toBeNull();
  });

  it("includes a signed unsubscribe link in the sent email", async () => {
    seedAlert(1);
    seedUser();
    const sendMock = vi.fn().mockResolvedValue({ messageId: "m" });
    const env = makeEnv({ hasEmailBinding: true, sendImpl: sendMock });

    await dispatchPendingAlerts(env);

    const call = sendMock.mock.calls[0][0];
    expect(call.text).toMatch(/\/alerts\/unsubscribe\?token=[\w.-]+/);
    expect(call.html).toMatch(/\/alerts\/unsubscribe\?token=[\w.-]+/);
  });
});
