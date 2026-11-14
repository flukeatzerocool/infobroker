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

  it("merges short republished snippets that match", () => {
    const families = assignSourceFamilies([
      {
        url: "https://one.example/a",
        title: "Claim Copy",
        snippet: "bridge inspection found structure sound today",
      },
      {
        url: "https://two.example/b",
        title: "Claim Copy",
        snippet: "bridge inspection found structure sound today",
      },
    ]);
    expect(families[0]).toBe(families[1]);
  });

  it("keeps short snippets with different text in separate families", () => {
    const families = assignSourceFamilies([
      {
        url: "https://one.example/a",
        title: "Claim Copy",
        snippet: "bridge inspection found structure sound today",
      },
      {
        url: "https://two.example/b",
        title: "Claim Copy",
        snippet: "harbour dredging delayed until next spring",
      },
    ]);
    expect(families[0]).not.toBe(families[1]);
  });

  it("does not merge on a single shared shingle or a shared title", () => {
    const short = assignSourceFamilies([
      { url: "https://one.example/a", title: "Wire", snippet: "bridge inspection sound" },
      { url: "https://two.example/b", title: "Wire", snippet: "bridge inspection sound" },
    ]);
    expect(short[0]).not.toBe(short[1]);

    const titles = assignSourceFamilies([
      {
        url: "https://one.example/a",
        title: "Bridge inspection found structure sound",
        snippet: "council voted",
      },
      {
        url: "https://two.example/b",
        title: "Bridge inspection found structure sound",
        snippet: "mayor resigned",
      },
    ]);
    expect(titles[0]).not.toBe(titles[1]);
  });

  it("scores identical long text as fully similar", () => {
    expect(textSimilarity(wire, wire)).toBe(1);
  });

  // F-R5-B-8: containment must not count as republication. `words23` yields
  // exactly 20 four-gram shingles; `words39` starts with it and yields 36.
  const words23 = "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey";
  const words39 = `${words23} xray yankee zulu aardvark beetle camel dolphin eagle falcon giraffe hamster ibis jaguar koala lemur mongoose`;
  const excerpt12 = words23.split(" ").slice(0, 12).join(" ");

  it("scores a contained excerpt by the larger text, not the smaller", () => {
    expect(textSimilarity(excerpt12, words39)).toBeCloseTo(9 / 36, 5);
    expect(textSimilarity(excerpt12, words39)).toBeLessThan(0.9);
  });

  it("is symmetric in its arguments", () => {
    expect(textSimilarity(words39, excerpt12)).toBeCloseTo(textSimilarity(excerpt12, words39), 10);
  });

  it("keeps a small boilerplate delta above the merge threshold", () => {
    expect(textSimilarity(words23, `${words23} xray yankee`)).toBeCloseTo(20 / 22, 5);
    expect(textSimilarity(words23, `${words23} xray yankee`)).toBeGreaterThanOrEqual(0.9);
  });

  it("keeps a short excerpt and its containing article in separate families", () => {
    const families = assignSourceFamilies([
      { url: "https://one.example/a", title: "", snippet: excerpt12 },
      { url: "https://two.example/b", title: "", snippet: words39 },
    ]);
    expect(families[0]).not.toBe(families[1]);
  });
});

// @implements REQ-121 threshold-configurable
describe("family similarity threshold is honoured (F-R5-B-10)", () => {
  const wireA = "The committee released its findings on Tuesday after a year-long inquiry into procurement practices across three agencies and two contractors.";
  const wireB = "The committee released its findings on Wednesday after a year-long inquiry into procurement practices across three agencies and two contractors.";

  it("merges the same pair at a lenient threshold and splits it at a strict one", () => {
    const pair = [
      { url: "https://alpha.example/story", title: "Report", snippet: wireA },
      { url: "https://beta.example/republish", title: "Report", snippet: wireB },
    ];
    // The pair scores ~0.75; a non-default 0.7 merges it, a 0.8 splits it.
    // A hardcoded 0.9 would also split it, so the merge is the discriminating
    // assertion; the split proves the parameter is not ignored downward.
    expect(textSimilarity(wireA, wireB)).toBeGreaterThan(0.7);
    expect(textSimilarity(wireA, wireB)).toBeLessThan(0.8);
    expect(familyCount(assignSourceFamilies(pair, 0.7))).toBe(1);
    expect(familyCount(assignSourceFamilies(pair, 0.8))).toBe(2);
  });
});
