# Plan — Full-review sweep, chunk M1 (machine evidence and program close)

**Status:** draft — self pass complete; cold pass 1 (1 Blocker / 5 Majors / 7 Nits) and cold pass 2 (diff re-review, `independent-review passed.`) complete; user approval pending · **Date:** 2026-11-10 · **Depth:** standard — M1 owns no REQ and changes no behavior; it re-runs the machine-evidence battery, reconciles the program's coverage invariant, retires the roadmap item, and writes the program AAR. It touches no release, credential, or schema-migration surface (worklist D4).
**Review route:** standard — self pass, one `independent-review` cold pass, one diff re-review at most.
**Review independence:** self pass complete; cold pass 1 returned `independent-review FAILED.` with one Blocker (the roadmap-mapping invariant was false for R2/R3) and five Majors, all resolved; cold pass 2 (diff re-review) returned `independent-review passed.` with one non-blocking count correction, applied.
**Rollback cost:** 1 on the 0–2 scale — documentation and tracker edits, plus two bounded register repairs. No source, dependency, config, credential, or publish operation is planned.
**Roadmap item:** `ROADMAP.md` § Full-repository review sweep — M1 is its program-close clause ("close this item when M1's machine-evidence pass is green").
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`
**Predecessor:** chunk R9, closed 2026-11-10; the worklist status board names M1 as the next trigger (`worklist.md:565`).

## Done bar

**Done bar:** the program is closed when all of the following hold.

- **(a) Evidence.** The battery ran un-piped and every leg has a recorded exit status and observation. *Gating legs* (every gate inside `npm run check`, plus the individually re-run non-fast gates) must exit 0. *Informational legs* (`check-tdqs --report`, `check-gate-coverage --report`, `check-fixtures`) always exit 0 by design, so their evidence is the parsed content — structural-violation count, G1 coverage and exemptions, fixture ages — not the exit code. A leg that cannot run is recorded `NOT_RUN` with its reason and a condition (C-3); no leg is recorded green without its own status or parsed result.
- **(b) Coverage.** 142 distinct §4 REQ IDs each carry a verdict row; every `finding:<ID>` cited in a verdict table has a register row; every register row carries an ID, chunk, predicate, severity, and terminal disposition; zero `P0` row is non-`Resolved`; all 22 prose ownership units (`worklist.md:83-104`) carry a prose row; every spec section named in a chunk's `Spec:` line is represented by a prose row or that chunk's REQ rows; all nine review chunks plus M1 read closed on the status board. Every `Scheduled-roadmap` row maps to **one of the three forms the tracker actually uses** — (i) the ID named in a roadmap section (74 rows), (ii) the section trigger naming the chunk's finding register, as R2 and R3 do (42 rows), or (iii) a row counted in the unbacked census (52 rows: R4 18, R5 27 plus the malformed row, R6 6), which is recorded per chunk in the program AAR and dispositioned as a finding, not silently passed.
- **(c) Findings.** Every gap found under (b) carries an ID, a severity, and a terminal disposition. The §1 goal 3 prose unit is recorded with a predicate drawn from existing verdicts (not a bare `holds`), and its ownership conflict is a P3 tracker finding resolved in-session.
- **(d) Retirement.** The `## Full-repository review sweep` section is absent from `ROADMAP.md` by heading-list diff (not by count), the 27 remediation headings are present, and `check-roadmap` + `check-non-goals` pass.
- **(e) AARs.** The program AAR (rewritten into the sweep directory, preserving the Phase-A record) and the M1 increment AAR are written after the first authoritative gate, carry its recorded status, and end `LOOP PAUSED` — or `LOOP OPEN` if any condition under the non-closure rule survives.
- **(f) Final tree.** A final un-piped `npm run check` on the finished tree exits 0. If a C-3 environmental leg is `NOT_RUN`, the normative run is `npm run check:fast` plus the individually recorded non-fast legs, and the aggregate is recorded as "green with N environmental `NOT_RUN`"; otherwise `npm run check` itself must exit 0.

