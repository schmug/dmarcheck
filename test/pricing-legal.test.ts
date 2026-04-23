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

const LEGAL_PLACEHOLDER_ROUTES: Array<{
  path: string;
  canonical: string;
  title: string;
}> = [
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

describe("legal placeholder pages", () => {
  for (const { path, canonical, title } of LEGAL_PLACEHOLDER_ROUTES) {
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

  it("/legal indexes terms and privacy", async () => {
    const res = await app.request("/legal");
    const html = await res.text();
    expect(html).toContain('href="/legal/terms"');
    expect(html).toContain('href="/legal/privacy"');
  });

  it("legal pages surface a clear preview banner", async () => {
    for (const { path } of LEGAL_PLACEHOLDER_ROUTES) {
      const res = await app.request(path);
      const html = await res.text();
      expect(html.toLowerCase()).toContain("pending");
      expect(html.toLowerCase()).toContain("preview");
    }
  });

  it("sitemap.xml does NOT list placeholder /legal routes", async () => {
    const res = await app.request("/sitemap.xml");
    const body = await res.text();
    expect(body).not.toContain("<loc>https://dmarc.mx/legal</loc>");
    expect(body).not.toContain("<loc>https://dmarc.mx/legal/terms</loc>");
    expect(body).not.toContain("<loc>https://dmarc.mx/legal/privacy</loc>");
  });
});

describe("pricing page (live copy)", () => {
  it("GET /pricing returns indexable HTML (no noindex)", async () => {
    const res = await app.request("/pricing");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/html/);
    const html = await res.text();
    expect(html).not.toContain('name="robots"');
    expect(html).toContain(
      '<link rel="canonical" href="https://dmarc.mx/pricing">',
    );
  });

  it("advertises $19/mo, nightly monitoring, and every protocol name in the hero", async () => {
    const res = await app.request("/pricing");
    const html = await res.text();
    expect(html).toContain("$19/mo");
    expect(html).toContain("Nightly DMARC, SPF, DKIM, BIMI");
    expect(html).toContain("MTA-STS");
  });

  it("does not contain placeholder markers", async () => {
    const res = await app.request("/pricing");
    const html = await res.text();
    expect(html).not.toMatch(/\[PLACEHOLDER/);
    expect(html.toLowerCase()).not.toContain("copy pending");
  });

  it("links upgrade CTA to /dashboard/billing/subscribe", async () => {
    const res = await app.request("/pricing");
    const html = await res.text();
    expect(html).toContain('href="/dashboard/billing/subscribe"');
  });

  it("includes the explicit 'not in Pro' list", async () => {
    const res = await app.request("/pricing");
    const html = await res.text();
    expect(html).toContain("RUA");
    expect(html.toLowerCase()).toContain("team seats");
    expect(html.toLowerCase()).toContain("white-label");
  });

  it("exposes Product/Offer + FAQPage JSON-LD", async () => {
    const res = await app.request("/pricing");
    const html = await res.text();
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"price":"19"');
    expect(html).toContain('"priceCurrency":"USD"');
  });

  it("markdown rendering honors Accept: text/markdown", async () => {
    const res = await app.request("/pricing", {
      headers: { Accept: "text/markdown" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toContain("$19/mo");
    expect(body).toContain("Nightly DMARC");
    expect(body).not.toMatch(/\[PLACEHOLDER/);
  });

  it("sitemap.xml lists /pricing", async () => {
    const res = await app.request("/sitemap.xml");
    const body = await res.text();
    expect(body).toContain("<loc>https://dmarc.mx/pricing</loc>");
  });
});

describe("site footer links", () => {
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

  it("indexable pages (/, /scoring, /pricing) stay free of noindex", async () => {
    for (const path of ["/", "/scoring", "/pricing"]) {
      const res = await app.request(path);
      const html = await res.text();
      expect(html).not.toContain('name="robots"');
    }
  });
});
