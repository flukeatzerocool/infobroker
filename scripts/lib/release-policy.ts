// release-policy — pure release decisions for the push pipeline.
//
// Role: library + CLI. Holds the two decisions that must not be improvised in
// shell: (1) what to do with a version tag, and (2) whether a step range may
// commit and push. Both are pure functions so they are unit-testable without
// running the pipeline; the CLI wrapper lets push-pipeline.sh call them.
//
// Exit codes: 0 = decision printed, 1 = usage error, 2 = unexpected error.

export type TagActionKind = "create" | "move" | "refuse";

export interface TagState {
  /** Version being released (package.json at release time). */
  currentVersion: string;
  /** Whether refs/tags/v<currentVersion> exists. */
  tagExists: boolean;
  /** package.json version recorded at that tag, or null when unreadable. */
  tagVersion: string | null;
  /** Whether the existing tag is an ancestor of HEAD. */
  isAncestor: boolean;
  /** Explicit --force-tag. */
  force: boolean;
}

export interface TagDecision {
  action: TagActionKind;
  reason: string;
}

/**
 * tagAction — never relabel a tag that carries a different version.
 *
 * The 2026-11-04 release moved v2026.10.28 onto 2026.11.04 code because the
 * pipeline looked up a stale version. Looking up v<currentVersion> makes that
 * class impossible; the version check below is the backstop for a tag that was
 * already corrupted.
 */
export function tagAction(state: TagState): TagDecision {
  const tag = `v${state.currentVersion}`;
  if (!state.tagExists) {
    return { action: "create", reason: `no ${tag} tag yet` };
  }
  if (state.force) {
    return { action: "move", reason: `--force-tag set; moving ${tag}` };
  }
  if (state.tagVersion === null) {
    return {
      action: "refuse",
      reason: `${tag} exists but its package.json version is unreadable; use --force-tag to overwrite`,
    };
  }
  if (state.tagVersion !== state.currentVersion) {
    return {
      action: "refuse",
      reason: `${tag} points at code version ${state.tagVersion}, not ${state.currentVersion}; refusing to relabel it — use --force-tag`,
    };
  }
  if (!state.isAncestor) {
    return {
      action: "refuse",
      reason: `${tag} already exists and is not an ancestor of HEAD; use --force-tag to overwrite`,
    };
  }
  return {
    action: "move",
    reason: `${tag} already exists for this version; moving it onto HEAD`,
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

// ── CLI ─────────────────────────────────────────────────────────────────────
// tag-action   --current <v> --exists <0|1> --tag-version <v|-> --ancestor <0|1> [--force <0|1>]
//   → prints "<action>|<reason>"
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
    if (!current || exists === undefined) {
      process.stderr.write(
        "usage: release-policy tag-action --current <v> --exists <0|1> [--tag-version <v|->] [--ancestor <0|1>] [--force <0|1>]\n",
      );
      return 1;
    }
    const decision = tagAction({
      currentVersion: current,
      tagExists: truthy(exists),
      tagVersion: flag(rest, "tag-version") === "-" ? null : (flag(rest, "tag-version") ?? null),
      isAncestor: truthy(flag(rest, "ancestor")),
      force: truthy(flag(rest, "force")),
    });
    process.stdout.write(`${decision.action}|${decision.reason}\n`);
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
