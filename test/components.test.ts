import { describe, expect, it } from "vitest";
import { esc, generateCreature, gradeToMood } from "../src/views/components";

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

describe("generateCreature", () => {
  it("returns HTML with creature class and correct size", () => {
    const html = generateCreature("lg");
    expect(html).toContain('class="creature creature-lg"');
    expect(html).toContain("@");
    expect(html).toContain("creature-eye");
    expect(html).toContain("creature-leg");
  });

  it("applies mood class when provided", () => {
    const html = generateCreature("md", "celebrating");
    expect(html).toContain("creature-celebrating");
  });

  it("renders without mood class when mood is omitted", () => {
    const html = generateCreature("sm");
    expect(html).not.toContain("creature-celebrating");
    expect(html).not.toContain("creature-content");
    expect(html).not.toContain("creature-worried");
    expect(html).not.toContain("creature-scared");
    expect(html).not.toContain("creature-panicked");
  });

  it("includes aria-hidden for decorative use", () => {
    const html = generateCreature("md");
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("gradeToMood", () => {
  it("maps A grades to celebrating", () => {
    expect(gradeToMood("A+")).toBe("celebrating");
    expect(gradeToMood("A")).toBe("celebrating");
    expect(gradeToMood("A-")).toBe("celebrating");
  });

  it("maps B grades to content", () => {
    expect(gradeToMood("B+")).toBe("content");
    expect(gradeToMood("B")).toBe("content");
  });

  it("maps C grades to worried", () => {
    expect(gradeToMood("C")).toBe("worried");
  });

  it("maps D grades to scared", () => {
    expect(gradeToMood("D")).toBe("scared");
  });

  it("maps F grades to panicked", () => {
    expect(gradeToMood("F")).toBe("panicked");
  });
});
