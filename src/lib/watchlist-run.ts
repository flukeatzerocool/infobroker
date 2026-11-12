// @implements REQ-125
// watchlist-run.ts — the watchlist runner's control flow, separated from its CLI
// so the dry-run short-circuit, per-topic error isolation, claim retention, and
// the run-time write-back are testable without spawning the MCP server.
//
// The runner takes an injected `callTool` and `now`; it performs only the
// filesystem writes the contract names (one record per topic, and the watchlist's
// `last_run`). Scheduling stays external (REQ-125).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "./atomic-write.js";
import { diffClaims, dueTopics, markRun, type Watchlist } from "./watchlist.js";

export interface VerifyParse {
  ok: boolean;
  claims: string[];
  error?: string;
}

/** Classify a `verify_claims` tool response. An `[ERROR]` body is a failed run,
 * even though the MCP transport delivers it as ordinary content. */
export function parseVerifyEnvelope(text: string): VerifyParse {
  const trimmed = text.trim();
  if (trimmed.startsWith("[ERROR]")) {
    return { ok: false, claims: [], error: trimmed.slice("[ERROR]".length).trim() };
  }
  const body = trimmed.startsWith("[OK] ") ? trimmed.slice(5) : trimmed;
  try {
    const parsed = JSON.parse(body) as { findings?: Array<{ claim?: string; topic?: string }> };
    if (!Array.isArray(parsed.findings)) {
      return { ok: false, claims: [], error: "response carried no findings array" };
    }
    return {
      ok: true,
      claims: parsed.findings.map((finding) => finding.claim ?? finding.topic ?? "").filter(Boolean),
    };
  } catch {
    // A non-JSON body is an unreadable response; treat it as a failed run so the
    // topic is recorded as an error rather than as a successful empty run.
    return { ok: false, claims: [], error: "response was not JSON" };
  }
}

export interface RunRecord {
  topic: string;
  ran_at: string;
  status: "ok" | "error";
  /** Claims found by this run. Empty when the run failed or the result was empty. */
  claims: string[];
  /** Prior claims kept for diff continuity when this run found nothing. */
  retained_claims?: string[];
  carried_over?: boolean;
  suspected_empty?: boolean;
  last_success_at?: string;
  delta: { new: string[]; removed: string[] };
  error?: string;
}

export interface RunResult {
  due: string[];
  ran: string[];
  records: RunRecord[];
}

function readRecord(path: string): RunRecord | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as RunRecord;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    // An unreadable prior record starts a fresh chain rather than aborting the run.
    return null;
  }
}

/** The claim set a new delta is computed against: the last found set, or the
 * set retained across an empty/failed run. */
function effectivePrior(prior: RunRecord | null): string[] {
  if (prior === null) return [];
  if (Array.isArray(prior.claims) && prior.claims.length > 0) return prior.claims;
  return Array.isArray(prior.retained_claims) ? prior.retained_claims : [];
}

export async function runWatchlist(args: {
  watchlist: Watchlist;
  watchlistPath: string;
  outDir: string;
  dryRun?: boolean;
  callTool: (query: string) => Promise<string>;
  now?: Date;
}): Promise<RunResult> {
  const { watchlist, watchlistPath, outDir, callTool } = args;
  const now = args.now ?? new Date();
  const due = dueTopics(watchlist, now).filter((topic) => topic.due);
  if (args.dryRun === true || due.length === 0) {
    return { due: due.map((topic) => topic.id), ran: [], records: [] };
  }

  mkdirSync(outDir, { recursive: true });
  const ranAt = now.toISOString();
  let updated = watchlist;
  const records: RunRecord[] = [];
  const ran: string[] = [];

  for (const topic of due) {
    const recordPath = join(outDir, `${topic.id}.json`);
    const prior = readRecord(recordPath);
    const previous = effectivePrior(prior);
    const record: RunRecord = {
      topic: topic.id,
      ran_at: ranAt,
      status: "ok",
      claims: [],
      delta: { new: [], removed: [] },
      ...(prior?.last_success_at !== undefined ? { last_success_at: prior.last_success_at } : {}),
    };
    try {
      const payload = parseVerifyEnvelope(await callTool(topic.query));
      if (!payload.ok) throw new Error(payload.error ?? "verify_claims failed");
      if (payload.claims.length === 0) {
        // REQ-125: an empty result is distinguishable from a genuine removal, so
        // the prior claims are retained and the next run does not restate them.
        record.retained_claims = previous;
        record.carried_over = true;
        record.suspected_empty = true;
      } else {
        record.claims = payload.claims;
        record.delta = diffClaims(previous, payload.claims);
        record.last_success_at = ranAt;
      }
    } catch (error) {
      record.status = "error";
      record.error = error instanceof Error ? error.message : String(error);
      record.retained_claims = previous;
      record.carried_over = true;
    }
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
    records.push(record);
    ran.push(topic.id);
    updated = markRun(updated, topic.id, ranAt);
  }

  atomicWriteFile(watchlistPath, Buffer.from(`${JSON.stringify(updated, null, 2)}\n`, "utf-8"), 0o600);
  return { due: due.map((topic) => topic.id), ran, records };
}
