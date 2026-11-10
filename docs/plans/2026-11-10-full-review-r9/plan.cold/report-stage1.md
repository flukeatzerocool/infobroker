Reviewer: review (independent cold pass; single fresh context, no authoring history)
Plan sha256: de0e27e28ffebdbd296aab8d097f605d60a2cfe87b64403202516da004989773
Depth: standard · Read budget: 40 · Reads used: ~27

# Independent cold review — docs/plans/2026-11-10-full-review-r9/plan.md

Independence note: all five stages ran sequentially in one fresh context (the
parent consolidated them). Independence from the author is intact; inter-stage
isolation required by the skill was not used. Recorded, not hidden.

## Stage 1 — Zoom out (artifact only)

Claims asserted without support or contradicted elsewhere:

1. **D77 is used eight times but never defined in this artifact.** Lines 13,
   28, 30, 32, 47, 112, 116, 136 invoke "D77 cross-chunk notes", while line 50
   defines **D88 — Non-R9 defect disposition** with the same function. Step 17
   (line 112) says "Record D77/D88 notes" as if they differ. D77's definition
   lives only in `docs/plans/2026-11-10-full-review-r8/plan.md:53`; a cold
   reader of this artifact must guess whether D77 and D88 are the same rule.
2. **Split contingency contradicts the close contract.** D79 (line 41) and
   step 7 (line 96) define a split, but the done bar (line 13) fixes the output
   at nine REQs + 11 prose rows with no `deferred:R9b` vocabulary, and step 20
   (line 115) advances the trigger only to M1. A triggered split has no
   satisfiable close path and no R9b successor routine.
3. **Eligible P0 pool excludes the surface Cluster B reviews.** Review surface B
   (line 74) names "the seven tool registrations in `src/index.ts`", but the
   blast radius (line 80) admits only "the `spec`-action record region of
   `src/index.ts`" to the P0 pool. A REQ-089/090 violation is fixable only in
   the registration literals, so the stated pool forbids the fix D79 requires.
4. **EV11 misstates the tracker.** EV11 (line 66) says the R9 `Code:` line omits
   `src/intent-citations.ts`; `worklist.md:500` lists it. The same plan calls
   that module "Evidence-only (read, never changed)" and R7-owned (line 28).
5. **"Nine REQs across eight primary files"** (line 41) against nine files
   enumerated in EV4 (line 59).
6. **Evidence sidecar does not bind to this artifact.** The supplied
   `plan.evidence.md` records `Plan sha256: ff6036af…` and 152 lines; the
   artifact is `de0e27e2…` at 151 lines. Its Targets/Requirements tables were
   computed against a different revision.

Everything else the artifact asserts about file existence, line counts, and
section ranges checked out (see Stage 3 verification).

## Stage 2 — Comprehension (artifact only, ≤200 words)

R9 is the last review chunk of the repository-wide sweep. It reviews, without
changing runtime behaviour, nine spec-integrity REQs (`REQ-055`, `077`, `078`,
`080`, `081`, `089`, `090`, `092`, `106`) and eleven prose units (§1 preamble +
North Star, §3 SR-011/SR-012, §3 Terminology, §9.1–§9.5, Appendix B, Appendix
C), using the existing gates, tests, and file-presence artifacts. Phases:
scaffold + baseline the gate suite (0), enumerate anchors and confirm REQ/check
kinds (1), review clusters A–D and cross-check gates (2), disposition findings,
append worklist verdict/prose tables and corrected tracker lines, advance the
roadmap trigger to M1, write the AAR (3). P0 fixes are bounded (≤2 files, ≤100
lines); a missing gate is scheduled, never built. Done means: every REQ and
prose unit has a verdict row, every finding has a predicate, severity, and
terminal disposition, zero open P0, P1s on `ROADMAP.md`, `npm run check` green
at steps 19 and 22, AAR ends `LOOP PAUSED`.

Could not determine: what distinguishes a D77 note from a D88 note; what
happens to the done bar if step 7 triggers a split.

