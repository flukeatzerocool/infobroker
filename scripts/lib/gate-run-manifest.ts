// gate-run-manifest.ts — the gate-run record the git hooks read.
//
// A run of the full suite writes a small record keyed on the git tree object
// for HEAD plus a clean working tree, so `.githooks/pre-push` can skip a
// duplicate suite only for the exact tree that was verified. The tree object is
// the content hash: a path list would let an edit to an untracked file pass,
// while the clean-tree check plus `HEAD^{tree}` cannot.
//
// State lives under `$TMPDIR/infobroker/` (the documented local-state
// directory), in a 0700 directory, with a filename keyed by the repo root so
// two checkouts on one machine never read each other's records. It is never
// committed: `.infobroker/` inside the tree is rejected by the shipped-KB gate.
//
// Local state only: no network, no wall-clock decisions (the timestamp is
// informational).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type GateRunMode = "fast" | "full";

export interface GateRun {
  schema: 1;
  mode: GateRunMode;
  head: string;
  tree: string;
  recorded_at: string;
}

export interface TreeState {
  head: string;
  tree: string;
  clean: boolean;
}

/** State directory shared with quota and truncation files. */
export function stateDir(): string {
  return join(tmpdir(), "infobroker");
}

function repoKey(root: string): string {
  let resolved = root;
  try {
    resolved = realpathSync(root);
  } catch {
    // A path that cannot be resolved still gets a stable-enough key.
  }
  return createHash("sha256").update(resolved).digest("hex").slice(0, 12);
}

/** The run record path for one repository. */
export function recordPath(root: string): string {
  return join(stateDir(), `gate-run-${repoKey(root)}.json`);
}

/** The per-gate timing path for one repository. */
export function timingPath(root: string): string {
  return join(stateDir(), `gate-timing-${repoKey(root)}.json`);
}

function ensureStateDir(): void {
  mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf-8" }).trim();
}

/**
 * treeState — HEAD, its tree object, and whether the working tree is clean
 * (untracked files included). Returns null outside a git repo or before the
 * first commit; the caller treats null as "no record can match".
 */
export function treeState(root: string): TreeState | null {
  try {
    const head = git(root, ["rev-parse", "HEAD"]);
    const tree = git(root, ["rev-parse", "HEAD^{tree}"]);
    const dirty = git(root, ["status", "--porcelain", "--untracked-files=all"]);
    return { head, tree, clean: dirty === "" };
  } catch {
    // Not a git repo, or no commit yet: nothing to key a record on.
    return null;
  }
}

/** readGateRun — the stored record, or null when absent or unreadable. */
export function readGateRun(root: string): GateRun | null {
  const path = recordPath(root);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as GateRun;
    if (parsed.schema !== 1 || !parsed.head || !parsed.tree) return null;
    if (parsed.mode !== "fast" && parsed.mode !== "full") return null;
    return parsed;
  } catch {
    // A corrupt record is treated as absent: the hook runs the suite.
    return null;
  }
}

/**
 * writeGateRun — record a passing run for the current tree. A dirty tree is
 * never recorded (the record could not match later anyway), so the call
 * returns null and the caller can warn.
 */
export function writeGateRun(root: string, mode: GateRunMode, now = new Date()): GateRun | null {
  const state = treeState(root);
  if (!state || !state.clean) return null;
  const record: GateRun = {
    schema: 1,
    mode,
    head: state.head,
    tree: state.tree,
    recorded_at: now.toISOString(),
  };
  ensureStateDir();
  writeFileSync(recordPath(root), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  return record;
}

/**
 * gateRunMatches — true when a stored record covers the current tree at the
 * required level. A `fast` record never satisfies a `full` requirement: the
 * excluded gates (network, build artifact) have not run.
 */
export function gateRunMatches(root: string, required: GateRunMode): boolean {
  const record = readGateRun(root);
  if (!record) return false;
  const state = treeState(root);
  if (!state || !state.clean) return false;
  if (record.head !== state.head || record.tree !== state.tree) return false;
  return required === "fast" ? true : record.mode === "full";
}

/** recordedMode — the level already verified for this tree, for `--recorded`. */
export function recordedMode(root: string): GateRunMode | null {
  if (!gateRunMatches(root, "fast")) return null;
  return readGateRun(root)?.mode ?? null;
}
