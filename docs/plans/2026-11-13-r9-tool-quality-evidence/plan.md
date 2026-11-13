# Plan — R9 tool-quality reporting and evidence

**Status:** revision 3 (cold pass 1 and diff re-review both FAILED; their
findings are applied; revision 3 is not independently re-read) · **Date:** 2026-11-13 · **Depth:** standard
**Review independence:** self. `plan.cold/report.md` (cold pass 1, FAILED: 2
blockers, 8 majors) and `plan.cold/report-diff.md` (diff re-review, FAILED: 1
new clarity major) reviewed revisions 1–2; revision 3 applies every finding.
The standard re-review cap forbade a third pass, so revision 3 carries the
recorded condition `risk accepted: no cold pass — authorized by fluke`.
**Rollback cost:** 1 on the §7 0–2 scale (reversible edit). The rollback unit is
commit C1 as a whole — the amended REQ-106 sentence is false without the report
fields, so spec and gate revert together. C2 reverts independently: without it
the descriptions stay truthful and the REQ-089 clause simply stays unasserted.
**Roadmap item:** `ROADMAP.md:17-22` § R9 tool-quality reporting and evidence;
removed when this increment closes.
**Predecessor:** version `2026.11.11` (latest tag `v2026.11.07`); `HEAD`
`27abc6c`; `npm run check:fast` PASS (19/19 gates, 28.2 s) with a clean tree
before this directory existed. Full `npm run check` was not run this session.
**Closes:** F-R9-B-1, F-R9-B-2, F-R9-B-3 (`worklist.md:883-885`).

## Why this item

