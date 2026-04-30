import { describe, expect, it } from "vitest";
import { parseDnsServers } from "../src/dns/client.js";

describe("parseDnsServers", () => {
  it("returns null when raw is undefined", () => {
    expect(parseDnsServers(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseDnsServers("")).toBeNull();
  });

  it("returns null when only whitespace and separators are present", () => {
    expect(parseDnsServers(" , , ")).toBeNull();
  });

  it("returns a single server", () => {
    expect(parseDnsServers("8.8.8.8")).toEqual(["8.8.8.8"]);
  });

  it("splits a comma-separated list", () => {
    expect(parseDnsServers("8.8.8.8,1.1.1.1")).toEqual(["8.8.8.8", "1.1.1.1"]);
  });

  it("trims whitespace around each entry", () => {
    expect(parseDnsServers(" 8.8.8.8 , 1.1.1.1 ")).toEqual([
      "8.8.8.8",
      "1.1.1.1",
    ]);
  });

  it("drops empty entries from trailing/leading commas", () => {
    expect(parseDnsServers(",8.8.8.8,,1.1.1.1,")).toEqual([
      "8.8.8.8",
      "1.1.1.1",
    ]);
  });
});
