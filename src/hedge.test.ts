// @implements REQ-031 REQ-021
import { describe, it, expect, vi } from "vitest";
import { computeHedgeDelay, raceFirstSuccess } from "./hedge.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("computeHedgeDelay", () => {
  const opts = { minMs: 200, maxMs: 1500 };

  it("hedges at the floor when there is no latency history", () => {
    expect(computeHedgeDelay(0, opts)).toBe(200);
  });

  it("tracks the primary's average latency within the window", () => {
    expect(computeHedgeDelay(500, opts)).toBe(500);
  });

  it("clamps low latency up to the floor", () => {
    expect(computeHedgeDelay(50, opts)).toBe(200);
  });

  it("clamps high latency down to the cap", () => {
    expect(computeHedgeDelay(5000, opts)).toBe(1500);
  });
});

describe("raceFirstSuccess", () => {
  it("resolves with the first successful task", async () => {
    const out = await raceFirstSuccess([
      { slug: "a", run: async () => "A" },
      { slug: "b", run: async () => "B" },
    ]);
    expect(out).toEqual({ slug: "a", value: "A" });
  });

  it("skips an empty (null) result and takes the next success", async () => {
    const out = await raceFirstSuccess([
      { slug: "a", run: async () => null },
      { slug: "b", run: async () => "B" },
    ]);
    expect(out).toEqual({ slug: "b", value: "B" });
  });

  it("skips an empty array result", async () => {
    const out = await raceFirstSuccess([
      { slug: "a", run: async () => [] as string[] },
      { slug: "b", run: async () => ["B"] as string[] },
    ]);
    expect(out).toEqual({ slug: "b", value: ["B"] });
  });

  it("treats a thrown error as a failure and continues", async () => {
    const out = await raceFirstSuccess([
      { slug: "a", run: async () => { throw new Error("boom"); } },
      { slug: "b", run: async () => "B" },
    ]);
    expect(out).toEqual({ slug: "b", value: "B" });
  });

  it("rejects when every task fails", async () => {
    await expect(
      raceFirstSuccess([
        { slug: "a", run: async () => null },
        { slug: "b", run: async () => { throw new Error("down"); } },
      ]),
    ).rejects.toThrow(/all providers failed/);
  });

  it("rejects when every task returns empty", async () => {
    await expect(
      raceFirstSuccess([
        { slug: "a", run: async () => [] as string[] },
        { slug: "b", run: async () => null },
      ]),
    ).rejects.toThrow(/all providers failed/);
  });

  describe("with a preferred primary and grace window", () => {
    it("takes the primary when it wins outright", async () => {
      const out = await raceFirstSuccess(
        [
          { slug: "primary", run: async () => "P" },
          { slug: "alt", run: async () => "A" },
        ],
        { prefer: "primary", graceMs: 50 },
      );
      expect(out).toEqual({ slug: "primary", value: "P" });
    });

    it("yields to the primary when it succeeds within the grace window", async () => {
      const out = await raceFirstSuccess(
        [
          { slug: "primary", run: async () => { await sleep(20); return "P"; } },
          { slug: "alt", run: async () => "A" },
        ],
        { prefer: "primary", graceMs: 50 },
      );
      expect(out).toEqual({ slug: "primary", value: "P" });
    });

    it("falls back to the alternate when the primary misses the grace window", async () => {
      const out = await raceFirstSuccess(
        [
          { slug: "primary", run: async () => { await sleep(120); return "P"; } },
          { slug: "alt", run: async () => "A" },
        ],
        { prefer: "primary", graceMs: 20 },
      );
      expect(out).toEqual({ slug: "alt", value: "A" });
    });

    it("releases a grace-pending alternate immediately when the primary fails", async () => {
      const out = await raceFirstSuccess(
        [
          { slug: "primary", run: async () => { await sleep(5); return null; } },
          { slug: "alt", run: async () => "A" },
        ],
        { prefer: "primary", graceMs: 500 },
      );
      expect(out).toEqual({ slug: "alt", value: "A" });
    });
  });
});
