# Plan — Review cap contract and the narrowing rule

**Status:** draft 2026-11-13 (revision 6) · **Depth:** standard
**Conditions:** C-indep — `risk accepted: no cold pass — authorized by the maintainer` (stage 5 failed twice at its re-audit cap; the residual fixture blocker is fixed in this revision as a condition-only amendment).
**Rollback:** revert four commits — (1) the gate library, its tests, and the changelog line, (2) the documents, (3) the roadmap retirement, (4) the increment record. No runtime code, no runtime state, no response shape.
**Roadmap item:** `ROADMAP.md` § Review-loop convergence (retired by this increment)
**Reviewed artifact:** revision 5, sha256 `bae98daf…` (cold pass in `plan.cold/`); revision 6 applies the readiness re-audit's fixture correction as a condition-only amendment, and `plan.cold/report.md` carries the final hash.
**Predecessor:** `a694430` (`docs(plans): record the R9 default-consistency increment`)

## Review budget

**Review cap:** 1 cold pass — 7 reviewer dispatches (stages 1–2, three stage-3 lenses, stage 4, stage 5) — plus at most 1 re-audit of each failed stage, so at most 12 dispatches. A further dispatch requires a user authorization written into this increment's `aar.md`. The gate grandfathers this increment (dated 2026-11-13), so this line is an exemplar of the accepted shape, not an enforced instance.

## Baseline (verified this session)

- `git log -1` → `a694430`; tracked tree clean (`git status --short` empty). The increment directory and `plan.cold/` are untracked until commit 4.
- `npm run status` → version 2026.11.11, 190 unpushed commits (oldest 4.1 d), 2 open roadmap items, last pipeline run 2026-11-07.
- `npm run check` → **PASS** (full, 22 gates, 166.4 s), run before this increment's directory existed. Only finding: the pre-existing `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` (no `**Done bar:**`). From step 0 onward the directory adds one `missing aar.md` error until C-8 writes it, which is the DB-2 expectation.
- Population probe, exactly as run: `ls -d docs/plans/*/ | wc -l` → 54; `grep -rlE "Review cap|Review-loop cap|cold-pass cap" docs/plans/*/plan.md | wc -l` → 12 (a loose prose match that includes headings); `grep -rl "Review cap" docs/plans/*/aar.md | wc -l` → 3.
- Cutoff probe: `ls -d docs/plans/*/ | sort | tail -1` → `2026-11-13-r9-tool-quality-evidence/`, so no existing increment is at or after `2026-11-14` and the new rules add no finding to any of the 54.
- `grep -c "D-117" DECISIONS.md` → 0 (the decision number is free; the highest used is D-116).
- Precedent to generalize: `docs/plans/2026-11-11-r2b-ii-user-layer-write-ordering/plan.md:15-22` (`## Review-loop cap`) and its `aar.md:4` ("re-audited under a one-pass cap"). Its predecessor, `docs/plans/2026-11-10-r2b-config-reload-validation/aar.md:60-66`, ran a seven-pass loop and recorded the cap as a recommendation instead of a plan declaration — the demonstrated failure behind the roadmap item. The heading form is superseded by the inline line this plan adds; increments using it are grandfathered.
- Contract surface today: `docs/plans/README.md:8-23`, `scripts/lib/loop-artifacts.ts:44` (`**Done bar:**` parse), `:59-88` (`validateIncrements`), `:91-96` (`nameProblem`), `scripts/lib/loop-artifacts.test.ts:3-4,39-45` (invariant, fixtures), `scripts/check-loop-artifacts.ts:6-9,36-38`, `scripts/session-close.ts:83,90,99,107-108` (findings filter, naming check, error exit, dry-run return), `AGENTS.md:414-432`.
- Execution-start state: `plan.md` and `tasks.md` exist from the start of execution; `aar.md` is written at close. `plan.cold/` is a nested directory, and `listIncrements` reads only top-level directories (`loop-artifacts.ts:34`), so the review evidence is gate-inert.

## Problem

The review cap lives in the `independent-review` skill, which is user configuration outside this repository; the increment artifacts that *are* version-controlled do not state it. So the bound on a review is applied by an agent that is also the author of the plan under review, and the record of how many passes ran is optional prose. Two increments demonstrate the cost: one ran seven passes, the next declared `## Review-loop cap` by hand because the previous AAR recommended it — the practice is voluntary. The second bullet of the roadmap item adds the companion rule: when the first blocker — a Blocker-severity finding whose cause is confined to one finding's evidence — arrives in a multi-finding increment, the increment narrows to that finding instead of revising the combined scope again.