**Non-closure rule.** A red deterministic gate traced to the tree's content, or an unresolved coverage gap not covered by (b)(iii), is not repaired inside M1: the owning chunk is named, the roadmap item stays, the AAR ends `LOOP OPEN`, and the retirement edits are rolled back. Only bounded tracker repairs are made in-session — a missing prose row backed by recorded evidence, and the malformed register row.

## Conditions

- **C-1 (user decision, non-blocking).** 28 unpushed commits predate this increment (oldest 18.6 h, EV8). Publishing them is a separate authorization; M1 neither publishes nor treats the backlog as part of its done bar. Consequence: the program's evidence is local; no CI run has observed these chunks.
- **C-2 (review independence) — resolved 2026-11-10.** The diff re-review returned `independent-review passed.` (`plan.cold/report.md`); its one new Major was a count correction, applied. No residual condition.
- **C-3 (environment-dependent gates).** `audit`, `check-pack`, and `test-debate-club` sit inside `npm run check`. If one fails for an environment reason (registry unreachable, packed-tarball handshake sandbox), it is re-run once and then recorded `NOT_RUN` with the reason and a condition, and done bar (f)'s aggregate rule applies. A failure traced to the tree's content lands `LOOP OPEN`.

## Scope

**In scope.** The machine-evidence pass over the closed sweep: the 22-gate suite, the fixture-freshness report, the TDQS and gate-coverage report modes, the Arena replay, the shipped-KB-empty gate, and the coverage reconciliation over `worklist.md` (REQ rows, prose rows, finding register, dispositions, chunk closure). The close artifacts: the M1 increment record, the program AAR, the worklist status board, the sweep `tasks.md` tick-through, and the `ROADMAP.md` retirement edit.

**Out of scope.** Any review of a REQ surface (R1–R9 closed); any implementation change; any remediation from the 27 remaining roadmap items; any re-adjudication of a finding's severity or the intent of a P2 row beyond the bounded repairs in M1-D2; publication, tagging, or versioning; dependency changes.

## Decisions

- **M1-D1 — Evidence admissibility.** Every recorded result names the exact command, the un-piped exit status, the reported wall time where available, HEAD, and the date. A piped command is not evidence (a pipeline's exit status is the last command's). Informational legs state their parsed result, because their exit code is always 0 (M3 of the cold pass).
- **M1-D2 — Bounded repairs only.** M1's blast radius is documentation plus two tracker repairs: (i) writing the missing §1 goal 3 prose row, whose evidence already exists in recorded verdicts; (ii) escaping the unescaped pipes in the `F-R5-B-8` register row (`textSimilarity` divides by `min(|A|,|B|)`), which breaks the Markdown table and makes the row unparseable. Nothing else in the register is rewritten: a behavioral red names its owning chunk and lands `LOOP OPEN`, and an unbacked disposition is recorded, not re-dispositioned (M1-D9).
- **M1-D3 — Coverage reconciliation is mechanical and uses the tracker's real forms.** The REQ check counts **distinct IDs**, not rows (REQ-106 legitimately carries two rows). The finding check is bidirectional at the ID level: every `finding:<ID>` in a verdict table must have a register row; the 153 register rows not cited by a verdict are legitimate review output, not a gap. The disposition check uses three forms (done bar (b)) because the roadmap's own admission rule caps a section at 1–3 bullets, so grouping is by design: R2/R3 trigger on their chunk register, R4–R9 name P1 IDs, and the R4/R5/R6 P2 rows are unbacked. The pre-scan census is EV10.
- **M1-D4 — Retirement shape and register coupling.** Only the `## Full-repository review sweep` section is removed. The 27 remediation sections it produced stay untouched, `## Non-goals` and its pointer stay, and `check-roadmap` + `check-non-goals` are the proof. Live registers updated in the same step: `worklist.md` (status board, program-close note), `ROADMAP.md` (section removal), the program AAR, and the sweep `tasks.md` (checkbox tick-through). The program `plan.md` stays as opened: its `**Roadmap item:**` line records what the increment was opened against, and the increment closes with M1 — the same immutability that `docs/plans/README.md` applies to a closed chunk plan, applied at the moment of close. The closed chunk plans (`R1`–`R9`) are historical and are not edited. No `CHANGELOG.md` entry: nothing ships behavior.
- **M1-D5 — No new harness.** M1 adds no probe and no script. The machine evidence is the shipped gates; the reconciliation is a bounded `grep`/`sort -u`/`sed` ID comparison whose exact commands are recorded in `tasks.md`. A gap the gates cannot observe is a finding, not a new tool.
- **M1-D6 — No push.** Publication stays user-authorized. The 28-commit backlog (C-1) is not folded into any step.
- **M1-D7 — Program AAR home.** The program AAR is written into `docs/plans/2026-11-09-full-review-sweep/aar.md`, replacing the Phase-A scaffold AAR (it currently ends `LOOP OPEN`) while **preserving** that scaffold's outcome and its F-A1..F-A3 records in a short "Phase A" section — the calibration rules they founded stay traceable. M1's own increment AAR lives in `docs/plans/2026-11-10-full-review-m1/aar.md`. Two artifacts, two tokens, both required by `check-loop-artifacts`.
- **M1-D8 — Approval seam.** Phase 0 stops for user approval before Phase 1 records a battery. The draft-time baseline (EV1) is the plan's own evidence, not the recorded program run.
- **M1-D9 — Unbacked dispositions are evidence, not a rewrite.** 52 rows (R4 18, R5 27 plus one malformed, R6 6) assert `Scheduled-roadmap` with no roadmap home in any form. M1 records them as a census plus one P3 finding (tracker disposition drift) disposed `Closed-P3`: no gate consumes the register, and re-adjudicating 52 rows in an evidence pass would substitute a new review for the recorded one. The census is the durable record; a future remediation pass may re-disposition them.

