# AAR — Citation chain, dedupe merge, benchmark failure, and bounded preservation

AAR: SUCCESS — the four remaining § Corroboration rows are fixed, the section is
retired, and the full gate suite is green.

**Review cap:** 2 passes — one cold pass plus one targeted diff re-review; used 2 passes, none past the cap.

**Done bar:** met — see §2 and §5.

## 1. What was supposed to happen

Close the last four register rows in `ROADMAP.md` § Corroboration, citation, and
benchmark fidelity: `F-R5-E-1` (academic chain truncated at `fallback_depth`),
`F-R5-E-2` (DOI and title namespaces never merge), `F-R5-F-1` (a reconciler error is
swallowed and raw order scored), and `F-R5-C-8` (preservation awaited inline against
two requirements that cannot both hold).

Done bar from `plan.md`: four rows `Resolved` with a driving test or recorded
re-disposition; REQ-026c amended inside Appendix B; no § Corroboration section;
census re-derived; `npm run check` green; `aar.md` ends `LOOP PAUSED`. Three explicit
assumptions: the shipped academic chain is exactly five slugs (so E-1 is latent), the
snapshot store is local in production (so C-8 is about the archive wave), and the
register census is authoritative over its own stale prose cells.

## 2. What happened

All six steps executed. No step was skipped. Three deviations, all recorded:

1. **Step 4 first attempt failed one new test.** The initial implementation raced the
   policy assessment against the wave deadline *before* storing, so a bounded-out
   assessment left the source ungraded even with policy `off` in practice. Fixed
   inside the same step by storing the snippet first and bounding only the optional
   document upgrade. This is a real design correction: the first version reproduced
   the REQ-122 divergence the plan's M5 resolution was meant to remove.
2. **The plan's Step 5 file list omitted `CHANGELOG.md`.** No entry was written,
   deliberately: a new dated heading would fail `version-sync` while `package.json`
   still reads `2026.11.14`, and the release path (`npm run prep`) seeds it with the
   new version. Recorded rather than improvised.
3. **README `§Knowledge Base` exceeded its 350-word limit** after the first doc edit
   (`380 words`). Trimmed in the same step; `validate-readme` then reported
   `0 error(s), 0 warning(s)`.

Gate outcomes:

| Gate | Token | Verdict |
|------|-------|---------|
| plan-review | `plan-review passed.` | passed (approved with C-1, C-2, C-3) |
| independent-review | `independent-review passed.` (cold + diff re-review) | passed |
| build-review | `build-review passed.` | passed |
| validate-spec | `All checks passed.` | passed |
| validate-readme | `0 error(s), 0 warning(s)` | passed |
| `npm run check` | `gates: PASS (full)` | passed |

Loop closure: plan reviewed → build-review emitted before the first edit → outcome
verified by per-step test files and the full gate suite → findings below. Complete.

## 3. What went right

- Every claim the plan made about the tree survived execution. The five-slug chain,
  the `rankedUrls` boolean parameter collision, the `:873-881` sequential awaits, the
  local `snapshotSource`, and all four register line numbers were exactly as cited.
- The pre-change probes did their job: the `archiveBudgetMs` probe caught five match
  sites, not the three the plan first listed, before any edit.
- The cold pass's eight majors were all plan-precision defects; resolving them in the
  artifact avoided at least two build-time surprises (the synchronous `rejects`
  assertion and the census contradiction).
- The failure seam for C-8 was found by a test, not by review: the stalled-`fetchSource`
  case refused to go green until the store ordering changed.

## 4. What went wrong

- **The C-8 design in the approved plan was incomplete.** It said the deadline bounds
  "network work" but did not say the snippet store must happen *before* the bounded
  network awaits. The prose was ambiguous enough that the first implementation
  satisfied the words and violated the intent. Process finding: a plan that says
  "never skip the local store" must also name the ordering that makes it true.
- **A plan file-list omission** (`CHANGELOG.md`) surfaced only at close, because the
  plan's commit-series boundary (stop before release) and the repository's
  changelog-before-commit convention were reconciled implicitly rather than written
  down.
- **One avoidable retry**: the README word budget was not checked before the doc edit,
  although the plan-review checklist explicitly requires recording section counts.

## 5. Session performance

- Outcome vs done bar: **holds on every clause** — four rows resolved with named
  driving tests, REQ-026c at 535/3/6 against Appendix B limits, roadmap section gone
  (`open roadmap: 1 item(s)`), census re-derived `183 / 93 / 0`, full suite green.
- Scope adherence: no out-of-plan file was touched. `README.md`, `DECISIONS.md`,
  `ROADMAP.md`, `worklist.md`, and `config-tune.md` were all named in the blast radius.
- Verification quality: the new tests can fail. The benchmark test throws through the
  real `runBenchmark`; the stall tests use a `fetch` stub that rejects only on abort, so
  a regression that awaited forever would hang and fail rather than pass.
- Rework: one failing test inside Step 4, one README overrun inside Step 5. Necessary
  iteration, not thrash.
- Cost: roughly 45 tool calls; the largest single cost was the initial cold review
  (34 reads) and the full `npm run check` baseline.
- User intervention: one scoping question (all four rows vs. three) and the execution
  instruction. No corrections to the work itself.

## 6. Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| F-AAR-1 | P3 | A plan that forbids skipping a local store must name the ordering that guarantees it (store before bounded network awaits), or the first implementation can satisfy the words and break the intent | Closed as informational — Step 4 test caught it; the ordering is now commented in `src/corroborate.ts` |
| F-AAR-2 | P3 | The plan's Step 5 file list omitted `CHANGELOG.md` while the series stops before release; the deferral was correct but implicit | Closed as informational — recorded in `tasks.md` and here; the release path owns the entry |
| F-AAR-3 | P3 | The README section word budget was not recorded before the edit, forcing a second edit | Closed as informational — `validate-readme` caught it in the same step |

No P0, P1, or P2 findings. No process failure: every gate ran and every emitted token
is in §2. `ROADMAP.md` gains nothing from this increment; the remaining § Calibration
gold-set refresh item stays open on its own trigger.

## Follow-through register

- No open `SR-` or `PR-` finding IDs were carried into this increment.
- Prior AAR items from `2026-11-14-corroboration-routing-and-provenance` were all
  `P3 — closed as informational`; nothing carried forward.
- The unpushed backlog (253 commits, oldest 5.0 d) predates this increment and is
  handled by the ship path, not here.

## Skills loaded

`programming-orchestrator`, `plan-review`, `build-review`, `after-action-report`.
`changelog-before-commit` was not loaded: the series stops before release (C-3) and the
release path seeds the CHANGELOG entry with the new version, so it is declared out of
scope for this increment rather than missed.

Invocation: 4 expected, 4 loaded, 0 misses.

LOOP PAUSED
