// @implements REQ-079
import { describe, it, expect } from "vitest";
import { compactMode, compactResults } from "./verbosity.js";

describe("compactMode (REQ-079)", () => {
  it("is off when verbose is true or undefined", () => {
    expect(compactMode({ output: { verbose: true } })).toBe(false);
    expect(compactMode({ output: {} })).toBe(false);
    expect(compactMode({})).toBe(false);
  });

  it("is on when verbose is false", () => {
    expect(compactMode({ output: { verbose: false } })).toBe(true);
  });
});

describe("compactResults (REQ-079)", () => {
  it("retains title, url, and snippet while dropping optional per-result fields", () => {
    const full = [{ title: "t", url: "u", snippet: "s", published_date: "2026-01-01", source_type: "web", original_source: "src" }];
    expect(compactResults(full)).toEqual([{ title: "t", url: "u", snippet: "s" }]);
  });

  it("keeps every required field of the REQ-001 result shape", () => {
    const [result] = compactResults([{ title: "t", url: "u", snippet: "s" }]);
    expect(Object.keys(result).sort()).toEqual(["snippet", "title", "url"]);
  });

  it("preserves result order", () => {
    const out = compactResults([
      { title: "a", url: "1", snippet: "x" },
      { title: "b", url: "2", snippet: "y" },
    ]);
    expect(out.map((r) => r.title)).toEqual(["a", "b"]);
  });
});
