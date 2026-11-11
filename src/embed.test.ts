// @implements REQ-103 REQ-021b REQ-026f REQ-020g REQ-020b REQ-020e REQ-128 REQ-072 boilerplate-only
import { describe, it, expect } from "vitest";
import {
  createModel,
  cosineSimilarity,
  rankDocs,
  pairwiseSimilarity,
  embedQueryInto,
  isKnownModel,
  tokenize,
  identityTokens,
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

  it("keeps ASCII tokenization identical to the legacy tokenizer", () => {
    const legacy = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1);
    const corpus = [
      "The Quick, brown FOX!",
      "site:example.com filetype:pdf --draft",
      "State-of-the-art 2026 results (n=42)",
      "a b c",
      "",
    ];
    for (const text of corpus) expect(tokenize(text)).toEqual(legacy(text));
  });

  it("tokenizes non-Latin scripts instead of dropping them", () => {
    expect(tokenize("Привет мир")).toEqual(["привет", "мир"]);
    expect(tokenize("مرحبا بالعالم")).toEqual(["مرحبا", "بالعالم"]);
  });

  it("segments scripts without word separators into character bigrams", () => {
    expect(tokenize("日本語")).toEqual(["日本", "本語"]);
    expect(tokenize("한국어")).toEqual(["한국", "국어"]);
    expect(tokenize("日")).toEqual(["日"]);
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

describe("identityTokens (REQ-072)", () => {
  it("keeps digit-bearing tokens and mid-sentence proper nouns", () => {
    const identity = identityTokens("The Ashford January 2019 review under case 5042 was completed.");
    expect(identity).toEqual(new Set(["ashford", "january", "2019", "5042"]));
  });

  it("excludes a proper noun that opens a sentence", () => {
    // Including the first word of every sentence would fire on any update.
    expect(identityTokens("Parliament debated the tariff while the dockworkers organised.")).toEqual(new Set());
    expect(identityTokens("The review closed. Parliament debated the tariff.")).toEqual(new Set());
  });

  it("keeps a single-character digit, which the tokenizer drops", () => {
    expect(identityTokens("Case 7 was closed.")).toEqual(new Set(["7"]));
    expect(tokenize("Case 7 was closed.")).not.toContain("7");
  });

  it("splits apostrophes and hyphens into word tokens", () => {
    expect(identityTokens("Filed by O'Neill-Byrne for the committee.")).toEqual(new Set(["neill", "byrne"]));
  });

  it("returns an empty set for empty or identity-free text", () => {
    expect(identityTokens("")).toEqual(new Set());
    expect(identityTokens("the harbour lease review was completed under the usual procedure")).toEqual(new Set());
  });

  it("is deterministic", () => {
    const text = "The Bramley March 2020 review under case 6100 was completed.";
    expect(identityTokens(text)).toEqual(identityTokens(text));
  });
});
