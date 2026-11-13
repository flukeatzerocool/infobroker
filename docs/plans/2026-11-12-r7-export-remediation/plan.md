# Plan — R7 export evidence remediation

**Status:** revision 1, awaiting user approval · **Date:** 2026-11-12 · **Depth:** standard (one library module, one CLI script, two test files, one register, one roadmap section, one changelog section; no destructive, external, credential, or publish surface)
**Review independence:** fresh — one cold pass (`independent-review` skill, `review` subagent, no authoring context), plan sha256 `015edfe4…4e78` at review time; 5/5 stages, 0 Blockers / 2 Majors / 4 Minors / 5 Nits. Both Majors (a false uniqueness claim about the open roadmap gate; a mutation mechanism that cannot reach the module under test) and all Minors and Nits are fixed in this revision. Cold report: `/tmp/opencode/r7-export-cold-review.md`, sha256 `d15cfc67…d92f`. Recorded limitation: the five stages ran as lenses inside one fresh context, not five separate fresh contexts; the cold premise (no authoring conversation, no prior findings) holds.
**Rollback cost:** 1 — one additive option argument plus an error class, and test-only changes; `git revert` of the commit series restores the prior exports with no state, schema, or config change.
**Roadmap item:** `ROADMAP.md` § R7 export remediation (`ROADMAP.md:17-22`); removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); 148 unpushed commits, oldest 3.1 d; 9 open roadmap items; `HEAD` `38c81b7`, clean tree apart from this plan directory.

## Why this section

