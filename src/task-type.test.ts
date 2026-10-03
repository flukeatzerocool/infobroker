// @implements REQ-020a
import { describe, it, expect } from "vitest";
import { classifyTaskType, TASK_TYPE_KEYWORDS, type Ranker } from "./task-type.js";

describe("classifyTaskType (REQ-020a)", () => {
  it("selects a task type by literal keyword", () => {
    expect(classifyTaskType("what is the definition of serendipity")).toBe("definition");
    expect(classifyTaskType("latest news on the merger")).toBe("news");
    expect(classifyTaskType("arxiv paper on transformers")).toBe("academic");
    expect(classifyTaskType("10-K filing for acme corp")).toBe("financial");
    expect(classifyTaskType("where is the eiffel tower")).toBe("location");
  });

  it("falls back to semantic similarity when no keyword matches", () => {
    const academicIndex = Object.keys(TASK_TYPE_KEYWORDS).indexOf("academic");
    const ranker: Ranker = () => [{ index: academicIndex, score: 0.9 }];
    expect(classifyTaskType("quantum entanglement", ranker)).toBe("academic");
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

  it("does not invoke the ranker when a keyword already matches", () => {
    let called = false;
    const ranker: Ranker = () => {
      called = true;
      return [];
    };
    expect(classifyTaskType("wiki page for ada lovelace", ranker)).toBe("encyclopedia");
    expect(called).toBe(false);
  });
});
