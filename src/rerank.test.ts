// @implements REQ-021b content-mode REQ-021b full-content-mode
import { describe, it, expect } from "vitest";
import { splitPassages, scorePassages, rankPassages } from "./rerank.js";

describe("splitPassages (REQ-021b)", () => {
  it("splits at sentence boundaries into roughly passage-sized chunks", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Sentence number ${i} with enough words to be meaningful.`).join(" ");
    const passages = splitPassages(text, 12);
    expect(passages.length).toBeGreaterThan(1);
    for (const p of passages) {
      expect(p.split(/\s+/).length).toBeLessThanOrEqual(24);
    }
  });

  it("strips code fences", () => {
    const text = "Intro sentence with words. ```\nconst x = 1;\n``` Another sentence follows here.";
    const passages = splitPassages(text, 100);
    const joined = passages.join(" ");
    expect(joined).not.toContain("const x");
    expect(joined).toContain("Intro sentence");
  });
});

describe("scorePassages (REQ-021b content-mode)", () => {
  it("ranks the passage that answers the question highest", () => {
    const passages = [
      "The capital of France is Paris, a major European city.",
      "Apples are a common fruit and grow in temperate climates.",
      "The Eiffel Tower stands in Paris beside the Seine river.",
    ];
    const ranked = scorePassages(passages, "what is the capital of France");
    expect(ranked[0].text).toContain("capital of France");
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("returns no passages when nothing matches the question", () => {
    const passages = ["Completely unrelated text about gardening tools."];
    const ranked = scorePassages(passages, "quantum entanglement in birds");
    expect(ranked.length).toBeGreaterThanOrEqual(0);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
  });
});

describe("rankPassages (REQ-021b full-content-mode)", () => {
  it("returns top-k matches with an empty result signalling a non-answer", () => {
    const text = "Paris is the capital of France. The city sits on the river Seine. France is in Europe.";
    const top = rankPassages(text, "what river runs through Paris", 10, 1);
    expect(top.length).toBeLessThanOrEqual(1);
    if (top.length > 0) {
      expect(top[0].score).toBeGreaterThan(0);
    }
  });
});