## Evidence base (this session)

| # | Evidence | Source | Trust |
|---|---|---|---|
| EV1 | **Baseline green.** `npm run check` PASS (full, 51.8 s) at HEAD `deab019`, tree clean, 22 gates, `audit` exit 0 with 4 low-severity advisories; `check-loop-artifacts` PASS over the 17 increments that existed at that scan (the untracked M1 directory was created after it) | tool output, 2026-11-10 | tool-output |
| EV2 | **REQ rows close.** 143 rows matching `^\| REQ-` over **142 distinct** IDs; the duplicate is `REQ-106`, recorded twice by R9 for its two clause groups | `grep -o '^\| REQ-[0-9a-z]*' \| sort -u \| wc -l` | repo |
| EV3 | **Register closes at the ID level.** 272 register rows; all 119 distinct `finding:<ID>` references in verdict tables resolve to a register row; no row with severity `P0` lacks a `Resolved` disposition | `grep`, `sort -u`, ID comparison | repo |
| EV4 | **Chunk closure.** Status board: R1–R9 closed, M1 `not started`; every closed chunk carries a verdict table, a register block, and an AAR with a terminal token | `worklist.md:557-566`, `docs/plans/` | repo |
| EV5 | **Prose coverage — one real gap.** The ownership table (`worklist.md:83-104`) lists 22 units covering §1 goals, §2 failure modes, §3 invariants, and §6.1–§6.2. 21 carry a prose row; **§1 goal 3 (provider intelligence) has none**. R3's plan disclaims it (`r3/plan.md:33`, D28: "R3 owns §7.4 only"), the ownership table assigns it to R3 (`worklist.md:86`), and the only reference is R9's preamble row (`worklist.md:534`). The evidence for a row exists in R3's REQ-020a/020c/020h verdicts and R2's `F-R2-27` (latency), so the row is written at step 10 with verdict `finding:F-R2-27`, and the ownership conflict is filed as a P3 tracker finding | `grep -n 'goal'`, R3 `plan.md`/`aar.md` | repo |
| EV6 | **Gate inventory.** 22 gates in `scripts/lib/gate-manifest.ts`; `check-fixtures` is deliberately not a gate (`scripts/check-fixture-freshness.ts:1-8`); `check-tdqs --report` and `check-gate-coverage --report` are informational modes that always exit 0 (`check-tdqs.ts:31`, `check-gate-coverage.ts:28`) | manifest, script headers | repo |
| EV7 | **Release state.** Version 2026.11.7, tag `v2026.11.07`, 28 unpushed commits (oldest 18.6 h), last pipeline run 2026-11-07, 28 open roadmap items | `npm run status` | tool-output |
| EV8 | **Loop mechanics.** `check-loop-artifacts` scans `docs/plans` one level deep for `plan.md`, `tasks.md`, `aar.md`, a `**Done bar:**`, and a terminal LOOP token; `docs/plans/README.md` states a plan is not edited after close | `scripts/lib/loop-artifacts.ts`, `docs/plans/README.md` | repo |
| EV9 | **Cold pass.** `plan.cold/report-stage1.md` — `independent-review FAILED.` 1 Blocker (roadmap-mapping invariant false for R2/R3), 5 Majors (§1 goal 3 evidence disclaimer; close artifacts written before the authoritative gate; informational legs counted as gating; program `plan.md` and sweep `tasks.md` omitted from the register list; done-bar (f) vs C-3 conflict), 7 Nits. All resolutions are in this revision | `.cold` report, this session | tool-output |
| EV10 | **Disposition census.** 168 register rows are disposed `Scheduled-roadmap`: 78 P1, 89 P2, and 1 row whose severity cell is unparseable (the `F-R5-B-8` row's unescaped `\|A\|` pipes). By roadmap form: 74 rows name their ID in a section; 42 (R2 27, R3 15) are covered only by that section's chunk-register trigger; 52 have no roadmap home (R4 18, R5 27 plus the malformed row, R6 6). (The unanchored token count of 169 includes the schema-definition prose line `worklist.md:21`.) | `node` census over register × `ROADMAP.md` | repo |
| EV11 | **Roadmap shape.** 29 `##` headings: the sweep section, 27 remediation sections, and `## Non-goals`. Retirement must leave exactly 28, verified by heading-list diff | `grep -n '^## '` | repo |

## Phases and steps

### Phase 0 — Scaffold and baseline

0. The increment directory carries `plan.md` (this artifact), `tasks.md`, and an in-progress `aar.md` stub whose final line is `LOOP OPEN`. Nothing here is committed and no roadmap trigger moves. **Stop for user approval** (M1-D8) before Phase 1 records a battery.
1. Run `npm run check` un-piped; record exit status, gate count, wall time, HEAD, and the `audit` advisory count. EV1 is the draft-time run; step 1 is the authority.
2. Record `git status --porcelain`, `git rev-parse --short HEAD`, `npm run status`, and the tagged version.
3. Run `npm run check-fixtures -- --now=2026-11-10` and record the fixture ages (informational; the exit code proves nothing).

### Phase 1 — Machine evidence

4. Re-run the non-fast gates individually and un-piped so each has its own status line: `npm run check-pack`, `npm run test-debate-club`, `npm run audit`.
5. Capture the informational report content: `npm run check-tdqs -- --report` (structural-violation count, parameter counts, definition bytes, invocation cost, description coverage) and `npm run check-gate-coverage -- --report` (G1 coverage, exemptions, waivers). The gating verdicts come from step 1, not from these runs.
6. Capture the remaining named legs un-piped: `npm run check-intent-citations`, `npm run check-report-fixtures`, `npm run validate-spec`, `npm run validate-readme`, `npm run check-shipped-kb-empty`, `npm run check-gate-table`, `npm run check-loop-artifacts`.
7. Record the battery as a table in `tasks.md`: command → status (gating exit / informational result) → wall time → observation. Any `NOT_RUN` carries its reason and condition (C-3). A red gating leg stops the battery and routes to step 14.

### Phase 2 — Coverage reconciliation

8. **REQ closure.** Count distinct §4 REQ IDs in the verdict tables and compare with the spec's 142 (§9.5 manifest). Enumerate any ID with no row, and any row whose verdict cell is neither `holds` nor `finding:<ID>` nor `deferred:<chunk>`.
9. **Finding closure.** Bidirectional ID check: every `finding:<ID>` cited in a verdict table resolves to a register row; every register row carries an ID, chunk, predicate, severity, and terminal disposition; zero `P0` row is non-`Resolved`.
10. **Prose closure.** Walk the 22 ownership units (`worklist.md:83-104`) and confirm each has a prose row. Write the §1 goal 3 row (EV5) with verdict `finding:F-R2-27` and its predicates, and file the ownership conflict as a P3 tracker finding. Then walk each chunk's `Spec:` line and confirm every named section is represented by a prose row or that chunk's REQ rows — the ownership table does not cover `§5.3`, `§6.3`, `§6.4`, `§7.x`, `§8`, `§9`, `§10`, or Appendices A–E, which are recorded per chunk.
11. **Disposition mapping.** Apply the three forms: ID named (74), chunk-register trigger (42), unbacked census (52, including the malformed row). Record the census per chunk in the AAR and file it as the P3 finding from M1-D9. Repair the malformed `F-R5-B-8` row by escaping its pipes. This step's job is to make the claim true, not to make it pass.
12. **Roadmap shape.** Diff the heading list: the sweep heading is absent, the 27 remediation headings and `## Non-goals` are present. `check-roadmap` and `check-non-goals` pass.
13. **Chunk closure.** Every status-board row reads closed except M1; every chunk directory under `docs/plans/` has a terminal LOOP token.

### Phase 3 — Close

14. Disposition every M1 finding under M1-D1..D3 and M1-D9. Report-only finding IDs are new (`F-M1-1` ownership conflict, `F-M1-2` disposition drift); they are P3 and `Closed-P3`. A behavioral red names its owning chunk, rolls back steps 15–17 if already applied, and lands `LOOP OPEN`.
15. Retire the roadmap item and repair the tracker: remove the sweep section, apply the two bounded repairs (step 10 row, step 11 row), update the status board to M1 closed with next trigger `—`, tick the sweep `tasks.md` checkboxes whose work the record verifies (R1–R9 chunk boxes and Phase A, per the status board and each AAR), and record the program-close note.
16. Run `npm run check` un-piped on the edited docs. This is the first authoritative gate. **Red path:** a deterministic behavioral failure traced to the tree's content sends the finding to its owning chunk and lands `LOOP OPEN`; a formatting/tracker failure is repaired by amending step 15 and re-running. Do not write a terminal token before this run is green.
17. Write the program AAR (`docs/plans/2026-11-09-full-review-sweep/aar.md`, preserving the Phase-A record) and the M1 AAR, each carrying the step-16 status, the reconciliation counts (142 / 272 / 22 / 74-42-52 / 28→27), the finding census, the C-1 condition, and a terminal token.
18. Run `npm run check` un-piped on the finished tree. A red gate is handled exactly as at step 16, including rewriting both AAR tokens to `LOOP OPEN` and restoring the roadmap section if the failure is not repairable inside the step; a repairable formatting failure is amended and this step re-run.
19. Split commits in the standing AGENTS order — `docs(review)` worklist + register repairs → `docs(roadmap)` retirement → `docs(plans)` M1 record, program AAR, sweep `tasks.md` — one concern each, earlier commits `npm run typecheck`-verified; then `npm run session:close`. No push (M1-D6).

## Verification

- The done bar is satisfied clause by clause, with the artifact or command named for each.
- The battery table in `tasks.md` distinguishes gating legs from informational legs and carries a status or parsed result per leg; no green claim lacks one.
- Reconciliation commands are recorded verbatim, so the counts are reproducible (142 / 272 / 22 / 168 dispositions / 28→27).
- The heading-list diff — not a count — proves the retirement (EV11).
- `check-roadmap`, `check-non-goals`, `check-loop-artifacts`, `check-gate-table`, and `validate-spec` pass after the retirement and AAR edits.
- The final-tree run is the normative gate (done bar (f)); its exit status is recorded un-piped and quoted in both AARs.
- No source, config, dependency, credential, or published artifact changes; the tree diff is documentation only.

## Risks and mitigations

- **Environment-dependent red.** C-3 fixes the handling: one retry, then `NOT_RUN` with reason, and done bar (f)'s aggregate rule keeps the close truthful instead of papering over it.
- **Program-close performance theater.** Informational legs always exit 0 (EV6); their evidence is the parsed content, and the gating verdict is the step-1 run. The reconciliation counts are the substantive evidence.
- **Invariant overclaim.** The first cold pass caught exactly this class (EV9): a claimed mapping that the roadmap does not carry. The three-form census replaces the false universal, and the unbacked rows become a recorded finding.
- **Silent coverage hole.** The §1 goal 3 gap (EV5) is a real one; step 10 writes the row from recorded verdicts and never from recollection, and the row is a `finding:` verdict, not a `holds`.
- **Retirement collateral.** Step 12 diffs headings before and after; `check-roadmap` catches an empty or malformed survivor.
- **Close-artifact ordering.** Steps 16–18 put the authoritative gate before the terminal tokens and define the rollback, so a red final gate cannot leave a `LOOP PAUSED` claim standing.
- **Unbacked P2 drift.** 52 rows claim a scheduling that does not exist; recording the census rather than rewriting it keeps M1 an evidence pass and leaves the adjudication to a remediation increment (M1-D9).
- **Stale base.** 28 unpushed commits (C-1) mean the evidence is local; a failure caused by the backlog is diagnosed from `git log` before any M1 finding is written.
- **Independence gap.** If the diff re-review cannot run, the plan records `NOT_RUN.` and the program close does not claim independent plan review.

## User impact

No restart, dependency, or breaking change. The shipped tree is unchanged; the diff is the M1 record, the program AAR, the worklist status board and two register repairs, the sweep `tasks.md` tick-through, and the roadmap retirement. Publication of the 28-commit backlog remains a separate, user-authorized step.

## Backout

The increment reverts as `git revert` on its documentation commits, restoring the sweep roadmap section, the prior status board, the un-escaped register row, and the Phase-A program scaffold AAR. No source, gate membership, config, or state is touched, so no other rollback surface exists.

## Review independence

**Self pass** verified EV2–EV7 and EV10–EV11 against the artifacts (row counts, ID closure, ownership-table walk, gate inventory, disposition census, heading list) and identified the §1 goal 3 gap and the disposition census.

**Cold pass 1** (`plan.cold/report-stage1.md`, plan sha256 `877f6cd7…`) returned `independent-review FAILED.` with 1 Blocker and 5 Majors; its Blocker (the roadmap-mapping invariant was false for R2/R3) was independently re-verified and is broader than reported — 94 rows are unnamed by ID, of which 42 use a chunk-register trigger and 52 have no home at all, the malformed row among them (EV10). Every Blocker, Major, and Nit is resolved in this revision: the invariant is now the three-form census, the goal-3 row has named evidence, the close artifacts follow the authoritative gate with a defined rollback, informational legs carry parsed results, the program `plan.md` and sweep `tasks.md` are named with their treatment, done bar (f) defines the `NOT_RUN` aggregate, and the seven Nits are applied.

**Cold pass 2** is the diff re-review (`plan.cold/report.md`) of this revision; it returned `independent-review passed.` with B1 and M1–M5 resolved, N1–N7 resolved, and one new non-blocking Major (New-M1: the census total was off by one and double-counted the malformed row). The correction is applied as required — 168 rows, the malformed row inside the 52, the forms 74 / 42 / 52 — and, because it is a textual count correction that leaves the mapping unchanged, no further cold pass is required under the reviewer's own stamp condition.
