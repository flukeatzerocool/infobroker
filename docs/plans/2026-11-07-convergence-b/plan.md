# Plan — Workflow convergence, increment B: hermetic pipeline harness, immutable tags, loop telemetry

**Status:** Draft for approval (2026-11-07).
**Mode:** planned. **Gate:** build-review.
**Increment:** `docs/plans/2026-11-07-convergence-b/`.
**Review artifact:** `~/.local/state/opencode/plans/3b34aea2bce9fb4da60d99c296e2000157a146aca988b48969a73d1a3d3aec94/2026-11-07T16-26-07-219Z-dc269521.md`
(sha256 `dc2695218dcb8b9fe6cec6e12f8d76b917c90f6792723ac517b5cd9294e92c4d`).
**Review independence:** self.

**Amendments at build:** (1) `push-pipeline.sh` records the post-commit HEAD in
the run journal; without it `--resume` refused after a failed push (found by
harness case 6). (2) Harness cases supply an untracked change because a
`--no-ai` release publishes a prepared tree and would otherwise commit nothing.
Both are recorded in `aar.md`.

**Done bar:** `npm run check` and `npm run check:fast` green in **both** repos
(Infobroker and `/home/fluke/Holonovel`); `npm run session:close` passes for
this increment; `npm run test-push-pipeline` passes every case; a published
tag is refused and a re-run after a failed push still succeeds; the shared
vocabulary (`status`, `check:fast`, `session:close`, `prep`, `release`) is
identical in both `package.json` files; `docs/workflow-cadence.md` states the
immutable-tag rule; the four split commits land.

## Why

ROADMAP item 1 (Workflow convergence with Holonovel). Increment A
(`docs/plans/2026-11-07-loop-and-gates`) shipped the shared vocabulary, the
manifest-driven gate runner, the tree-keyed run record, increment artifacts,
`session:close`, and the first loop audit. Its plan and AAR defer exactly two
pieces to increment B: **the hermetic pipeline harness and the tag policy**
(`plan.md` §Why; `aar.md` finding C-1). This plan is that increment and is the
session that closes the roadmap item.

Baseline measured this session (before any edit):

| Check | Result |
|---|---|
| Infobroker `npm run check` | PASS, 21 gates, 32.6 s; full run recorded for `dacec216ef60` |
| Infobroker `npm run check:fast` | PASS (inside the full run) |
| Holonovel `npm run check:fast` | PASS, 36 gates |
| Holonovel `npm run check` | PASS, incl. `test:pipeline` 22/22 |

What is already converged and is **not** re-done: `status`, `check:fast`,
`session:close`, `prep`, `release`, `gates`, durable AARs, the run manifest,
the split-commit series in the pipeline, and `check:fast` already passing
`--timing` (`package.json:51`). Infobroker's gate runner models a gate as
`{name, description, fast}` (`scripts/lib/gate-manifest.ts:10-17`), not
Holonovel's per-suite argv pair; that is accepted divergence (D5), and
advisory gate status belongs to ROADMAP item 3, not here.

## Scope

**In:** end-to-end hermetic harness for `scripts/push-pipeline.sh`; a tag
policy that never moves a published tag (retires `--force-tag`); loop-audit
delivery telemetry and hook-event recording; the spec, AGENTS, cadence,
decision, and CHANGELOG updates that carry those behavior changes.

**Out:** the weekly runner and gate-retirement ledger (ROADMAP item 3);
advisory gate status; CalVer→SemVer normalization (ROADMAP item 2); changing
`session:close` to commit (D-089/D-091); any new check that duplicates
`check-loop-artifacts`.

## Decisions

- **D1 — Stub seam is double-keyed.** The harness needs the real shell driver
  without the real toolchain. `scripts/pipeline/lib.sh` and
  `scripts/push-pipeline.sh` honor `INFOBROKER_PIPELINE_STUB=1` only when
  `INFOBROKER_PIPELINE_TEST_ROOT` resolves to the same directory as
  `PROJECT_DIR`; otherwise the pipeline dies before any step. A routine
  release never sets either variable, so a leaked env var cannot ship an
  untested tree. Rejected: copying a minimal fake project (scans and version
  checks would then test the fake, not the pipeline).
