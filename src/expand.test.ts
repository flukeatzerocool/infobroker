// @implements REQ-020e expansion-available REQ-020e expansion-unavailable
import { describe, it, expect } from "vitest";
import { deriveExpansions } from "./expand.js";

describe("deriveExpansions (REQ-020e)", () => {
  it("returns the original query plus deduplicated suggestions", () => {
    const out = deriveExpansions("quantum computing", ["quantum computing basics", "quantum computing explained"], 5);
    expect(out[0]).toBe("quantum computing");
    expect(out).toContain("quantum computing basics");
  });

  it("caps the result at the max expansion count", () => {
    const out = deriveExpansions("ai", ["a", "b", "c", "d", "e", "f", "g"], 5);
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it("derives a keyword phrase when no suggestions are available", () => {
    const out = deriveExpansions("how does machine learning work", [], 5);
    expect(out).toContain("machine learning work");
  });

  it("drops stop-words when forming the keyword phrase", () => {
    const out = deriveExpansions("the history of the roman empire", [], 5);
    expect(out.some((e) => e.includes("history"))).toBe(true);
  });
});
