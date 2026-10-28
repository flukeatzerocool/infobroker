// @implements REQ-125
import { describe, it, expect } from "vitest";
import { parseWatchlist, dueTopics, diffClaims } from "./watchlist.js";

describe("watchlist (REQ-125)", () => {
  it("rejects malformed entries", () => {
    expect(() => parseWatchlist({})).toThrow();
    expect(() => parseWatchlist({ topics: [{ id: "", query: "q", interval_hours: 1 }] })).toThrow();
    expect(() => parseWatchlist({ topics: [{ id: "a", query: "q", interval_hours: 0 }] })).toThrow();
  });

  it("rejects ids that could escape the output directory", () => {
    expect(() => parseWatchlist({ topics: [{ id: "../escape", query: "q", interval_hours: 1 }] })).toThrow();
    expect(() => parseWatchlist({ topics: [{ id: "a/b", query: "q", interval_hours: 1 }] })).toThrow();
    expect(() => parseWatchlist({ topics: [{ id: "..", query: "q", interval_hours: 1 }] })).toThrow();
    expect(() => parseWatchlist({ topics: [{ id: "safe.id_1-2", query: "q", interval_hours: 1 }] })).not.toThrow();
  });

  it("selects due topics by interval", () => {
    const list = parseWatchlist({
      topics: [
        { id: "due", query: "q1", interval_hours: 1, last_run: "2026-10-26T00:00:00Z" },
        { id: "fresh", query: "q2", interval_hours: 1, last_run: "2026-10-26T23:30:00Z" },
        { id: "new", query: "q3", interval_hours: 1 },
      ],
    });
    const due = dueTopics(list, new Date("2026-10-26T23:45:00Z"));
    expect(due.find((t) => t.id === "due")?.due).toBe(true);
    expect(due.find((t) => t.id === "fresh")?.due).toBe(false);
    expect(due.find((t) => t.id === "new")?.due).toBe(true);
  });

  it("diffs claim lists", () => {
    expect(diffClaims(["a", "b"], ["b", "c"])).toEqual({ new: ["c"], removed: ["a"] });
  });
});