- **D2 — Immutability is remote-scoped.** "Published" means the tag exists on
  the push remote (`git ls-remote origin refs/tags/v<version>`). A local tag
  that is an ancestor, carries the same version, and is absent from the remote
  may be moved to HEAD — that is the retry of a failed publish. Every other
  case refuses: remote tag present, local tag mislabeled, or local tag not an
  ancestor. A refused tag is corrected by bumping the CalVer, never by
  moving it. Rejected: a local-only rule (it would refuse the legitimate
  retry) and a time-based rule (nondeterministic). **Consequence, accepted:**
  a second release on one calendar day reuses `v<same CalVer>` and is refused;
  the operator must publish a distinct version. This supersedes D-071's
  rejected "never move a tag" alternative, which assumed same-CalVer
  multi-commit releases could reuse a tag; D-071 stays as history and D-092
  records the new rule.
- **D3 — `--force-tag` retires.** The flag and the `move` branch it forced are
  removed; `TagState.force` disappears. This is a deliberate breaking change
  for an operator who relied on re-tagging; the remediation is a new version.
- **D4 — Push is atomic.** Branch and tag go in one `git push --atomic` per
  remote, so a server-side tag rejection cannot leave the branch published
  without its tag. The `+refs/tags/...` forced refspec is deleted (a tag that
  needs forcing can no longer be produced).
- **D5 — Gate model stays.** Keep `{name, description, fast}` and
  `fastGates()`. Porting Holonovel's per-suite argv is churn with no new
  behavior; advisory status is item 3's problem. Recorded, not ported.
- **D6 — Loop audit absorbs metrics; no `--check` gate.** `scripts/metrics.ts`
  keeps its CLI and output (vocabulary), but its computation moves to a pure
  `scripts/lib/delivery.ts` that `loop-audit` also reports. No `--check`
  failure mode is added: artifact-contract checking is already
  `check-loop-artifacts`, and a drift threshold has no measured baseline here
  (a duplicated check is a maintenance cost, not coverage). Rejected:
  porting Holonovel's `--check` thresholds (its 5% drift and 4-repeat
  baselines are Holonovel's history, not ours).
- **D7 — Hook telemetry is bash, not a Node start.** `.githooks/pre-commit`
  and `.githooks/pre-push` append one JSONL line
  (`at/event/action/head`) to `$TMPDIR/infobroker/hook-events-<repoKey>.jsonl`.
  `repoKey` is the same rule as `gate-run-manifest.ts` (realpath of the repo
  root, sha256 hex, first 12 chars), so bash computes it with
  `realpath | sha256sum | cut -c1-12` without a tsx startup on every commit.
  A reader test asserts the TS parser accepts a line in the hook's exact
  shape. A failed append never fails the hook (telemetry is disposable).
  `sha256sum` is used with a `shasum -a 256` fallback so the same three lines
  work on a macOS checkout.
- **D8 — Keep the spec in the behavior commit.** Appendix C.9 changes with the
  tag behavior in the same commit (AGENTS: behavior change and its spec text
  travel together), even though the bucket order otherwise puts spec first.

## Blast radius

