// release-policy — pure release decisions for the push pipeline.
//
// Role: library + CLI. Holds the three decisions that must not be improvised in
// shell: (1) what to do with a version tag, (2) whether a step range may
// commit and push, and (3) how a run's changed paths split into convention
// commits. All are pure functions so they are unit-testable without running the
// pipeline; the CLI wrapper lets push-pipeline.sh call them.
//
// Exit codes: 0 = decision printed, 1 = usage error, 2 = unexpected error.

import { readFileSync } from "node:fs";

export type TagActionKind = "create" | "move" | "refuse";

export interface TagState {
  /** Version being released (package.json at release time). */
  currentVersion: string;
  /** Whether refs/tags/v<currentVersion> exists locally. */
  tagExists: boolean;
  /** Whether refs/tags/v<currentVersion> exists on the push remote. */
  remoteExists: boolean;
  /** package.json version recorded at that tag, or null when unreadable. */
  tagVersion: string | null;
  /** Whether the existing tag is an ancestor of HEAD. */
  isAncestor: boolean;
}

export interface TagDecision {
  action: TagActionKind;
  reason: string;
}

/**
 * tagAction — a published tag is immutable.
 *
 * A tag that exists on the remote is never moved: a correction is a new
 * version (a new CalVer), because a moved tag silently changes what every
 * downstream pin resolves to. The only move this policy permits is the retry
 * of an interrupted publish: the tag exists locally, is absent from the
 * remote, is an ancestor of HEAD, and carries the version being released.
 *
 * The 2026-11-04 release moved v2026.10.28 onto 2026.11.04 code; looking up
 * v<currentVersion> made that class impossible, and the version check below is
 * the backstop for a tag that was already corrupted. D-092 records why the
 * old `--force-tag` override was retired.
 */
export function tagAction(state: TagState): TagDecision {
  const tag = `v${state.currentVersion}`;
  if (state.remoteExists) {
    return {
      action: "refuse",
      reason: `${tag} is already published; a correction is a new version, never a moved tag`,
    };
  }
  if (!state.tagExists) {
    return { action: "create", reason: `no ${tag} tag yet` };
  }
  if (state.tagVersion === null) {
    return {
      action: "refuse",
      reason: `${tag} exists locally but its package.json version is unreadable; delete the local tag or bump the version`,
    };
  }
  if (state.tagVersion !== state.currentVersion) {
    return {
      action: "refuse",
      reason: `${tag} points at code version ${state.tagVersion}, not ${state.currentVersion}; delete the local tag or bump the version`,
    };
  }
  if (!state.isAncestor) {
    return {
      action: "refuse",
      reason: `${tag} exists locally and is not an ancestor of HEAD; delete the local tag or bump the version`,
    };
  }
  return {
    action: "move",
    reason: `${tag} is local-only (an interrupted publish); moving it onto HEAD`,
  };
}

export interface RunModeInput {
  start?: string;
  end?: string;
  commit?: boolean;
  noCommit?: boolean;
  noPush?: boolean;
}

export type RunMode =
  | { ok: true; noCommit: boolean; noPush: boolean }
  | { ok: false; error: string };

/**
 * resolveRunMode — a step range is a testing run unless the caller explicitly
 * asks to publish with --commit, and a truncated range (`--to`) never
 * publishes: the tree it leaves behind is not a complete release.
 */
export function resolveRunMode(input: RunModeInput): RunMode {
  const start = input.start ?? "";
  const end = input.end ?? "";
  if (end && input.commit) {
    return {
      ok: false,
      error: "--commit cannot be combined with --to: a truncated run never publishes.",
    };
  }
  if (end) return { ok: true, noCommit: true, noPush: true };
  if (start && !input.commit) return { ok: true, noCommit: true, noPush: true };
  return {
    ok: true,
    noCommit: Boolean(input.noCommit),
    noPush: Boolean(input.noPush),
  };
}

// ── Commit plan ─────────────────────────────────────────────────────────────
export interface PlannedCommit {
  key: string;
  subject: string;
  paths: string[];
}

export interface CommitPlanInput {
  /** Every path the run changed (added, modified, deleted). */
  paths: string[];
  /** Run date, YYYY-MM-DD; used in the per-bucket subject. */
  date: string;
  /** Release version; used in the release commit subject. */
  version: string;
  /**
   * Whether this run changed the version. Only then does the CHANGELOG entry
   * belong to a release commit; a docs-only CHANGELOG edit is documentation.
   */
  versionChanged?: boolean;
}

/** Bucket order follows AGENTS.md: spec → source+tests → pipeline → docs → release. */
const BUCKET_ORDER = ["spec", "source", "tests", "pipeline", "docs", "release"] as const;

const DOC_PATHS = new Set(["README.md", "DECISIONS.md", "ROADMAP.md", "AGENTS.md"]);

function isTestPath(path: string): boolean {
  return /\.test\.(ts|tsx|js|mjs)$/.test(path) || path.startsWith("test-fixtures/");
}

