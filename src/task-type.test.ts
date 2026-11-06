// @implements REQ-020a word-boundary REQ-020a scholarly-signals REQ-020a confidence-floor REQ-020a override REQ-020a reported-task-type REQ-020a narrow-chain-guard
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyTaskType,
  resolveTaskType,
  isSearchableTaskType,
  TASK_TYPE_KEYWORDS,
  SEARCHABLE_TASK_TYPES,
  MIN_SIGNAL_SCORE,
  type Ranker,
} from "./task-type.js";

describe("classifyTaskType (REQ-020a)", () => {
  it("selects a task type by literal keyword", () => {
    expect(classifyTaskType("what is the definition of serendipity")).toBe("definition");
    expect(classifyTaskType("latest news on the merger")).toBe("news");
    expect(classifyTaskType("arxiv paper on transformers")).toBe("academic");
    expect(classifyTaskType("10-K filing for acme corp")).toBe("financial");
    expect(classifyTaskType("where is the eiffel tower")).toBe("location");
  });

  // REQ-020a word-boundary: a signal may not match inside a longer word.
  it("matches whole words, not substrings", () => {
    expect(classifyTaskType("capacity of the Suez Canal")).not.toBe("location"); // "city" in capacity
    expect(classifyTaskType("capacity of the Suez Canal")).toBe("general_web");
    expect(classifyTaskType("update on the election results")).not.toBe("structured_fact"); // "date" in update
    expect(classifyTaskType("update on the election results")).toBe("general_web");
    expect(classifyTaskType("gold standard history")).toBe("general_web"); // "old" in gold
  });

  // REQ-020a scholarly-signals: DOI, author–year, and cited work.
  it("recognises scholarly signals", () => {
    expect(classifyTaskType("10.1038/nature12373")).toBe("academic");
    expect(classifyTaskType("Smith 2020 attention mechanisms")).toBe("academic");
    expect(classifyTaskType("Smith et al. 2020 attention mechanisms")).toBe("academic");
    expect(classifyTaskType("Van der Berg 2020 citation networks")).toBe("academic");
    expect(classifyTaskType("as Smith 2020 shows")).toBe("academic");
    expect(classifyTaskType("peer-reviewed studies on sleep deprivation")).toBe("academic");
    expect(classifyTaskType('Sharon Mazer "Donald Trump Shoots the Match" TDR Drama Review')).toBe("academic");
    expect(classifyTaskType('Abraham Riesman "Trump Is a Pro Wrestler"')).toBe("academic");
  });

  it("does not treat a bare quoted phrase as a cited work", () => {
    expect(classifyTaskType('"coffee shops in berlin"')).toBe("general_web");
    expect(classifyTaskType('best "coffee shops in berlin"')).toBe("general_web");
  });

  it("prefers the specific signal over a generic one", () => {
    expect(classifyTaskType("research paper on transformer architectures")).toBe("academic");
    expect(classifyTaskType("journal of machine learning research transformer scaling")).toBe("academic");
  });

  // REQ-021i: an explicitly named measurable attribute is decisive even when a
  // title-plus-year token would otherwise read as an author-year citation.
  it("routes measurable-attribute queries to structured_fact", () => {
    expect(classifyTaskType("Survivor Series 1997 attendance")).toBe("structured_fact");
    expect(classifyTaskType("WrestleMania 23 attendance")).toBe("structured_fact");
    expect(classifyTaskType("what percent of Americans trust news")).toBe("structured_fact");
    expect(classifyTaskType("US trust in news percentage 2025")).toBe("structured_fact");
    expect(classifyTaskType("what date did the Montreal Screwjob happen")).toBe("structured_fact");
    // Guards: the decisive tokens do not disturb the existing routes.
    expect(classifyTaskType("population of Austin")).toBe("structured_fact");
    expect(classifyTaskType("Smith et al. 2020 attention mechanisms")).toBe("academic");
    expect(classifyTaskType("capacity of the Suez Canal")).toBe("general_web");
  });

  it("recognises biography queries", () => {
    expect(classifyTaskType("Ada Lovelace biography")).toBe("encyclopedia");
    expect(classifyTaskType("who was Marie Curie")).toBe("encyclopedia");
  });

  // REQ-020a confidence-floor: one generic token is not enough evidence.
  it("keeps general_web when only a generic signal matches", () => {
    expect(MIN_SIGNAL_SCORE).toBe(2);
    expect(classifyTaskType("paper")).toBe("general_web");
    expect(classifyTaskType("map")).toBe("general_web");
  });

  // REQ-020a override.
  it("uses a caller-supplied task type without reclassifying", () => {
    const q = 'Sharon Mazer "Donald Trump Shoots the Match" TDR Drama Review';
    expect(resolveTaskType(q, "academic")).toEqual({ taskType: "academic", source: "override" });
    // The override wins even when it contradicts the automatic classification.
    expect(resolveTaskType("latest news on the merger", "academic").taskType).toBe("academic");
    // Auto path is unchanged when no override is supplied.
    expect(resolveTaskType(q)).toEqual({ taskType: "academic", source: "auto" });
  });

  it("rejects an unknown or non-searchable task type", () => {
    for (const bad of ["content_fetch", "scholarly", ""]) {
      const resolved = resolveTaskType("any query", bad);
      expect(resolved.error, `expected "${bad}" to be rejected`).toBeDefined();
      expect(resolved.error?.remediation).toContain("academic");
    }
    expect(isSearchableTaskType("content_fetch")).toBe(false);
    expect(SEARCHABLE_TASK_TYPES).toHaveLength(14);
  });

  it("falls back to semantic similarity when no keyword matches", () => {
    const academicIndex = Object.keys(TASK_TYPE_KEYWORDS).indexOf("academic");
    const ranker: Ranker = () => [{ index: academicIndex, score: 0.9 }];
    expect(classifyTaskType("quantum entanglement", ranker)).toBe("academic");
  });

  // REQ-020a narrow-chain-guard: a semantic-only match may not pick a narrow
  // chain, however confident the score.
  it("does not let the semantic fallback select a narrow chain", () => {
    const locationIndex = Object.keys(TASK_TYPE_KEYWORDS).indexOf("location");
    const locationRanker: Ranker = () => [{ index: locationIndex, score: 0.99 }];
    expect(classifyTaskType("Abraham Riesman and his subject", locationRanker)).toBe("general_web");

    const definitionIndex = Object.keys(TASK_TYPE_KEYWORDS).indexOf("definition");
    const definitionRanker: Ranker = () => [{ index: definitionIndex, score: 0.99 }];
    expect(classifyTaskType("serendipity", definitionRanker)).toBe("general_web");

    const encyclopediaIndex = Object.keys(TASK_TYPE_KEYWORDS).indexOf("encyclopedia");
    const broadRanker: Ranker = () => [{ index: encyclopediaIndex, score: 0.99 }];
    expect(classifyTaskType("a life story", broadRanker)).toBe("encyclopedia");
  });

  it("keeps the general_web default when semantic similarity is below the bar", () => {
    const ranker: Ranker = () => [{ index: 0, score: 0.2 }];
    expect(classifyTaskType("quantum entanglement", ranker)).toBe("general_web");
  });

  it("keeps the general_web default when the ranker is unavailable", () => {
    const ranker: Ranker = () => {
      throw new Error("model unavailable");
    };
    expect(classifyTaskType("quantum entanglement", ranker)).toBe("general_web");
  });

  it("does not invoke the ranker when a keyword already clears the floor", () => {
    let called = false;
    const ranker: Ranker = () => {
      called = true;
      return [];
    };
    expect(classifyTaskType("wiki page for ada lovelace", ranker)).toBe("encyclopedia");
    expect(called).toBe(false);
  });
});

