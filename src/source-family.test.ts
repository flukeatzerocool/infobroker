// @implements REQ-121
import { describe, it, expect } from "vitest";
import { canonicalUrl, assignSourceFamilies, familyCount, textSimilarity } from "./source-family.js";

const wire = "The committee released its findings on Tuesday after a year-long inquiry into procurement practices across three agencies and two contractors.";

describe("source-family (REQ-121)", () => {
  it("canonicalizes tracking parameters, fragments, and trailing slashes", () => {
    expect(canonicalUrl("https://Example.com/Story/?utm_source=x&id=7#top")).toBe("https://example.com/Story?id=7");
  });

  it("collapses cross-domain republished wire copy into one family", () => {
    const families = assignSourceFamilies(
      [
        { url: "https://alpha.example/story", title: "Report", snippet: wire },
        { url: "https://beta.example/republish", title: "Report", snippet: wire },
        { url: "https://gamma.example/other", title: "Unrelated", snippet: "A completely different report about local weather and transport." },
      ],
      0.9,
    );
    expect(families[0]).toBe(families[1]);
    expect(families[0]).not.toBe(families[2]);
    expect(familyCount(families)).toBe(2);
  });

  it("keeps same-registrable-domain pages in one family", () => {
    const families = assignSourceFamilies([
      { url: "https://en.wikipedia.org/wiki/A", title: "A", snippet: "alpha" },
      { url: "https://en.wikipedia.org/wiki/B", title: "B", snippet: "beta" },
    ]);
    expect(families[0]).toBe(families[1]);
  });

  it("does not merge short snippets that happen to match", () => {
    const families = assignSourceFamilies([
      { url: "https://one.example/a", title: "Common Topic", snippet: "shared claim" },
      { url: "https://two.example/b", title: "Common Topic", snippet: "shared claim" },
    ]);
    expect(families[0]).not.toBe(families[1]);
  });

  it("scores identical long text as fully similar", () => {
    expect(textSimilarity(wire, wire)).toBe(1);
  });
});
