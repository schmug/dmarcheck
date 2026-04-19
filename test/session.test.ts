import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  validateSessionToken,
} from "../src/auth/session.js";

const SECRET = "test-secret-key-for-jwt-signing";

describe("session JWT", () => {
  it("creates and validates a session token", async () => {
    const token = await createSessionToken(
      { sub: "user-123", email: "alice@example.com" },
      SECRET,
    );

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const payload = await validateSessionToken(token, SECRET);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-123");
    expect(payload?.email).toBe("alice@example.com");
    expect(typeof payload?.exp).toBe("number");
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(
      { sub: "user-456", email: "bob@example.com" },
      SECRET,
    );

    // Tamper with the payload segment
    const parts = token.split(".");
    const tamperedPayload = btoa(
      JSON.stringify({
        sub: "attacker",
        email: "evil@example.com",
        exp: parts[1],
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const result = await validateSessionToken(tamperedToken, SECRET);
    expect(result).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken(
      { sub: "user-789", email: "carol@example.com" },
      SECRET,
      -1, // already expired
    );

    const result = await validateSessionToken(token, SECRET);
    expect(result).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(
      { sub: "user-999", email: "dave@example.com" },
      "original-secret",
    );

    const result = await validateSessionToken(token, "different-secret");
    expect(result).toBeNull();
  });
});