`ROADMAP.md` § R7 export remediation is the first open section in the file, and
the ordering rule is top section first, so file order alone selects it. Its
trigger — "start after chunk R8 closes" — is satisfied: the sweep status board
records R8 **closed 2026-11-10**
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:602`). It is not the only
section with a satisfied trigger: the three R8 sections carry "start after the
sweep reaches R9" (`ROADMAP.md:29,36,43`), the three R9 sections carry "start
after chunk M1 closes" (`ROADMAP.md:50,57,64`, and M1 closed 2026-11-10 at
`worklist.md:604`), and the last two are keyed to "the next increment that …"
(`ROADMAP.md:71,78`). Selection is therefore by file order, not by gate
uniqueness.

Both findings are evidence/contract gaps in the same module, which is why they
were filed together:

- **F-R7-F-1** — export determinism is implied by pure functions but never
  asserted by a repeat-and-compare test (`src/lib/report-export.test.ts:9-26`).
- **F-R7-F-2** — the library exports call `validateReport` and discard `ok`, and
  `reportToSourcesCsv` never validates at all (`src/lib/report-export.ts:33-67`),
  while REQ-126 requires export to "validate the report before writing unless the
  caller explicitly skips validation" (`infobroker.md:510`).

REQ-126 already states the obligation, so closing F-R7-F-2 needs no REQ body
edit: the code is the gap, not the spec. Only the CLI (`scripts/render-report.ts:80-88`)
enforces validation today; the functions REQ-126 calls "the report tooling" do not.

## Baseline (verified this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **148 unpushed
  commits, oldest 3.1 d**, 9 open roadmap items.
- Working tree clean at `38c81b7` apart from this plan directory.
- `npm run check` → **FAIL, one gate: `check-loop-artifacts`** — `missing tasks.md`
  and `missing aar.md` for this increment directory. This directory did not exist
  when the run started; it was created during the run, so the gate scanned a
  half-made increment. Every gate before it passed: 22-gate suite, 121 test files
  / 1438 tests, `test-push-pipeline`, `check-pack`, `test-debate-club` (8 files /
  61 tests), `audit` (4 low-severity `katex`/`markdownlint` transitives; the gate
  fails only on high/critical per REQ-101, so it passed). `typecheck:scripts` (the
  last gate) did not run because the manifest stops at the first failure. The red
  is an artifact of the plan's own directory, not of the tree.
- Re-run after `tasks.md` and `aar.md` were written:
  `npm run check-loop-artifacts` → **PASS, 0 errors**, 1 pre-existing warning
  (`2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:**
  line`, not this increment's and not fixed here).
- Live probe (tsx, this session) against `test-fixtures/reports/bad-confidence.md`:
  `validateReport` returns `ok: false` with 12 error findings
  (`manifest-as-of`, `manifest-handling-required`, `manifest-confidence`,
  `shape-block`, `register-column` ×4, `register-primacy`, `register-interests`,
  `register-published`, `register-accessed`), yet `reportToJson` still returns a
  manifest and 10 sections, `reportToSourcesCsv` returns 2 rows, and
  `reportToClaimsCsv` returns 2 rows. **Confirmed: an invalid report exports
  cleanly today** — the F-R7-F-2 predicate.
- Repeat probe on `good-report.md`: two `reportToJson` calls produce byte-identical
  JSON. The functions are already deterministic; F-R7-F-1 is a missing assertion,
  not a behavior defect. The increment must record that rather than claim red
  evidence that does not exist.

## Predicates re-verified by reading the code this session

| Claim | Evidence | Verdict |
|---|---|---|
| `reportToJson` validates but discards `ok` | `src/lib/report-export.ts:34-35` calls `validateReport`, uses only `.manifest`/`.sections` | Confirmed |
| `reportToClaimsCsv` validates but discards `ok` | `src/lib/report-export.ts:56-57` | Confirmed |
| `reportToSourcesCsv` never validates | `src/lib/report-export.ts:50-53` reads the register rows directly | Confirmed |
| The CLI already enforces validation for every format | `scripts/render-report.ts:80-88` runs before the format branch at `:92-97` | Confirmed |
| `--no-validate` is the caller's explicit skip | flag parsing at `scripts/render-report.ts:61` sets `validate = false`, which skips the pre-check | Confirmed — the option exists but is not passed to the exports |
| The exports are the only library surface of this module | `grep -rn "reportToJson\|reportToSourcesCsv\|reportToClaimsCsv"` → `src/lib/report-export.ts`, its test, and `scripts/render-report.ts` | Confirmed — no other consumer |
| No test covers the CLI | `rg "render-report" --glob '!docs/**' --glob '!CHANGELOG.md'` → `package.json`, the script itself; the full `rg` also hits `CHANGELOG.md:1378,1434` and `worklist.md:405`, none of which is a test. `vitest.config.ts:5` includes `scripts/**/*.test.ts`, and no `render-report.test.ts` exists | Confirmed — the `--no-validate` mapping is untested. Note `worklist.md:873` records the older `F-R7-F-4` ("render-report CLI flags are untested") as `Closed-P3`; this increment partly retires that finding, and the AAR names it so the registers do not disagree |
| REPO lib convention for invalid input is `throw` | `src/lib/report-delta.ts:47,50`; `src/lib/watchlist.ts:23-33` | Confirmed — throwing is the house style, not a new pattern |
| REQ-126 carries no `or`-branch or "when … declares" conditional | `src/clause-coverage.ts` — regexes at `:19` (`OR_ENUM_RE`) and `:23` (`CONDITIONAL_RE`), detector at `:89-102`; neither matches `infobroker.md:510` | Confirmed — no clause tag is required; named tags are additive documentation |
| `validateReport` is pure and side-effect-free | `src/lib/report-manifest.ts:682-764`; no I/O in the module | Confirmed — a second call from the CLI is cheap and cannot change output |

## Alternatives considered

- **A — enforce in the CLI only.** Rejected: the CLI already enforces. F-R7-F-2
  names the library exports, and a library consumer bypasses the CLI entirely, so
  the finding would remain true.
- **B — return a discriminated union `{ ok: true, value } | { ok: false, findings }`.**
  Rejected: it duplicates the union `validateReport` already returns, forces every
  call site into result handling, and departs from the module's pure-string
  signature. The CLI would still need a branch to print findings.
- **C — one `exportReport(markdown, { format })` wrapper.** Rejected: the CLI
  writes a claims CSV alongside a second format (`--claims-out`), so it needs the
  individual functions; a wrapper adds indirection without removing the need.
- **D — narrow REQ-126 to the CLI.** Rejected: the REQ is correct as written and
  the code is behind it. Narrowing the spec to match a weak implementation is the
  defect this sweep exists to catch.
- **E — validate through a typed throw with an explicit skip option (chosen).**
  Each export takes `ExportOptions { skipValidation?: boolean }`, validates by
  default, and throws `ReportExportError` (carrying the findings) when the report
  is invalid. House style, one concept, and `--no-validate` maps directly onto it.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/lib/report-export.ts` | add `ExportOptions`, `ReportExportError`, and one `ensureValidated(markdown, options)` helper; `reportToJson` and `reportToClaimsCsv` reuse their single `validateReport` call to decide (no second pass); `reportToSourcesCsv` gains the check; all three accept the options argument | S |
