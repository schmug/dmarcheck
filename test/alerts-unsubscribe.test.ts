import { describe, expect, it } from "vitest";
import {
  createUnsubscribeToken,
  validateUnsubscribeToken,
} from "../src/alerts/unsubscribe.js";

const SECRET = "test-unsub-secret";

describe("alerts/unsubscribe", () => {
  it("round-trips a user id", async () => {
    const token = await createUnsubscribeToken("user_1", SECRET);
    expect(await validateUnsubscribeToken(token, SECRET)).toBe("user_1");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createUnsubscribeToken("user_1", SECRET);
    expect(await validateUnsubscribeToken(token, "other-secret")).toBeNull();
  });

  it("rejects a token with tampered payload", async () => {
    const token = await createUnsubscribeToken("user_1", SECRET);
    const [, sig] = token.split(".");
    const tamperedPayload = btoa("attacker")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tampered = `${tamperedPayload}.${sig}`;
    expect(await validateUnsubscribeToken(tampered, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await validateUnsubscribeToken("", SECRET)).toBeNull();
    expect(await validateUnsubscribeToken("abc", SECRET)).toBeNull();
    expect(await validateUnsubscribeToken("a.b.c", SECRET)).toBeNull();
    expect(await validateUnsubscribeToken("!!!.???", SECRET)).toBeNull();
  });

  it("handles user ids containing unicode and punctuation", async () => {
    const id = "user_ñ&=/@";
    const token = await createUnsubscribeToken(id, SECRET);
    expect(await validateUnsubscribeToken(token, SECRET)).toBe(id);
  });
});
