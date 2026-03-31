import { describe, it, expect } from "vitest";
import { parseTags } from "../src/shared/parse-tags.js";

describe("parseTags", () => {
  it("parses semicolon-separated key=value pairs", () => {
    expect(parseTags("v=DMARC1; p=reject")).toEqual({
      v: "DMARC1",
      p: "reject",
    });
  });

  it("trims whitespace around keys and values", () => {
    expect(parseTags("  v = DMARC1 ;  p = reject  ")).toEqual({
      v: "DMARC1",
      p: "reject",
    });
  });

  it("skips empty segments", () => {
    expect(parseTags("v=DMARC1;;p=reject;")).toEqual({
      v: "DMARC1",
      p: "reject",
    });
  });

  it("skips segments without =", () => {
    expect(parseTags("v=DMARC1; badentry; p=reject")).toEqual({
      v: "DMARC1",
      p: "reject",
    });
  });

  it("lowercases keys by default", () => {
    expect(parseTags("V=DMARC1; P=reject")).toEqual({
      v: "DMARC1",
      p: "reject",
    });
  });

  it("preserves key case when lowercaseKeys is false", () => {
    expect(parseTags("V=DMARC1; P=reject", { lowercaseKeys: false })).toEqual({
      V: "DMARC1",
      P: "reject",
    });
  });

  it("splits only on first = to preserve values containing =", () => {
    expect(parseTags("rua=mailto:d@example.com")).toEqual({
      rua: "mailto:d@example.com",
    });
  });

  it("returns empty object for empty string", () => {
    expect(parseTags("")).toEqual({});
  });
});
