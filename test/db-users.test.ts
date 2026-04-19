import { beforeEach, describe, expect, it } from "vitest";
import {
  createUser,
  getUserByApiKey,
  getUserByEmail,
  getUserById,
  setApiKey,
  type User,
} from "../src/db/users.js";

// In-memory store for mock D1
let store: Map<string, User>;

function makeD1Mock(): D1Database {
  // Each call to prepare returns a statement builder.
  // We track the SQL and implement bind/run/first against the in-memory store.
  const prepare = (sql: string) => {
    return {
      bind: (...params: unknown[]) => {
        return {
          run: async () => {
            if (/^INSERT INTO users/i.test(sql)) {
              const [id, email, email_domain] = params as [
                string,
                string,
                string,
              ];
              store.set(id, {
                id,
                email,
                email_domain,
                stripe_customer_id: null,
                api_key: null,
                created_at: Math.floor(Date.now() / 1000),
              });
            } else if (/^UPDATE users SET api_key/i.test(sql)) {
              const [apiKey, userId] = params as [string, string];
              const user = store.get(userId);
              if (user) {
                store.set(userId, { ...user, api_key: apiKey });
              }
            }
            return { success: true };
          },
          first: async <T>(): Promise<T | null> => {
            if (/WHERE id = \?/i.test(sql)) {
              const [id] = params as [string];
              return (store.get(id) as T | undefined) ?? null;
            }
            if (/WHERE email = \?/i.test(sql)) {
              const [email] = params as [string];
              for (const user of store.values()) {
                if (user.email === email) return user as T;
              }
              return null;
            }
            if (/WHERE api_key = \?/i.test(sql)) {
              const [apiKey] = params as [string];
              for (const user of store.values()) {
                if (user.api_key === apiKey) return user as T;
              }
              return null;
            }
            return null;
          },
        };
      },
    };
  };

  // Cast to D1Database — we only use prepare/bind/run/first in our module
  return { prepare } as unknown as D1Database;
}

describe("db/users", () => {
  let db: D1Database;

  beforeEach(() => {
    store = new Map();
    db = makeD1Mock();
  });

  describe("createUser + getUserById", () => {
    it("creates a user and retrieves it by id", async () => {
      await createUser(db, { id: "user-1", email: "alice@example.com" });
      const user = await getUserById(db, "user-1");

      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-1");
      expect(user?.email).toBe("alice@example.com");
    });

    it("extracts email_domain from the email address", async () => {
      await createUser(db, { id: "user-2", email: "bob@dmarc.mx" });
      const user = await getUserById(db, "user-2");

      expect(user?.email_domain).toBe("dmarc.mx");
    });

    it("initialises stripe_customer_id and api_key as null", async () => {
      await createUser(db, { id: "user-3", email: "carol@test.org" });
      const user = await getUserById(db, "user-3");

      expect(user?.stripe_customer_id).toBeNull();
      expect(user?.api_key).toBeNull();
    });
  });

  describe("getUserByEmail", () => {
    it("retrieves an existing user by email", async () => {
      await createUser(db, { id: "user-4", email: "dave@example.com" });
      const user = await getUserByEmail(db, "dave@example.com");

      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-4");
    });

    it("returns null for an unknown email", async () => {
      const user = await getUserByEmail(db, "nobody@example.com");
      expect(user).toBeNull();
    });
  });

  describe("getUserById", () => {
    it("returns null for a non-existent id", async () => {
      const user = await getUserById(db, "does-not-exist");
      expect(user).toBeNull();
    });
  });

  describe("setApiKey + getUserByApiKey", () => {
    it("sets an api key and retrieves the user by that key", async () => {
      await createUser(db, { id: "user-5", email: "eve@example.com" });
      await setApiKey(db, "user-5", "sk-test-abc123");

      const user = await getUserByApiKey(db, "sk-test-abc123");
      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-5");
      expect(user?.api_key).toBe("sk-test-abc123");
    });

    it("returns null when no user has that api key", async () => {
      const user = await getUserByApiKey(db, "sk-unknown");
      expect(user).toBeNull();
    });
  });
});
