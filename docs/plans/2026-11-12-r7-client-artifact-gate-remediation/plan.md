# Plan — R7 client-artifact gate remediation

**Status:** revision 2, review complete · **Date:** 2026-11-12 · **Depth:** standard (one gate script, three client artifacts, one pure validation module, one CLI entry point, one test file, one spec bullet, four registers; no destructive, credential, schema-migration, or publish surface)
**Review independence:** fresh — one cold pass (`independent-review`, 4/5 stages, 30/40 reads) on revision 1 returned `FAILED` with 3 blockers, 4 majors, 4 minors, 4 nits (`/tmp/opencode/r7-client-artifact-cold-report.md`); revision 2 resolved every item. The single permitted diff re-review returned `plan-review passed.` with 1 major (probe fidelity) and 2 soft flags, and two deferred citation defects in unchanged text (`/tmp/opencode/r7-client-artifact-rereview.md`); the conditions and the deferred fixes are applied here. The review cap is spent; no further pass runs.
**Rollback cost:** 1 — the gate gains assertions, the skill/reference prose is reworded, and one optional CLI flag is added; `git revert` of the series restores the prior gate. No data, config, or schema is touched.
**Roadmap item:** `ROADMAP.md` § R7 client-artifact gate remediation (`ROADMAP.md:17-22`); removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); `HEAD` `936fb99`; 141 unpushed commits, oldest 3.0 d; 10 open roadmap items; clean tree apart from this plan directory.

## Why this section