| File | Change | Size | Verification |
|---|---|---|---|
| `infobroker.md` | C.9: published tags are never moved; a correction is a new version | S | `validate-spec` |
| `scripts/lib/release-policy.ts` | `TagActionKind` = create/refuse; add `remoteExists`; drop `force` | M | `release-policy.test.ts` |
| `scripts/lib/release-policy.test.ts` | Table: create, remote-tag refuse, mislabeled refuse, non-ancestor refuse, unpublished retry move | M | `npm test` |
| `scripts/pipeline/lib.sh` | `tag_release` computes remote existence, passes it, greps the plain refspec; stub guard helper | M | harness + `pipeline-logic.test.ts` |
| `scripts/pipeline/pipeline-logic.test.ts` | cover the extracted refspec/remote-check helper | S | `npm test` |
| `scripts/lib/gate-run-manifest.ts` | export `repoKey` for the hook-event path rule | S | `typecheck:scripts` |
| `scripts/push-pipeline.sh` | drop `--force-tag`; `--atomic` pushes; stub guard; remove `TAG_MOVED` | M | harness |
| `scripts/test-push-pipeline.ts` | **new** gate: 7-case hermetic harness (below) | L | itself |
| `scripts/lib/hook-events.ts` | **new** reader/writer + path rule | S | new unit test |
| `scripts/lib/hook-events.test.ts` | **new**: parses a hook-shaped line, skips corruption, caps at 2000 | S | `npm test` |
| `scripts/lib/delivery.ts` | **new** pure delivery metrics extracted from `metrics.ts` | M | new unit test |
| `scripts/lib/delivery.test.ts` | **new**: fixture log/reflog strings → numbers | M | `npm test` |
| `scripts/metrics.ts` | delegate to `delivery.ts`; output unchanged | S | existing manual run |
| `scripts/loop-audit.ts` | add delivery section + hook counts + gate-timing rows to text and `--json` | M | `npm run loop-audit` |
| `.githooks/pre-commit`, `.githooks/pre-push` | append hook events; fix the stale `.infobroker/` path comment | S | harness/manual |
| `scripts/lib/gate-manifest.ts`, `gate-manifest.test.ts` | add `test-push-pipeline` gate (fast, hermetic) | S | `check-gate-table` |
| `package.json` | `test-push-pipeline` script; manifest picks it up | S | `check`, `check-pack` |
| `AGENTS.md` | generated gates table; remove the stale `INFOBROKER_PIPELINE_VERIFIED_SHA` claim; describe harness + tag rule | S | `check-gate-table`, `validate-readme` |
| `docs/workflow-cadence.md` | monthly tag rule; loop audit description; shared-command table | S | manual + `validate-readme` |
| `DECISIONS.md` | D-092 immutable published tags (supersedes D-071's `--force-tag` clause; D-071 stays as history); D-093 guarded stub seam | S | `check-non-goals` |
| `CHANGELOG.md` | one dated entry naming C.9 + the harness + `--force-tag` retirement (date must equal the `package.json` version date, `version-sync`) | S | `version-sync` |
| `ROADMAP.md` | remove the shipped workflow-convergence section (work shipped moves to CHANGELOG); update the cadence cross-reference in the same step | S | `check-roadmap`, `check-non-goals` |
| `docs/plans/2026-11-07-convergence-b/{plan,tasks,aar}.md` | increment record | S | `check-loop-artifacts` |

Rollback cost: **1** for each commit (revert it). No remote state changes
during this session — no tag is created, moved, or pushed.

## Steps

### B0 — Baseline and increment record (S)

1. Re-run `npm run status`, `npm run check` (Infobroker) and `npm run check`
   (Holonovel) and record the SHAs. Expected: green, per the table above.
2. Create `docs/plans/2026-11-07-convergence-b/` with `plan.md` (this text,
   stamped), `tasks.md` (B0–B5 as unchecked boxes), and `aar.md` carrying
   `**Done bar:**` and a provisional `LOOP OPEN`. `check-loop-artifacts` must
   pass at close.
3. Probe the harness preconditions: `git --version`, `mktemp -d` under
   `/tmp/opencode`, writable bare-repo path, and that `node_modules/.bin/tsx`
   exists (the harness symlinks `node_modules` into the scratch repo so the
   real `release-policy` CLI runs).

### B1 — Tag policy: published tags are immutable (M)

1. `scripts/lib/release-policy.ts`: `TagActionKind = "create" | "move" |
   "refuse"` stays, but `move` is reachable only for the unpublished-retry
   case. Add `remoteExists: boolean` to `TagState`; remove `force`. Decision
   order: no local tag → create; remote exists → refuse (bump the version);
   local version ≠ current → refuse; local not ancestor → refuse; else move
   (unpublished retry). Update the doc comment and the 2026-11-04 backstory.
2. `scripts/pipeline/lib.sh` `tag_release`: compute
   `remote=$(git -C "$PROJECT_DIR" ls-remote --tags origin "refs/tags/${tag}" 2>/dev/null)`.
   A failed `ls-remote` is **fail-closed** (die: cannot verify the remote).
   Pass `--remote-exists`; drop `--force`; on `move`, print that the tag was
   never published.
3. `scripts/push-pipeline.sh`: delete `--force-tag` from the usage block, the
   flag parser, and the call site; delete `TAG_MOVED`; set the refspec to
   `refs/tags/${TAG_NAME}:refs/tags/${TAG_NAME}` unconditionally; add
   `--atomic` to the origin and mirror pushes. Update the undo hint to "do not
   move a published tag; publish a corrected version".
4. `infobroker.md` C.9: replace "SHALL NOT silently overwrite an existing
   version tag; re-tagging a version SHALL require explicit confirmation" with
   the immutable-published-tag rule (keeps the clause under one sentence).
5. Tests: extend `release-policy.test.ts` with the five decision rows and the
   CLI's new flag; extend `pipeline-logic.test.ts` for the refspec helper if
   one is extracted.
6. Sibling-clause check: search the spec for every clause that governs tag
   mutation (`grep -n 'tag' infobroker.md`). This session found exactly one
   governing clause (C.9) plus the glossary row; no numbered REQ owns the
   release tag, so there is no REQ body or manifest row to co-edit.

Verify: `npm run typecheck`, `npx vitest run scripts/lib/release-policy.test.ts
scripts/pipeline/pipeline-logic.test.ts`, `npm run validate-spec`.

### B2 — Hermetic pipeline harness (L)

1. Add the stub guard to `scripts/pipeline/lib.sh` (helper
   `pipeline_stub_active`: true only when `INFOBROKER_PIPELINE_STUB=1` and
   `realpath(INFOBROKER_PIPELINE_TEST_ROOT) == realpath(PROJECT_DIR)`). In
   `run_gate`, when active, print `STUB <label>` and return 0. In
   `push-pipeline.sh`, when active, skip the deterministic scan/auth steps and
   the mirror; everything else (state journal, staging, denylist, secret scan,
   commit, tag decision, push) runs for real.
2. New `scripts/test-push-pipeline.ts` [gate], modeled on Holonovel's
   `scripts/test-push-pipeline.ts`: build a scratch root under
   `/tmp/opencode/`, with `origin.git` (bare), `work/` (clone), git identity,
   a `package.json` version, a dated `CHANGELOG.md`, a tracked file, a copy of
   `scripts/`, and a symlink to the real `node_modules`. Cases:
   - `happy path`: full `--no-ai --yes --no-mirror` → exit 0, branch on the
     bare remote, tag present, `git ls-remote` shows both.
   - `no-push`: `--no-ai --no-push` → local commit, no tag, no remote ref.
   - `preflight rejection`: staged change before start → exit 1, no commit.
   - `published tag`: create the tag on the bare remote, run → exit 1, message
     names the new version as remediation, no forced update.
   - `unpublished retry`: local tag without a remote counterpart, simulate a
     push failure, then re-run → move succeeds.
   - `resume after failed push`: point `origin` at a missing path, run to
     failure, restore `origin`, `--resume` → push completes.
   - `dry-run`: `--no-ai --dry-run` → tree clean, no commit/tag.
   Each case prints `PASS`/`FAIL <name>`; `--keep` retains the scratch root.
3. Wire it: `package.json` `"test-push-pipeline"`, a `fast: true` entry in
   `scripts/lib/gate-manifest.ts`, and regenerate the AGENTS.md table with
   `npm run gates -- --list --format md`. Add it to `check:fast`? It is
   offline and hermetic, so yes — but confirm it stays under ~20 s in the
   fast budget; otherwise mark `fast: false` and record why.

Verify: `npm run test-push-pipeline` (7/7), `npm run check-gate-table`,
`npm run check-script-discipline`, `npm run typecheck:scripts`, and a seeded
failure (`break the refspec → a case FAILs and the gate exits 1`).

### B3 — Loop telemetry: delivery metrics and hook events (M)

1. Extract `scripts/lib/delivery.ts` from `scripts/metrics.ts`: pure functions
   over already-read `git log` / reflog text (deployment frequency, lead time,
   commits per push, pipeline-fix proxy). `metrics.ts` keeps its CLI and
   output, calling the library.
2. `scripts/lib/hook-events.ts`: `readHookEvents(root)` with the 2000-line cap
   and corrupt-line skip; `hookEventsPath(root)` using the shared repo-key
   rule (export `repoKey` from `gate-run-manifest.ts`).
3. Hooks: `.githooks/pre-commit` appends `ran`/`failed` around `version-sync`;
   `.githooks/pre-push` appends `skipped` on the recorded-tree path and
   `ran`/`failed` on the suite path. Append is best-effort (`|| true`).
4. `scripts/loop-audit.ts`: add `delivery` (from `delivery.ts`), `hooks`
   (ran/skipped/failed), and `gates` (per gate: runs, failures, median ms,
   p95 ms from `timingPath(ROOT)`) to both the text report and `--json`. Keep
   exit codes unchanged (informational; 1 only when a source is unreadable).
5. Tests: `delivery.test.ts` and `hook-events.test.ts` with fixture strings and
   a hook-shaped JSON line. Aggregation stays in `scripts/loop-audit.ts`, so
   the existing pure helper and its test are unchanged.

Verify: `npm test`, `npm run loop-audit`, `npm run loop-audit -- --json`
(valid JSON), and one commit + one push with the hooks active to confirm the
JSONL line lands (measure the added hook latency; if > 0.5 s, record it).

### B4 — Docs, spec, and release record (S)

1. `docs/workflow-cadence.md`: replace "the tag policy is being aligned" with
   the rule (published tags are immutable; a correction is a new CalVer;
   branch and tag push atomically); describe `loop-audit`'s new sections; keep
   "no weekly command yet" (item 3 owns it).
2. `AGENTS.md`: delete the stale `INFOBROKER_PIPELINE_VERIFIED_SHA` sentence
   (no code references it; verified by repo-wide search this session) and the
   `--force-tag` override phrase; add the harness and the tag rule to the
   push-pipeline paragraph; paste the regenerated gates table.
3. `DECISIONS.md`: D-092 (immutable published tags, remote-scoped, why; it
   supersedes D-071's `--force-tag` override clause, which is left in place as
   history), D-093 (guarded stub seam, why not a fake project).
4. `CHANGELOG.md`: one dated entry naming C.9, the harness gate, the new
   loop-audit sections, and the `--force-tag` retirement as breaking.
5. Update `tasks.md`; write `aar.md` with the findings register and `LOOP
   PAUSED`.
6. `ROADMAP.md`: remove the shipped workflow-convergence section (shipped work
   moves to `CHANGELOG.md`). Register coupling: the only cross-reference to
   the section is `docs/workflow-cadence.md` §Monthly ("the tag policy is
   being aligned with Holonovel"), updated in the same commit; `AGENTS.md`
   carries no section-level reference.

Verify: `npm run validate-readme`, `npm run check-non-goals`,
`npm run check-gate-table`, `npm run validate-spec`,
`npm run check-roadmap`, `npm run version-sync`.

### B5 — Cross-repo verification and close (S)

1. Infobroker: `npm run check:fast`, then `npm run check` (sequential, full).
2. Holonovel: `npm run check:fast`, then `npm run check`; both were green
   before this session's changes and none of those files are touched here.
3. `npm run session:close` for this increment (must pass; it does not commit).
4. Emit the roadmap closure evidence: both repos green with the shared
   commands; `docs/workflow-cadence.md` current; this increment closed through
   `session:close`. Confirm the ROADMAP section was removed in commit 4 (work
   shipped moves to CHANGELOG) and run `check-roadmap`.

## Commit series

One concern per commit; `npm run typecheck` after each; full `npm run check`
once on the final tree. Order follows the pipeline's convention buckets
(spec and its source together; pipeline; docs last).

| # | Subject | Contents | Must pass |
|---|---|---|---|
| 1 | `2026-11-07 — Tag policy: published tags are immutable` | `infobroker.md` C.9, `release-policy.ts`(+test), `pipeline/lib.sh`, `push-pipeline.sh` | `typecheck`, `vitest` (2 files), `validate-spec` |
| 2 | `2026-11-07 — Push pipeline: hermetic harness` | stub guard, `test-push-pipeline.ts`, `package.json`, `gate-manifest.ts`(+test), AGENTS table | `test-push-pipeline`, `check-gate-table`, `check-script-discipline`, `typecheck:scripts` |
| 3 | `2026-11-07 — Loop audit: delivery metrics and hook events` | `delivery.ts`(+test), `metrics.ts`, `hook-events.ts`(+test), `loop-audit.ts`, `.githooks/*` | `npm test`, `loop-audit` |
| 4 | `2026-11-07 — Docs: cadence, decisions, changelog` | `AGENTS.md`, `docs/workflow-cadence.md`, `DECISIONS.md`, `CHANGELOG.md`, `ROADMAP.md`, increment record | `validate-readme`, `check-roadmap`, `check-non-goals`, `check-loop-artifacts` |

Commit 2 is ~350 lines (one artifact plus its wiring) — the atomic exception to
the ~300-line split limit; it does not split by file because the gate is
unusable until the manifest and script entry exist. `scripts/pipeline/lib.sh`
and `scripts/push-pipeline.sh` appear in commits 1 and 2 on distinct hunks (tag
policy vs stub guard); `AGENTS.md` appears in commit 2 (generated table) and
commit 4 (prose).

## Verification summary

- **Unit:** release-policy decision table, pipeline refspec helper, delivery
  metrics, hook-event parsing (vitest).
- **Harness:** 7 hermetic cases against a bare remote; seeded-failure proof
  that a broken refspec makes the gate exit 1.
- **Gates:** `check:fast` and `check` green in both repos; `check-gate-table`;
  `check-script-discipline`; `check-loop-artifacts`; `validate-spec`;
  `validate-readme`; `version-sync`.
- **Behavior:** a published tag is refused (harness case); an unpublished
  retry still moves (harness case); `--force-tag` no longer parses (manual
  `bash scripts/push-pipeline.sh --force-tag` → unknown flag, exit 1).

## Risks, edge cases, rollback

| Risk | Mitigation |
|---|---|
| Stub env var leaks into a real release | Double key: `INFOBROKER_PIPELINE_STUB` **and** `INFOBROKER_PIPELINE_TEST_ROOT == PROJECT_DIR`, else die. Tested by a harness case. |
| `git ls-remote` fails offline | Fail closed with a retry message; never assume the tag is unpublished. |
| Harness leaves scratch repos | `finally { rm -rf }`; `--keep` is explicit; scratch lives under `/tmp/opencode`. |
| Hook telemetry slows commits | Measure once; the append is 3 lines of bash and no Node start. If > 0.5 s, drop to pre-push only and record it. |
| New gate inflates `check:fast` | Measure; if > ~20 s, mark `fast: false` and record the reason. |
| Second release on one calendar day reuses the CalVer tag | Refuse with "publish a distinct version"; the operator bumps the version (ROADMAP item 2 changes the scheme). Never force. |
| Mislabeled local tag | Refuse with "delete the stale local tag or bump the version"; never `tag -f`. |

**Rehearsal (deep tier):** all tag operations are exercised in the scratch
bare remote before the real repo is touched; the session runs no
`prep`/`release`/`push`, so no remote state changes. **Backout:** revert
commit 1 to restore `--force-tag`; revert commit 2 to remove the gate; revert
commit 3 to drop telemetry; commits are independent.

## Unknowns

- The exact added latency of the hook append on this machine (measured in B3;
  the design assumes bsh-only, no Node).
- Whether `test-push-pipeline` finishes inside the fast-suite budget on CI
  (measured in B2; fallback `fast: false`).
- Holonovel must stay green; it was green at baseline, but its full suite is
  network-sensitive (`test:pipeline` is hermetic; `audit`-class steps are not
  in its check). If it flakes, re-run and record the flake rather than editing
  Holonovel from this repo.
