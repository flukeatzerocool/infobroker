# Plan — Gate retirement and weekly cadence

**Status:** Draft (awaiting user approval).
**Mode:** planned. **Gate:** plan-review → build-review.
**Done bar:** `npm run check` and `npm run check:fast` green; `npm run
gate-cost` reports per-gate cost and eligibility from the local timing record;
`npm run weekly` writes its combined report and prints the gate-cost, loop, and
delivery sections; one eligible gate is recorded as advisory in
`scripts/gate-ledger.json` by the maintainer's choice, `run-gates --list`
marks it, and a simulated failure of that gate leaves the suite green with
`ADVISORY FAIL`; the `ROADMAP.md` section is removed; the increment's `aar.md`
ends `LOOP PAUSED`; the split commits land.

## Why

The roadmap asks for two tools over the timing record that `run-gates
--timing` already writes: a gate-cost report with a retirement policy, and one
weekly command that produces the gate-cost, loop, and delivery reports
together. Today `npm run loop-audit` prints runs, failures, median, and p95 per
gate, but it computes no clean streak, no cost share, no eligibility verdict,
and there is no ledger and no advisory behavior in the runner. The weekly
routine is three manual commands spread across `docs/workflow-cadence.md`.

Probe run before drafting (this checkout, 2026-11-07):
`$TMPDIR/infobroker/gate-timing-5d449521a653.json` holds 442 rows; 16 of the
22 manifest gates already carry 20 or more consecutive `pass` rows (typecheck,
validate-spec, test, and others at 23; check-script-discipline at 21), so the
roadmap trigger ("20 consecutive runs for at least one gate") is already
satisfied and the policy is demonstrable on current data. The full-only gates
are younger (audit, check-pack, test-debate-club at 9 rows; test-push-pipeline
at 10), and check-loop-artifacts has 17.

## Design decisions

**D1 — Advisory is a committed ledger entry, not a manifest edit.** The gate
manifest stays the static list of gates; `scripts/gate-ledger.json` records
advisory decisions. A retirement decision is governance that must apply on
every checkout and in CI, so the ledger is tracked. Deleting a gate remains a
manual edit to `scripts/lib/gate-manifest.ts`. *Rejected:* mutating the
manifest from a report (makes an informational run edit tracked source and
loses the distinction between "retired" and "never existed").

**D2 — "No findings" is read as "no failing run".** The timing record carries
`status: pass | fail` only; there is no per-gate finding count, and historical
rows cannot gain one. The policy therefore counts consecutive `pass` rows, and
the ledger snapshot records that this is the evidence used. *Rejected:*
extending timing rows with finding counts now (no uniform source across 22
gates, and it cannot justify a decision from existing rows). The report states
the proxy in its header, and a manual ledger entry can override the policy.

**D3 — Retirement is one gate per explicit command; no bulk apply.** The
current record makes every gate eligible (23/23 clean), so an apply-all command
would retire the whole suite in one keystroke. `gate-cost --retire <gate>`
records one decision and refuses a gate that is not eligible. The weekly run
never mutates the ledger; it prints the exact command with the eligible names.
*Rejected:* `--apply` over every eligible gate (a footgun, and it makes the
decision automatic when the roadmap says deletion stays manual).

**D4 — Advisory gates still run, are timed, and report; only the exit status
is softened.** This keeps the cost signal and surfaces a recently failing
advisory gate in the weekly report. An advisory failure prints `ADVISORY FAIL
<gate>` and does not fail the suite; `--record` still records the full run
because advisory findings are non-blocking by definition. *Rejected:* skipping
advisory gates entirely (loses the evidence that would justify restoring the
gate).

**D5 — Ledger reads fail closed.** A missing ledger means no advisory gates. A
corrupt ledger, or a malformed entry, produces a warning and leaves the
affected gate gating; it is never fatal. An unknown gate name in the ledger is
a stale-entry warning and has no effect.