`ROADMAP.md` § R7 client-artifact gate remediation is the **first open section**
in the file, and the ordering rule is top section first. Its trigger — "start
after chunk R8 closes" — is satisfied: the sweep status board records R8
**closed 2026-11-10** and M1 **closed 2026-11-10**
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:595-604`). The previous
increment's AAR names this section as the next open one
(`docs/plans/2026-11-12-r7-routing-citation-remediation/aar.md`, "Finding
dispositions").

The five findings are one defect class: **the gate asserts less than the clause
it reports on.** Every affected REQ is G3 (content verification), so the gate
*is* the verification — and where it warns, skips, or checks a token the REQ
does not contain, the clause is unenforced.

- **F-R7-A-1 (P2)** — REQ-050's content check is warn-only, and file absence is
  silently accepted (`scripts/validate-spec.ts:576-601`); delete the KB-first
  paragraph and the gate stays green.
- **F-R7-A-2 (P2)** — REQ-051's escalation, manifest, quality-gate, and
  revalidate clauses have no assertion, while the one hard error is an
  imperative-token rule that lives in §9.4 (`infobroker.md:1165-1167`), not in a
  REQ body (`scripts/validate-spec.ts:594-596`; REQ-051 `infobroker.md:464-465`).
- **F-R7-D-1 (P2)** — the shared pipeline tail in the diagram omits TRANSLATE
  (`skills/infobroker/references/pipeline-map.md:62`), contradicting the
  canonical order in `SKILL.md:69-138`; the gate only counts TAIL links
  (`scripts/validate-spec.ts:661-671`).
- **F-R7-D-3 (P2)** — no instruction records the manifest language after
  translation, and the validator accepts a stale value
  (`skills/infobroker/SKILL.md:102-105`; `src/lib/report-manifest.ts:271-281`).
- **F-R7-D-4 (P2)** — both REDRAFT-CHECK instructions let an unsupported drafted
  claim be *attributed or softened* instead of removed or marked unverified
  (`skills/infobroker/SKILL.md:87-90`; `skills/infobroker/references/workflows.md:50-53`),
  contradicting REQ-120 (`infobroker.md:503-504`).

No REQ body changes. REQ-050, REQ-051, REQ-120, and REQ-116 already state the
obligations; this increment makes the gate enforce them and fixes the two client
artifacts whose wording contradicts the spec.

## Baseline (verified this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **141
  unpushed commits, oldest 3.0 d**, 10 open roadmap items.
- `npm run check` → **PASS (full, 164.0 s, 22 gates, recorded for `936fb99`)**,
  run before this plan directory was created. One pre-existing warning, not a
  failure: `check-loop-artifacts` reports
  `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`.
  `npm run audit` (inside the suite) reports 4 low-severity
  `markdownlint`/`katex` advisories; the gate fails only on high/critical
  (REQ-101).
- Working tree clean at `936fb99` before this plan directory was created.

## Predicates re-verified by reading the artifacts this session

| Claim | Evidence | Verdict |
|---|---|---|
| REQ-050's gate warns and treats absence as a pass | `scripts/validate-spec.ts:580-585` — `if (existsSync(prefPath)) { ... warn(...) }`, no `else` | Confirmed — F-R7-A-1 |
| The three REQ-050 clauses exist in the file and are deletable | `instructions/search-preferences.md:17-22` — KB recall before external providers, external fallback, `manage_kb` reserved for stored-content-only answers | Confirmed — the content is present, only the gate is missing |
| REQ-051's skill block is gated on a token clause no REQ body states | `scripts/validate-spec.ts:594-596` errors on "End your reply with … token"; REQ-051 (`infobroker.md:464-465`) contains no token clause. The imperative-emit rule is stated in §9.4 (`infobroker.md:1165-1167`), which attributes it to REQ-051/REQ-052 | Confirmed — keep the check, label it §9.4, and add the four missing clause assertions |
| REQ-051's four real clauses are unasserted | No occurrence of `analysis-loop`, `report-manifest`, `validate-report`, or `verify_report` in the content-check block `scripts/validate-spec.ts:576-690` (`analysis-loop` appears only later, at `:712`, in the REQ-088 block) | Confirmed — F-R7-A-2 |
| Both pipelines and all four clauses exist in the skill | `SKILL.md:69` and `:140` headings; `:113-115` escalation; `:92` manifest; `:97` validator; `:109-116` receipt + `verify_report` | Confirmed — the fix is gate-only for REQ-051 |
| No other script owns this finding class | `grep -rn "instructions/search-preferences\|skills/infobroker/SKILL.md\|checkArtifactContent" scripts/*.ts` → only `scripts/validate-spec.ts:576` performs content verification; `scripts/check-pack.ts:38-39` only lists the paths in the tarball allowlist | Confirmed — extending `validate-spec` adds coverage without a second gate |
| The TAIL node omits TRANSLATE | `pipeline-map.md:62` — `TAIL["write → redraft-check → validate → polish → revalidate → archive → cite"]` | Confirmed — F-R7-D-1 |
| A second inline chain also omits TRANSLATE | `pipeline-map.md:35` — `FCd["… validate → polish → revalidate → archive"]` (six shape chains link to TAIL; the FC chain is inline) | Confirmed — same defect class, fix both |
| The TAIL gate checks only presence and link count | `scripts/validate-spec.ts:661-671` — `/TAIL\[/` and `tailLinks < 6` | Confirmed |
| The per-shape pipeline gate also omits TRANSLATE | `REPORT_TAIL` at `scripts/validate-spec.ts:649` has no `TRANSLATE`; all 8 shape `**Pipeline:**` paragraphs in `workflows.md` already carry `TRANSLATE` (probe over every paragraph) | Confirmed — one line closes it with no artifact churn |
| The manifest `language` field is optional and only non-empty is checked | `src/lib/report-manifest.ts:271-281` — `language?: string`, `manifest-language` fires only on an empty string | Confirmed — F-R7-D-3 |
| No gate instructs or checks the post-translation language | `SKILL.md:102-105` TRANSLATE/REVALIDATE mention the translation skill and the validator, not the manifest language; `workflows.md:68-71` the same | Confirmed |
| `validateReport` takes one argument at every call site | 36 occurrences of `validateReport(` across `src/`, `scripts/`, and `debate-club/`, **none** with a second argument; the definition is `src/lib/report-manifest.ts:661`, the manifest call site `:682` | Confirmed — an optional second parameter is backward compatible |
| Every committed report fixture that declares `language` uses a plain tag | `test-fixtures/reports/` holds 25 fixtures; 20 declare `"language"`, all `"en"`, and the 5 that do not (`bad-empty-manifest`, `no-register`, `bad-confidence`, `unresolved-source`, `missing-citation`) are rejected for unrelated defects | Confirmed — a conditional check needs no fixture churn; the 5 undeclared fixtures are unaffected because the expectation is opt-in |
| REQ-114 makes `language` optional | `infobroker.md:482-483` — "MAY declare audience, target length, language, …" | Confirmed — do not make it unconditionally required |
| REQ-120 requires the translated language in the manifest | `infobroker.md:503-504` — "A translated report SHALL retain the canonical section headings and record its language in the manifest" | Confirmed — the conditional obligation already exists |
| Heading retention is already enforced structurally | `REQUIRED_SECTIONS` are English strings matched by `validateReport` (`src/lib/report-manifest.ts:661-668`), so translated headings fail VALIDATE/REVALIDATE | Confirmed — D-3's residual is language declaration only |
| Both REDRAFT-CHECK instructions rescue an unsupported claim | `SKILL.md:87-90` and `workflows.md:50-53` — "attribute, soften to the source's `modality`, or delete" | Confirmed — F-R7-D-4 |
| REQ-120 requires removal or an unverified marking | `infobroker.md:503-504` — "SHALL be removed or marked unverified" | Confirmed — the skill wording is the defect, not the spec |
| The gate already parses REDRAFT-CHECK blocks | `redraftBlock(...)` at `scripts/validate-spec.ts:565-574`, used for REQ-026h at `:640-645` and `:678-683`; it returns one block (first or last), so enumeration needs a new local helper | Confirmed — reuse the block boundaries, add the loop |
| `validate-spec` fails only on `severity: "error"` | `scripts/validate-spec.ts:1174` — `process.exit(errors.length > 0 ? 1 : 0)` | Confirmed — the warn→error change is what closes A-1 |
| The five worklist rows and three REQ verdict rows are live | REQ-050 `:414`, REQ-051 `:415`, REQ-120 `:424`; F-R7-A-1 `:841`, F-R7-A-2 `:842`, F-R7-D-1 `:846`, F-R7-D-3 `:847`, F-R7-D-4 `:848` | Confirmed — eight lines to update |
| The version/CHANGELOG rule | `scripts/version.ts:163-175` pins the top entry date to `package.json` (2026.11.11) | Confirmed — no version bump in this increment |
| The gate count stays 22 | `scripts/lib/gate-manifest.ts` gains no gate in this plan | Confirmed — no AGENTS.md table edit |

## Alternatives considered

- **A — keep the REQ-050 check a warning and add the assertion elsewhere.**
  Rejected: a G3 REQ is verified by the content gate; a test that reads the
  instruction file is the same gate in another file, with a weaker signal.
- **B — assert the exact sentences the file carries today.** Rejected: it
  couples the gate to prose and fails on any harmless rewording. The plan
  asserts clause-bearing anchors (KB-first-before-external, external fallback,
  `manage_kb` reservation) and names what a failure means.
- **C — make `report-manifest.language` unconditionally required.** Rejected:
  REQ-114 says the manifest MAY declare it; an untranslated report legitimately
  has one language implied by its headings. It would also be a REQ-level
  contract change for a P2 gate finding.
- **D — auto-detect the report's language and compare with the manifest.**
  Rejected: no deterministic detector ships, and a heuristic language guess in
  a gate is a new failure source. The gate takes the *declared intent* from the
  caller instead.
- **E — `validate-report --expect-language <tag>` (chosen).** The pipeline
  knows the language it was asked to produce. When supplied, a missing or
  differing manifest value is an error, so a translated report that keeps
  `"language": "en"` fails its own REVALIDATE. No detection, no heuristic, and
  the flag is optional so every existing call site is unchanged.
- **F — instruct the skill only, without a validator change.** Rejected: the
  finding names the missing gate explicitly ("no gate rejects a stale value"),
  and an instruction alone is what exists today.
- **G — fix only the TAIL node.** Rejected: `pipeline-map.md:35` carries the
  same omission for the Fact-Check shape; fixing one and gating on the other
  leaves the diagram self-inconsistent.

## Blast radius

| File | Change | Size |
|---|---|---|
| `instructions/search-preferences.md` | **No permanent edit.** Probe-only (T2/T4): the file already carries all three REQ-050 clauses, so the fix is the gate. Listed here because it is the probe target and the gate's subject | — |
| `scripts/validate-spec.ts` | **REQ-050**: error on file absence; three failing assertions (KB-first before external providers, external fallback, `manage_kb` reservation). **REQ-051**: error on file absence; assert both `## Pipeline:` headings; per-pipeline KB phase (`search_web` KB-first + `manage_kb` reservation); file-level assertions for escalation to `analysis-loop`, `report-manifest`, `validate-report`, ARCHIVE `receipt`, and `verify_report`; relabel the imperative-token error `(REQ-051/REQ-052, §9.4)` so it names its real carrier. **REQ-120**: add `TRANSLATE` to `REPORT_TAIL` (`:649`); assert the TAIL node's phase sequence, and for every multi-phase chain label (`→` and `archive`) that `translate` and `revalidate` precede `archive`. **REQ-120/026h**: assert each REDRAFT-CHECK block (two in `SKILL.md`, one in `workflows.md`) says removed-or-unverified and carries no softening instruction, enumerated by a new local helper beside `redraftBlock`. **REQ-120**: assert TRANSLATE names the manifest language and REVALIDATE names `--expect-language` | L |
| `skills/infobroker/SKILL.md` | Research REDRAFT-CHECK (`:87-90`) and Fact-Check REDRAFT-CHECK (`:152-155`): an unsupported claim is removed or marked unverified; modality preservation applies to supported claims. TRANSLATE (`:102-103`): record the output language in the manifest. REVALIDATE (`:104-105`): pass `--expect-language <tag>` when TRANSLATE ran | S |
| `skills/infobroker/references/workflows.md` | REDRAFT-CHECK (`:50-53`) reworded the same way; TRANSLATE (`:68-69`) and REVALIDATE (`:70-71`) carry the manifest-language and `--expect-language` instructions | S |
| `skills/infobroker/references/pipeline-map.md` | TAIL (`:62`) becomes `write → redraft-check → validate → polish → translate → revalidate → archive → cite`; FC chain (`:35`) gains `translate` between `polish` and `revalidate` | S |
| `src/lib/report-manifest.ts` | `validateReport(text, options?: { expectLanguage?: string })`, threaded into `validateManifest(manifest, options)` at `:682`; `manifest-language-required` when an expectation is supplied and the manifest declares none; `manifest-language-mismatch` when the declared value differs under `normalizeValue`. No unconditional requirement (REQ-114) | S |
| `scripts/validate-report.ts` | `--expect-language <tag>` flag (and `--expect-language=<tag>`), named in USAGE, passed through; unknown flags still exit 2 | S |
| `src/report-contract.test.ts` | Three cases: `good-report.md` with `expectLanguage: "en"` passes; with `"de"` fails `manifest-language-mismatch`; a manifest with the `language` key removed and `expectLanguage: "en"` fails `manifest-language-required` | S |
| `infobroker.md` §9.4 | Extend the client-artifact bullet (`:1165-1167`) so the spec states that REQ-050/051 content clauses and the pipeline-map tail are content-checked. No REQ body change | S |
| `DECISIONS.md` | One `### D-109: <title> (2026-11-12)` section: the language staleness check is caller-declared (`--expect-language`), not detected; `language` stays MAY in REQ-114; a translated report that omits the flag is a recorded residual | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | REQ-050 (`:414`), REQ-051 (`:415`), REQ-120 (`:424`) verdict rows and F-R7-A-1 (`:841`), F-R7-A-2 (`:842`), F-R7-D-1 (`:846`), F-R7-D-3 (`:847`), F-R7-D-4 (`:848`) register rows → `Resolved 2026-11-12` with probe evidence | S |
| `ROADMAP.md` | Remove § R7 client-artifact gate remediation (`:17-22`); § Review-loop convergence (`:73-78`) is retired **only** if this increment holds its cap | S |
| `CHANGELOG.md` | One sibling `## 2026.11.11 — …` section between `# Changelog` and the current first section (`CHANGELOG.md:3`); the date must equal `package.json`'s version | S |
| `docs/plans/2026-11-12-r7-client-artifact-gate-remediation/` | `plan.md`, `tasks.md`, `aar.md` | S |

No config, provider, dependency, tool-schema, or new-gate change. The gate count
stays 22, so `scripts/lib/gate-manifest.ts`, the generated AGENTS.md table, and
`check-gate-table` are untouched. No `src/index.ts` change, so the TDQS and
intent-citation gates are unaffected (they still run).

## Assertion scope (pinned so the gate and the artifacts agree)

- **Per-pipeline** (REQ-051 says "Each pipeline"): the two `## Pipeline:`
  headings, and the KB retrieval phase inside each pipeline block.
- **File-level** (REQ-051 says "The skill"): manifest, quality gate, archive
  receipt, and `verify_report`. Escalation is asserted inside the
  `## Phase 0: Classify` section **on the imperative sentence** — the anchor
  `Escalate to \`analysis-loop\` when` — because the section also contains the
  routing table, whose row (`SKILL.md:62`) mentions "escalate to
  `analysis-loop`" in parentheses and would otherwise satisfy a loose check.
  `verify_report` appears
  in the Research ARCHIVE block (`SKILL.md:112`) and not in the Fact-Check one
  (`:160-166`); REQ-051 states the archive-and-revalidate obligation once for
  the skill, so a file-level assertion matches the REQ and needs no unplanned
  `SKILL.md` edit. The plan does not extend the Fact-Check ARCHIVE; that is a
  separate improvement, not this finding.
- **Diagram**: the TAIL node must name all eight tail phases in order. Inline
  chains are checked by one rule — a node label that contains both `→` and
  `archive` must name `translate` and `revalidate` before `archive`. That
  covers the TAIL node (`pipeline-map.md:62`) and the Fact-Check chain (`:35`)
  and excludes single-phase nodes such as `RPa["archive + cite"]` (`:29`).
- **Imperative token**: the check stays, labelled `(REQ-051/REQ-052, §9.4)`.
  The rule is a §9.4 G3 check attributed there to those REQs; no REQ body
  states it, so the label names §9.4 rather than inventing an owner. The
  finding's point — that it was the *only* error — is answered by adding the
  missing clause assertions, not by deleting the token check.

## Done bar

**Done bar:** F-R7-A-1, F-R7-A-2, F-R7-D-1, F-R7-D-3, and F-R7-D-4 each have a
committed fix **and** a deterministic check that fails when the fix is reverted.
Concretely: (1) deleting any of REQ-050's three clauses, or the file itself,
makes `validate-spec` exit 1; (2) deleting either `## Pipeline:` heading, a
pipeline's KB phase, the escalation sentence, `report-manifest`, `validate-report`,
the ARCHIVE `receipt`, or `verify_report` from `SKILL.md` makes `validate-spec`
exit 1, and the imperative-token message names §9.4 alongside the REQs §9.4
attributes it to (`REQ-051/REQ-052`), rather than asserting a REQ body states
the rule; (3) removing `translate` from the TAIL
node or from the Fact-Check chain makes `validate-spec` exit 1, and removing
`TRANSLATE` from a shape `**Pipeline:**` paragraph in `workflows.md` makes it
exit 1 as well; (4) restoring
the "attribute, soften … or delete" wording in any REDRAFT-CHECK block makes
`validate-spec` exit 1; (5) removing the manifest-language or `--expect-language`
instruction makes `validate-spec` exit 1, and `validate-report --expect-language de`
on a report declaring `language: "en"` exits 1 with `manifest-language-mismatch`
while the same report declaring `de` exits 0; (6) the eight worklist rows read
`Resolved 2026-11-12`, § R7 client-artifact gate remediation is gone from
`ROADMAP.md`, `D-109` is present, and the CHANGELOG section is present with the
pinned date; (7) `npm run validate-spec`, `npm run validate-readme`,
`npm run check-roadmap`, `npm run check-non-goals`, `npm run check-report-fixtures`,
`npm run check-script-discipline`, `npm run check-loop-artifacts`,
`npm run version-sync`, `npm run typecheck`, `npm run typecheck:scripts`,
`npm run check-intent-citations`, and `npm run test` are green on the final
tree, and `npm run check` is green **after** `aar.md` carries its terminal
token; (8) the AAR records the review cap and whether it was held, and ends
`LOOP PAUSED` when nothing is unresolved or `LOOP OPEN` naming an escalated
item.

## Review-loop cap (recorded, not judged at run time)

**One cold pass at standard depth, plus at most one targeted diff re-review of
the lines that changed.** At that cap any unresolved item is escalated to the
user with `LOOP OPEN` rather than re-scoped. This increment records the cap
because its trigger has fired — "start with the next increment that plans a
multi-finding remediation" (`ROADMAP.md:73-78`). § Review-loop convergence is
retired **only** if the AAR can record that the cap was held.

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Record the baseline in `tasks.md`: the `npm run status` and
  `npm run check` output captured before this directory existed.
- **T1.** Create `tasks.md` (with red/green transcript slots) and `aar.md`
  seeded `LOOP OPEN` with the finding list. `LOOP OPEN` is a valid terminal
  token, so every intermediate `check-loop-artifacts` run is satisfiable.

### Phase 1 — REQ-050 content gate (F-R7-A-1)

- **T2 — red-first.** With the tree unmodified, delete the KB-first paragraph
  from `instructions/search-preferences.md` (lines 17-22), run
  `npx tsx scripts/validate-spec.ts` → **exit 0** (today's warn-only gate).
  Record; restore the file.
- **T3 — implement.** In `checkArtifactContent`, replace the `existsSync`
  warn block with: an error when the file is absent; an error when it does not
  state knowledge-base recall before external providers; an error when it does
  not treat external providers as the fallback; an error when it does not
  reserve a direct `manage_kb` search for stored-content-only answers or
  inspection. Each message ends `(REQ-050)`.
- **T4 — green + red.** The unmodified file passes; re-running T2's deletion
  now exits 1 naming the KB-first clause. Record both; restore.

### Phase 2 — REQ-051 content gate (F-R7-A-2)

- **T5 — red-first.** Delete the imperative escalation sentence in the
  `## Phase 0: Classify` section (`SKILL.md:64-67`, "Escalate to
  `analysis-loop` when …"); the gate stays green today. Record; restore. The
  routing-table row (`:62`) stays in place and does **not** satisfy the
  imperative anchor, so a single-sentence deletion is a faithful probe.
- **T6 — implement.** In the same function:
  - error on `SKILL.md` absence (no `existsSync` wrapper that skips);
  - assert both `## Pipeline: Research & Write` and `## Pipeline: Fact-Check`
    headings exist;
  - split the file on pipeline headings and assert each pipeline block carries
    a `RECALL` line naming `search_web` KB-first and the `manage_kb` reservation;
  - assert the imperative escalation anchor `Escalate to \`analysis-loop\` when`
    inside the `## Phase 0: Classify` section, and **file-level**
    `report-manifest`, `validate-report`, ARCHIVE `receipt`, and
    `verify_report`;
  - relabel the imperative-token error to `(REQ-051/REQ-052, §9.4)`; keep the
    assertion and do not attribute it to a REQ body that does not state it.
  Scope is pinned in "Assertion scope" above.
- **T7 — green + red.** The unmodified file passes; T5's deletion now exits 1.
  Record; restore. Then delete **every** ARCHIVE `receipt` mention (Research
  `:107` and Fact-Check `:161`) and confirm exit 1 — a single-site deletion
  leaves the other and the file-level assertion stays green, so both must go.

### Phase 3 — pipeline tail (F-R7-D-1)

- **T8 — red-first.** Remove `translate` from `pipeline-map.md:62`; the current
  gate stays green (it only counts TAIL links). Record; restore.
- **T9 — implement the diagram fix.** TAIL becomes `write → redraft-check →
  validate → polish → translate → revalidate → archive → cite`; the FC chain
  (`:35`) gains `translate` before `revalidate`.
- **T10 — implement the gate.** Extract the TAIL node label and assert the
  eight phases appear in order (case-insensitive); for every node label that
  contains **both** `→` and `archive`, assert `translate` and `revalidate`
  precede `archive` (covers `:62` and `:35`; excludes `RPa["archive + cite"]`
  at `:29`). Keep the existing `TAIL[` presence and ≥6 link checks. Add
  `TRANSLATE` to `REPORT_TAIL` (`scripts/validate-spec.ts:649`) so a shape
  `**Pipeline:**` paragraph cannot drop translation; all 8 already carry it, so
  this is green immediately.
- **T11 — green + red.** The edited diagram passes; re-running T8's removal now
  exits 1, and deleting `TRANSLATE` from one shape `**Pipeline:**` paragraph
  exits 1. Record; restore both.

### Phase 4 — unsupported-claim wording (F-R7-D-4)

- **T12 — red-first.** Restore the `attribute, soften … or delete` wording in
  `SKILL.md:87-90`; no assertion fires. Record; restore.
- **T13 — implement.** Reword both SKILL.md REDRAFT-CHECK blocks and the
  `workflows.md` bullet: a claim the evidence does not support is **removed or
  marked unverified**; modality and attribution are carried for the claims that
  remain and never upgrade a hedged source. No "soften"/"attribute it"
  rescue path remains in those blocks.
- **T14 — implement the assertion.** Add a local helper beside `redraftBlock`
  (which returns only the first or last match) that enumerates every block
  between a per-file START and END pattern: for `SKILL.md`, `/^REDRAFT-CHECK/m`
  … `/^VALIDATE/m` (two blocks, `:87-96` and `:152-155`); for `workflows.md`,
  `/- \*\*REDRAFT-CHECK\*\*/` … `/\n- \*\*VALIDATE\*\*/` (one block, `:50-56`,
  the same anchors the existing call uses). Each block must match `unverified`
  and a removal verb, and must not match `soften`. Green on the edited text;
  T12's wording exits 1.

### Phase 5 — manifest language after translation (F-R7-D-3)

- **T15 — red-first.** Run
  `npx tsx scripts/validate-report.ts --report test-fixtures/reports/good-report.md --expect-language de`
  → **exit 2** (unknown flag). Record.
- **T16 — implement the validator.** `validateReport(text, options?)` with
  `expectLanguage`; in `validateManifest`, when an expectation is supplied and
  the manifest declares no language, push `manifest-language-required`; when it
  declares one and `normalizeValue` differs, push `manifest-language-mismatch`.
  Both are `error`-level `ReportFinding`s.
- **T17 — implement the CLI.** Add `--expect-language <tag>` /
  `--expect-language=<tag>` to `scripts/validate-report.ts`, to USAGE, and to
  the pass-through; a missing value exits 2 as `--report` does.
- **T18 — implement the instructions.** `SKILL.md` TRANSLATE records the output
  language in the manifest; REVALIDATE passes `--expect-language <tag>` when
  TRANSLATE ran. `workflows.md` TRANSLATE/REVALIDATE bullets say the same.
- **T19 — implement the assertions.** In the `SKILL.md` block: the TRANSLATE
  step names the manifest and language; the REVALIDATE step names
  `--expect-language`. In `workflows.md`: both bullets do.
- **T20 — green + red.** `--expect-language en` on `good-report.md` → exit 0;
  `--expect-language de` → exit 1 with `manifest-language-mismatch`; a copy of
  the fixture with the `language` key removed and `--expect-language en` →
  exit 1 with `manifest-language-required`. Then remove the TRANSLATE
  manifest-language sentence and confirm `validate-spec` exits 1. Restore.
- **T21 — unit tests.** Add the three cases to `src/report-contract.test.ts`
  (expectation matching, mismatch, required). `npm run test` → green.

### Phase 6 — Documentation and registers

- **T22 — spec bullet.** Extend §9.4's client-artifact bullet so the spec states
  what the content gate now covers. `npm run validate-spec` → exit 0.
- **T23 — decision.** Add `### D-109` under `## Active Decisions`: the
  staleness check is caller-declared; `language` remains MAY per REQ-114; an
  untranslated report needs no flag; a translated report that omits the flag is
  a recorded residual, and the fix is to pass it, never to auto-guess.
