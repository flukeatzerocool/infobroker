# Push Pipeline

The read-through reviews the change set since the last release tag plus every
REQ that references a changed tool, file, flag, or provider, then one rotating
spec shard as a drift pass. Six shards keyed to section anchors cover the whole
file every six releases; the cursor is the newest `(review S3/6)` marker in a
pipeline commit subject, and `(deep review)` resets it. `--deep-review` reads
the whole spec in one pass instead.

`scripts/push-pipeline.sh` runs its review-only AI steps (read-through,
changelog, scan, README) under the non-thinking `pipeline-fast` agent
(`.opencode/agents/pipeline-fast.md`); the server-sync step keeps the full
`build` agent. Provider auth is generated deterministically before the
read-through (the old `--parallel` auth race is a deprecated no-op). Step 6 is
deterministic (`scripts/scan-refs.ts`,
`scripts/scan-git-refs.ts`); pass `--scan-ai` for the deep AI scan, which runs
its two prompts concurrently in isolated sessions. Every failing gate enters a
bounded auto-repair loop (`PIPELINE_FIX_ATTEMPTS`, default 2) driven by
`scripts/pipeline/prompts/fix-gate.md`; read-through high findings keep the
dedicated `fix-high.md` repair plus a fresh re-review. The server-sync step is
followed by an independent code review of its source diff in a forked session
(`sync-review.md`), recorded in `sync-review.json`: it is skipped when the run
changed no source or config, halts on a critical finding, and repairs high
findings within the same fix budget. Exhausting the budget
stops the run for human attention; it never loops unbounded. The default run
commits the prepared tree once, keeping the `(review SN/K)` shard marker in the
subject; `--split-commits` opts into the convention series (spec → source →
tests → pipeline → docs → release, from the pure `planCommits` classifier in
`scripts/lib/release-policy.ts`), where each earlier commit is `typecheck`-
verified and the version stamps plus the new CHANGELOG entry are snapshotted,
rewound to the pre-run version, and restored before the final release commit.
Both paths print a readiness report and ask for push approval — It then prints a readiness report and asks for push approval —
`--yes` pre-approves, `--no-push` commits locally and exits 0, and a
non-interactive run without `--yes` exits 1 rather than publishing. Per-step
wall times are recorded under the run directory (`timings/`, one file per step,
so concurrent scans cannot clobber each other) and printed at the end; the
fixture-refresh cadence report is surfaced in the final summary. `--from=<step>`
/ `--to=<step>` run a bounded range for testing and are validated against the
step list (an unknown step is rejected before any work runs); a step range
does not commit or push unless `--commit` is given, and `--to` never publishes
because the tree it leaves is not a release. `--resume` continues the newest
run recorded for the current repo and branch and accepts the dirty tree an
interrupted run left behind, refusing only if HEAD or the branch moved.
`--run-id=<id>` (or a `PIPELINE_RUN_DIR` override) pins a specific run
directory and resumes from its journal when one exists, exactly like
`--resume`. `--dry-run` is
non-mutating (spec audit + deterministic scans only, working tree left clean;
run logs still land under TMPDIR);
`--no-commit` runs all steps including AI edits but stops before staging,
leaving the tree dirty for inspection. The release path is split in two:
`npm run prep` is that `--no-commit` run, so the AI diff is reviewed and
committed in the session loop; `npm run release` runs `--no-ai`, which skips
the read-through, sync, changelog, and README steps plus the AI scan, requires
a clean tree whose version and CHANGELOG already agree (`npm run version-sync`),
then runs the deterministic auth and scan steps, the full gate suite, the
commit, the tag, and the push. A deterministic release therefore publishes the
tree that was prepared and reviewed and never needs `opencode` or `curl`. The
entry point is `prep`, not `prepare`, because `prepare` is an npm lifecycle
hook that would run the pipeline on every `npm install`. Staging is whole-tree with a deny-list
and a fail-closed leftover check, so tracked paths the old allowlist omitted
(e.g. `test-fixtures/`, `DECISIONS.md`, `bin/`) can no longer be silently
dropped. Secret scanning reports `path:line` only and never logs the matched
value. Push, tag, and mirror operations target the current branch rather than
a hardcoded `main`. The tag version is read from `package.json` after the sync
step, so a mid-run version bump cannot relabel an old tag onto new code. A tag
that already exists on the push remote is never moved: a correction is a new
version (D-092), and `--force-tag` no longer exists. The only permitted move is
an interrupted publish's local-only tag that still carries the release version
and is an ancestor of HEAD. Branch and tag are pushed together with `--atomic`,
one push per remote, so a rejected tag cannot leave the branch published
without it. The mirror push is fatal because npm publishing is delegated to
the mirror's CI (`--no-mirror` opts out deliberately). A full `npm run check`
on the tree to ship runs before staging; its success writes the tree-keyed run
record that lets `.githooks/pre-push` skip its own duplicate suite for exactly
that commit when the tree is clean and CI is unset. An unexpected command
failure exits 2; gate failures and required human approval exit 1.

`npm run test-push-pipeline` exercises that control flow hermetically: a
disposable repository, a bare remote, the real pipeline scripts, and a
toolchain stub that is honored only when `INFOBROKER_PIPELINE_STUB=1` and
`INFOBROKER_PIPELINE_TEST_ROOT` resolves to the same project directory.
