import { describe, expect, it } from "vitest";
import { CSS_HASH, CSS_PATH, JS_HASH, JS_PATH } from "../src/views/assets.js";

describe("content hashing", () => {
  it("produces deterministic hashes", () => {
    expect(CSS_HASH).toBe(CSS_HASH);
    expect(JS_HASH).toBe(JS_HASH);
  });

  it("produces non-empty hash strings", () => {
    expect(CSS_HASH.length).toBeGreaterThan(0);
    expect(JS_HASH.length).toBeGreaterThan(0);
  });

  it("embeds hashes in asset paths", () => {
    expect(CSS_PATH).toBe(`/assets/styles-${CSS_HASH}.css`);
    expect(JS_PATH).toBe(`/assets/scripts-${JS_HASH}.js`);
  });

  it("produces different hashes for CSS and JS", () => {
    expect(CSS_HASH).not.toBe(JS_HASH);
  });
});