**D6 — The weekly command reports; it does not run the gate suite.** It
composes the existing pure computations and writes one JSON artifact under
`$TMPDIR/infobroker/`, then prints the three sections. The documented routine
stays "`npm run check` once, then `npm run weekly`", and the report shows the
timing record's age so a stale record is visible. *Rejected:* making `weekly`
invoke `check` (a 30 s+ hidden side effect, and it would duplicate the gate
runner's own timing row).

**D7 — Policy evidence is local; the decision is committed.** A fresh CI
runner has no accumulated timing history (it sees only its own run), so it
cannot re-evaluate eligibility. The committed ledger entry
carries the evidence snapshot (`runs`, `clean_runs`, `median_ms`, `p95_ms`)
that justified it, and CI only honors the status.

**D8 — Same-day CalVer.** The package version is the date (`2026.11.7`), so a
second change today cannot get a new version. The CHANGELOG entry goes under
the existing `## 2026.11.7` heading; `version-sync` compares the top heading
date to `package.json` and stays green without a bump.

## Blast radius

| Path | Change | Size |
|---|---|---|
| `scripts/lib/gate-retirement.ts` | New: timing read, cost summary, ledger IO, eligibility, result classification | M |
| `scripts/gate-cost-report.ts` | New: cost report; `--retire`, `--restore`, `--dry-run`, `--json` | M |
| `scripts/lib/weekly.ts` | New: pure weekly composition and text rendering | M |
| `scripts/weekly.ts` | New: weekly report writer and printer | S |
| `scripts/gate-ledger.json` | New: committed decision ledger, initially empty | S |
| `scripts/lib/gate-retirement.test.ts` | New: policy, ledger, classification tests | M |
| `scripts/lib/weekly.test.ts` | New: composition and missing-source tests | S |
| `scripts/run-gates.ts` | Advisory set, softened exit, `--list` marker, header path fix | M |
| `package.json` | `gate-cost`, `weekly` scripts | S |
| `docs/workflow-cadence.md` | Weekly and monthly routine, evidence table | S |
| `AGENTS.md` | Weekly mapping, advisory-gate note | S |
| `CHANGELOG.md` | Entry under the current heading | S |
| `ROADMAP.md` | Remove the shipped section at close | S |
| `docs/plans/2026-11-07-gate-retirement-weekly/` | plan, tasks, AAR | S |

Rollback cost: **1** (each phase is its own commit; revert it). The weekly
artifact is disposable local state. No remote state, no schema migration, no
credentials. `scripts/gate-ledger.json` is tracked and not ignored (verified
with `git check-ignore`, exit 1), and `files` in `package.json` excludes
`scripts/`, so the tarball is unaffected.

Reused unchanged: `scripts/lib/delivery.ts` (`percentile` and the delivery
readers), `scripts/lib/loop-artifacts.ts`, `scripts/lib/loop-audit.ts`, and
`scripts/lib/hook-events.ts`.

## Implementation

### 1. Policy and ledger — `scripts/lib/gate-retirement.ts`

- `CLEAN_RUNS = 20`.
- `TimingRow` mirrors the row `run-gates` writes (`at`, `mode`, `head`,
  `gate`, `ms`, `status`).
- `readTiming(root): TimingRow[]` reads `timingPath(root)`; missing, corrupt,
  or non-array input returns `[]` with an optional warning string (a corrupt
  timing file is disposable local state, as `loop-audit` already treats it).
- `summarizeGateCost(rows): Record<string, GateCost>` sorts by `at` (file order
  breaks ties), then reports `runs`, `failures`, `medianMs`, `p95Ms`, `maxMs`,
  `lastRunAt`, `lastFailureAt`, `cleanRuns` (consecutive `pass` rows counted
  backward from the newest), and `costShare` (median over the sum of medians).
  Reuse `percentile` from `scripts/lib/delivery.ts` rather than duplicating it.
- `ledgerPath(root)` → the tracked `scripts/gate-ledger.json` under the repo
  root.
- `readLedger(root): { ledger, warnings }` validates `schema === 1` and a
  `gates` object; each entry needs `status: "advisory"`, an ISO `decided_at`,
  and an `evidence` object. Invalid file → empty ledger plus a warning;
  invalid entry → that gate stays active plus a warning.
- `advisoryGates(ledger): Set<string>`.
- `retirementState(cost, advisory, policy = CLEAN_RUNS)` → `"advisory" |
  "eligible" | "insufficient" | "blocked"`; `blocked` means the newest run
  failed (clean streak 0).
- `retireGate(root, gate, cost, now)` refuses when the gate is unknown,
  already advisory, or below the threshold; otherwise writes the entry with
  the evidence snapshot via a temp-file write plus rename.
- `restoreGate(root, gate)` removes the entry (the removal is the git-visible
  audit trail).
- `classifyResults(results, advisory)` returns `{ code: 0 | 1 | 2,
  advisoryFailures: string[] }`: any fatal → 2; a non-advisory failure → 1;
  only advisory failures → 0. This makes the new exit behavior unit-testable
  without spawning npm.

### 2. Cost report — `scripts/gate-cost-report.ts` [build tool]

- Default: print a table sorted by median cost descending, then an eligibility
  summary and the current advisory list.
- `--json` prints the same data as JSON.
- `--retire <gate>` validates eligibility and writes one ledger entry;
  `--restore <gate>` removes one. Both support `--dry-run` (print the resulting
  ledger, write nothing).
- Refusals are exit 1 with the reason (`unknown gate`, `already advisory`,
  `clean streak 5 < 20`, `not in the manifest`); write failure is exit 1;
  unexpected error is exit 2. `--help` prints usage and exits 0.
- Header states the findings proxy (D2) and the mass-retirement guard (D3).

### 3. Runner — `scripts/run-gates.ts`

- Read the ledger once; pass `advisoryGates` into `runFull` and `runFast`.
- `runFull`: an advisory failure writes `ADVISORY FAIL <gate>` to stderr and
  continues; a gating failure still stops the run.
- `runFast`: an advisory failure is printed but excluded from the failure
  count; the `PASS`/`FAIL` lines for gating gates are unchanged.
- `classifyResults` decides the final exit code (0/1/2).
- `--list` (plain only) appends `  [advisory]` to an advisory gate's row;
  `--format md` is unchanged so `check-gate-table` stays byte-identical.
- Fix the header's stale path: it says `.infobroker/gate-timing.json`, but
  `timingPath()` writes `$TMPDIR/infobroker/gate-timing-<repoKey>.json`.

### 4. Weekly — `scripts/lib/weekly.ts` and `scripts/weekly.ts` [informational]

- `buildWeeklyReport(inputs)` is pure: it takes the timing rows, cost summary,
  advisory set, increment validation, drift rows, delivery report, hook summary,
  and roadmap count, and returns one object with `gate_cost`, `loop`,
  `delivery`, `hooks`, `roadmap`, `generated_at`, and `timing_last_at`.
- `renderWeekly(report)` prints the three headed sections; missing delivery
  says `unavailable (fewer than two recorded pushes)` exactly as `loop-audit`
  does, and an empty timing record says `no record`.
- `scripts/weekly.ts` reads the sources, writes
  `$TMPDIR/infobroker/weekly-<repoKey>-<YYYY-MM-DD>.json` (0600, directory
  0700, date from the wall clock), prints the path, and prints the text report.
  `--json` prints JSON instead of the text; `--help` exits 0.
- Exit codes: 0 report printed and written (including all missing-source
  cases), 1 an unreadable source that is not disposable local state (for
  example an unreadable `docs/plans` entry), 2 fatal.
- The increment count, artifact findings, drift rows, and hook summary come
  from the exported helpers in `scripts/lib/loop-artifacts.ts`,
  `scripts/lib/loop-audit.ts`, and `scripts/lib/hook-events.ts`; delivery comes
  from `scripts/lib/delivery.ts`. No second computation of those numbers.

### 5. Ledger, scripts, docs

- `scripts/gate-ledger.json`: `{ "schema": 1, "gates": {} }` with a trailing
  newline.
- `package.json`: `"gate-cost": "npx tsx scripts/gate-cost-report.ts"`,
  `"weekly": "npx tsx scripts/weekly.ts"`. Neither is a gate, so the gate
  manifest and the `AGENTS.md` table do not change.
- `docs/workflow-cadence.md`: replace the "No weekly command yet" paragraph
  with `npm run check` then `npm run weekly` (report path included); update the
  monthly gate-retirement bullet to `npm run gate-cost` →
  `npm run gate-cost -- --retire <gate>`; add the weekly report to the evidence
  table.
- `AGENTS.md`: add a **"weekly"** line to the Agent Operating Routine
  (`npm run check`, then `npm run weekly`; retire only through
  `npm run gate-cost -- --retire <gate>`), and one sentence in the Gates
  section: a ledger advisory gate still runs and is timed, but its failure does
  not fail `check`.
- `CHANGELOG.md`: bullets under `## 2026.11.7` (D8).
- `ROADMAP.md`: remove the section after the done bar is met.

## Verification

1. `npm run typecheck:scripts` → PASS.
2. `npm run test` → PASS, including the new policy tests: 19 clean rows =
   `insufficient`; 20 = `eligible`; newest `fail` = `blocked`; an older failure
   followed by 20 passes = `eligible`; out-of-order rows sort by `at`; a corrupt
   ledger leaves gates gating and emits a warning; advisory-only failure
   classifies as exit 0; a gating failure as 1; a fatal as 2.
3. `npm run gate-cost` on this checkout → per-gate table with 23-run streaks and
   the eligible list; no ledger entries yet.
4. `npm run gate-cost -- --retire <chosen-gate>` → one ledger entry; a second
   call refuses `already advisory`. Choose the gate at execution (open decision
   below).
5. `npm run gates -- --list` → the chosen gate carries `[advisory]`;
   `npm run check-gate-table` → PASS (the md block is unchanged).
6. Simulated failure: break the chosen gate's subject (for example edit the
   file or pointer it checks), run `npm run check:fast` → `ADVISORY FAIL
   <gate>`, exit 0, rest of the suite green. Restore the file; the next run is
   fully green. This is the proof that D4 is wired end to end.
