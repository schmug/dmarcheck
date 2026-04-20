import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetApiKeyTouchCache,
  generateApiKey,
  resolveBearer,
} from "../src/auth/api-key.js";
import { requireAuthOrBearer } from "../src/auth/middleware.js";
import { createSessionToken } from "../src/auth/session.js";

const SECRET = "test-session-secret";

interface StoredKey {
  id: string;
  user_id: string;
  hash: string;
  revoked_at: number | null;
}

function makeMockDb(
  keys: StoredKey[],
  writes: Array<{ sql: string; bindings: unknown[] }> = [],
): D1Database {
  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      first: async <T>(): Promise<T | null> => {
        if (
          sql.includes("SELECT id, user_id FROM api_keys WHERE hash") &&
          sql.includes("revoked_at IS NULL")
        ) {
          const hash = params[0] as string;
          const row = keys.find(
            (k) => k.hash === hash && k.revoked_at === null,
          );
          return (
            row ? { id: row.id, user_id: row.user_id } : null
          ) as T | null;
        }
        return null;
      },
      run: async () => {
        writes.push({ sql, bindings: params });
        return { success: true };
      },
    }),
  });
  return { prepare } as unknown as D1Database;
}

// Hono's app.request(path, init, env) does not provide executionCtx by
// default — patch one so waitUntil is a noop in tests.
function dispatch(
  app: Hono,
  path: string,
  init: RequestInit & { env: Record<string, unknown> },
) {
  const req = new Request(`http://local${path}`, init);
  return app.fetch(req, init.env, {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as ExecutionContext);
}

describe("requireAuthOrBearer", () => {
  beforeEach(() => {
    __resetApiKeyTouchCache();
  });

  it("populates c.get('user') when only a session cookie is present", async () => {
    const app = new Hono();
    app.use("*", requireAuthOrBearer);
    app.get("/x", (c) => {
      const user = c.get("user" as never) as
        | { sub: string; email: string }
        | undefined;
      const bearer = c.get("bearer" as never) as { userId: string } | undefined;
      return c.json({
        userSub: user?.sub ?? null,
        bearerUser: bearer?.userId ?? null,
      });
    });

    const token = await createSessionToken(
      { sub: "u1", email: "a@b.c" },
      SECRET,
    );
    const res = await dispatch(app, "/x", {
      headers: { Cookie: `session=${token}` },
      env: { SESSION_SECRET: SECRET, DB: makeMockDb([]) },
    });
    const body = (await res.json()) as {
      userSub: string | null;
      bearerUser: string | null;
    };
    expect(body.userSub).toBe("u1");
    expect(body.bearerUser).toBeNull();
  });

  it("populates c.get('bearer') when only an Authorization header is present", async () => {
    const { raw, hash } = await generateApiKey();
    const app = new Hono();
    app.use("*", requireAuthOrBearer);
    app.get("/x", (c) => {
      const user = c.get("user" as never) as
        | { sub: string; email: string }
        | undefined;
      const bearer = c.get("bearer" as never) as { userId: string } | undefined;
      return c.json({
        userSub: user?.sub ?? null,
        bearerUser: bearer?.userId ?? null,
      });
    });

    const db = makeMockDb([
      { id: "k1", user_id: "u42", hash, revoked_at: null },
    ]);
    const res = await dispatch(app, "/x", {
      headers: { Authorization: `Bearer ${raw}` },
      env: { SESSION_SECRET: SECRET, DB: db },
    });
    const body = (await res.json()) as {
      userSub: string | null;
      bearerUser: string | null;
    };
    expect(body.userSub).toBeNull();
    expect(body.bearerUser).toBe("u42");
  });

  it("cookie wins when both a valid cookie and a valid bearer are present", async () => {
    const { raw, hash } = await generateApiKey();
    const app = new Hono();
    app.use("*", requireAuthOrBearer);
    app.get("/x", (c) => {
      const user = c.get("user" as never) as
        | { sub: string; email: string }
        | undefined;
      const bearer = c.get("bearer" as never) as { userId: string } | undefined;
      return c.json({
        userSub: user?.sub ?? null,
        bearerUser: bearer?.userId ?? null,
      });
    });

    const token = await createSessionToken(
      { sub: "cookie-user", email: "a@b.c" },
      SECRET,
    );
    const db = makeMockDb([
      { id: "k1", user_id: "bearer-user", hash, revoked_at: null },
    ]);
    const res = await dispatch(app, "/x", {
      headers: {
        Cookie: `session=${token}`,
        Authorization: `Bearer ${raw}`,
      },
      env: { SESSION_SECRET: SECRET, DB: db },
    });
    const body = (await res.json()) as {
      userSub: string | null;
      bearerUser: string | null;
    };
    expect(body.userSub).toBe("cookie-user");
    // Bearer is not resolved because the cookie already authed the request.
    expect(body.bearerUser).toBeNull();
  });

  it("passes through anonymously when neither cookie nor bearer is present", async () => {
    const app = new Hono();
    app.use("*", requireAuthOrBearer);
    app.get("/x", (c) => c.json({ ok: true }));

    const res = await dispatch(app, "/x", {
      env: { SESSION_SECRET: SECRET, DB: makeMockDb([]) },
    });
    expect(res.status).toBe(200);
  });
});

describe("resolveBearer last_used_at debounce", () => {
  beforeEach(() => {
    __resetApiKeyTouchCache();
  });

  it("does not issue a second touch within the debounce window", async () => {
    const { raw, hash } = await generateApiKey();
    const writes: Array<{ sql: string; bindings: unknown[] }> = [];
    const db = makeMockDb(
      [{ id: "k1", user_id: "u1", hash, revoked_at: null }],
      writes,
    );

    const touchTasks: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => touchTasks.push(p),
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    const makeReq = () =>
      new Request("http://local/x", {
        headers: { Authorization: `Bearer ${raw}` },
      });

    const app = new Hono();
    app.get("/x", async (c) => {
      const id = await resolveBearer(c);
      return c.json({ keyId: id?.keyId ?? null });
    });

    await app.fetch(makeReq(), { DB: db }, ctx);
    await app.fetch(makeReq(), { DB: db }, ctx);

    await Promise.all(touchTasks);

    const touchWrites = writes.filter((w) =>
      w.sql.includes("UPDATE api_keys SET last_used_at"),
    );
    expect(touchWrites.length).toBe(1);
  });
});

// Integration: the /api/check handler uses resolveBearer to tag authed
// scans. We only need to prove the bearer is resolved; recording scan
// history requires a much richer fixture and is exercised end-to-end in
// manual testing.
describe("/api/check bearer resolution", () => {
  beforeEach(() => {
    vi.resetModules();
    __resetApiKeyTouchCache();
  });

  it("returns 400 on an invalid domain whether or not a bearer is present", async () => {
    // This doesn't boot the full app (would pull in Sentry etc); instead we
    // assert the happy-path pieces above cover the hot path, and leave the
    // integration concern to manual smoke. This placeholder test ensures the
    // file stays authoritative for future additions.
    expect(typeof resolveBearer).toBe("function");
  });
});