## Change entries

**C-1 (M) — `scripts/lib/loop-artifacts.ts`, and the header of `scripts/check-loop-artifacts.ts`.** Export `CAP_CONTRACT_FROM = "2026-11-14"`. An increment is subject to the cap rules when `nameProblem(name) === null` and `name.slice(0, 10) >= CAP_CONTRACT_FROM`; a non-date directory is skipped rather than treated as modern, because `validateIncrements` applies no naming rule of its own. Parse the marker with a line-initial regex over the file text, `^\*\*Review cap:\*\*[ \t]*(.*)$` with the `m` flag, and expose `planReviewCap` and `aarReviewCap` on `Increment` (`null` means no line). A marker must begin a line; the regex is non-global, so the first line-initial marker wins and a duplicate is not detected (C-5 records that limit) — this plan quotes the marker in C-1 and C-3 and must still parse. Return findings, all `level: "error"`: when the increment is subject and `hasPlan` — `plan.md has no **Review cap:** line`, or `plan.md **Review cap:** value does not open with a count` (trimmed value fails `/^\d+/`); when the increment is subject and `hasAar` — `aar.md has no **Review cap:** line`, or `aar.md **Review cap:** line does not record \`used <n> passes\`` (value fails `/;\s*used\s+\d+\s+pass(?:es)?\b/i`). The plan-side checks do not depend on the AAR existing; the AAR-side checks sit after the existing `missing aar.md` `continue`, so a directory without an AAR reports the plan-side findings and that one error only. The AAR-side check does not validate a leading count — it requires only the `used <n> passes` clause, where one pass is one reviewer dispatch. `CAP_CONTRACT_FROM` is exported so the tests read it instead of hard-coding the date. The canonical AAR form is `**Review cap:** <declared cap>; used <n> passes`, and the colon is required, unlike the optional colon the older `**Done bar:**` regex tolerates. Rationale and limits are C-5's D-117, not restated here. Update the `check-loop-artifacts.ts` header sentence that says "A missing Done bar is a warning, not an error" so it also names the cap findings as errors; the exit-code contract at `:12-13` is unchanged. No new gate, so `gate-manifest.ts`, the AGENTS.md gate table, and the gate ledger are untouched.

**C-2 (M) — `scripts/lib/loop-artifacts.test.ts`.** Eight temp-root cases: (a) a capped increment dated 2026-11-20 whose `plan.md` carries `**Review cap:** 1 cold pass; used 2 passes` and whose `aar.md` carries the same value plus `LOOP PAUSED` is accepted; (b) its plan without the line errors; (c) plan with the line and AAR without it errors; (d) a plan value that does not open with a count errors; (e) an AAR value without `used <n> passes` errors; (f) an increment dated 2026-11-13 with neither line produces no finding (grandfather); (g) a capped-date increment with `tasks.md` and an `aar.md` carrying `**Review cap:** 1 cold pass; used 2 passes` plus `LOOP PAUSED`, but no `plan.md`, reports exactly `missing plan.md`; (h) a non-date directory name with all three files and no cap lines produces no cap finding. Cases (b)–(e) are written first and observed red. (a), (f), (g), and (h) are green before and after C-1 by construction: they assert the absence or the shape of a finding the new branches do not produce. Existing fixtures are dated 2026-11-06/07 and stay green unchanged. Every case builds its own temp root, so the file's stated invariant (`:3-4`, no dependence on the repository's own increments) holds.

**C-3 (S) — `docs/plans/README.md`.** `plan.md` row gains the `**Review cap:**` line; `aar.md` row gains the record. Three bullets join the flat Rules list: every increment dated 2026-11-14 or later declares its cap on a line-initial `**Review cap:**` line in `plan.md` and records the same marker in `aar.md` as `<declared cap>; used <n> passes`, where a missing line or a value outside that shape is an error — earlier increments, including any that used the older `## Review-loop cap` heading form, are grandfathered; a dispatch beyond the declared cap requires a user authorization recorded in the AAR, otherwise stop and escalate; when the first blocker's cause is confined to one finding's evidence, the increment narrows to that finding and the rest move to a follow-on increment instead of a second revision of the combined scope.

**C-4 (S) — `AGENTS.md`.** In `## Review-Loop Governance` add `**Review cap.**` (declared in the plan, recorded in the AAR, user authorization required past it) and `**Narrowing rule.**` (the single-finding narrowing rule in imperative voice); amend `**Increment record.**` to name the cap alongside the `**Done bar:**`.

