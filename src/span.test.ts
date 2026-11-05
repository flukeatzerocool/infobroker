// @implements REQ-026h span-located
// @implements REQ-026h span-unavailable
import { describe, it, expect } from "vitest";
import { locateSupport, splitSentences, MAX_SPAN_TEXT } from "./span.js";

describe("splitSentences", () => {
  it("splits on sentence punctuation and keeps offsets", () => {
    const text = "First sentence. Second sentence! Third?";
    const slices = splitSentences(text);
    expect(slices).toHaveLength(3);
    for (const slice of slices) {
      expect(text.slice(slice.start, slice.end)).toBe(slice.text);
    }
  });

  it("returns one slice when there is no punctuation", () => {
    const slices = splitSentences("  plain text without punctuation  ");
    expect(slices).toHaveLength(1);
    expect(slices[0]!.text).toBe("plain text without punctuation");
  });

  it("returns nothing for empty text", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("locateSupport", () => {
  it("finds the sentence that carries the claim", () => {
    const snippet =
      "Unrelated opening matter. Red teaming reduces model risk in production. Another trailing note.";
    const span = locateSupport(snippet, "red teaming reduces model risk");
    expect(span).not.toBeNull();
    expect(span!.text).toBe("Red teaming reduces model risk in production.");
    expect(snippet.slice(span!.start, span!.end)).toBe(span!.text);
  });

  it("skips leading whitespace from the offsets", () => {
    const snippet = "  Intro words. The claim lives here for the test.";
    const span = locateSupport(snippet, "the claim lives here");
    expect(span!.text.startsWith("The claim")).toBe(true);
    expect(snippet[span!.start]).toBe("T");
  });

  it("returns null when no sentence clears the overlap floor", () => {
    expect(locateSupport("Completely unrelated content.", "quantum entanglement teleportation")).toBeNull();
  });

  it("returns null for empty inputs", () => {
    expect(locateSupport("", "a claim")).toBeNull();
    expect(locateSupport("a claim", "   ")).toBeNull();
  });

  it("caps the returned text and keeps the offsets consistent", () => {
    const long = `${"alpha ".repeat(60)}end.`;
    const span = locateSupport(long, "alpha alpha alpha");
    expect(span).not.toBeNull();
    expect(span!.text.length).toBeLessThanOrEqual(MAX_SPAN_TEXT);
    expect(long.slice(span!.start, span!.end)).toBe(span!.text);
  });

  it("is deterministic", () => {
    const snippet = "Alpha beta gamma. Delta epsilon zeta.";
    const a = locateSupport(snippet, "delta epsilon");
    const b = locateSupport(snippet, "delta epsilon");
    expect(a).toEqual(b);
  });
});
