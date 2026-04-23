import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { _memoryStore } from "../src/rate-limit.js";

vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn().mockResolvedValue(null),
  queryMx: vi.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  _memoryStore.clear();
});

const ROUTES: Array<{ path: string; canonical: string; title: string }> = [
  {
    path: "/pricing",
    canonical: "https://dmarc.mx/pricing",
    title: "Pricing",
  },
  {
    path: "/legal",
    canonical: "https://dmarc.mx/legal",
    title: "Legal",
  },
  {
    path: "/legal/terms",
    canonical: "https://dmarc.mx/legal/terms",
    title: "Terms of Service",
  },
  {
    path: "/legal/privacy",
    canonical: "https://dmarc.mx/legal/privacy",
    title: "Privacy Policy",
  },
];

describe("pricing + legal placeholder pages", () => {
  for (const { path, canonical, title } of ROUTES) {
    it(`GET ${path} returns HTML with noindex meta`, async () => {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toMatch(/^text\/html/);
      const html = await res.text();
      expect(html).toContain('<meta name="robots" content="noindex,follow">');
      expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
      expect(html).toContain(title);
    });

    it(`GET ${path} with Accept: text/markdown returns markdown`, async () => {
      const res = await app.request(path, {
        headers: { Accept: "text/markdown" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8",
      );
      const body = await res.text();
      expect(body).toContain("#");
    });

    it(`GET ${path}?format=md returns markdown`, async () => {
      const res = await app.request(`${path}?format=md`);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8",
      );
    });
  }

  it("landing footer links to /pricing, /legal/terms, /legal/privacy", async () => {
    const res = await app.request("/");
    const html = await res.text();
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/legal/terms"');
    expect(html).toContain('href="/legal/privacy"');
  });

  it("scoring page footer links to /pricing and /legal/*", async () => {
    const res = await app.request("/scoring");
    const html = await res.text();
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/legal/terms"');
    expect(html).toContain('href="/legal/privacy"');
  });

  it("/legal indexes terms and privacy", async () => {
    const res = await app.request("/legal");
    const html = await res.text();
    expect(html).toContain('href="/legal/terms"');
    expect(html).toContain('href="/legal/privacy"');
  });

  it("placeholder pages surface a clear preview banner", async () => {
    for (const { path } of ROUTES) {
      const res = await app.request(path);
      const html = await res.text();
      // The legal index and /pricing use 'copy pending'; terms/privacy use
      // 'legal text pending'. Either is acceptable — both are placeholder
      // banners that a reviewer can grep for.
      expect(html.toLowerCase()).toContain("pending");
      expect(html.toLowerCase()).toContain("preview");
    }
  });

  it("indexable pages (/, /scoring) stay free of noindex", async () => {
    for (const path of ["/", "/scoring"]) {
      const res = await app.request(path);
      const html = await res.text();
      expect(html).not.toContain('name="robots"');
    }
  });

  it("sitemap.xml does NOT list placeholder /pricing or /legal routes", async () => {
    const res = await app.request("/sitemap.xml");
    const body = await res.text();
    expect(body).not.toContain("<loc>https://dmarc.mx/pricing</loc>");
    expect(body).not.toContain("<loc>https://dmarc.mx/legal</loc>");
    expect(body).not.toContain("<loc>https://dmarc.mx/legal/terms</loc>");
    expect(body).not.toContain("<loc>https://dmarc.mx/legal/privacy</loc>");
  });
});
