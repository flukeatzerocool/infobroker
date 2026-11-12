// @implements REQ-125 dry-run
// @implements REQ-125 error-isolation
// @implements REQ-125 claim-retention
// @implements REQ-125 empty-result
// @implements REQ-125 last-run-persistence
// watchlist-run.test.ts — the runner's control flow without a server: dry-run,
// per-topic error isolation, found-versus-retained claims, and the last_run
// write-back (REQ-125).

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseWatchlist, type Watchlist } from "./watchlist.js";
import { runWatchlist, type RunRecord } from "./watchlist-run.js";

const NOW = new Date("2026-10-26T12:00:00Z");
const roots: string[] = [];

function workspace(watchlist: unknown): { root: string; path: string; out: string; list: Watchlist } {
  const root = mkdtempSync(join(tmpdir(), "watchlist-run-"));
  roots.push(root);
  const path = join(root, "watchlist.json");
  writeFileSync(path, JSON.stringify(watchlist, null, 2));
  return { root, path, out: join(root, "runs"), list: parseWatchlist(watchlist) };
}

function record(root: string, id: string): RunRecord {
  return JSON.parse(readFileSync(join(root, "runs", `${id}.json`), "utf-8")) as RunRecord;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("watchlist runner (REQ-125)", () => {
  // @implements REQ-125 dry-run
  it("selects due topics in dry-run mode without calling the tool or writing", async () => {
    const ws = workspace({ topics: [{ id: "a", query: "q", interval_hours: 1 }] });
    let calls = 0;
    const result = await runWatchlist({
      watchlist: ws.list,
      watchlistPath: ws.path,
      outDir: ws.out,
      dryRun: true,
      callTool: async () => {
        calls++;
        return '[OK] {"findings":[]}';
      },
      now: NOW,
    });
    expect(result.due).toEqual(["a"]);
    expect(result.ran).toEqual([]);
    expect(calls).toBe(0);
    expect(existsSync(ws.out)).toBe(false);
    expect(JSON.parse(readFileSync(ws.path, "utf-8")).topics[0].last_run).toBeUndefined();
  });

  // @implements REQ-125 error-isolation
  it("records a failing topic as an error without aborting the next", async () => {
    const ws = workspace({
      topics: [
        { id: "bad", query: "q1", interval_hours: 1 },
        { id: "good", query: "q2", interval_hours: 1 },
      ],
    });
    const result = await runWatchlist({
      watchlist: ws.list,
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async (query) => {
        if (query === "q1") throw new Error("provider_unavailable");
        return '[OK] {"findings":[{"claim":"claim one"}]}';
      },
      now: NOW,
    });
    expect(result.ran).toEqual(["bad", "good"]);
    expect(record(ws.root, "bad").status).toBe("error");
    expect(record(ws.root, "bad").error).toContain("provider_unavailable");
    expect(record(ws.root, "good").status).toBe("ok");
    expect(record(ws.root, "good").claims).toEqual(["claim one"]);
  });

  // @implements REQ-125 claim-retention
  it("retains prior claims when a run fails and does not restate them as new", async () => {
    const ws = workspace({ topics: [{ id: "a", query: "q", interval_hours: 1 }] });
    const first = await runWatchlist({
      watchlist: ws.list,
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async () => '[OK] {"findings":[{"claim":"claim one"}]}',
      now: NOW,
    });
    expect(first.records[0]!.claims).toEqual(["claim one"]);

    const failing = await runWatchlist({
      watchlist: parseWatchlist(JSON.parse(readFileSync(ws.path, "utf-8"))),
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async () => {
        throw new Error("boom");
      },
      now: new Date("2026-10-26T14:00:00Z"),
    });
    const failedRecord = failing.records[0]!;
    expect(failedRecord.status).toBe("error");
    expect(failedRecord.claims).toEqual([]);
    expect(failedRecord.retained_claims).toEqual(["claim one"]);
    expect(failedRecord.carried_over).toBe(true);
    expect(failedRecord.delta).toEqual({ new: [], removed: [] });
    expect(failedRecord.last_success_at).toBe(NOW.toISOString());

    const recovered = await runWatchlist({
      watchlist: parseWatchlist(JSON.parse(readFileSync(ws.path, "utf-8"))),
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async () => '[OK] {"findings":[{"claim":"claim one"}]}',
      now: new Date("2026-10-26T16:00:00Z"),
    });
    expect(recovered.records[0]!.claims).toEqual(["claim one"]);
    expect(recovered.records[0]!.delta).toEqual({ new: [], removed: [] });
  });

  // @implements REQ-125 empty-result
  it("flags an empty result and keeps it distinct from a genuine removal", async () => {
    const ws = workspace({ topics: [{ id: "a", query: "q", interval_hours: 1 }] });
    await runWatchlist({
      watchlist: ws.list,
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async () => '[OK] {"findings":[{"claim":"claim one"},{"claim":"claim two"}]}',
      now: NOW,
    });
    const empty = await runWatchlist({
      watchlist: parseWatchlist(JSON.parse(readFileSync(ws.path, "utf-8"))),
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async () => '[OK] {"findings":[]}',
      now: new Date("2026-10-26T14:00:00Z"),
    });
    expect(empty.records[0]!.status).toBe("ok");
    expect(empty.records[0]!.suspected_empty).toBe(true);
    expect(empty.records[0]!.claims).toEqual([]);
    expect(empty.records[0]!.retained_claims).toEqual(["claim one", "claim two"]);
    expect(empty.records[0]!.delta).toEqual({ new: [], removed: [] });

    const partial = await runWatchlist({
      watchlist: parseWatchlist(JSON.parse(readFileSync(ws.path, "utf-8"))),
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async () => '[OK] {"findings":[{"claim":"claim one"}]}',
      now: new Date("2026-10-26T16:00:00Z"),
    });
    expect(partial.records[0]!.claims).toEqual(["claim one"]);
    expect(partial.records[0]!.delta).toEqual({ new: [], removed: ["claim two"] });
  });

  // @implements REQ-125 last-run-persistence
  it("persists last_run so a second invocation selects nothing", async () => {
    const ws = workspace({ topics: [{ id: "a", query: "q", interval_hours: 1, extra: "kept" }] });
    const first = await runWatchlist({
      watchlist: ws.list,
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async () => '[OK] {"findings":[{"claim":"claim one"}]}',
      now: NOW,
    });
    expect(first.ran).toEqual(["a"]);
    const persisted = JSON.parse(readFileSync(ws.path, "utf-8"));
    expect(persisted.topics[0].last_run).toBe(NOW.toISOString());
    expect(persisted.topics[0].extra).toBe("kept");

    const second = await runWatchlist({
      watchlist: parseWatchlist(persisted),
      watchlistPath: ws.path,
      outDir: ws.out,
      callTool: async () => '[OK] {"findings":[]}',
      now: new Date("2026-10-26T12:30:00Z"),
    });
    expect(second.due).toEqual([]);
    expect(second.ran).toEqual([]);
  });
});