describe("task-type regression corpus (REQ-020a)", () => {
  // Rows 1–2 are the misroutes recorded in the "Promoter's Chair" session
  // (ses_e5606586bffeWNyqFJq4HrJ73g); rows 7–8 are recorded session queries;
  // the rest are direct classifier probes. Each expectation is a routing
  // outcome, not an implementation detail.
  const corpus: Array<{ query: string; expected: string; old: string }> = [
    { query: 'Abraham Riesman "Trump Is a Pro Wrestler"', expected: "academic", old: "location" },
    { query: 'Sharon Mazer "Donald Trump Shoots the Match" TDR Drama Review', expected: "academic", old: "general_web" },
    { query: "Ada Lovelace biography", expected: "encyclopedia", old: "general_web" },
    { query: "research paper on transformer architectures", expected: "academic", old: "general_web" },
    { query: "journal of machine learning research transformer scaling", expected: "academic", old: "general_web" },
    { query: "10.1038/nature12373", expected: "academic", old: "financial" },
    { query: "small language models 3B 7B tool calling reliability research paper", expected: "academic", old: "general_web" },
    { query: "Judging LLM-as-a-Judge MT-Bench Chatbot Arena arxiv 2306.05685", expected: "academic", old: "general_web" },
    { query: "capacity of the Suez Canal", expected: "general_web", old: "location" },
    { query: "update on the election results", expected: "general_web", old: "structured_fact" },
    { query: "gold standard history", expected: "general_web", old: "archive" },
  ];

  for (const { query, expected, old } of corpus) {
    it(`routes ${JSON.stringify(query)} to ${expected} (was ${old})`, () => {
      expect(classifyTaskType(query)).toBe(expected);
    });
  }
});