7. `npm run weekly` → writes
   `$TMPDIR/infobroker/weekly-<repoKey>-<YYYY-MM-DD>.json` and prints the
   gate-cost, loop, and delivery sections; `npm run weekly -- --json` prints
   parseable JSON. Repeat with the timing file temporarily moved aside → the
   same artifact is still written with `no record`, exit 0.
8. `npm run check` (full) → PASS, including `check-script-discipline`,
   `typecheck:scripts`, and `check-loop-artifacts` (the AAR is present from the
   start and ends `LOOP PAUSED` after close).

The negative paths (1, 4, 6, 7) are required; a green happy path alone does
not prove the advisory wiring.

## Edge cases

- Missing or corrupt timing record → `gate-cost` prints `no record` and exits
  0; `weekly` still writes its artifact.
- Missing or corrupt ledger → no advisory gates; warnings only; never fatal.
- Stale ledger entry (gate removed from the manifest) → warning, no effect.
- Timing rows out of order or duplicated → stable sort by `at`, file order as
  tie-break; one row per gate per run is expected but duplicates count as
  separate runs.
- Every gate eligible → still one explicit `--retire` per gate; the report
  says so.
- The chosen gate fails after retirement → suite stays green; the weekly
  report lists the failure under the advisory section so a restore is visible.