Comprehension: **faithful-with-gaps**.

## Stage 3 — Critics

**Design.** REQ-106's clause enumeration in step 8(ii) (line 97) and step 12
(line 104) omits "a description that does not contradict those annotations"
(`infobroker.md:382`). `scripts/check-tdqs.ts:110,134` computes
`annotationContradictionCandidates` but exits non-zero only on `violations`, so
this is exactly the gate-assertion gap the chunk exists to find; the plan's
own step list will not look at it. Also: step 18(i) (line 113) corrects the
`Code:` line from EV11's false list, so it would add an R7-owned, evidence-only
module to R9's ownership line. Step 20 (line 115) "updates" a `Next trigger`
cell that already reads M1 (`worklist.md:521`).

**Structural.** D85 (line 47) bounds only `scripts/validate-spec.ts`, but step
15 (line 107) cross-checks the whole gate suite; `check-gate-table.ts` and
`check-gate-coverage.ts` also assert every chunk's gates and are not covered by
the shared-surface rule. Step 23 (line 118) commits after `session:close`
ordering matches AGENTS D-089/D-091.

**Style.** The `Deferred-by-user`/`Scheduled-roadmap` vocabulary matches
`worklist.md:20-22`; REQ verdict vocabulary (`holds`/`finding:<ID>`) is not
restated but the walkthrough steps make it unambiguous.

**Verified against sources (hold):**
- Nine REQ IDs and `_Check:_` kinds match `infobroker.md:1211-1214,1246-1250`
  exactly (089 G0,G1; 090 G0,G1; 092 G1,G3; 106 G1,G3; 081 G1; 055/077/078/080
  G3) and `worklist.md:494-501`.
- All eight dispatched targets exist; `scripts/validate-spec.ts` 1038 L,
  `src/clause-coverage.ts` 73, `src/tdqs.ts` 439, `scripts/check-tdqs.ts` 140,
  `src/lib/feature-taxonomy.ts` 106, `src/tool-surface.test.ts` 236 — all match
  EV4. `src/tool-surface.ts` does **not** exist, as the plan claims.
- Gate wiring `scripts/lib/gate-manifest.ts:41,73,78,90,135` matches EV6;
  `validate-spec.ts:73` meta set is `055/077/078/080/096`; tool-default block at
  `:764-800`; `check-gate-coverage` scans `debate-club/src` and exempts
  `REQ-091`.
- `src/tool-surface.test.ts:1` cites 089/090/092 and spawns the server over
  stdio; `debate-club/src/mcp-contract.test.ts:386-391` asserts only byte fields
  — EV8's narrow-assertion risk is real.
- `/ROADMAP.md:17-23` carries the sweep section and program-close clause.
- Prose anchors correct: §1 `23-60`; Terminology `138-188`; §9 `1039-1297`;
  Appendix B `1544-1684`; Appendix C `1685-1766`.

## Stage 4 — Re-zoom

Not run: no artifact edit was made in response to Stage 3 findings (reviewer is
read-only). Stages 4/5 remain unevidenced as a re-check.

## Stage 5 — Readiness

An implementer needs no further decisions for the happy path. Blocking
ambiguities are listed as Major below; the two that force a decision are the
D77/D88 equivalence and the P0-pool/registration contradiction. No required
artifact is missing: `plan.md`, `tasks.md`, `aar.md` stub and `plan.cold/` are
named, and `check-loop-artifacts` requirements (`scripts/lib/loop-artifacts.ts:39-83`)
are satisfied by step 0/21.

## Findings (severity-ranked)

### Blocker
None.

### Major
1. [design] **SR-011/SR-012 anchors are wrong.** EV10 (`plan.md:65`) and D84
   (`:46`) give SR-011 `:96-101` and SR-012 `:102-110`. Actual: SR-011 spans
   `infobroker.md:96-124`, SR-012 spans `:125-136`; `:102-110` is inside
   SR-011's test list. Fix both citations and D84's `worklist.md:99` (should be
   `:101`).