- **T24 — worklist.** Set the three verdict rows and five register rows to
  `Resolved 2026-11-12` with the probe evidence. **Retain the finding ID in
  each verdict cell** — written `**Resolved 2026-11-12** (F-R7-A-1)`, matching
  the precedent at `worklist.md:429` — because the acceptance grep keys on the
  IDs. The F-R7-D-3 verdict cell names `D-109` (the residual carrier). Correct
  any stale line reference the edit moves. Acceptance:
  `grep -n "F-R7-A-1\|F-R7-A-2\|F-R7-D-1\|F-R7-D-3\|F-R7-D-4" docs/plans/2026-11-09-full-review-sweep/worklist.md`
  returns exactly **eight** lines (three verdict rows — REQ-050, REQ-051,
  REQ-120 — plus five register rows), each carrying
  the resolved disposition or a `Resolved` verdict.
- **T25 — roadmap.** Remove § R7 client-artifact gate remediation (`:17-22`).
  At the AAR, remove § Review-loop convergence (`:73-78`) **only** if the cap
  was held. `npm run check-roadmap` → OK.
- **T26 — CHANGELOG.** Insert the sibling section after `# Changelog`; the date
  stays `2026.11.11` because `package.json` is unchanged. The entry names the
  five findings, the content-gate coverage, the `--expect-language` flag,
  REQ-050/051/120, and `D-109`. `npm run version-sync` → OK.