- Same-day change → CHANGELOG under the current heading; no version bump.
- Dirty tree → `run-gates --record` keeps its existing refusal; no change.

## Commit series

Each commit passes its own gate; `npm run check` runs once on the final tree.

1. `feat(gates): retirement policy, ledger, and cost report` — lib, report,
   tests, initial ledger, `package.json` script, increment artifacts
   (plan/tasks/AAR skeleton). Gate: `npm run typecheck:scripts && npm run test`.
2. `feat(gates): advisory gates in the suite runner` — `run-gates.ts`, result
   classification tests. Gate: `npm run check:fast`.
3. `feat(weekly): one weekly report` — weekly lib/script, tests,
   `package.json` script. Gate: `npm run check:fast`.
4. `docs(cadence): weekly and retirement routine` — cadence doc, AGENTS,
   CHANGELOG. Gate: `npm run check:fast`.
5. `chore(roadmap): retire <gate> and close the item` — ledger decision,
   `ROADMAP.md` removal, final `aar.md`. Gate: `npm run check`.

## Open decision

Which eligible gate becomes advisory. The report will list the 16 eligible
gates on this checkout, so the policy alone does not choose.
Recommended first candidate: `check-non-goals` — narrowest surface (a list and
a pointer), cheapest runtime, and its subject changes rarely. The maintainer
may pick another; if none should retire, the roadmap item stays open and only
the tooling lands (the done bar then reports `LOOP OPEN`).
