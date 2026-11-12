# Plan — R7 report-contract evidence remediation

**Status:** revision 3, awaiting user approval · **Date:** 2026-11-12 · **Depth:** standard (one production module, one test file, an 18-file fixture corpus update, one skill reference, three registers; no destructive, external, credential, or publish surface)
**Review independence:** fresh — one cold pass (`independent-review`), revision 1 `FAILED` with 3 Blockers / 4 Majors / 4 Minors / 3 Nits; revision 2 returned `independent-review passed.` with one count nit and three clarity nits. Every Blocker and Major is fixed; the four post-pass nit findings (counts and wording) are applied in this revision after the passing pass (C-6), so the reviewed artifact and this text differ only in wording and counts. Cold report: `/tmp/opencode/r7-cold-review.md`.
**Rollback cost:** 1 — one additive validator rule plus fixtures and tests; `git revert` of the commit series restores the prior gate with no state, schema, or config change.
**Roadmap item:** `ROADMAP.md` § R7 report-contract evidence remediation (`ROADMAP.md:17-23`); removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); 119 unpushed commits, oldest 2.9 d; 14 open roadmap items; `HEAD` `2501e81`, clean tree apart from this plan directory (preflight evidence sidecar).

## Why this section

`ROADMAP.md` § R7 report-contract evidence remediation is the first open section in
the file, and the ordering rule is top section first. Its trigger — "start after
chunk R8 closes" — is satisfied: the sweep status board records R8 **closed
2026-11-10** (`docs/plans/2026-11-09-full-review-sweep/worklist.md:602`). The other
five R7 sections carry the same trigger (`ROADMAP.md:25-59`); file order puts this
one first, so it runs first.