### Phase 7 — Gates and close

- **T27.** `npm run validate-spec`, `npm run validate-readme`,
  `npm run check-roadmap`, `npm run check-non-goals`,
  `npm run check-report-fixtures`, `npm run check-script-discipline`,
  `npm run check-loop-artifacts`, `npm run version-sync`,
  `npm run typecheck`, `npm run typecheck:scripts`,
  `npm run check-intent-citations`, `npm run test`.
- **T28.** Rewrite `aar.md`: dispositions, the cap record, the terminal token.
  `npm run session:close`.
- **T29.** `npm run check` on the final tree (full, un-piped, exit status
  recorded) after the terminal token is in place.

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| REQ-050 clauses are enforced | `validate-spec` REQ-050 block + T2/T4 | the file already carries all three clauses; the deletion probe is a one-paragraph edit |
| REQ-051 clauses are enforced | `validate-spec` REQ-051 block + T5/T7 | both pipelines and all four clauses already exist at `SKILL.md:69-167` |
| The completion-token message names its carrier | message text → `(REQ-051/REQ-052, §9.4)` | §9.4 (`infobroker.md:1165-1167`) states the imperative-emit rule and attributes it to those REQs; no REQ body is claimed |
| The diagram tail matches the canonical order | TAIL sequence + chain-label assertion + `REPORT_TAIL` + T8/T11 | the canonical order is fixed at `SKILL.md:69-138`; only two diagram labels change, and all 8 shape pipelines already name `TRANSLATE` |
| An unsupported claim cannot be rescued | REDRAFT-CHECK assertion + T12/T14 | three blocks, one wording rule; the new enumerating helper covers both `SKILL.md` blocks |
| A stale language fails | `manifest-language-mismatch` + T15/T20/T21 | `good-report.md` declares `en`; the expectation flag is the declared intent |
| No REQ body change | `validate-spec` Appendix B checks | no REQ body is edited |
| No new gate or manifest row | `check-gate-table` (22 gates) | no manifest edit |
| Whole-tree health | `npm run check` after T28 | baseline recorded at T0 |

