// @implements REQ-124
import { describe, it, expect } from "vitest";
import { parseQuery, ignoredOperators } from "./query.js";

describe("query operators (REQ-124)", () => {
  it("parses site, filetype, phrases, and exclusions", () => {
    const parsed = parseQuery('site:example.com filetype:pdf "exact words" -spam budget');
    expect(parsed.sites).toEqual(["example.com"]);
    expect(parsed.filetypes).toEqual(["pdf"]);
    expect(parsed.phrases).toEqual(["exact words"]);
    expect(parsed.exclusions).toEqual(["spam"]);
    expect(parsed.hasOperators).toBe(true);
  });

  it("leaves malformed operators as ordinary text", () => {
    const parsed = parseQuery("site: budget filetype:");
    expect(parsed.sites).toEqual([]);
    expect(parsed.filetypes).toEqual([]);
    expect(parsed.hasOperators).toBe(false);
  });

  it("reports operators ignored by structured providers", () => {
    const parsed = parseQuery("site:example.com budget");
    expect(ignoredOperators("duckduckgo", parsed)).toEqual([]);
    expect(ignoredOperators("arxiv", parsed)).toEqual(["site"]);
  });
});