// CR-3/CR-15: the author–year signal must not fire on a lowercase word or a
// multi-word title before a year. These are the named routing regressions for
// title-plus-year, author–year, and attendance queries.
describe("routing regressions (CR-3, CR-15)", () => {
  // False positives: assert the route, not the exact fallback. The semantic
  // fallback is model-dependent, so only "not academic" is stable; an empty
  // ranker pins the general_web default when nothing else fires.
  for (const query of ["election results 2024", "The Great Gatsby 1925", "Berlin Wall 1989"]) {
    it(`keeps ${JSON.stringify(query)} off the academic chain`, () => {
      expect(classifyTaskType(query)).not.toBe("academic");
      expect(classifyTaskType(query, () => [])).toBe("general_web");
    });
  }

  // Author–year: a literal signal fires, so the exact route is stable.
  it("keeps a capitalized author–year citation on the academic chain", () => {
    expect(classifyTaskType("Smith 2020 attention mechanisms")).toBe("academic");
    expect(classifyTaskType("Smith et al. 2020 attention mechanisms")).toBe("academic");
    expect(classifyTaskType("Mazer 1997")).toBe("academic");
  });

  // Title-plus-year with a measurable attribute: the attribute outweighs the
  // scholarly signal, so the academic chain must not win.
  it("keeps title-plus-year attendance queries on the structured_fact chain", () => {
    expect(classifyTaskType("Survivor Series 1997 attendance")).toBe("structured_fact");
    expect(classifyTaskType("WrestleMania 23 attendance")).toBe("structured_fact");
    expect(classifyTaskType("The Great Gatsby 1925 box office")).not.toBe("academic");
  });
});

describe("searchable task types match the dispatch table (REQ-020a)", () => {
  it("equals the shipped config dispatch keys minus content_fetch", () => {
    const configPath = join(import.meta.dirname, "..", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as { dispatch: Record<string, string[]> };
    const expected = Object.keys(config.dispatch).filter((type) => type !== "content_fetch");
    // Order is the §7.1 table order, which differs from the config file's key
    // order; the guard is over membership, so compare sorted.
    expect([...SEARCHABLE_TASK_TYPES].sort()).toEqual(expected.sort());

  });
});