| `scripts/render-report.ts` | pass `{ skipValidation: !validate }` to the three exports; map a `ReportExportError` to the documented exit 1 instead of the catch-all exit 2; usage text unchanged | S |
| `src/lib/report-export.test.ts` | three new `it` blocks: default refusal on an invalid report for all three exports (typed error carries error-level findings only), explicit skip returns the same output as before, and the repeat-and-compare determinism assertion | S |
| `scripts/render-report.test.ts` (new) | CLI integration: invalid report without the flag → exit 1 and the error codes on stderr; invalid report with `--no-validate` → exit 0 and JSON on stdout; good report → exit 0 | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | REQ-126 verdict row (`:428`) and the two register rows `F-R7-F-1`/`F-R7-F-2` (`:853-854`) → `Resolved 2026-11-12` with evidence | S |
| `ROADMAP.md` | remove § R7 export remediation | S |
| `CHANGELOG.md` | one section under the `2026.11.11` date | S |
| `DECISIONS.md` | one entry recording the export-validation contract: library-level enforcement, throwing over a result union, and why the CLI validates twice by design | S |
| `docs/plans/2026-11-12-r7-export-remediation/` | `plan.md`, `tasks.md`, `aar.md` (increment record) | S |

No spec body change, no config, schema, dependency, provider-registry, tool-schema,
or new-gate change. The MCP tool surface is untouched: `report-export.ts` is not
imported by `src/index.ts`.

## Done bar

**Done bar:** F-R7-F-1 and F-R7-F-2 each read `Resolved 2026-11-12` with file:line
evidence. Concretely: (1) every one of the three exports throws `ReportExportError`
on a report that `validateReport` rejects, and each returns data when
`skipValidation: true` is passed, with the exact same bytes as today — asserted for
JSON and both CSVs in `src/lib/report-export.test.ts`; (2) the determinism test
calls each export twice and compares byte-for-byte, and an in-place
`Date.now()` mutation of `src/lib/report-export.ts` makes it fail before the file
is restored from `/tmp/opencode/report-export.bak.ts` (mutation evidence recorded
in `tasks.md`); (3) `scripts/render-report.test.ts`
shows the invalid report exits 1 without the flag and 0 with `--no-validate`;
(4) `npm run typecheck`, `npx vitest run src/lib/report-export.test.ts
scripts/render-report.test.ts`, `npm run validate-spec`, `npm run check-roadmap`,
`npm run version-sync`, `npm run check-script-discipline`, and `npm run
check-loop-artifacts` are green on the final tree; (5) `npm run check` is green
**after** `aar.md` carries its terminal token; (6) the roadmap section is gone and
the three worklist rows carry their evidence; (7) the AAR ends `LOOP PAUSED` with
the review cap recorded.

## Review-loop cap (recorded, not judged at run time)

