import { describe, expect, it } from "vitest";
import type { ScanResult } from "../src/analyzers/types";
import type { GradeBreakdown } from "../src/shared/scoring";
import {
  esc,
  generateCreature,
  gradeToMood,
  monitorSnapshotCard,
  mxTable,
  statusDot,
  themeToggle,
} from "../src/views/components";
import { renderError, renderLandingPage } from "../src/views/html";
import { CSS } from "../src/views/styles";

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    domain: "example.com",
    timestamp: "2026-03-31T12:00:00.000Z",
    grade: "B",
    breakdown: {
      grade: "B",
      tier: "B",
      tierReason: "",
      modifier: 0,
      modifierLabel: "",
      factors: [],
      recommendations: [],
      protocolSummaries: {},
    } as GradeBreakdown,
    summary: {
      mx_records: 0,
      mx_providers: [],
      dmarc_policy: "reject",
      spf_result: "pass",
      spf_lookups: "3/10",
      dkim_selectors_found: 1,
      bimi_enabled: false,
      mta_sts_mode: null,
    },
    protocols: {
      mx: {
        status: "info",
        records: [],
        providers: [],
        validations: [],
      },
      dmarc: {
        status: "pass",
        record: "v=DMARC1; p=reject",
        tags: { v: "DMARC1", p: "reject" },
        validations: [],
      },
      spf: {
        status: "pass",
        record: "v=spf1 include:_spf.google.com ~all",
        lookups_used: 3,
        lookup_limit: 10,
        include_tree: null,
        validations: [],
      },
      dkim: {
        status: "pass",
        selectors: {
          google: { found: true, key_type: "rsa", key_bits: 2048 },
          selector1: { found: false },
        },
        validations: [],
      },
      bimi: {
        status: "fail",
        record: null,
        tags: null,
        validations: [],
      },
      mta_sts: {
        status: "fail",
        dns_record: null,
        policy: null,
        validations: [],
      },
    },
    ...overrides,
  };
}

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
    const html = statusDot("info");
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

describe("monitorSnapshotCard", () => {
  it("renders + for passing protocols and · for missing ones", () => {
    const html = monitorSnapshotCard(makeScanResult());
    // 3 passing: DMARC p=reject, SPF pass, DKIM 1 selector found
    const plusMatches = html.match(/<span class="snap-mark">\+<\/span>/g) ?? [];
    expect(plusMatches).toHaveLength(3);
    // 1 muted: BIMI not configured (middle-dot is \u00b7)
    expect(html).toContain(
      '<div class="snap-row snap-row-muted">\n      <span class="snap-mark">\u00b7</span>',
    );
  });

  it("embeds the CTA pointing at the login page with a monitor prompt", () => {
    const html = monitorSnapshotCard(makeScanResult());
    expect(html).toContain(
      "/auth/login?next=/dashboard&amp;prompt=monitor:example.com",
    );
    expect(html).toContain('class="monitor-cta"');
  });

  it("escapes the domain in both the heading and the CTA href", () => {
    const html = monitorSnapshotCard(makeScanResult({ domain: "<evil>.test" }));
    expect(html).not.toContain("<evil>.test</strong>");
    expect(html).toContain("&lt;evil&gt;.test</strong>");
    // encodeURIComponent escapes < and > before esc() runs
    expect(html).toContain("%3Cevil%3E.test");
  });

  it("mutes DMARC row when policy is p=none", () => {
    const html = monitorSnapshotCard(
      makeScanResult({
        protocols: {
          ...makeScanResult().protocols,
          dmarc: {
            status: "warn",
            record: "v=DMARC1; p=none",
            tags: { v: "DMARC1", p: "none" },
            validations: [],
          },
        },
      }),
    );
    // DMARC row should be muted (p=none is not reject/quarantine)
    expect(html).toMatch(
      /snap-row snap-row-muted">\s*<span class="snap-mark">\u00b7<\/span>\s*<span class="snap-label">DMARC policy/,
    );
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