function isPipelinePath(path: string): boolean {
  return (
    path.startsWith("scripts/") ||
    path.startsWith(".githooks/") ||
    path.startsWith(".github/") ||
    path.startsWith("bin/")
  );
}

function bucketFor(path: string): string {
  if (path === "infobroker.md") return "spec";
  // A test travels with the area it tests ("source plus its tests"): splitting
  // a test into an earlier commit than its module would break that commit.
  if (path.startsWith("src/")) return "source";
  if (isPipelinePath(path)) return "pipeline";
  if (isTestPath(path)) return "tests";
  if (DOC_PATHS.has(path) || path.startsWith("skills/")) return "docs";
  return "release";
}

function subjectFor(key: string, input: CommitPlanInput): string {
  if (key === "release") return `Release: ${input.version}`;
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return `${label}: update for ${input.date}`;
}

/**
 * planCommits — deterministic path→bucket plan for a split commit series.
 *
 * Every input path lands in exactly one bucket, buckets are emitted in the
 * fixed convention order with empty buckets omitted, and the release bucket is
 * always last. The caller rewinds the version stamps before the earlier
 * commits, so a spec/source/docs file carries only its content hunks and its
 * stamp hunk falls out of the final `git add` — no partial-file staging is
 * needed. `CHANGELOG.md` is the one exception: its new entry is never rewound,
 * so it always travels with the release commit.
 */
export function planCommits(input: CommitPlanInput): PlannedCommit[] {
  const buckets = new Map<string, string[]>();
  for (const path of input.paths) {
    if (!path) continue;
    const key =
      path === "CHANGELOG.md" ? (input.versionChanged === false ? "docs" : "release") : bucketFor(path);
    const list = buckets.get(key);
    if (!list) buckets.set(key, [path]);
    else if (!list.includes(path)) list.push(path);
  }
  return BUCKET_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    subject: subjectFor(key, input),
    paths: buckets.get(key) ?? [],
  }));
}

// ── CLI ─────────────────────────────────────────────────────────────────────
// tag-action   --current <v> --exists <0|1> --remote-exists <0|1> --tag-version <v|-> --ancestor <0|1>
//   → prints "<action>|<reason>"
// commit-plan  --paths-file <f> --date <YYYY-MM-DD> --version <v> [--version-changed <0|1>]
//   → prints "key<TAB>subject<TAB>path" lines, one per path, in commit order
// run-mode     --start <s|-> --end <s|-> --commit <0|1> --no-commit <0|1> --no-push <0|1>
//   → prints "ok|<noCommit>|<noPush>" or "error|<message>"
function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

function truthy(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === "tag-action") {
    const current = flag(rest, "current");
    const exists = flag(rest, "exists");
    const remoteExists = flag(rest, "remote-exists");
    if (!current || exists === undefined || remoteExists === undefined) {
      process.stderr.write(
        "usage: release-policy tag-action --current <v> --exists <0|1> --remote-exists <0|1> [--tag-version <v|->] [--ancestor <0|1>]\n",
      );
      return 1;
    }
    const decision = tagAction({
      currentVersion: current,
      tagExists: truthy(exists),
      remoteExists: truthy(remoteExists),
      tagVersion: flag(rest, "tag-version") === "-" ? null : (flag(rest, "tag-version") ?? null),
      isAncestor: truthy(flag(rest, "ancestor")),
    });
    process.stdout.write(`${decision.action}|${decision.reason}\n`);
    return 0;
  }
  if (command === "commit-plan") {
    const pathsFile = flag(rest, "paths-file");
    const date = flag(rest, "date");
    const version = flag(rest, "version");
    if (!pathsFile || !date || !version) {
      process.stderr.write(
        "usage: release-policy commit-plan --paths-file <f> --date <YYYY-MM-DD> --version <v> [--version-changed <0|1>]\n",
      );
      return 1;
    }
    const readLines = (path: string): string[] =>
      readFileSync(path, "utf-8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    const plan = planCommits({
      paths: readLines(pathsFile),
      date,
      version,
      versionChanged: flag(rest, "version-changed") === undefined ? undefined : truthy(flag(rest, "version-changed")),
    });
    for (const commit of plan) {
      for (const path of commit.paths) {
        process.stdout.write(`${commit.key}\t${commit.subject}\t${path}\n`);
      }
    }
    return 0;
  }
  if (command === "run-mode") {
    const mode = resolveRunMode({
      start: flag(rest, "start") === "-" ? "" : flag(rest, "start"),
      end: flag(rest, "end") === "-" ? "" : flag(rest, "end"),
      commit: truthy(flag(rest, "commit")),
      noCommit: truthy(flag(rest, "no-commit")),
      noPush: truthy(flag(rest, "no-push")),
    });
    process.stdout.write(
      mode.ok ? `ok|${mode.noCommit}|${mode.noPush}\n` : `error|${mode.error}\n`,
    );
    return 0;
  }
  process.stderr.write("usage: release-policy <tag-action|run-mode> [flags]\n");
  return 1;
}

if (process.argv[1]?.endsWith("release-policy.ts")) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    process.stderr.write(`release-policy: ${(err as Error).message}\n`);
    process.exit(2);
  }
}