## Edge cases and rollback

- **A translated report whose manifest already names the target language but
  whose body is still English.** Undetectable without language detection; `D-109`
  records the residual and the pipeline instruction is the control.
- **A translated report that skips REVALIDATE.** The flag is only checked when
  passed; the skill makes REVALIDATE mandatory and the validator re-run is the
  existing control. `D-109` states that the flag is the enforcement point.
- **Translated headings.** `REQUIRED_SECTIONS` are English strings, so a
  translated-heading report already fails VALIDATE/REVALIDATE; the plan does not
  add a second heading check.
- **A legitimately reworded skill paragraph.** The content gate asserts anchors,
  not sentences; a reworded anchor must be matched by updating the gate in the
  same commit. That coupling is the point of a G3 content gate, not a defect.
- **Prose-token false positives.** No new routing text is added, so
  `check-intent-citations` is unaffected; it still runs at T27.
- **`--expect-language` on an untranslated report.** A caller may pass its
  current language; the check then passes or fails on the declared value. The
  flag is opt-in and never required.
- **Probe hygiene.** T2, T5, T7, T8, T12, T15, and T20 edit a tracked file or a
  temp copy. After each, `git status --short` must show only this plan directory.
- **Rollback.** `git revert` of the full series restores the prior gate and
  removes the flag. Partial reverts are not clean: reverting the gate alone
  leaves the reworded skill text without its assertion (harmless but
  unenforced), and reverting `report-manifest.ts` alone breaks the CLI
  pass-through (typecheck fails). Revert the whole series or none of it.

