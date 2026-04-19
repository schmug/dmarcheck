import { describe, expect, it } from "vitest";
import { renderLandingPage } from "../src/views/html.js";

describe("landing page nav", () => {
  it("includes a login link", () => {
    const html = renderLandingPage();
    expect(html).toContain("/auth/login");
    expect(html).toContain("Log in");
  });
});