`ROADMAP.md:17-22` is the first open section in file order, and file order
selects it. Its trigger — "start after chunk M1 closes" — is satisfied: the
sweep board records M1 closed 2026-11-10
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:604`). The other three
open sections are separate items and stay open. All three findings are P1 in
the sweep register and `Scheduled-roadmap` today.

- **F-R9-B-1 — the report omits a metric the REQ names, and names a carrier
  that does not exist.** REQ-106 (`infobroker.md:382`) requires the report to
  state parameter counts, schema description coverage, invocation cost, and
  definition size, and says the **server** reports them. `check-tdqs --report`
  emits coverage, cost, and size but never `paramCount`/`requiredParamCount`
  (`src/tdqs.ts:270` computes both; `scripts/check-tdqs.ts:113-127` drops
  them), and no server-side per-tool report exists — `inspect_providers spec`
  emits only an aggregate `token_footprint` (`src/index.ts:1722-1760`).
- **F-R9-B-2 — the contradiction branch is report-only, and its detector
  cannot fire on a conformant surface.** `src/tdqs.ts:429-438` labels
  candidates heuristic; `scripts/check-tdqs.ts:134` exits non-zero on
  `structuralViolations` alone. Worse, the detector tests
  `MUTATION_VERBS.test(desc) && !NEGATIONS.test(desc)` over the **whole**
  description (`src/tdqs.ts:434`), and `NEGATIONS` matches the literal `not`
  (`src/tdqs.ts:390`) while REQ-089/092 require every description to contain
  "Do NOT use" (`scripts/validate-spec.ts:1089`,
  `src/tool-surface.test.ts:143`). Every conformant description therefore
  suppresses detection by construction, so promoting the branch unchanged would
  add no coverage.
- **F-R9-B-3 — the behavioral-consequence clause has no assertion.** The static
  bar (`scripts/validate-spec.ts:1076-1104`) and the live bar
  (`src/tool-surface.test.ts:130-180`) assert purpose, use/when-not plus an
  alternative, the return contract, annotations, parameter descriptions, and
  coupling notes. Nothing asserts disclosure of stored-state effects, external
  calls, rate limits, authentication requirements, or destructive operations.

## Measured state (this session, before any edit)

Probes run against the live `tools/list` surface; the disclosure probe is
committed as `evidence/measure-tool-disclosure.ts` with output
`evidence/measure-tool-disclosure.out`.

**Disclosure coverage** (`Y` = disclosed, `n/a` = class does not apply):

| tool | stored | external | rate-limit | auth | destructive |
|---|---|---|---|---|---|
| search_web | Y | Y | Y | Y | n/a |
| fetch_page | Y | Y | Y | Y | n/a |
| inspect_providers | n/a | Y | Y | n/a | n/a |
| verify_claims | Y | Y | Y | **GAP** | n/a |
| manage_kb | Y | Y | **GAP** | **GAP** | Y |
| reload_config | Y | n/a | n/a | n/a | Y |
| get_citations | n/a | Y | Y | Y | n/a |

- **Applicability rule** (recorded in `DECISIONS.md` D-115): a class applies
  when the tool exercises it, and never because the description under test
  mentions it. `external` — the tool makes outbound network calls.
  `rate-limit` — the tool dispatches through the provider or renderer chain and
  consumes its quota. `auth` — the tool dispatches through that chain, so
  configured credentials change its coverage. `stored` — the tool creates,
  modifies, or deletes persisted state under its own control (knowledge-base
  entries, the user config layer); transport-level artifacts every tool can
  produce (the truncation temp file in `$TMPDIR/infobroker/`) do not make the
  class apply, so a read-only tool with no persisted write of its own is
  `n/a`, and a disclaimer is not what makes the class apply. `destructive` — the tool
  declares `destructiveHint: true`. Each `n/a` cell carries a one-line
  justification in the matrix in `tasks.md`.
- **Three disclosure cells across two descriptions are gaps**: `verify_claims`
  never says that keyed providers need a configured API key; `manage_kb` never
  says that URL ingest dispatches the fetch chain and therefore consumes its
  quota, rate limits, and configured keys.
- **Contradiction detector dry run.** 7 tools, 3 read-only
  (`search_web`, `inspect_providers`, `get_citations`). Sentence-scoped
  negation with the "Do NOT use" guidance sentence excluded yields **0
  candidates** on the live corpus, because the only mutation verb in those
  descriptions ("modifies", `inspect_providers`) sits in a negated sentence.
  The old whole-description form also yields 0, for the vacuous reason above.
  Synthetic classification (the false-positive budget): 1 true positive
  ("Reads the index and writes findings back to the store."), 0 false
  positives (a negated sentence, a guidance-only sentence, and the live
  corpus).
- **Error-gate dry run.** `npx tsx scripts/check-tdqs.ts --report` on the
  current tree: 7 tools, 0 shadow candidates, 0 contradiction candidates, 0
  violations. Promoting the branch changes no current result; the fail-before
  evidence is a unit fixture over the pure violation function, and the script's
  failure path is its own `violations.length > 0` branch — no fixture-injection
  mode is added to `check-tdqs`.
- **Existing-check discovery.** No script asserts behavioral disclosure:
  `grep -rn "stored state|rate limit|authentication" scripts/*.ts` returns
  prose comments only, and the static bar (`validate-spec.ts:1076-1104`)
  covers the structural subset. The new assertion does not duplicate a gate.
- **Server-side carrier feasibility.** `doSpecHealth` reads
  `server._registeredTools`, whose `inputSchema` is a Zod raw shape
  (`src/index.ts:1735-1740`). Per-tool `definitionBytes`/`paramCount` derived
  there would be Zod numbers, not the JSON-Schema numbers the gate reports —
  two sources of truth for one metric.

## Decisions and alternatives

1. **REQ-106 carrier: narrow to the conformance gate (chosen).** The spec
   already uses "conformance gate" as its subject (`infobroker.md:379`), so the sentence
   becomes "The conformance gate SHALL report …" — a subject the spec owns.
   Rejected: "the conformance report" (an undefined term), and a second
   server-side report (two derivations of one metric; a new contract on a
   7-tool surface with a REQ-107 citation obligation). D-115 records the
   narrowing and the rejected alternative.
2. **Contradiction check: promote, and fix the detector (chosen).** Promotion
   is code-only because REQ-106 already places the clause inside the layer the
   gate SHALL enforce. Negation is scoped per sentence and the "Do NOT use"
   guidance sentence is excluded; the mutation-verb list is **unchanged**
   (widening it to "caches" would flag `search_web`'s declared cache write and
   turn a separate annotation question into this increment's blocker).
   Rejected: narrowing the REQ to exclude the branch (deletes a checkable
   clause); keeping the detector as-is (vacuous, per the measured section).
3. **Disclosure assertion: live test over a declared matrix (chosen).**
   Rejected: a second static bar in `validate-spec.ts` (duplicate carrier for
   the same REQ-089 clause); a prose-similarity or LLM check (nondeterministic,
   cannot gate).
4. **Marker matching is a proxy (accepted).** The assertion proves disclosure
   *presence*, not *accuracy*; D-115 and the test comment record the limit. A
   false positive blocks a release, so markers stay narrow
   (`API key|authenticat|credential` rather than `key`).
5. **README stays in this increment (chosen).** A REQ body change obliges a
   non-whitespace README diff at publication; writing the sentence now keeps
   the increment self-contained instead of leaving a prep-time obligation.
6. **No version bump.** The predecessor added a CHANGELOG section under the
   current version without bumping (`git log --oneline -- package.json` shows
   the last bump at `511dce1`); bumping belongs to the release step. Multiple
   `## 2026.11.11` sections are the established per-increment convention
   (`CHANGELOG.md:3,28,50`).

## Files expected

- `infobroker.md`
- `src/tdqs.ts`
- `src/tdqs.test.ts`
- `scripts/check-tdqs.ts`
- `src/index.ts`
- `src/tool-surface.test.ts`
- `README.md`
- `DECISIONS.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `docs/plans/2026-11-09-full-review-sweep/worklist.md`
- `docs/plans/2026-11-13-r9-tool-quality-evidence/plan.md`
- `docs/plans/2026-11-13-r9-tool-quality-evidence/plan.cold/report.md`
- `docs/plans/2026-11-13-r9-tool-quality-evidence/tasks.md`
- `docs/plans/2026-11-13-r9-tool-quality-evidence/aar.md`
- `docs/plans/2026-11-13-r9-tool-quality-evidence/evidence/measure-tool-disclosure.ts`
- `docs/plans/2026-11-13-r9-tool-quality-evidence/evidence/measure-tool-disclosure.out`

Blast radius: 5 source/test files, 6 documentation files (`README`, `DECISIONS`,
`CHANGELOG`, `ROADMAP`, the sweep register, the increment directory), 1 spec
file. No config, no dependency, no migration, no destructive operation.

## Work (commit order and the gate each commit must pass)

**C1 — the REQ-106 gap closes as one concern (M).**

1. `infobroker.md:382`: replace `The server SHALL report` with
   `The conformance gate SHALL report`. Nothing else changes. Budget measured
   with `wc -c` on `infobroker.md:382`: body 671 → 681 chars, 4 sentences,
   5 SHALL clauses, 0 backticked tokens — inside Appendix B (≤800 / ≤8 / ≤8 /
   ≤5).
2. `src/tdqs.ts`: add `QualityReport` + `buildQualityReport(defs)` emitting
   `paramCount` and `requiredParamCount` beside `invocationCost`,
   `definitionBytes`, `schemaDescriptionCoverage`, `schemaDepth`,
   `unionChoiceCount`; make `annotationContradictionCandidates` sentence-scoped
   (drop the `Do NOT use` guidance sentence, then require a mutation verb and
   no negation in the same sentence); add
   `conformanceViolations(defs)` = structural plus contradiction, rule name
   `annotation-contradiction`.
3. `scripts/check-tdqs.ts`: consume both, drop the inline report assembly,
   keep `--report` informational (exit 0 on any conformance result; exit 2
   stays reserved for a fatal error), keep the default failing exit on a
   non-empty violation list, make the stderr summary name the contradiction
   count, and update the script's own `USAGE` text — `1 = conformance
   violation` (it currently reads "structural violation") and the `--report`
   line ("always exit 0" is wrong; a fatal error still exits 2). The report's `violations` key becomes the conformance
   list and the separate `annotationContradictionCandidates` key is removed —
   it would duplicate entries, and `src/tdqs.test.ts:20,229` is its only other
   consumer.
4. `src/tdqs.test.ts`: the report carries all four REQ-named metrics for every
   definition (red before: `paramCount` `undefined`); `conformanceViolations`
   yields `annotation-contradiction` for a read-only definition whose sentence
   says it writes, and yields none for the negated sentence, the guidance-only
   sentence, and a mutation verb that appears only in "Do NOT use".
5. `CHANGELOG.md`: a new section `## 2026.11.11 — R9 tool-quality reporting and
   evidence` whose first bullet is this gate change (AGENTS.md: a gate
   behavioral change ships with its CHANGELOG entry).
6. `DECISIONS.md:1189-1192`: replace the whole sentence, which must keep the
   shadow-candidate reporting fact (REQ-106 requires it and the gate performs
   it) — the new text reads: "The gate fails on structural and
   annotation-contradiction violations, reports shadow candidates and per-tool
   signals, and binds the deterministic layer to the live surface." No
   fragment-level swap: the rewritten sentence replaces the old
   "…and reports shadow candidates, annotation-contradiction candidates, and
   per-tool signals" clause in one edit.
7. `src/tdqs.ts:424-428`: the doc comment above
   `annotationContradictionCandidates` stops calling the branch report-only —
   it now names the sentence-scoped rule and the gate-failing consequence.

Must pass: `validate-spec`, `typecheck`, `typecheck:scripts`,
`check-script-discipline`, `npm run test -- src/tdqs.test.ts`, `check-tdqs`
(exit 0 on the live tree). Commit:
`fix(tdqs): complete the REQ-106 report and enforce contradictions`.

**C2 — behavioral disclosure (M).**

1. `src/tool-surface.test.ts`: add the 5-class matrix, marker sets, and one row
   per tool; a live tool without a row fails; the per-class `n/a`
   justifications mirror `tasks.md`;
   `// @implements REQ-089 behavioral-consequence` on the test.
2. `src/index.ts`: one sentence to `verify_claims` (keyed providers need their
   configured API key) and one to `manage_kb` (URL ingest dispatches the fetch
   chain and consumes its quota, rate limits, and configured keys). Keep
   `Use when`, `Do NOT use`, the alternative-tool reference, and the
   `[OK]`/`[ERROR]` contract intact — `validate-spec:1076` re-checks them.
3. `README.md`: one sentence under `### Operational Visibility` naming the
   per-tool quality report (parameter counts, description coverage, invocation
   cost, definition size, shadow pairs).
4. `CHANGELOG.md`: one bullet for the disclosure assertion and the two
   description sentences.
5. Red-before recorded in `tasks.md`: the new test against unchanged
   descriptions fails exactly 3 cells; green after the two edits.

Must pass: `typecheck`, `validate-spec`, `validate-readme`,
`check-intent-citations`, `npm run test -- src/tool-surface.test.ts`,
`check-tdqs`. Commit:
`feat(tools): disclose behavioral consequences in every definition`.

**C3 — registers and decisions (S).** `ROADMAP.md` section deleted, leaving the
other three items intact; `worklist.md:883-885` rows →
`**Resolved 2026-11-13**` with the carrying gate/file per row;
`worklist.md:532` (REQ-089), `:534` (REQ-092), `:535-536` (REQ-106) verdict
rows rewritten to cite the new carrier and the disclosure assertion;
`DECISIONS.md` D-115 (carrier narrowing, contradiction promotion and the
vacuous-detector evidence, marker-proxy limits, applicability rule). Must pass:
`check-roadmap`, `check-non-goals`, `validate-spec`, `check-gate-coverage`.
Commit: `docs(roadmap): retire the R9 tool-quality item and resolve its rows`.

**C4 — increment artifact (S).** `tasks.md` transcript with the 7×5
justification table, `aar.md` dispositions and terminal token, evidence probe
and output, `plan.cold/report.md`. Must pass: `check-loop-artifacts`,
`check:fast`. Commit: `docs(plans): record the R9 tool-quality increment`.

## Done bar

**Done bar:** the increment is done when all five criteria below hold.

1. Every commit above is `typecheck`-clean; the final tree passes one full
   `npm run check` with exit 0.
2. `npx tsx scripts/check-tdqs.ts --report` states `paramCount` and
   `requiredParamCount` for all 7 tools; the default run exits 0 on the live
   tree. The failing path is proven by the unit test over
   `conformanceViolations` (non-empty list) — the script's only failure
   condition; no fixture-injection mode is added.
3. The disclosure test asserts all 7 tools, fails on an unregistered tool, and
   is green after the two description sentences.
4. `worklist.md` rows 532/534/535/536/883-885 are updated, the roadmap section
   is gone, `check-roadmap` and `check-loop-artifacts` pass.
5. `aar.md` ends `LOOP PAUSED` with zero new action items.

## Risks and edge cases

- **User impact.** Two agent-facing tool descriptions gain one sentence each
  (no parameter, output, or name change), README gains one sentence, and the
  gate report changes shape (`violations` folds in contradiction entries; one
  diagnostic key is dropped — informational only). No restart sequence,
  migration, or client change; a running server picks the new descriptions up
  on restart.
- **Marker false positive blocks a release.** Narrow markers, per-class
  justifications, and a classified dry run bound it. Fix a tripped marker by
  rewording the description, never by widening the marker.
- **The contradiction heuristic still has a false-positive class**: a
  non-read-only mutation disclosed inside a "Do NOT use" sentence is dropped
  with that sentence. Recorded in D-115; the live corpus has no such case.
- **REQ-106 narrowing could read as weakening a gate.** It is not: every
  required metric stays, and the carrier becomes the gate that computes them.
  D-115 states the reason and the rejected alternative.
- **`validate-spec` anchors drift after C2.** Anchors cited here describe the
  pre-edit tree and are not re-asserted post-edit.
- **Rollback.** Revert C1 as a unit — spec sentence, `src/tdqs.ts`, its tests,
  `scripts/check-tdqs.ts`, the CHANGELOG bullet, and the DECISIONS sentence —
  because the sentence and the fields move together. C2 reverts alone
  (descriptions, assertion, README sentence, and its CHANGELOG bullet are
  additions).

## Evidence

Preflight sidecar: `/home/fluke/.local/state/opencode/plans/3b34aea2…/plan.evidence.json`,
generated after this revision, carrying the plan hash, target existence and
tracking, REQ-089/106 matches, and `git HEAD` `27abc6c`.
