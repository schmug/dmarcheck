import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { _memoryStore } from "../src/rate-limit.js";

vi.mock("../src/cache.js", () => ({
  getCachedScan: vi.fn().mockResolvedValue(null),
  setCachedScan: vi.fn(),
}));

vi.mock("../src/dns/client.js", () => ({
  queryTxt: vi.fn().mockResolvedValue(null),
  queryMx: vi.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  _memoryStore.clear();
});

describe("Link response header", () => {
  it("advertises the four agent-discovery relations on the landing page", async () => {
    const res = await app.request("/");
    const link = res.headers.get("Link");
    expect(link).toBeTruthy();
    expect(link).toContain('rel="api-catalog"');
    expect(link).toContain('rel="service-desc"');
    expect(link).toContain('rel="service-doc"');
    expect(link).toContain('rel="status"');
    expect(link).toContain("</.well-known/api-catalog>");
    expect(link).toContain("</openapi.json>");
    expect(link).toContain("</docs/api>");
    expect(link).toContain("</health>");
  });

  it("sets Link on scoring, learn, and docs pages too", async () => {
    for (const path of ["/scoring", "/learn", "/docs/api"]) {
      const res = await app.request(path);
      expect(
        res.headers.get("Link"),
        `expected Link header on ${path}`,
      ).toContain('rel="api-catalog"');
    }
  });

  it("does not attach a Link header to JSON responses", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("Link")).toBeNull();
  });
});

describe("/.well-known/api-catalog", () => {
  it("returns an RFC 9727 linkset with the expected anchor and relations", async () => {
    const res = await app.request("/.well-known/api-catalog");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/linkset+json");
    const body = (await res.json()) as {
      linkset: Array<{
        anchor: string;
        "service-desc": Array<{ href: string; type: string }>;
        "service-doc": Array<{ href: string; type: string }>;
        status: Array<{ href: string }>;
      }>;
    };
    expect(body.linkset).toHaveLength(1);
    const [entry] = body.linkset;
    expect(entry.anchor).toBe("https://dmarc.mx/api/check");
    expect(entry["service-desc"][0].href).toBe("https://dmarc.mx/openapi.json");
    expect(entry["service-desc"][0].type).toBe("application/openapi+json");
    expect(entry["service-doc"][0].href).toBe("https://dmarc.mx/docs/api");
    expect(entry.status[0].href).toBe("https://dmarc.mx/health");
  });
});

describe("/openapi.json", () => {
  it("returns an OpenAPI 3.1 document covering the public endpoints", async () => {
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/openapi+json; charset=utf-8",
    );
    const doc = (await res.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    expect(doc.openapi).toBe("3.1.0");
    for (const path of [
      "/api/check",
      "/api/check/stream",
      "/check",
      "/health",
      "/.well-known/api-catalog",
    ]) {
      expect(doc.paths[path], `expected OpenAPI path ${path}`).toBeDefined();
    }
    expect(doc.components.schemas.ScanResult).toBeDefined();
    expect(doc.components.schemas.DmarcResult).toBeDefined();
  });
});

describe("/docs/api", () => {
  it("renders the HTML API docs page by default", async () => {
    const res = await app.request("/docs/api");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("dmarcheck API");
    expect(body).toContain("/openapi.json");
  });

  it("returns markdown when Accept: text/markdown is sent", async () => {
    const res = await app.request("/docs/api", {
      headers: { Accept: "text/markdown" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toContain("# dmarcheck API");
  });
});

describe("markdown content negotiation", () => {
  it("returns markdown for the landing page when requested", async () => {
    const res = await app.request("/", {
      headers: { Accept: "text/markdown" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toContain("# dmarcheck");
  });

  it("honors ?format=md on the scoring page", async () => {
    const res = await app.request("/scoring?format=md");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(await res.text()).toContain("# dmarcheck scoring rubric");
  });

  it("keeps HTML as the default when Accept lists HTML first", async () => {
    const res = await app.request("/", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("returns a 400 markdown error when /check has no domain and Accept: text/markdown", async () => {
    const res = await app.request("/check", {
      headers: { Accept: "text/markdown" },
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(await res.text()).toContain("# Error");
  });

  it("noindexes markdown responses", async () => {
    const res = await app.request("/", {
      headers: { Accept: "text/markdown" },
    });
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });
});

describe("WebMCP tool registration", () => {
  it("inlines the scan_domain tool definition in the client bundle", async () => {
    // Fetch the hashed JS asset. Follow the CSS_PATH/JS_PATH constants through
    // the landing page response so the test is resilient to content-hash
    // changes.
    const landing = await app.request("/");
    const html = await landing.text();
    const match = html.match(/src="(\/assets\/scripts-[^"]+\.js)"/);
    expect(match).toBeTruthy();
    const jsPath = match?.[1];
    expect(jsPath).toBeTruthy();
    const js = await (await app.request(jsPath as string)).text();
    expect(js).toContain("navigator.modelContext");
    expect(js).toContain("scan_domain");
    expect(js).toContain("/api/check");
  });
});