2. [clarity] **D77 is undefined and duplicates D88.** `plan.md:13,28,30,32,47,112,116,136`
   vs D88 at `:50`. Define D77 in this artifact or replace every use with D88.
3. [design] **Split contingency is unsatisfiable.** D79 `plan.md:41` + step 7
   `:96` vs done bar `:13` (nine REQs, no deferred rows) and step 20 `:115`
   (R9b successor absent). Add the R8-style deferred branch or an explicit
   "split closes as R9a with R9b trigger".
4. [design] **P0 pool contradicts Cluster B.** `plan.md:74` reviews the tool
   registrations in `src/index.ts`; `:80` admits only the `spec`-action region
   to the P0 pool. Widen the pool or state that registration defects are P1.
5. [design] **Step 18(i) tracker correction rests on a false EV11 item.**
   `plan.md:66,113`: `src/intent-citations.ts` is already named at
   `worklist.md:500`, and `plan.md:28` calls it R7-owned evidence-only. Remove
   it from the "omitted modules" list.
6. [design] **REQ-106 annotation-contradiction branch is dropped.** Steps 8(ii)
   `plan.md:97` and 12 `:104` list deterministic layer, four fields, shadow
   pairs, but not the "description does not contradict annotations" clause
   (`infobroker.md:382`); `scripts/check-tdqs.ts:110,134` only reports
   candidates. Add the branch to the review unit.
7. [design] **Preflight evidence is stale.** Sidecar sha `ff6036af…` ≠ artifact
   sha `de0e27e2…`; re-run preflight before the plan is stamped, or the recorded
   evidence describes a different revision.

### Nit
1. EV3 (`plan.md:58`) cites `:372-390`; the four REQ bodies end at `:382`.
2. EV9 (`:64`) cites the artifact-REQ set at `:67`; the const is at
   `scripts/validate-spec.ts:70`.
3. "eight primary files" (`:41`) vs nine files listed in EV4 (`:59`).
4. D84 (`:46`) cites `worklist.md:99` for SR-011; the row is `:101`.
5. Step 20 (`:115`) updates an already-M1 cell (`worklist.md:521`); say
   "confirm" rather than "update".
6. The worklist close contract (`worklist.md:15`) requires a `code-review` run;
   no step names that skill, only prose verification.
7. D85 (`:47`) omits `check-gate-table.ts`/`check-gate-coverage.ts` from the
   shared-surface boundary, yet step 15 (`:107`) reviews the whole gate suite.

## Unknowns
- `npm run check`/`check:fast` and `check-gate-coverage --report` counts (EV1,
  EV7) were not run under the read-only contract; only their structural claims
  were verified.
- Whether D77 has a standing program meaning outside the R8 plan; only the R8
  artifact defines it.
- Probe/anchor counts used by D79's split threshold cannot be known until Phase
  1 runs.

## Verdict
independent-review passed.

---

## Parent addendum (authoring context — not part of the cold review)

The plan was amended after this report to resolve every Major and Nit finding:
SR-011/SR-012 anchors corrected to `:96-124`/`:125-136` and `worklist.md:101-102`
(Major 1, Nit 4); every `D77` reference replaced with `D88` (Major 2); the done
bar gained a `deferred:R9b` split branch and step 20 a split successor
(Major 3, Nit 5); the P0 pool now admits the `src/index.ts` tool-registration
literals (Major 4); EV11 and step 18(i) drop the false `src/intent-citations.ts`
claim (Major 5); the REQ-106 annotation-contradiction branch is now a named
review unit and the `check-tdqs` exit path is read (Major 6); preflight was
re-run against the amended artifact (Major 7). Nits 1–3 and 5–7 are also applied
(`:372-382`, `:70`, "nine primary files", "confirm", `code-review` named in
steps 11–13, D85 widened to the gate-table and G1-coverage scripts).