**C-5 (S) — `DECISIONS.md`.** New `### D-117: The Review Cap Is a Plan Declaration, Not an Agent Judgement (2026.11.13)`. Records the rejected alternatives: leave the cap to the `independent-review` skill (outside the repo, unrecorded), and gate on a pass count the repository cannot observe. Records why the cap findings are errors rather than the Done bar's warning, names `CAP_CONTRACT_FROM`, and states three limits: the narrowing rule is documentary; a false AAR record is possible because the gate sees a declaration; and the parser reads the first line-initial marker only, so a second declaration or an amended value is not detected.

**C-6 (S) — `CHANGELOG.md`.** New top entry `## 2026.11.11 — Review cap contract` (heading date must equal the package version, `version-sync`), carrying both the gate-behavior line and the documentation line. It ships in commit 1 with the gate change, because Script Discipline requires a behavioral gate change to carry its changelog entry and a re-run of the gates it feeds.

**C-7 (S) — `ROADMAP.md`.** Remove `## Review-loop convergence`; its trigger closes with this increment's own cap record.

**C-8 (M) — `docs/plans/2026-11-13-review-loop-cap-contract/`.** `plan.md` (this text) and `tasks.md` are written at execution start; `aar.md` is written at close and records the cap, the dispatches used, findings with dispositions, gates, and the terminal token. Its cap line takes the canonical form — for this increment, `**Review cap:** 1 cold pass, at most 12 reviewer dispatches; used <n> passes` — because DB-5 validates it as if the directory were dated 2026-11-20. `tasks.md` carries one checkbox per commit-order step, with the DB rows as sub-items under the step that verifies them. `plan.cold/` is the cold-pass evidence (`00-scope.md`, stage files, `report.md`) and is committed with this directory; it is nested, so `listIncrements` ignores it.

## Blast radius

| File | Change | Size | Gate |
|---|---|---|---|
| `scripts/lib/loop-artifacts.ts` | cap parse + validation | M | `typecheck:scripts`, `test` |
| `scripts/lib/loop-artifacts.test.ts` | 8 cases | M | `test` |
| `scripts/lib/weekly.test.ts` | two fields on the `Increment` fixture | S | `typecheck:scripts`, `test` |
| `scripts/check-loop-artifacts.ts` | header prose only | S | `check-script-discipline` |
| `docs/plans/README.md` | contract + 3 bullets | S | none |
| `AGENTS.md` | governance bullets | S | none |
| `DECISIONS.md` | D-117 | S | none |
| `CHANGELOG.md` | entry | S | `version-sync` |
| `ROADMAP.md` | retire section | S | `check-roadmap`, `check-non-goals` |
| `docs/plans/2026-11-13-review-loop-cap-contract/{plan,tasks,aar}.md` | increment record | M | `check-loop-artifacts` |
| `docs/plans/2026-11-13-review-loop-cap-contract/plan.cold/` | cold-pass evidence, tracked | S | none |

No file outside this table is modified. `scripts/session-close.ts` is deliberately unchanged: it filters `validateIncrements` for one increment (`:83`), so a post-cutoff increment missing a cap now fails `npm run session:close` with the same error at close. That inherited effect is the enforcement.

## Verification

| Done bar | Step |
|---|---|
| **DB-1** — the eight cases are correct and each omission errors | `npx vitest run scripts/lib/loop-artifacts.test.ts`; cases (b)–(e) are observed red before C-1; (a), (f), (g), (h) are green by construction, as C-2 states |
| **DB-2** — the tightened gate adds no finding on the current tree | step 0 and step 1 of the commit order; both runs must print `1 error(s), 1 warning(s)` — the in-progress increment's missing `aar.md` plus the pre-existing Done-bar warning, with no cap finding on any of the 54 |
| **DB-3** — the contract, governance, decision, and changelog agree | read-back of C-3..C-6; `npm run version-sync`; `npm run check-script-discipline` |
| **DB-4** — the roadmap section is retired | `grep -c "Review-loop convergence" ROADMAP.md` → 0; `npm run check-roadmap`; `npm run check-non-goals` |
| **DB-5** — the increment's own cap lines satisfy the new rule | step 4: copy the increment into a temp root dated 2026-11-20 and validate it — `TMP=$(mktemp -d) && mkdir -p "$TMP/docs/plans" && cp -r docs/plans/2026-11-13-review-loop-cap-contract "$TMP/docs/plans/2026-11-20-review-loop-cap-contract" && rm -rf "$TMP/docs/plans/2026-11-20-review-loop-cap-contract/plan.cold" && REVIEW_CAP_ROOT="$TMP" npx tsx -e 'import { validateIncrements } from "./scripts/lib/loop-artifacts.ts"; const f = validateIncrements(process.env.REVIEW_CAP_ROOT!); console.log(JSON.stringify(f)); if (f.length) process.exit(1);'` → `[]`, exit 0 (command shape verified this session) |
| **DB-6** — `session-close` inherits the rule without a code change | step 4, after `aar.md` exists: `npm run session:close -- --dry-run` exits 0 and prints `session-close: dry run — no gate run, no record, no commit.` |
| **DB-7** — the suite is green on the final tree | step 5: `npm run check` (full) exit 0 |