Four of the five findings are evidence gaps, not behavior gaps: the rejection
branches already exist in `src/lib/report-manifest.ts` and no fixture or assertion
reaches them. The fifth (F-R7-C-2) is a real behavior gap — `SHAPE_BLOCKS["Fact-Check"]`
is an empty array (`src/lib/report-manifest.ts:137`) while the bundled template
defines a verdict table for that shape
(`skills/infobroker/references/report-template.md:125-136`), so a Fact-Check report
that omits its table validates clean. The documentation already promises the table:
`skills/infobroker/SKILL.md:151` ("the shared skeleton plus the Fact-Check verdict
table"), `skills/infobroker/references/workflows.md:97`, and
`skills/infobroker/references/pipeline-map.md:34` ("write skeleton + verdict
table"). The gate lags the documentation it shares a contract with.

REQ-119 delegates the per-shape block to the bundled template ("the output block
defined for its declared workflow shape"), so closing this gap needs no REQ body
edit: the template is the carrier and the validator must agree with it.

## Baseline (verified this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **119 unpushed
  commits, oldest 2.9 d**, 14 open roadmap items.
- `npx tsx scripts/check-report-fixtures.ts` → **PASS, 19 fixture(s), 0 expectation
  violation(s)**. `--json` per-fixture error codes were captured, so every fixture's
  current failure set is known before the corpus changes.
- `npm run check` → **FAIL, one gate: `check-loop-artifacts`** — `missing tasks.md`
  and `missing aar.md` for this new increment directory (`docs/plans/` is
  gate-scanned, and `check-loop-artifacts` is gate 21 of 22 in
  `scripts/lib/gate-manifest.ts`). Every gate before it passed; the run stops at
  the first failure, so `typecheck:scripts` (the last gate) did not run. This is a
  red created by the plan's own directory, not by the tree: T1 creates `tasks.md`
  and an `aar.md` seeded `LOOP OPEN`, after which the same run is meaningful. The
  baseline is **not** claimed green.
- `npm run audit` inside that run → 4 low-severity advisories in `markdownlint`
  transitives; the gate fails only on high/critical (REQ-101), so it passed.
- Working tree clean at `2501e81` apart from this plan directory.

## Predicates re-verified by reading the code this session

| Claim | Evidence | Verdict |
|---|---|---|
| `register-url` fires at runtime | `src/lib/report-manifest.ts:413-415` | Confirmed |
| No fixture or test reaches `register-url` | `check-report-fixtures --json` emits no `register-url`; `grep -rn "register-url" src test-fixtures` → only the emitting site | Confirmed |
| `undeterminable` publication date is accepted | `src/lib/report-manifest.ts:438-440` skips the ISO check when the normalized value is `undeterminable` | Confirmed |
| The positive `undeterminable` branch has no fixture | `grep -rn "undeterminable" test-fixtures/reports` → no hit | Confirmed |
| Register `source`/`type`/`interests` rejections exist | `src/lib/report-manifest.ts:420-437` pushes `register-source`, `register-type`, `register-interests` | Confirmed — unasserted |
| Manifest likelihood/verdict vocabularies exist | `src/lib/report-manifest.ts:306-311` pushes `manifest-likelihood`, `manifest-verdict`; lexicons at `:77-96` | Confirmed — no fixture or test reaches either code |
| Fact-Check's shape block is unenforced | `SHAPE_BLOCKS["Fact-Check"] = []` (`:137`); `shapeBlockFindings` iterates required entries only (`:541-554`) | Confirmed — F-R7-C-2 |
| `shapeBlockFindings` has no report text in scope | signature `(manifest, sections)` at `:536`, called at `:619`; `sections` holds heading names, not bodies | Confirmed — the table check needs a signature change and a call-site edit |
| `sectionText` can return a section body | exported at `:196-215`; stops at the next `##` heading | Confirmed |
| `register-orphan` is advisory | `:644-652` pushes `level: "warning"` | Confirmed — an uncited row cannot fail validation |
| Only Fact-Check has a defined block with no validator entry | the template's `## Per-shape blocks` defines sections for Fact-Check, Competitive Evaluation, Literature Review, Monitoring / Delta, Adversarial / Red-Team, Deep-Dive, Vetting / Due-Diligence; all but Fact-Check already have a non-empty `SHAPE_BLOCKS` entry. Research & Write and Gated Analysis are empty *and* define no template block | Confirmed — scope is one shape |
| `good-report.md` and `good-modality.md` are Fact-Check and pass today | `--json` → both `[]` | Confirmed — both need the new block |
| Ten Fact-Check fixtures fail today for one intended class | `--json` per-file codes: `bad-doi`, `bad-finding-unlabeled`, `bad-handling`, `bad-manifest-placement`, `bad-register-dates`, `bad-register-grades`, `bad-supersedes`, `missing-as-of`, `missing-handling`, `bad-modality` | Confirmed — each must gain the block or its failure stops being isolated |
| Seven fixtures are left untouched | four trimmed Fact-Check excerpts (`bad-confidence`, `missing-citation`, `unresolved-source`, `no-register`), plus `bad-empty-manifest` (no declared shape), `missing-shape-block` (Literature Review) and `bad-shape-audience` (shape `banana`) | Confirmed — the new code adds no new isolation |
| `bad-shape-audience.md` is not a Fact-Check report | manifest `shape: "banana"` → `shapeBlockFindings` returns early at `:540`; adding a block there would be inert | Confirmed — excluded from the rollout |
| The template strings pinned by `validate-spec` survive an added heading | `scripts/validate-spec.ts:733-750` pins `report-manifest`, `as_of`, `Published`, `Accessed`, `Relevant interests`, `policy`, `journalist`, `skeleton omitted`, `## Baseline and Verification` | Confirmed — none is inside the Fact-Check block |
| Citation ids are counted before `## Source Register` | `src/lib/report-manifest.ts:641-643` | Confirmed — the new section must sit before the register |
| No spec fingerprint covers the template or the validator | `grep -rn -i fingerprint scripts src` → no hit | Confirmed — no regeneration step |
| `dist/` is not tracked | `git ls-files dist` → 0 files | Confirmed — no build artifact to regenerate |

## Alternatives considered

- **A — heading only.** Add `{ heading: "Claim Verdicts" }` to `SHAPE_BLOCKS["Fact-Check"]`
  and reuse the existing check. Rejected: it rejects a report missing the section but
  accepts a report whose section holds prose instead of a table, which is the defect
  F-R7-C-2 describes. Partial coverage of the finding.
- **B — heading plus a required table header signature (chosen).** Extend the
  `SHAPE_BLOCKS` entry type with an optional `table?: readonly string[]`; after the
  heading check passes, locate the markdown table in that section and require each
  named column. New finding code `shape-table`. Cost: ~25 lines in the validator,
  no new module, no new gate. The heading *name* is stricter than REQ-119's "block
  is absent" (`infobroker.md:501`), and that is defensible only because T10 adds the
  same heading to the template in the same change — the template is the carrier, so
  the validator and the template cannot drift.
- **C — table signature with no heading.** Rejected: every other shape block is a
  heading, the report is a human-readable artifact, and a table located "anywhere"
  is harder to discover and to cite in the template.
- **D — edit REQ-119 to name the table.** Rejected: the REQ already delegates the
  block to the bundled template; a body edit adds manifest/coverage/README coupling
  for no new obligation.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/lib/report-manifest.ts` | `SHAPE_BLOCKS` entry type gains `table?: readonly string[]`; `"Fact-Check"` becomes one entry (`Claim Verdicts` + required columns); `shapeBlockFindings` gains the report-text parameter, the table check, and the `shape-table` code; one helper returning a section's table header cells; call site at `:619` updated | S |
| `src/report-contract.test.ts` | six new `it` blocks: `shape-table`, `register-url`, register identity fields, invalid published date, positive `undeterminable`, manifest likelihood+verdict; plus positive assertions that `good-report.md` carries the block. Named clause tags added where a branch is newly asserted | S |
| `test-fixtures/reports/good-report.md` | add `## Claim Verdicts` (after `## Key Findings`) with one row mirroring the manifest claim | S |
| `test-fixtures/reports/good-modality.md` | same block, same one-row shape | S |
| `test-fixtures/reports/{bad-modality,bad-doi,bad-finding-unlabeled,bad-handling,bad-manifest-placement,bad-register-dates,bad-register-grades,bad-supersedes,missing-as-of,missing-handling}.md` | add the same block so each keeps a single intended failure class | S (10 × 5 lines) |
| `test-fixtures/reports/missing-shape-table.md` (new) | copy of the updated `good-report.md` with the `## Claim Verdicts` heading but no table; must fail with `shape-table` | S |
| `test-fixtures/reports/bad-register-url.md` (new) | copy of the updated `good-report.md` with an added, **uncited** row `S2` whose URL is `example.com/bridge-inspection`; S1 stays valid, so the only error is `register-url` (S2 is never cited → at most an advisory `register-orphan`) | S |
| `test-fixtures/reports/bad-register-identity.md` (new) | copy with empty Source, Type, and Relevant-interests cells in the S1 row | S |
| `test-fixtures/reports/bad-register-published.md` (new) | copy with `circa 2026` in Published | S |
| `test-fixtures/reports/good-undeterminable-published.md` (new) | copy with `undeterminable` in Published; must pass | S |
| `test-fixtures/reports/bad-manifest-vocabulary.md` (new) | copy with `likelihood: "probably"` and `verdict: "Sort Of True"` in the manifest claim | S |
| `skills/infobroker/references/report-template.md` | name the heading in the Fact-Check snippet (`## Claim Verdicts` above the table) so the required block is discoverable and matches the validator | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | R7 verdict rows for REQ-114/116/118/119 and the five register rows `F-R7-C-1`…`C-5` (rows `:835-839` within the `:835-845` block) → `Resolved 2026-11-12` with evidence | S |
| `ROADMAP.md` | remove § R7 report-contract evidence remediation | S |
| `CHANGELOG.md` | one section `## 2026.11.11 — R7 report-contract: shape-table enforcement and register evidence` | S |
| `docs/plans/2026-11-12-r7-report-contract-remediation/` | `plan.md`, `tasks.md`, `aar.md` (increment record) | S |

No type change outside the exported `SHAPE_BLOCKS` entry shape, no config, schema,
dependency, provider-registry, or new-gate change. No spec body change. The corpus
holds 19 top-level fixtures (the `delta/` subdirectory is skipped by the gate): 12
are edited, 6 are added, and 7 are left untouched (`bad-confidence`,
`bad-empty-manifest`, `missing-citation`, `unresolved-source`, `no-register`,
`bad-shape-audience`, `missing-shape-block`), so the gate ends at 25.

## Done bar

**Done bar:** every one of F-R7-C-1 through F-R7-C-5 has a committed fixture **and**
an assertion that names its finding code, and a Fact-Check report that omits its
verdict table fails validation with `shape-table` while a conforming one passes.
Concretely: (1) `missing-shape-table.md` fails the fixture gate after the change and
passes it (unexpectedly) before the change — the red result is recorded in
`tasks.md`; (2) `npx vitest run src/report-contract.test.ts` is green and each new
`it` fails if its branch is reverted; (3) `npx tsx scripts/check-report-fixtures.ts`
reports 25 fixtures / 0 violations; `missing-shape-table.md`'s error-code set is
exactly `{shape-table}`; every edited single-class fixture's error set equals its T0
capture; and the four trimmed Fact-Check fixtures gain `shape-block` alongside
their existing codes (accepted and recorded, see Edge cases); (4) `npm run validate-spec`, `npm run
check-roadmap`, `npm run version-sync`, `npm run check-script-discipline`, and `npm
run check-loop-artifacts` are green on the final tree; (5) `npm run check` is green
**after** `aar.md` carries its terminal token; (6) the five register rows and the
four R7 verdict rows read `Resolved 2026-11-12` with file:line evidence and the
roadmap section is gone; (7) the AAR ends `LOOP PAUSED` with the review cap recorded.

## Review-loop cap (recorded, not judged at run time)

Per `ROADMAP.md` § Review-loop convergence, the cap is stated here: **one cold pass
at standard depth, plus at most one targeted diff re-review of the lines that
changed.** This increment has spent its cold pass (revision 1, `FAILED`); one diff
re-review of this revision is the only remaining review step, and at that cap any
unresolved item is escalated to the user rather than re-scoped. If a cold-pass
blocker sits inside one finding's evidence, the revision narrows to that finding
instead of re-scoping the combined increment. This increment **records** the cap but
does **not** retire § Review-loop convergence: the two prior increments that
recorded a cap (r2c-i, r5-corroboration) left the section in place, and retiring it
is a user decision after this AAR, not an agent judgement.

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Record the baseline in `tasks.md`: `npm run status`, the
  `check-report-fixtures --json` per-fixture code map, and the `npm run check`
  result above with its one expected `check-loop-artifacts` failure.
- **T1.** Create `tasks.md` (this step list) and `aar.md` seeded with
  `LOOP OPEN` plus the finding list, so `check-loop-artifacts` sees a complete
  directory from the first gate run onward.

### Phase 1 — Shape-table enforcement (F-R7-C-2)

The corpus update runs **before** the evidence fixtures so every fixture — existing
and new — is cut from a `good-report.md` that already carries the block.

- **T2 — red.** Add `missing-shape-table.md` (the updated good report with the
  `## Claim Verdicts` heading, no table). Run
  `npx tsx scripts/check-report-fixtures.ts` → expect
  `FAIL: missing-shape-table.md (expected fail, got pass)`, exit 1. Record verbatim.
- **T3 — implement.** In `src/lib/report-manifest.ts`: extend the `SHAPE_BLOCKS`
  entry type with `table?: readonly string[]`; replace `"Fact-Check": []` with
  `[{ heading: "Claim Verdicts", table: ["Claim", "Verdict", "Confidence", "Likelihood", "Justification", "Sources"] }]`;
  change `shapeBlockFindings(manifest, sections)` to take the report `text` (keep
  `sections` for the heading check), update the call site at `:619`; after a
  heading check succeeds and `required.table` is set, read
  `sectionText(text, required.heading)`, find the first line starting with `|` that
  is followed by a separator row (`/^:?-{2,}:?$/` per cell), normalize its cells,
  and push one finding with code `shape-table` naming the missing columns. The
  required set is a subset check: the template's header carries a leading `#`
  column, fixtures keep that cell, and only the six named columns are required. The
  existing heading message and `shape-block` code stay unchanged so
  `missing-shape-block.md` keeps its four `shape-block` findings.
- **T4.** Add the `## Claim Verdicts` block to `good-report.md`, `good-modality.md`,
  and the ten single-class Fact-Check fixtures (`bad-modality`, `bad-doi`,
  `bad-finding-unlabeled`, `bad-handling`, `bad-manifest-placement`,
  `bad-register-dates`, `bad-register-grades`, `bad-supersedes`, `missing-as-of`,
  `missing-handling`). Place it after `## Key Findings` and before
  `## Assumptions`, i.e. before `## Source Register`, so citation-id counting is
  unchanged. Run the fixture gate: expect 20 fixtures / 0 violations.
- **T5.** Add the `shape-table` `it` to `src/report-contract.test.ts` (tag
  `@implements REQ-119 shape-table`) and a positive assertion that `good-report.md`
  validates with the block present. In
  `skills/infobroker/references/report-template.md:125-136`, insert
  `## Claim Verdicts` **inside the fenced snippet, above the table header row**, so
  the template's carrier block and the validator's required heading are the same
  artifact.
- **T6.** `npm run typecheck` and `npx vitest run src/report-contract.test.ts` green;
  re-read the per-file code map with `--json` and confirm every single-class
  fixture still fails for its T0 class only.

### Phase 2 — Evidence fixtures and assertions (F-R7-C-1, C-3, C-4, C-5)

Each fixture is a copy of the now-conforming `good-report.md` with exactly one class
changed, so its failure set is that class alone.

- **T7.** Add `bad-register-url.md` (uncited S2 row, non-http URL).
- **T8.** Add `bad-register-identity.md` (empty Source, Type, Relevant interests).
- **T9.** Add `bad-register-published.md` (`circa 2026`) and
  `good-undeterminable-published.md` (`undeterminable`).
- **T10.** Add `bad-manifest-vocabulary.md` (`likelihood: "probably"`,
  `verdict: "Sort Of True"`).
- **T11.** Add the five remaining `it` blocks asserting `register-url`,
  `register-source`, `register-type`, `register-interests`, `register-published`,
  `manifest-likelihood`, `manifest-verdict`, and the positive case
  `result.ok === true` for `good-undeterminable-published.md`. Tags, one per asserted
  branch: `@implements REQ-116 register-url`, `@implements REQ-118
  register-identity`, `@implements REQ-118 undeterminable-publication-date`,
  `@implements REQ-114 likelihood-vocabulary`, `@implements REQ-114
  verdict-vocabulary`. Run
  `npx vitest run src/report-contract.test.ts` and
  `npx tsx scripts/check-report-fixtures.ts --json`; expect 25 fixtures / 0
  violations and each new `bad-*` fixture's error set to be exactly its intended
  class (plus at most `register-orphan` warnings, which do not affect `ok`). These
  tests are green on first run by construction — the branches exist; the finding is
  the missing coverage, and `tasks.md` records that explicitly rather than claiming
  red evidence that does not exist.

### Phase 3 — Bookkeeping

- **T12.** In `docs/plans/2026-11-09-full-review-sweep/worklist.md`, update the R7
  verdict rows for REQ-114, REQ-116, REQ-118, and REQ-119 (replace
  `finding:F-R7-C-x` with `**Resolved 2026-11-12** — …` plus the new evidence), and
  the five finding-register rows `F-R7-C-1`…`C-5` at `:835-839` with their
  dispositions and evidence. `grep -rn "F-R7-C-" --include=*.md .` returns the
  worklist and `ROADMAP.md` only; both are updated in this increment.
- **T13.** Remove § R7 report-contract evidence remediation from `ROADMAP.md`.
  `npm run check-roadmap` → OK.
- **T14.** Add the CHANGELOG section under the `2026.11.11` date (the version-sync
  gate pins the top date to `package.json`; duplicate same-date section headings are
  the existing convention — do not invent a date).

### Phase 4 — Gates and close

- **T15.** `npm run validate-spec`, `npm run check-report-fixtures`,
  `npm run check-roadmap`, `npm run version-sync`, `npm run check-script-discipline`.
- **T16.** Rewrite `aar.md` with the finding dispositions, the review cap, and the
  terminal `LOOP PAUSED` / `LOOP OPEN` token. `npm run session:close`.
- **T17.** `npm run check-loop-artifacts`, then `npm run check` on the final tree
  (full suite, un-piped, exit status recorded). This runs after the AAR so the
  loop-artifact gate is satisfiable.

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| Fixture evidence for C-1/C-3/C-4/C-5 | `vitest run src/report-contract.test.ts` | every code already emits; `--json` shows each branch reachable today |
| Shape-table red→green | `check-report-fixtures` exit 1 then 0 | the fixture is a copy of a passing report, so the only delta is the missing table |
| No corpus weakening | `check-report-fixtures --json` per-file codes | T0 capture compared at T6 and T11 |
| Template/validator agreement | `validate-spec` template checks | pinned strings untouched (`validate-spec.ts:733-750`) |
| Register consistency | `check-roadmap`, `check-loop-artifacts` | section removal + `aar.md` terminal token |
| Whole-tree health | `npm run check` after T16 | 22 gates, sequential; the only expected baseline red is the AAR that T16 writes |

## Edge cases and rollback

- **A trimmed fixture gains an extra code.** Accepted for the four trimmed
  Fact-Check fixtures that already fail for several classes (`bad-confidence`,
  `missing-citation`, `unresolved-source`, `no-register`); their asserted code is
  unchanged and the new `shape-block` warns alongside it. `bad-empty-manifest`
  declares no shape and `bad-shape-audience`'s shape is unknown to `SHAPE_BLOCKS`,
  so both are unaffected. The ten single-class fixtures are updated so isolation is
  preserved.
- **`bad-register-url` cascade.** Avoided by making the malformed row `S2` and
  leaving S1 valid and cited; `S2` is uncited, so the only consequences are
  `register-url` (error) and at most `register-orphan` (warning).
- **A fixture's table row accidentally fixes its defect.** Prevented by T6/T11's
  per-file code comparison against the T0 capture.
- **The heading normalizer matches a sub-heading.** `sectionText` stops at the next
  `##`, so a `###` inside `Claim Verdicts` stays in the section — intended.
- **Table header detection finds a separator row first.** The helper requires a
  header line followed by a separator row; a section with two tables picks the
  first, which is the template's shape.
- **Rollback.** Per commit: `git revert <sha>`. Phase 1 reverts the rule, the six
  updated fixtures, and the new fixture together, so the corpus and the validator
  never disagree in a committed state. Phase 2 reverts with no production change.

## Commit series

Each commit is `typecheck`-clean and passes the gate it feeds. Order matches the
convention buckets in `AGENTS.md`.

1. `fix(report-contract)`: the `shape-table` rule, the template heading, the twelve
   fixture blocks, `missing-shape-table.md`, and the `shape-table` test (Phase 1).
   Gate: `check-report-fixtures`, `typecheck`, `validate-spec`.
2. `test(report-contract)`: the five evidence fixtures plus their assertions — no
   production change (Phase 2). Gate: `vitest run src/report-contract.test.ts`,
   `check-report-fixtures`.
3. `docs(plans)`: worklist dispositions and roadmap removal (Phase 3 T12–T13).
   Gate: `check-roadmap`.
4. `docs(changelog)`: the CHANGELOG section (T14); `version-sync`.
5. `docs(plans)`: this increment's `plan.md`, `tasks.md`, `aar.md`;
   `check-loop-artifacts`.

## Conditions to verify during execution

- **C-1** — the exact `--json` per-fixture code map is captured at T0 and re-read at
  T6/T11; a mismatch is a stop, not a fixture edit.
- **C-2** — `missing-shape-table.md` must pass the gate before T3 (red) and fail
  after (green); the transcript is copied into `tasks.md`.
- **C-3** — no `dist/` rebuild or fingerprint regeneration is expected
  (`git ls-files dist` → 0); if `npm run check` reports one, treat it as a finding.
- **C-4** — the review cap: one cold pass spent, at most one diff re-review; at the
  cap any unresolved item is escalated to the user, never re-scoped.
- **C-5** — `npm run check` runs only after `aar.md` carries a terminal token; a
  `check-loop-artifacts` failure before T16 is expected and is not a tree defect.
- **C-6** — post-pass clarifications: the diff re-review's one count nit and three
  clarity nits (fixture arithmetic, the header's resolution claim, the done-bar
  code-set clause, the subset semantics of the table columns, the template
  insertion point, and the clause-tag names) are applied after its passing pass.
  The reviewed artifact and this text differ only in wording and counts; no design
  decision changed.

## Unknowns

- Whether the ten single-class fixtures take the identical table row without
  disturbing their defect — resolved at T4/T6 by the per-file code comparison.
- Whether `check-skill-harness` or `validate-readme` reference the template's
  Fact-Check snippet verbatim — resolved by the T15/T17 runs; the pinned strings are
  known untouched, and neither gate reads the per-shape block.
- Clause-tag necessity for REQ-119 under `src/clause-coverage.ts` — not verified
  within the review budget. The plan adds tags additively, which cannot reduce an
  existing count; T15's `validate-spec` run settles it.
