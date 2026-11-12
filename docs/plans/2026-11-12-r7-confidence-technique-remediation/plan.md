# Plan — R7 confidence and technique remediation

**Status:** revision 2, awaiting diff re-review · **Date:** 2026-11-12 · **Depth:** standard (two skill artifacts, one gate script, four registers; no production module, config, schema, dependency, or destructive surface)
**Review independence:** fresh — one cold pass (`independent-review`) on revision 1 returned `FAILED` with 3 Blockers / 12 Majors / 8 Nits (report `/tmp/opencode/r7-confidence-cold-report.md`). Revision 2 fixed every Blocker and Major; the one targeted diff re-review returned 14 of 15 prior items resolved and one residual Major in the T11 acceptance wording, which is corrected in this text (C-5). The diff re-review's three Nits are also applied. No design decision changed after the diff re-review, so the cap is spent and the artifact is re-stamped `fresh` against the diff-re-review report.
**Rollback cost:** 1 — content edits to two Markdown artifacts, two additive check groups in an existing gate, and one decision row; `git revert` of the commit restores the prior gate. A partial revert of the content alone leaves the gate red by design.
**Roadmap item:** `ROADMAP.md` § R7 confidence and technique remediation (`ROADMAP.md:17-22`); removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); 130 unpushed commits, oldest 3.0 d; 12 open roadmap items; `HEAD` `8138fe9`, clean tree apart from this plan directory.

## Why this section

`ROADMAP.md` § R7 confidence and technique remediation is the first open section
in the file, and the ordering rule is top section first. Its trigger — "start
after chunk R8 closes" — is satisfied: the sweep status board records R8
**closed 2026-11-10** and M1 **closed 2026-11-10**
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:602-604`). The remaining R7
sections carry the same trigger, so file order decides, and this one is first.

Both findings are client-artifact defects that a deterministic gate can carry:
the gated-analysis skill **restates** the confidence scale instead of citing it
and invents a fourth label (F-R7-B-1, P1), and the technique catalog **claims**
six families without assigning any technique to a family (F-R7-B-2, P2). The
roadmap's two permitted remedies for the second finding are "map each catalog
technique to a family so the six-family claim is verifiable, **or** narrow the
claim" (`ROADMAP.md:20`); this plan does both halves. Neither finding needs a
REQ body edit: REQ-115 already requires three labels and citation rather than a
*divergent* restatement (`infobroker.md:486`), and REQ-088 already requires at
least six techniques across at least three families (`infobroker.md:480`).

## Baseline (verified this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **130 unpushed
  commits, oldest 3.0 d**, 12 open roadmap items.
- `npm run check` → **PASS (full, 156.9 s, 22 gates, recorded for `8138fe9`)**.
  One pre-existing warning, not a failure: `check-loop-artifacts` reports
  `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`.
  `npm run audit` inside that run reports 4 low-severity `markdownlint`
  advisories; the gate fails only on high/critical (REQ-101).
- Working tree clean at `8138fe9` before this plan directory was created.

## Predicates re-verified by reading the artifacts this session

| Claim | Evidence | Verdict |
|---|---|---|
| The analysis skill assigns a fourth label | `skills/analysis-loop/SKILL.md:180` — `- **No confidence** — no reliable source found.` | Confirmed — F-R7-B-1 |
| The canonical scale has exactly three labels with bands | `skills/infobroker/references/confidence.md:8-12` (`High` 0.80–1.00, `Medium` 0.50–0.79, `Low` 0.00–0.49) | Confirmed |
| The canonical file forbids restating the scale in `analysis-loop` | `skills/infobroker/references/confidence.md:104` — "cite this file's bands when grading; do not restate them" | Confirmed |
| REQ-115 forbids a *divergent* restatement, not a verbatim citation | `infobroker.md:486` — "cite that definition rather than restating a divergent scale" | Confirmed — the distinction the fix relies on |
| The analysis skill cites the canonical file once, in Phase 1 | `skills/analysis-loop/SKILL.md:114` | Confirmed |
| The Phase 2 bullets define the labels by source grade, which the canonical file does not | `SKILL.md:176-180` vs `confidence.md:8-12` | Confirmed — divergent restatement, not just the fourth label |
| No gate reads the analysis skill's confidence block | `scripts/validate-spec.ts:751-757` reads only `confidence.md`; the REQ-088 block at `:712-729` reads the skill only for the literal `technique-selection` and the catalog only for its `###` count | Confirmed |
| The skill's no-source destination exists | `SKILL.md:234` carries a per-finding `**Gaps:**` field and `SKILL.md:242` carries `## Uncertainty Register` | Confirmed — the fix routes to these existing surfaces |
| The catalog claims six families | `skills/analysis-loop/references/techniques.md:8-12` | Confirmed — F-R7-B-2 |
| No technique declares a family | `grep "\\*\\*Family" skills/analysis-loop/references/techniques.md` → 0 matches across 8 `###` sections | Confirmed |
| The technique gate counts headings only | `scripts/validate-spec.ts:726-729` | Confirmed |
| REQ-088 names the family obligation | `infobroker.md:479-480` | Confirmed — no REQ edit needed |
| No other gate or test asserts these two properties | `scripts/lib/parse-readme.ts:85-99` enumerates skill **names** only; `grep -rln "analysis-loop" scripts/test-skills/` → `event-stream.test.mjs:16-28` matches the completion token only; `test-fixtures/skills/analysis-loop.json` holds an agent prompt | Confirmed — no competing check |
| `README.md:432` survives the change | it says techniques are "chosen by fit and named"; it states no family count and no confidence block | Confirmed — no README edit |
| The version/CHANGELOG rule | `scripts/version.ts:163-175` seeds and the check asserts the top entry date equals `package.json` | Confirmed — the plan names the real carrier |
| The gate has no unit-test harness | `ls scripts/*.test.ts` → `monitor-delta`, `monitor-watchlist`, `version` only | Confirmed — red/green evidence is a recorded probe |

