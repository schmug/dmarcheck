import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env.js";
import { stagingMarker } from "../src/middleware/staging-marker.js";

function makeApp(env: Partial<Env>) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", stagingMarker);
  app.get("/html", (c) =>
    c.html(
      "<!doctype html><html><head><title>x</title></head><body><p>x</p></body></html>",
    ),
  );
  app.get("/json", (c) => c.json({ ok: true }));
  app.get("/text", (c) => c.text("hello"));
  return {
    request: (path: string) =>
      app.request(path, {}, env as unknown as Record<string, unknown>),
  };
}

describe("middleware/staging-marker", () => {
  it("injects the noindex meta and STAGING banner into HTML when IS_STAGING=1", async () => {
    const { request } = makeApp({ IS_STAGING: "1" });
    const res = await request("/html");
    const body = await res.text();
    expect(body).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(body).toContain("data-staging-banner");
    expect(body).toContain("STAGING — not production");
    expect(body.indexOf('<meta name="robots"')).toBeLessThan(
      body.indexOf("</head>"),
    );
    expect(body.indexOf("data-staging-banner")).toBeGreaterThan(
      body.indexOf("<body"),
    );
  });

  it("does not modify HTML when IS_STAGING is unset (prod)", async () => {
    const { request } = makeApp({});
    const res = await request("/html");
    const body = await res.text();
    expect(body).not.toContain("noindex,nofollow");
    expect(body).not.toContain("data-staging-banner");
  });

  it("does not modify HTML when IS_STAGING is '0' or any non-'1' value", async () => {
    const { request } = makeApp({ IS_STAGING: "0" });
    const res = await request("/html");
    const body = await res.text();
    expect(body).not.toContain("data-staging-banner");
  });

  it("leaves non-HTML responses untouched even on staging", async () => {
    const { request } = makeApp({ IS_STAGING: "1" });
    const json = await request("/json");
    expect(await json.text()).toBe('{"ok":true}');
    const text = await request("/text");
    expect(await text.text()).toBe("hello");
  });

  it("preserves the original status code and headers", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", stagingMarker);
    app.get("/notfound", (c) =>
      c.html("<!doctype html><html><body>nope</body></html>", 404, {
        "X-Custom": "yes",
      }),
    );
    const res = await app.request("/notfound", {}, {
      IS_STAGING: "1",
    } as unknown as Record<string, unknown>);
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Custom")).toBe("yes");
    const body = await res.text();
    expect(body).toContain("data-staging-banner");
  });
});