Per `ROADMAP.md` § Review-loop convergence, the cap is stated here: **one cold pass
at standard depth, plus at most one targeted diff re-review of the lines that
changed.** If the cold pass returns a blocker inside one finding's evidence, the
revision narrows to that finding instead of re-scoping the combined increment. At
the cap, an unresolved item is escalated to the user rather than re-scoped. This
increment records the cap and does not retire § Review-loop convergence; retiring
it is a user decision after the AAR.

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Record the baseline in `tasks.md`: `npm run status`, the `npm run check`
  result, and the two live probes above (invalid report exports cleanly; repeated
  export is byte-identical).
- **T1 (done in the planning session).** Create `tasks.md` (this step list) and
  `aar.md` seeded with `LOOP OPEN` plus the finding list, so `check-loop-artifacts`
  sees a complete directory from the first gate run onward. Both exist and the
  gate is green on them; T0's baseline row is recorded in `tasks.md`.

### Phase 1 — Library enforcement (F-R7-F-2)

- **T2 — red.** Add the "refuses to export a report that fails validation" `it` to
  `src/lib/report-export.test.ts`, using `bad-confidence.md`. Run it; expect three
  failures (`reportToJson`, `reportToSourcesCsv`, `reportToClaimsCsv` do not
  throw). Record the verbatim failure output. The explicit-skip assertion is
  written in the same block but is expected to pass pre-change; `tasks.md` records
  which assertions were red so the evidence is not overstated.
- **T3 — implement.** In `src/lib/report-export.ts`: add
  `export interface ExportOptions { skipValidation?: boolean }`, add
  `export class ReportExportError extends Error { readonly findings: ReportFinding[] }`
  (message lists the error-level codes only — never report text), and add
  `ensureValidated(markdown, options)` returning the `ReportValidation` it used.
  `reportToJson` calls it once and keeps its existing data path; `reportToClaimsCsv`
  the same; `reportToSourcesCsv` calls it for the gate and then reads rows as
  before. All three take `options: ExportOptions = {}`. Update the module header
  (`src/lib/report-export.ts:2-4`) so "pure functions over a validated report"
  reads as "validate by default; `skipValidation` is the caller's explicit
  opt-out".
- **T4.** Update `scripts/render-report.ts` to pass `{ skipValidation: !validate }`
  to each export call (`:90`, `:94`, `:96`), and map a `ReportExportError` thrown
  by an export to the documented `1 = validation failure` exit (print its
  finding codes to stderr) instead of letting the catch-all at `:100-103` report
  exit 2. The path is unreachable today because the pre-check at `:80-88`
  validates the same in-memory string, but the two checks can diverge, and the
  exit-code contract must stay coherent if they do. Manually run the two CLI
  transcripts
  on `bad-confidence.md` (`--format json`, with and without `--no-validate`) and
  copy them into `tasks.md`.
- **T5.** Add `scripts/render-report.test.ts` (shebang + header comment, role:
  test) spawning `npx tsx scripts/render-report.ts` with `spawnSync` for the three
  cases. Assert exit code, and for the skip case assert stdout parses as JSON with
  a `manifest` key. No new fixture; `bad-confidence.md` and `good-report.md` are
  reused.
- **T6.** `npm run typecheck` and
  `npx vitest run src/lib/report-export.test.ts scripts/render-report.test.ts` →
  green.

### Phase 2 — Determinism evidence (F-R7-F-1)

- **T7.** Add the repeat-and-compare `it` to `src/lib/report-export.test.ts`: call
  each export twice on the same Markdown and assert `JSON.stringify` equality for
  the JSON and string equality for both CSVs; separately assert the JSON's source
  ids and claim order match the report, and that the serialized JSON contains no
  timestamp or absolute-path field (`/\d{4}-\d{2}-\d{2}T|Date|\/home\//`).