## Commit series

Seven commits, one concern each (the split exceeds five, so the grouping is
printed here per the operating routine). The gate change and the client
artifacts it asserts share one contract — a gate without the corrected text
fails, and corrected text without the gate is unenforced — so they ship
together. The `--expect-language` feature lands **before** the instructions that
name it, so no commit documents a flag that does not exist yet.

1. `feat(report-contract)`: `src/lib/report-manifest.ts`,
   `scripts/validate-report.ts`, `src/report-contract.test.ts`. Gate:
   `typecheck`, `typecheck:scripts`, `test`, `check-report-fixtures`.
2. `fix(validate-spec)`: `scripts/validate-spec.ts`,
   `skills/infobroker/SKILL.md`, `skills/infobroker/references/workflows.md`,
   `skills/infobroker/references/pipeline-map.md`. Gate: `typecheck`,
   `typecheck:scripts`, `validate-spec`, `check-intent-citations`.
3. `docs(spec)`: the §9.4 bullet. Gate: `validate-spec`, `version-sync`.
4. `docs(decisions)`: `D-109`. Gate: `check-non-goals`, `validate-spec`.
5. `docs(plans)`: worklist dispositions and roadmap removal. Gate:
   `check-roadmap`.
6. `docs(changelog)`: the sibling section. Gate: `version-sync`.
7. `docs(plans)`: `plan.md`, `tasks.md`, `aar.md`. Gate:
   `check-loop-artifacts`, then `npm run check`.

