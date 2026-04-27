import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLlmsTxt } from "../src/api/llms-txt.js";
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

describe("/llms.txt route", () => {
  it("returns 200 with text/plain", async () => {
    const res = await app.request("/llms.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  });

  it("is cacheable for an hour at the edge", async () => {
    const res = await app.request("/llms.txt");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("appears in the sitemap", async () => {
    const res = await app.request("/sitemap.xml");
    const body = await res.text();
    expect(body).toContain("https://dmarc.mx/llms.txt");
  });
});

describe("buildLlmsTxt structure (llmstxt.org spec)", () => {
  const body = buildLlmsTxt();

  it("starts with an H1 project name", () => {
    expect(body.startsWith("# dmarcheck")).toBe(true);
  });

  it("has a one-line blockquote summary right after the H1", () => {
    const lines = body.split("\n").filter((l) => l.length > 0);
    // [0] is the H1, [1] is the blockquote
    expect(lines[1].startsWith("> ")).toBe(true);
  });

  it("has at least one H2 section", () => {
    expect(body).toMatch(/^## /m);
  });

  it("every section has at least one markdown-link bullet", () => {
    const sections = body.split(/^## .+$/m).slice(1);
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(
        section,
        "section must contain at least one markdown-link bullet",
      ).toMatch(/-\s+\[[^\]]+\]\([^)]+\)/);
    }
  });

  it("links to the canonical markdown-formatted URLs", () => {
    expect(body).toContain("/learn?format=md");
    expect(body).toContain("/scoring?format=md");
    expect(body).toContain("/docs/api?format=md");
  });

  it("links to the OpenAPI spec and api-catalog", () => {
    expect(body).toContain("/openapi.json");
    expect(body).toContain("/.well-known/api-catalog");
    expect(body).toContain("/.well-known/agent-skills/index.json");
  });
});

describe("/llms.txt — every advertised dmarc.mx URL resolves", () => {
  // Pulls every absolute https://dmarc.mx URL out of the body and hits each
  // one against the in-memory app to ensure the file isn't pointing at a
  // dead route. External GitHub URLs are excluded — they're informational
  // and outside our control.
  const body = buildLlmsTxt();
  const urls = Array.from(body.matchAll(/https:\/\/dmarc\.mx(\S*?)(?=[)\s])/g))
    .map((m) => m[1])
    .filter((u, i, a) => a.indexOf(u) === i);

  it.each(urls)("%s returns 200", async (path) => {
    const res = await app.request(path);
    expect(res.status, `expected 200 for ${path}`).toBe(200);
  });
});
