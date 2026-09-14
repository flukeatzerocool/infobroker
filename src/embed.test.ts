// @implements REQ-103 REQ-021b REQ-026f REQ-020g REQ-020b REQ-020e
import { describe, it, expect } from "vitest";
import {
  createModel,
  cosineSimilarity,
  rankDocs,
  pairwiseSimilarity,
  embedQueryInto,
  isKnownModel,
  tokenize,
  DEFAULT_MODEL,
} from "./embed.js";

describe("embed (REQ-103)", () => {
  it("exposes known model references and rejects unknown ones", () => {
    expect(isKnownModel("signed-hash-tfidf")).toBe(true);
    expect(isKnownModel("lsa")).toBe(true);
    expect(isKnownModel("bert-neural")).toBe(false);
    expect(createModel("nope")).toBeNull();
  });

  it("tokenizes to lowercase alphanumeric terms", () => {
    expect(tokenize("The Quick, brown FOX!")).toEqual(["the", "quick", "brown", "fox"]);
  });

  it("hash model produces fixed-dimension vectors regardless of corpus", () => {
    const model = createModel(DEFAULT_MODEL)!;
    model.fit(["alpha beta", "gamma delta"]);
    const v = model.embed("alpha gamma");
    expect(v.length).toBe(model.dims);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("lsa model serializes and reloads its basis", () => {
    const model = createModel("lsa")!;
    model.fit([
      "electric vehicles reduce carbon emissions on the road",
      "the car uses a battery and produces no exhaust",
      "bananas are a yellow tropical fruit",
      "fruit contains natural sugars and fiber",
    ]);
    const before = model.embed("electric car battery");
    const state = model.serialize();
    const restored = createModel("lsa")!;
    expect(restored.load(state)).toBe(true);
    const after = restored.embed("electric car battery");
    expect(after.length).toBe(before.length);
    expect(cosineSimilarity(before, after)).toBeCloseTo(1, 5);
  });

  it("rankDocs orders candidates by similarity and drops zero scores", () => {
    const docs = ["quantum computing and qubits", "baking sourdough bread", "quantum error correction with qubits"];
    const ranked = rankDocs("quantum computing qubits", docs, "lsa");
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
  });

  it("pairwiseSimilarity is symmetric with a unit diagonal", () => {
    const sim = pairwiseSimilarity(["alpha beta gamma", "alpha beta delta", "zeta eta theta"], "lsa");
    expect(sim[0][1]).toBeCloseTo(sim[1][0], 6);
    expect(sim[0][0]).toBeCloseTo(1, 3);
  });

  it("embedQueryInto projects a query into the document basis", () => {
    const { queryVec, docVecs } = embedQueryInto("battery electric", ["electric car battery", "sourdough bread"], "lsa");
    expect(queryVec.length).toBe(docVecs[0].length);
  });
});
