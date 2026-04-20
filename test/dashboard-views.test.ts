import { describe, expect, it } from "vitest";
import {
  renderApiKeysPage,
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
  const defaults = {
    email: "user@example.com",
    webhookUrl: null,
    plan: "free" as const,
    billingEnabled: true,
    emailAlertsEnabled: true,
    showRetirementBanner: false,
  };

  it("links to the API Keys page instead of rendering the raw key inline", () => {
    const html = renderSettingsPage(defaults);
    expect(html).toContain("/dashboard/settings/api-keys");
    expect(html).toContain("Manage API Keys");
    // No `.api-key-display` element on this page — the shared CSS class still
    // appears in the <style> block, but it shouldn't be used in the body.
    expect(html).not.toContain('class="api-key-display"');
  });

  it("renders email in account section", () => {
    const html = renderSettingsPage({
      ...defaults,
      email: "admin@example.com",
    });
    expect(html).toContain("admin@example.com");
    expect(html).toContain("Account");
  });

  it("renders webhook input with existing URL prefilled", () => {
    const html = renderSettingsPage({
      ...defaults,
      webhookUrl: "https://hooks.example.com/dmarc",
    });
    expect(html).toContain("https://hooks.example.com/dmarc");
    expect(html).toContain("Webhook");
  });

  it("renders the Pro badge and Manage Billing link for pro users", () => {
    const html = renderSettingsPage({ ...defaults, plan: "pro" });
    expect(html).toContain("Manage Billing");
    expect(html).toContain("<strong>Pro</strong>");
  });

  it("renders the Free badge and an Upgrade link for free users", () => {
    const html = renderSettingsPage(defaults);
    expect(html).toContain("<strong>Free</strong>");
    expect(html).toContain("Upgrade to Pro");
  });

  it("shows a 'not configured' message when billing is disabled on this deployment", () => {
    const html = renderSettingsPage({ ...defaults, billingEnabled: false });
    expect(html).toContain("not configured");
    expect(html).not.toContain("Upgrade to Pro");
  });

  it("renders the retirement banner when showRetirementBanner is true", () => {
    const html = renderSettingsPage({
      ...defaults,
      showRetirementBanner: true,
    });
    expect(html).toContain("API key was retired");
  });

  it("omits the retirement banner by default", () => {
    const html = renderSettingsPage(defaults);
    expect(html).not.toContain("API key was retired");
  });

  it("renders the email-alerts section with the checkbox checked when enabled", () => {
    const html = renderSettingsPage(defaults);
    expect(html).toContain("Email Alerts");
    expect(html).toContain('name="enabled" checked');
    expect(html).toContain("/dashboard/settings/email-alerts");
  });

  it("renders the checkbox unchecked when email alerts are disabled", () => {
    const html = renderSettingsPage({
      ...defaults,
      emailAlertsEnabled: false,
    });
    expect(html).toContain('name="enabled" >');
    expect(html).not.toContain('name="enabled" checked');
  });
});

describe("renderApiKeysPage", () => {
  const baseProps = {
    email: "user@example.com",
    keys: [],
    justCreated: null as string | null,
    showRetirementBanner: false,
  };

  it("renders an empty-state message when the user has no keys", () => {
    const html = renderApiKeysPage(baseProps);
    expect(html).toContain("No API keys yet");
    expect(html).toContain("Generate API Key");
  });

  it("lists keys by prefix + name + status", () => {
    const html = renderApiKeysPage({
      ...baseProps,
      keys: [
        {
          id: "k1",
          name: "ci-pipeline",
          prefix: "dmk_abcd1234",
          createdAt: "2026-04-01",
          lastUsedAt: "2026-04-18",
          revoked: false,
        },
      ],
    });
    expect(html).toContain("ci-pipeline");
    expect(html).toContain("dmk_abcd1234");
    expect(html).toContain("Active");
    expect(html).toContain("Revoke");
  });

  it("renders revoked keys without a Revoke button", () => {
    const html = renderApiKeysPage({
      ...baseProps,
      keys: [
        {
          id: "k1",
          name: null,
          prefix: "dmk_abcd1234",
          createdAt: "2026-04-01",
          lastUsedAt: null,
          revoked: true,
        },
      ],
    });
    expect(html).toContain("Revoked");
    expect(html).not.toContain("/api-keys/revoke");
  });

  it("shows the just-created banner only when justCreated is set", () => {
    const raw = `dmk_${"x".repeat(32)}`;
    const html = renderApiKeysPage({ ...baseProps, justCreated: raw });
    expect(html).toContain("Save this key now");
    expect(html).toContain(raw);
  });

  it("escapes the raw key in the banner to prevent HTML injection", () => {
    const raw = "dmk_<script>";
    const html = renderApiKeysPage({ ...baseProps, justCreated: raw });
    expect(html).toContain("dmk_&lt;script&gt;");
  });

  it("renders the retirement banner when showRetirementBanner is true", () => {
    const html = renderApiKeysPage({
      ...baseProps,
      showRetirementBanner: true,
    });
    expect(html).toContain("old API key was retired");
  });
});
