import { describe, expect, it } from "vitest";
import {
  renderDashboardPage,
  renderDomainDetailPage,
  renderSettingsPage,
} from "../src/views/dashboard";

describe("renderDashboardPage", () => {
  it("renders empty state when no domains", () => {
    const html = renderDashboardPage({
      email: "user@example.com",
      domains: [],
    });
    expect(html).toContain("No domains");
  });

  it("renders domain rows when domains are provided", () => {
    const html = renderDashboardPage({
      email: "user@example.com",
      domains: [
        {
          domain: "example.com",
          grade: "A",
          frequency: "daily",
          lastScanned: "2026-04-01",
          isFree: true,
        },
      ],
    });
    expect(html).toContain("example.com");
    expect(html).toContain("grade-a");
    expect(html).toContain("badge-free");
    expect(html).toContain("Free");
    expect(html).toContain("daily");
  });

  it("renders multiple domains", () => {
    const html = renderDashboardPage({
      email: "user@example.com",
      domains: [
        {
          domain: "alpha.com",
          grade: "B",
          frequency: "weekly",
          lastScanned: null,
          isFree: false,
        },
        {
          domain: "beta.com",
          grade: "F",
          frequency: "monthly",
          lastScanned: "2026-03-15",
          isFree: true,
        },
      ],
    });
    expect(html).toContain("alpha.com");
    expect(html).toContain("beta.com");
    expect(html).toContain("grade-a"); // B maps to grade-a class
    expect(html).toContain("grade-f");
    expect(html).toContain("Never");
  });

  it("escapes domain names containing special characters", () => {
    const html = renderDashboardPage({
      email: "user@example.com",
      domains: [
        {
          domain: "<script>alert(1)</script>",
          grade: "F",
          frequency: "daily",
          lastScanned: null,
          isFree: false,
        },
      ],
    });
    // The escaped form must appear in the body content
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("includes nav links and email", () => {
    const html = renderDashboardPage({
      email: "test@example.com",
      domains: [],
    });
    expect(html).toContain("test@example.com");
    expect(html).toContain("Domains");
    expect(html).toContain("Settings");
    expect(html).toContain("Logout");
  });

  it("links to domain detail pages", () => {
    const html = renderDashboardPage({
      email: "user@example.com",
      domains: [
        {
          domain: "example.com",
          grade: "A",
          frequency: "daily",
          lastScanned: null,
          isFree: false,
        },
      ],
    });
    expect(html).toContain("/dashboard/domain/");
    expect(html).toContain("example.com");
  });
});

describe("renderDomainDetailPage", () => {
  const baseProps = {
    email: "user@example.com",
    domain: "example.com",
    grade: "B+",
    lastScanned: "2026-04-01",
    isFree: false,
    scanFrequency: "daily",
    scanHistory: [
      { date: "2026-04-01", grade: "B+" },
      { date: "2026-03-25", grade: "B" },
    ],
  };

  it("renders domain name", () => {
    const html = renderDomainDetailPage(baseProps);
    expect(html).toContain("example.com");
  });

  it("renders grade", () => {
    const html = renderDomainDetailPage(baseProps);
    expect(html).toContain("B+");
  });

  it("renders Scan Now button", () => {
    const html = renderDomainDetailPage(baseProps);
    expect(html).toContain("Scan Now");
  });

  it("renders Grade History section", () => {
    const html = renderDomainDetailPage(baseProps);
    expect(html).toContain("Grade History");
  });

  it("renders scan history entries", () => {
    const html = renderDomainDetailPage(baseProps);
    expect(html).toContain("2026-04-01");
    expect(html).toContain("2026-03-25");
  });

  it("links to full report", () => {
    const html = renderDomainDetailPage(baseProps);
    expect(html).toContain("/check?domain=");
    expect(html).toContain("View Full Report");
  });

  it("shows free badge when isFree is true", () => {
    const html = renderDomainDetailPage({ ...baseProps, isFree: true });
    expect(html).toContain("badge-free");
    expect(html).toContain("Free");
  });

  it("shows no-history message when scanHistory is empty", () => {
    const html = renderDomainDetailPage({ ...baseProps, scanHistory: [] });
    expect(html).toContain("No scan history yet");
  });

  it("limits grade history to 12 entries", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      grade: "A",
    }));
    const html = renderDomainDetailPage({ ...baseProps, scanHistory: history });
    // Only 12 entries should appear — count list items inside the history list
    // Each entry renders as a <li> with class history-date span
    const matches = html.match(/<li>\s*<span class="history-date">/g);
    expect(matches).not.toBeNull();
    expect((matches ?? []).length).toBe(12);
  });

  it("includes scan form posting to correct URL", () => {
    const html = renderDomainDetailPage(baseProps);
    expect(html).toContain('method="POST"');
    expect(html).toContain("/scan");
  });
});

describe("renderSettingsPage", () => {
  it("renders Generate API Key when no key exists", () => {
    const html = renderSettingsPage({
      email: "user@example.com",
      apiKey: null,
      webhookUrl: null,
      hasStripe: false,
    });
    expect(html).toContain("Generate API Key");
    expect(html).not.toContain("Regenerate");
  });

  it("renders Regenerate and existing key when apiKey is set", () => {
    const html = renderSettingsPage({
      email: "user@example.com",
      apiKey: "dmx_abc123secret",
      webhookUrl: null,
      hasStripe: false,
    });
    expect(html).toContain("dmx_abc123secret");
    expect(html).toContain("Regenerate");
  });

  it("renders email in account section", () => {
    const html = renderSettingsPage({
      email: "admin@example.com",
      apiKey: null,
      webhookUrl: null,
      hasStripe: false,
    });
    expect(html).toContain("admin@example.com");
    expect(html).toContain("Account");
  });

  it("renders webhook input with existing URL prefilled", () => {
    const html = renderSettingsPage({
      email: "user@example.com",
      apiKey: null,
      webhookUrl: "https://hooks.example.com/dmarc",
      hasStripe: false,
    });
    expect(html).toContain("https://hooks.example.com/dmarc");
    expect(html).toContain("Webhook");
  });

  it("renders manage billing link when hasStripe is true", () => {
    const html = renderSettingsPage({
      email: "user@example.com",
      apiKey: null,
      webhookUrl: null,
      hasStripe: true,
    });
    expect(html).toContain("Manage Billing");
  });

  it("renders no subscription message when hasStripe is false", () => {
    const html = renderSettingsPage({
      email: "user@example.com",
      apiKey: null,
      webhookUrl: null,
      hasStripe: false,
    });
    expect(html).toContain("no active subscription");
    expect(html).toContain("Upgrade");
  });

  it("escapes API key to prevent XSS", () => {
    const html = renderSettingsPage({
      email: "user@example.com",
      apiKey: "<script>alert(1)</script>",
      webhookUrl: null,
      hasStripe: false,
    });
    // The escaped form must appear; raw user content must not be injected as HTML
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    // The api-key-display div must contain escaped content
    expect(html).toContain('class="api-key-display">&lt;script&gt;');
  });
});