Unverified by design: the narrowing rule has no mechanical check; it is verified by review of `docs/plans/README.md` and `AGENTS.md` and is recorded as a D-117 limit. DB-5 proves the lines are present and well-formed; it cannot prove the loop stopped at the cap, which is the forcing-function limit recorded in D-117.

## Commit order

0. Pre-edit: run `npm run check-loop-artifacts` and record `1 error(s), 1 warning(s)` (DB-2 baseline).
1. `fix(loop-artifacts): require a declared review cap and its AAR record` — C-1, C-2, C-6. Gates: `npm run typecheck:scripts`, the target vitest file, `npm run check-loop-artifacts` (still `1 error(s), 1 warning(s)`), `npm run check-script-discipline`, `npm run version-sync`.
2. `docs(plans): state the review cap and the narrowing rule` — C-3, C-4, C-5. Gates: `npm run check-script-discipline`, `npm run version-sync`.
3. `docs(roadmap): retire the review-loop convergence item` — C-7. Gates: `npm run check-roadmap`, `npm run check-non-goals`.
4. `docs(plans): record the review-loop cap increment` — C-8. Gates: `npm run check-loop-artifacts` (`0 error(s), 1 warning(s)`), DB-5, DB-6.
5. `npm run check` (full) once on the final tree — DB-7.

A failure at step 5 reopens commit 4's files before close; it is an amendment to an open increment, not a new one. Before commit 4 the increment directory is untracked, so abandoning it is a manual `rm` rather than a revert.

## Risks and mitigations

- **Grandfather date is a magic constant.** It is named and exported as `CAP_CONTRACT_FROM`, documented in `docs/plans/README.md` and D-117, and chosen one day after this increment so no already-closed plan is edited. The cost is that this increment is not itself enforced; DB-5 covers its lines directly.
- **The gate sees a declaration, not the number of passes actually run.** The AAR record is prose plus a number; a false record is possible. The gate is a forcing function, not a proof — recorded in D-117.
- **The parser accepts one declaration.** A second line-initial marker or an edited value is not detected; recorded in D-117.
- **The skill side is not version-controlled here.** `independent-review` and plan-review live in user config; this increment does not edit them. `AGENTS.md` and the increment contract are the enforced surface.
- **In-progress `docs/plans` directory is red.** The missing `aar.md` is one error until C-8 writes it; DB-2 states the exact expected sets so the red is not mistaken for a defect.

## User impact

No runtime, tool, spec, or response-shape change. Contributors get one more required line in new increment plans and one required record in their AARs. Rollback cost: 1 on the 0–2 scale (0 add, 1 reversible edit, 2 destructive).

**Done bar:** DB-1 through DB-7 pass, the roadmap section is retired, this increment's own cap lines pass DB-5, and both deliverables — the review cap contract and the narrowing rule — are in `docs/plans/README.md` and `AGENTS.md`.

## Amendment 2 (execution, 2026-11-13)

`session-close --dry-run` on this plan printed a garbage done bar: the Done-bar regex was unanchored, so it matched the plan's own prose mention of the marker in the Baseline section and captured the text after it. The Done bar is now parsed line-initial, matching the cap marker, with two cases — a declaration line after a prose mention, and a plan whose only mention is inline (warning). This is a demonstrated wrong output (P0), fixed in-session as its own commit. All 54 existing declarations are line-initial, so no increment's result changes.

## Amendment 1 (execution, 2026-11-13)

`scripts/lib/weekly.test.ts:29` constructs an `Increment` literal; the two new required fields broke `npm run typecheck:scripts` there. The fixture now passes `planReviewCap: null` and `aarReviewCap: null`, and the file joins the blast radius. This is a compile-time consequence of the interface change, not a design change: no behavior, no test expectation, and no gate is altered.
