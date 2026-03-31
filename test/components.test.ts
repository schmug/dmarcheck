import { describe, it, expect } from "vitest";
import { esc } from "../src/views/components";

describe("esc", () => {
  it("escapes ampersands", () => {
    expect(esc("a&b")).toBe("a&amp;b");
  });

  it("escapes angle brackets", () => {
    expect(esc("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(esc('a"b')).toBe("a&quot;b");
  });

  it("escapes single quotes", () => {
    expect(esc("a'b")).toBe("a&#39;b");
  });

  it("passes through plain strings unchanged", () => {
    expect(esc("hello world")).toBe("hello world");
  });

  it("escapes mixed special characters", () => {
    expect(esc(`<div class="x" data='y'>&`)).toBe(
      "&lt;div class=&quot;x&quot; data=&#39;y&#39;&gt;&amp;",
    );
  });
});