- **T8 — mutation check.** The test imports `./report-export.js` and resolves
  its fixture through `import.meta.dirname`
  (`src/lib/report-export.test.ts:5,7`), so a copy outside `src/lib/` is never
  loaded. Method: `cp src/lib/report-export.ts /tmp/opencode/report-export.bak.ts`;
  edit the module **in place** to add one non-deterministic field
  (`stamp: Date.now()` in `reportToJson`'s return); run
  `npx vitest run src/lib/report-export.test.ts` and record the failure; restore
  with `cp /tmp/opencode/report-export.bak.ts src/lib/report-export.ts`; confirm
  `git diff --stat` shows only the intended Phase 1 change and re-run the suite
  green. The backup/restore pair is used instead of `git checkout --` because the
  Phase 1 edits are uncommitted at this point. `tasks.md` states plainly that the
  pre-change code was already deterministic and this finding was coverage.
- **T9.** Add the three named clause tags to the test file header:
  `// @implements REQ-126 export-validates`,
  `// @implements REQ-126 explicit-skip`, and
  `// @implements REQ-126 export-determinism`. `src/clause-coverage.ts` requires
  none (REQ-126 has no detected branch), so these are additive documentation, not
  a gate workaround.

### Phase 3 — Bookkeeping

- **T10.** In `docs/plans/2026-11-09-full-review-sweep/worklist.md`, replace the
  REQ-126 row's `finding:F-R7-F-2` with a `**Resolved 2026-11-12**` verdict naming
  the evidence, and update the `F-R7-F-1` / `F-R7-F-2` register rows (`:853-854`)
  with their dispositions. `grep -rn "F-R7-F-" --include=*.md .` returns only the
  worklist and `ROADMAP.md`.
- **T11.** Remove § R7 export remediation from `ROADMAP.md`; `npm run
  check-roadmap` → OK. This leaves § R8 update-preservation evidence as the first
  section, whose trigger is still unopened.
- **T12.** Add a new `## 2026.11.11 — …` CHANGELOG heading (the version-sync gate
  pins the top date to `package.json`; eight same-date headings are the existing
  convention, `CHANGELOG.md:3,24,40,59,89,109,223,268`).
- **T13.** Add the `DECISIONS.md` entry (next free id, `D-110`) recording that
  library exports validate by default, that `skipValidation` is the explicit
  opt-out, that a throw was chosen over a result union, and that the CLI's
  pre-check plus the exports' check is deliberate duplication so HTML and library
  callers get the same guarantee.

### Phase 4 — Gates and close

- **T14.** `npm run validate-spec`, `npm run check-roadmap`,
  `npm run version-sync`, `npm run check-script-discipline`,
  `npm run typecheck:scripts`.
- **T15.** Rewrite `aar.md` with finding dispositions, the review cap, and the
  terminal `LOOP PAUSED` / `LOOP OPEN` token. `npm run session:close`.
- **T16.** `npm run check-loop-artifacts`, then `npm run check` on the final tree
  (full suite, un-piped, exit status recorded). This runs after the AAR so the
  loop-artifact gate is satisfiable.

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| Default refusal on an invalid report | `vitest run src/lib/report-export.test.ts` | the live probe shows `ok: false` today, so the assertion has a real input |
| Explicit skip preserves output bytes | same suite | output is unchanged by the option; the pre-change bytes are captured at T0 |
| Determinism | same suite | repeated calls already compare equal in the probe; the test makes it permanent |
| The mutation check bites | scratch-copy run | injecting a clock read must fail the repeat-and-compare assertion |
| CLI mapping | `vitest run scripts/render-report.test.ts` | `--no-validate` already skips the pre-check, so only the option passthrough is new |
| No spec drift | `validate-spec` | no REQ body change; `report-export.ts` keeps its `@implements REQ-126` header |
| Whole-tree health | `npm run check` after T15 | 22 gates, sequential; the only expected baseline red is the AAR that T15 writes |

## Edge cases and rollback

- **A caller wants raw data from an invalid report.** `skipValidation: true` is the
  documented opt-out, and the CLI's `--no-validate` already exposes it; behaviour
  is byte-identical to today, so no downstream format changes.
- **The CLI validates twice when the flag is absent.** Deliberate: the pre-check
  owns the friendly multi-error listing and the HTML path, the exports own the
  library guarantee. `validateReport` is pure and bounded by report size, so the
  second pass cannot change output or state. Recorded as D-110.
- **`reportToSourcesCsv` needs a manifest it does not use.** It calls the shared
  helper for the gate only; the returned validation is discarded, so the CSV
  content is unchanged. If a future edit starts using the manifest there, it comes
  from the same call — no second validation.
- **An error message leaks report content.** Forestalled: `ReportExportError`'s
  message lists finding codes only; the findings array carries the structured
  detail for programmatic callers.
- **The new CLI test is load-sensitive.** Two `npx tsx` spawns run inside the
  suite's 30 s `testTimeout` (`vitest.config.ts:9`); the repo already shells out
  from tests (`scripts/version.test.ts:198`).
- **`check-pack` sees a new test file.** Test files are not in the published
  tarball allowlist; if the pack list changes, T16 surfaces it and the allowlist is
  not touched by this increment.
- **Rollback.** Per commit: `git revert <sha>`. Phase 1 reverts the module, the
  script, and both tests together; Phase 2 reverts test-only lines; Phase 3 reverts
  registers and docs with no production change.

## Commit series

Each commit is `typecheck`-clean and passes the gate it feeds. Order matches the
convention buckets in `AGENTS.md`.

1. `fix(report-export)`: `ExportOptions`, `ReportExportError`, the three gated
   exports, the CLI passthrough, and both test files' refusal/skip/CLI cases
   (Phase 1). Gate: `vitest run src/lib/report-export.test.ts
   scripts/render-report.test.ts`, `typecheck`.
2. `test(report-export)`: the repeat-and-compare determinism assertion and the
   clause tags — no production change (Phase 2). Gate: same suite.
3. `docs(plans)`: worklist dispositions and roadmap removal (Phase 3 T10–T11).
   Gate: `check-roadmap`.
4. `docs(decisions)`: the D-110 export-validation contract (T13).
5. `docs(changelog)`: the CHANGELOG section (T12); `version-sync`.
6. `docs(plans)`: this increment's `plan.md`, `tasks.md`, `aar.md`;
   `check-loop-artifacts`.

## Conditions to verify during execution

- **C-1** — the live probe output is captured at T0 and re-run at T6; a change in
  the invalid report's error set is a stop, not a test edit.
- **C-2** — the red at T2 must name all three exports. If only one fails, the
  other two are already enforcing and the finding's file:line evidence is stale;
  stop and re-read `report-export.ts`.
- **C-3** — determinism is coverage, not a fix: the AAR must say so and must not
  claim the code was nondeterministic.
- **C-4** — the review cap: one cold pass, at most one diff re-review; at the cap
  any unresolved item is escalated to the user.
- **C-5** — `npm run check` runs only after `aar.md` carries a terminal token; a
  `check-loop-artifacts` failure before T15 is expected and is not a tree defect.
- **C-6** — no REQ body edit: if `validate-spec` or the read-through wants REQ-126
  reworded, that is a separate increment, not a silent edit inside this one.

## Unknowns

- Whether `check-script-discipline` accepts a `scripts/*.test.ts` that spawns a
  sibling script — the existing `scripts/monitor-watchlist.test.ts` precedent says
  yes, and T14 settles it.
- Whether the prose in `skills/infobroker/references/*.md` mentions
  `--no-validate`; `rg` found no hit, so no client-artifact update is expected, but
  T14's `validate-spec`/README checks are the authority.
- Whether the next free DECISIONS id is `D-110` — confirmed from
  `rg -o "D-\d{3}" DECISIONS.md | sort -u | tail` in this session; T13 re-checks
  before writing.
