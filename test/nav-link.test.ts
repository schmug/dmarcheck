import { describe, expect, it } from "vitest";
import { navLoginButton } from "../src/views/components.js";
import { renderLandingPage } from "../src/views/html.js";

describe("landing page nav", () => {
  it("includes a login link", () => {
    const html = renderLandingPage();
    expect(html).toContain("/auth/login");
    expect(html).toContain("Log in");
  });

  it("renders the persistent nav-login pill in the landing hero", () => {
    const html = renderLandingPage();
    expect(html).toContain('class="landing-nav"');
    expect(html).toContain('class="nav-login"');
  });

  it("drops the legacy footer text-link", () => {
    const html = renderLandingPage();
    expect(html).not.toContain("Log in</a> to monitor a domain (free)");
  });
});

describe("navLoginButton", () => {
  it("links to /auth/login and embeds the sm creature", () => {
    const html = navLoginButton();
    expect(html).toContain('href="/auth/login"');
    expect(html).toContain('class="creature creature-sm"');
  });

  it("provides an accessible label since the avatar is decorative", () => {
    const html = navLoginButton();
    expect(html).toContain('aria-label="Log in to monitor a domain (free)"');
    expect(html).toContain('aria-hidden="true"');
  });
});