Every commit is `typecheck`-clean; the full suite runs once on the final tree.

## Conditions to verify during execution

- **C-1** — every red probe is recorded verbatim with its exit status; a red
  that does not reproduce is a stop.
- **C-2** — the gate stays one script with no new exit path (0 pass / 1 finding
  / 2 fatal) and the gate count stays 22.
- **C-3** — no REQ body is edited; the §9.4 bullet is the only spec prose change.
- **C-4** — the cap: one cold pass plus at most one diff re-review; at the cap
  an unresolved item is escalated, never re-scoped.
- **C-5** — `validateReport`'s second parameter is optional and every existing
  call site keeps compiling unchanged.
- **C-6** — every probe leaves a clean tree; `git status --short` shows only
  this plan directory before the next step starts.
- **C-7** — the language check is conditional: no fixture, no existing report,
  and no untranslated pipeline gains a new required field.
- **C-8** — T7 deletes **every** ARCHIVE `receipt` mention (Research `:107`
  and Fact-Check `:161`) before asserting red; a single-site deletion leaves
  the file-level check green. T5 deletes the imperative escalation sentence
  (`:64-67`) while the routing-table mention at `:62` stays, which the
  imperative anchor does not accept.
- **C-9** — T14's enumerating helper takes per-file START/END patterns so the
  `workflows.md` bullet (`- **REDRAFT-CHECK**` … `- **VALIDATE**`) is
  enumerated alongside the two column-0 `SKILL.md` blocks.

## Unknowns

- Whether any skill-harness or fixture snapshot asserts the exact REDRAFT-CHECK
  or TRANSLATE wording. `grep -rn "soften" test-fixtures skills src` covers the
  code; the T27 suite settles the rest.
- Whether a caller in the repo passes `--expect-language` anywhere already (it
  does not today: `grep -rn "expect-language"` → 0), so the flag is additive.
- Whether the TAIL assertion should later cover every diagram shape rather than
  the six that link to TAIL. The plan gates the tail node and any label that
  reaches `archive`; widening it is a new decision, not an omission.
