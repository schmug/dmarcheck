import { describe, expect, it } from "vitest";
import {
  esc,
  generateCreature,
  gradeToMood,
  mxTable,
  statusDot,
  themeToggle,
} from "../src/views/components";
import { renderError, renderLandingPage } from "../src/views/html";
import { CSS } from "../src/views/styles";

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

describe("statusDot", () => {
  it("renders info status with informational label", () => {
    const html = statusDot("info" as any);
    expect(html).toContain("status-info");
    expect(html).toContain("informational");
  });
});

describe("themeToggle", () => {
  it("returns a button with theme-toggle class", () => {
    const html = themeToggle();
    expect(html).toContain('class="theme-toggle"');
  });

  it("includes aria-label", () => {
    const html = themeToggle();
    expect(html).toContain("aria-label=");
  });
});

describe("mxTable", () => {
  it("returns empty string for no records", () => {
    expect(mxTable([])).toBe("");
  });

  it("renders table with priority and exchange", () => {
    const html = mxTable([{ priority: 10, exchange: "mail.example.com" }]);
    expect(html).toContain("<table");
    expect(html).toContain("10");
    expect(html).toContain("mail.example.com");
  });

  it("renders provider badge inline when record has provider", () => {
    const html = mxTable([
      {
        priority: 10,
        exchange: "aspmx.l.google.com",
        provider: { name: "Google Workspace", category: "email-platform" },
      },
    ]);
    expect(html).toContain("Google Workspace");
    expect(html).toContain("provider-badge");
  });

  it("renders no badge when record has no provider", () => {
    const html = mxTable([{ priority: 10, exchange: "mail.custom.org" }]);
    expect(html).not.toContain("provider-badge");
  });

  it("escapes exchange hostnames", () => {
    const html = mxTable([
      { priority: 10, exchange: "<script>alert(1)</script>" },
    ]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("shows provider column header", () => {
    const html = mxTable([{ priority: 10, exchange: "mail.example.com" }]);
    expect(html).toContain("Provider");
  });
});

describe("CSS theme variables", () => {
  it("defines light palette in :root", () => {
    expect(CSS).toContain(":root");
    expect(CSS).toContain("--clr-bg:");
    expect(CSS).toContain("--clr-text:");
    expect(CSS).toContain("--clr-accent:");
    expect(CSS).toContain("color-scheme: light dark");
  });

  it("defines dark palette for prefers-color-scheme", () => {
    expect(CSS).toContain("prefers-color-scheme: dark");
    expect(CSS).toContain(':root:not([data-theme="light"])');
  });

  it("defines dark palette for manual override", () => {
    expect(CSS).toContain('[data-theme="dark"]');
  });

  it("uses CSS variables instead of hardcoded colors in body", () => {
    expect(CSS).toContain("background: var(--clr-bg)");
    expect(CSS).toContain("color: var(--clr-text)");
  });

  it("includes theme toggle styles", () => {
    expect(CSS).toContain(".theme-toggle");
  });
});

describe("page HTML theme integration", () => {
  it("includes flash-prevention script in head", () => {
    const html = renderLandingPage();
    expect(html).toContain("localStorage.getItem('theme')");
    expect(html).toContain("data-theme");
  });

  it("includes theme toggle button", () => {
    const html = renderLandingPage();
    expect(html).toContain('class="theme-toggle"');
  });

  it("includes theme toggle in error page", () => {
    const html = renderError("test");
    expect(html).toContain('class="theme-toggle"');
  });

  it("uses currentColor for GitHub SVG fill", () => {
    const html = renderLandingPage();
    expect(html).toContain('fill="currentColor"');
    expect(html).not.toContain('fill="#71717a"');
  });
});