## Alternatives considered

- **A — delete the Phase 2 label list and point at `confidence.md`.** Rejected:
  the skill must stay usable without opening a second file mid-analysis, and a
  named-label list is what the analyst writes into the output.
- **B — keep the fourth label and add it to the canonical scale.** Rejected:
  REQ-115 states three labels. "No reliable source" is a collection gap (the
  skill has `**Gaps:**` and `## Uncertainty Register`), not a strength of
  judgment.
- **C — keep the band numbers in the skill but copy them verbatim.** Rejected
  after the cold pass: a verbatim copy satisfies REQ-115's "divergent" qualifier
  but is still a restatement, and no cheap gate can detect band drift. The fix
  names the three labels only and leaves every band in the canonical file
  (Alternative A's citation with a usable label list).
- **D — six families preserved by adding a cause-and-effect technique.**
  Rejected: the catalog is curated by fit, not by count, and inventing a ninth
  technique to satisfy a preamble number is the failure mode REQ-088's "at least
  three families" already avoids. Narrowing is the roadmap's stated alternative
  (`ROADMAP.md:20`).
- **E — family labels plus a `## Families` index (chosen).** Each `###`
  technique gains a `**Family.**` line and the catalog gains a two-column index
  table; the preamble's numeric claim is replaced by a pointer to the index. The
  table is the human-readable claim and the machine-readable check at once, so
  the gate never parses prose.
- **F — gate the family from the selection-guide table.** Rejected: that table
  answers "what state am I in", not "which family is this technique"; a family
  column would mix the two questions.
- **G — detect the fourth label with a whole-file blacklist.** Rejected: an
  example sentence would trip it. The check scopes to the confidence-scoring
  block and requires set equality with the canonical three labels, which catches
  a fifth label, a renamed label, and a deleted block.

## Blast radius

| File | Change | Size |
|---|---|---|
| `skills/analysis-loop/SKILL.md` | Replace the four-bullet list (`:176-180`) with the three canonical labels and no band numbers, a pointer to `confidence.md` as the authority, and one sentence routing an unsourced claim to the finding's `**Gaps:**` field and the `## Uncertainty Register` | S |
| `skills/analysis-loop/references/techniques.md` | Replace the six-family sentence (`:8-12`) with a statement that each technique declares its family and that the new `## Families` index is the claim; insert the two-column index immediately before `## Selection Guide`; add one `**Family.**` line above `**Fit.**` in each of the eight `###` sections | M |
| `scripts/validate-spec.ts` | REQ-088 block: parse the `## Families` table and each `**Family.**` line; short-circuit on a missing/empty index; fail on a missing or duplicate family line, duplicate family membership across rows, a family absent from the index, an index technique absent from the catalog, a catalog technique absent from the index, fewer than three families, fewer than six techniques. REQ-115 block: require the `**Confidence scoring.**` block, require its label set to equal exactly `{High, Medium, Low}`, require the canonical citation in that block, and require each label to be a row in the `## Confidence` section of `confidence.md` | M |
| `DECISIONS.md` | One `### D-107` row under `## Active Decisions`: five families are the represented subset, cause-and-effect is deliberately unclaimed until a curated technique fills it, and the catalog claim is narrowed per `ROADMAP.md:20` | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | R7 verdict rows for REQ-088/REQ-115 (`:418-419`) and register rows `F-R7-B-1` (`:834`) / `F-R7-B-2` (`:843`) → `Resolved 2026-11-12` with file:line evidence | S |
| `ROADMAP.md` | Remove § R7 confidence and technique remediation (`:17-22`) | S |
| `CHANGELOG.md` | One new sibling `## 2026.11.11 — …` section inserted between `# Changelog` and the current first section (`CHANGELOG.md:3`); the top entry date must equal `package.json`'s version (`scripts/version.ts:163-175`) | S |
| `docs/plans/2026-11-12-r7-confidence-technique-remediation/` | `plan.md`, `tasks.md`, `aar.md` | S |

No spec body change, no production source change, no config, schema, provider,
dependency, or new-gate change. `validate-spec` gains two check groups inside its
existing artifact-content function; no new script and no new gate row, so
`check-gate-table` and `AGENTS.md` are untouched.

## Done bar

**Done bar:** F-R7-B-1 and F-R7-B-2 each have a committed artifact fix **and** a
gate assertion that fails when the fix is reverted. Concretely: (1) the
confidence-scoring block exists, names exactly the three canonical labels, cites
`confidence.md`, and routes the unsourced case to `**Gaps:**` / the Uncertainty
Register; (2) every `###` technique declares exactly one family, the `## Families`
index agrees in both directions with no technique under two families, and the
prose no longer claims a family that has no technique; (3) the new REQ-115 check
fails on the pre-fix tree naming `No confidence` at `SKILL.md:180` and passes
after the fix; (4) probes recorded in `tasks.md` each go red then green: deleting
a `**Family.**` line, listing one technique under two families, adding a bogus
index row, deleting the confidence block, and adding a fourth label; (5)
`npm run validate-spec`, `npm run check-roadmap`, `npm run version-sync`,
`npm run check-script-discipline`, `npm run check-loop-artifacts`,
`npm run typecheck`, and `npm run typecheck:scripts` are green on the final tree;
(6) `npm run check` is green **after** `aar.md` carries its terminal token; (7)
the worklist verdict and register rows read `Resolved 2026-11-12` with evidence,
`D-107` is present, and the roadmap section is gone; (8) the AAR ends
`LOOP PAUSED` when nothing is unresolved, or `LOOP OPEN` naming an escalated
item — the cap escalation and this bar do not conflict.

## Review-loop cap (recorded, not judged at run time)

**One cold pass at standard depth, plus at most one targeted diff re-review of
the lines that changed.** The cold pass is spent (revision 1, `FAILED`); one diff
re-review of this revision is the only remaining review step. At that cap any
unresolved item is escalated to the user with `LOOP OPEN` rather than re-scoped.
This increment records the cap but does **not** retire § Review-loop
convergence.

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Record the baseline in `tasks.md`: `npm run status` and the green
  `npm run check` run above.
- **T1.** Create `tasks.md` (with red/green transcript slots) and `aar.md` seeded
  `LOOP OPEN` with the finding list. `LOOP OPEN` is a valid terminal token
  (`AGENTS.md`), so every intermediate `check-loop-artifacts` run is satisfiable;
  no gate run is expected to fail on this directory.

### Phase 1 — Confidence scale (F-R7-B-1)

- **T2 — add the REQ-115 checks.** In `scripts/validate-spec.ts`, extend the
  existing REQ-115 block (`:751-757`): require the `**Confidence scoring.**`
  marker and the block up to the next numbered step; require the canonical
  citation `skills/infobroker/references/confidence.md` inside that block;
  extract every `- **<Label>** —` label; require the resulting sequence to be
  exactly `High`, `Medium`, `Low` (missing, extra, duplicated, or reordered →
  one error per defect); and read only the `## Confidence (strength of the
  judgment)` section of `confidence.md` (from that heading to the next `##`) when
  checking that each label is a table row. A missing block is an error, not a
  vacuous pass.
- **T3 — red.** `npm run validate-spec` → exit 1 with **two** errors: the label
  `No confidence` at `skills/analysis-loop/SKILL.md:180` (label set differs from
  the canonical three) and the missing canonical citation inside the block (the
  existing citation at `SKILL.md:114` sits in Phase 1, outside the block). Any
  other error is a parse defect and a stop. Record verbatim in `tasks.md`.
- **T4 — fix the skill.** Replace `SKILL.md:176-180` with three lines in the
  exact form `- **High** — <cue>`, `- **Medium** — <cue>`, `- **Low** — <cue>`
  (the form T2's extractor reads), with no band numbers, one sentence that
  the bands and definitions live in
  `skills/infobroker/references/confidence.md` and are cited rather than
  restated, and one sentence that a claim with no reliable source is not scored:
  it is recorded in the finding's `**Gaps:**` field (`SKILL.md:234`) and, when it
  is a collection gap, in the `## Uncertainty Register` (`SKILL.md:242`).
- **T5 — green.** `npm run validate-spec` → exit 0. Record the transcript.

### Phase 2 — Technique families (F-R7-B-2)

Index grammar, pinned so the gate and the content share one contract:

- section heading `## Families`, placed between the introductory paragraph and
  `## Selection Guide`;
- exactly one table with the header `| Family | Techniques |` and a standard
  separator row;
- a **Family** cell is plain text (no emphasis) that matches its `**Family.**`
  value exactly after trimming;
- a **Techniques** cell holds one or more technique names separated by `; `
  (semicolon + single space); each name is the exact trimmed text of a `###`
  heading, parenthetical included (`Analysis of Competing Hypotheses (ACH)`);
- a technique appears in exactly one row; a family appears in exactly one row.

- **T6 — add the REQ-088 family checks.** In the existing REQ-088 block:
  parse the `## Families` table; on a missing section, missing header, or zero
  data rows, emit one error and skip every per-technique cross-check so the red
  is deterministic. Otherwise parse each `###` section's `**Family.**` line
  (exactly one required), require the family value to appear in the index and the
  technique to appear in that family's row, require every index technique to
  exist as a section, reject a technique listed in two rows, a family listed
  twice, and a row whose Techniques cell is empty, and require at least three
  distinct families. The existing `###` count (≥6) stays.
- **T7 — red.** `npm run validate-spec` → exit 1 with exactly one error: the
  `## Families` section is missing (cross-checks skipped). Record verbatim.
- **T8 — fix the catalog.** Write the preamble replacement, the index, and the
  eight `**Family.**` lines per the grammar above, with five families:
  *hypothesis generation and testing* — `Analysis of Competing Hypotheses (ACH)`;
  *challenge analysis* — `Key Assumptions Check; Devil's Advocacy; Premortem
  Analysis; Structured Self-Critique`; *scenarios and indicators* —
  `Indicators`; *diagnostics* — `Quality-of-Information Check`;
  *decision support* — `Decision Matrix`.
- **T8b — record the decision.** Add `### D-107` under `## Active Decisions` in
  `DECISIONS.md`: the five-family subset is the standing mapping, the
  cause-and-effect family is deliberately unclaimed, and the claim was narrowed
  per `ROADMAP.md:20`. `npm run check-non-goals` is unaffected; `validate-spec`
  does not read `DECISIONS.md` beyond waivers.
- **T9 — green.** `npm run validate-spec` → exit 0.
- **T10 — probes.** Record each red→green transcript: (a) delete one
  `**Family.**` line; (b) list one technique in a second family row; (c) add a
  bogus index row; (d) delete the confidence-scoring block; (e) add
  `- **Very low** — …` to it. Restore after each.

### Phase 3 — Bookkeeping

- **T11.** Worklist: REQ-088/REQ-115 verdict rows (`:418-419`) and the
  `F-R7-B-1` / `F-R7-B-2` register rows (`:834`, `:843`) → `Resolved
  2026-11-12` with evidence. Acceptance:
  `grep -n "F-R7-B-1\\|F-R7-B-2" docs/plans/2026-11-09-full-review-sweep/worklist.md`
  returns exactly **four** lines — the two verdict rows (`:418-419`, read before
  the edit) and the two register rows (`:834`, `:843`) — each carrying a
  `Resolved 2026-11-12` disposition; and `grep -n "F-R7-B-" ROADMAP.md` returns
  no hit after T12.
- **T12.** Remove § R7 confidence and technique remediation from `ROADMAP.md`;
  `npm run check-roadmap` → OK.
- **T13.** Insert the CHANGELOG section between `# Changelog` and the current
  first section. Do not change the top date: `package.json` is still 2026.11.11
  and `npm run version-sync` pins that date.

### Phase 4 — Gates and close

- **T14.** `npm run validate-spec`, `npm run check-roadmap`,
  `npm run version-sync`, `npm run check-script-discipline`, `npm run typecheck`,
  `npm run typecheck:scripts`.
- **T15.** Rewrite `aar.md`: dispositions, the family-mapping decision (pointing
  at `D-107`), the review cap, and a terminal token. `npm run session:close`.
- **T16.** `npm run check-loop-artifacts`, then `npm run check` on the final tree
  (full, un-piped, exit status recorded).

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| Fourth label removed | new REQ-115 checks | T3 records the live red; set equality also catches a deleted block |
| Scale cited, not restated | same checks | the citation is required in the block; bands move to the canonical file only |
| Every technique assigned | new REQ-088 checks | 8 sections, 1 family line each |
| Index and catalog agree | bidirectional cross-check + duplicate rejection | T10 probes (a)–(c) |
| REQ-088 floor preserved | existing `###` count + ≥3 families | 8 techniques across 5 families |
| Register consistency | `check-roadmap`, `check-loop-artifacts` | section removal, `D-107`, and a terminal AAR token |
| Whole-tree health | `npm run check` after T15 | baseline is green |

## Edge cases and rollback

- **The GRADE table repeats the labels.** `confidence.md:79-81` maps
  `High`/`Medium`/`Low` to GRADE, so a file-wide `| High |` search would pass
  trivially. The check is scoped to the `## Confidence (strength of the
  judgment)` section, whose rows are the band table at `:8-12`.
- **A label appears outside the confidence-scoring block.** The check scopes to
  the block, so Phase 1 source-grading bullets and Gaps wording cannot trip it.
- **The index is missing during T7.** The short-circuit yields one error, so the
  red is deterministic rather than eight cross-check errors.
- **A technique is renamed.** The bidirectional check fails, so a rename without
  an index update is a red, not silent drift.
- **`check-loop-artifacts` warns on an older increment.** Pre-existing and
  non-failing; out of scope.
- **Rollback.** `git revert` the single content-and-gate commit; a content-only
  revert leaves the gate red, which is the intended reverted state. `D-107`
  reverts with the same commit or standalone without breaking any gate.

## Commit series

The gate and the artifacts it checks are one concern: committing the gate first
would leave a red tree, and committing the content first would leave the
committed gate blind to it. They ship together, atomically.

1. `fix(analysis-skill)`: both gate check groups (`scripts/validate-spec.ts`) and
   both artifact fixes, plus `tasks.md` transcripts. Gate: `validate-spec`,
   `typecheck:scripts`, `check-script-discipline`.
2. `docs(decisions)`: `D-107`. Gate: `validate-spec`, `check-non-goals`.
3. `docs(plans)`: worklist dispositions and roadmap removal (T11–T12). Gate:
   `check-roadmap`.
4. `docs(changelog)`: the new sibling section (T13); `version-sync`.
5. `docs(plans)`: `plan.md` and `aar.md` (final review evidence).
   `check-loop-artifacts`, `npm run check`.

Every commit is `typecheck`-clean; the full suite runs once on the final tree.

## Conditions to verify during execution

- **C-1** — the T3/T7/T10 transcripts are captured verbatim before and after each
  fix; a red that does not name the expected file:line is a stop.
- **C-2** — the gate stays one script with no new exit path (0 pass / 1 failure /
  2 fatal).
- **C-3** — the citation requirement inside the analysis skill is net-new; the
  baseline `validate-spec` reads only `confidence.md`. Do not describe it as an
  existing assertion.
- **C-4** — the cap: one cold pass spent, at most one diff re-review; at the cap
  an unresolved item is escalated, never re-scoped.
- **C-5** — post-pass corrections: the diff re-review's residual Major (the T11
  acceptance count, now stated as exactly four lines) and its three Nits (T3's
  two expected errors, T4's pinned label-line form, T6's empty-cell rejection)
  are applied after the re-review. The reviewed artifact and this text differ
  only in those lines; no design decision changed.

## Unknowns

- Whether the five-family split survives a later tradecraft review as canonical.
  If a mapping is disputed, adjust the assignment and the index together and
  supersede `D-107`; do not restore a numeric prose claim.
- Whether two extra file reads move `validate-spec`'s run time measurably; both
  files are already read in the same function. T16 records the run time.
- Whether any fixture snapshots the analysis skill body beyond its completion
  token; the T16 full run settles it, and the greps in the predicate table cover
  the known readers.
