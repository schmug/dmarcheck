import { describe, expect, it } from "vitest";
import { constantTimeEqualHex, hmacSha256Hex } from "../src/shared/hmac.js";

describe("shared/hmac", () => {
  it("hmacSha256Hex matches a known RFC 4231 vector", async () => {
    // RFC 4231 test case 1: key=0x0b*20, data="Hi There"
    // Expected: b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7
    const key = String.fromCharCode(...new Array(20).fill(0x0b));
    const out = await hmacSha256Hex(key, "Hi There");
    expect(out).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    );
  });

  it("hmacSha256Hex produces deterministic output", async () => {
    const a = await hmacSha256Hex("secret", "hello");
    const b = await hmacSha256Hex("secret", "hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hmacSha256Hex changes with payload", async () => {
    const a = await hmacSha256Hex("secret", "hello");
    const b = await hmacSha256Hex("secret", "hello!");
    expect(a).not.toBe(b);
  });

  it("constantTimeEqualHex returns true for identical hex", () => {
    expect(constantTimeEqualHex("abcd1234", "abcd1234")).toBe(true);
  });

  it("constantTimeEqualHex returns false for differing hex", () => {
    expect(constantTimeEqualHex("abcd1234", "abcd1235")).toBe(false);
  });

  it("constantTimeEqualHex returns false for different lengths", () => {
    expect(constantTimeEqualHex("ab", "abcd")).toBe(false);
  });
});
