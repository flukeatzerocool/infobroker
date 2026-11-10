# Cold review — plan R6 (knowledge base)

Reviewer: review
Plan sha256: 964040f0ea4bdf97456e19de610473fa7e47f5e99e272e9ba71354defee7d063

Target: `/home/fluke/Infobroker/docs/plans/2026-11-09-full-review-r6/plan.md` (148 lines)
Depth: deep · Stages: 1–5 lenses · Date: 2026-11-09 · Reads used: 61/80

## Independence and method

One fresh context (no authoring history, no parent findings) read the artifact,
the 13 named targets, and the cited standards. Stage 3's design/structural/style
lenses were applied sequentially rather than by three separate fresh reviewers;
this is a weakened but honest cold pass. The Stage 4 re-zoom had no author diff
to inspect (see Stage 4).

## Stage 1 — Zoom out

The document holds together on the central contract: the 29-REQ set is exact,
the cluster→REQ union is exact, and the R6a/R6b counts are right. The failures
are in the conditional and disposal paths, not in the enumeration.

**F1 [Critical|design] Split-execution gate routes the wrong probe legs.**
`plan.md:34` makes R6a (clusters A, B, F, G) run legs `(a)–(d), (g)` and defers
only `(e), (f)` to R6b. But `plan.md:98` assigns `(c)` to cluster D and `(g)` to
cluster E — both R6b clusters — while R6a's cluster F leg `(d)` and cluster A/B
legs `(a),(b)` are the only R6a probes. On a triggered split, R6a runs the
encryption and capacity probes for clusters it defers, and R6b (C, D, E) runs
only cluster C's probes. The encryption and capacity chunk would close without
its own probes. Fix: R6a = `(a),(b),(d)`; R6b = `(c),(e),(f),(g)`.

**F2 [Critical|design] D57 is used as a substitute for an R6 disposition.**
`plan.md:31` sends a config-only fix to "`Scheduled-roadmap` (P1) with a D57
note", and `plan.md:37` does the same for an encryption fix that moves key
material or the on-disk format. D57 (`plan.md:41`) says a D57-noted defect "is
not added to the R6 register and does not change an R6 verdict". A REQ-067,
REQ-084, or REQ-086 violation found on this surface is an R6 finding; routing it
only to D57 removes it from the register and can leave the REQ at `holds`,
defeating the done bar's "every in-scope finding … one terminal disposition"
(`plan.md:13`). Fix: always file the R6-REQ violation in the R6 register as
P1 `Scheduled-roadmap`; add a D57 note only for the non-R6 fix surface.

**F3 [Major|clarity, design] "report-receipt fixtures" is a phantom artifact
owned by another chunk.**
`plan.md:27` puts "receipt *fixtures*" and `check-report-fixtures` semantics
beyond the receipt contract out of scope under R7. Yet `plan.md:56` (EV9)
records that the R6 `Code:` line omits "the report-receipt fixtures", and
`plan.md:111` (step 21(i)) instructs adding them. No receipt fixture set exists:
`src/kb-report-receipt.test.ts` reads no fixture file, and
`scripts/check-report-fixtures.ts:3-5,16` reads `test-fixtures/reports/`, whose
contract is REQ-114/116/118 (R7). Adding those files to R6's code line creates
a double-owned surface and contradicts the plan's own scope. Fix: drop the
receipt-fixtures item from EV9 and step 21(i), or name a real R6-owned receipt
artifact.

**F4 [Minor|clarity] EV8's §9.5 count and anchors are wrong.**
`plan.md:55` says "four §9.5 verification scenarios name KB behavior
(`:1075-1076,1093`)". `infobroker.md` carries KB-named scenarios at `:1075`,
`:1076`, and `:1092`–`:1100` — eleven, not four — and the citation omits
`:1092` (KB search). §9.5 is R9-owned (`worklist.md:360`) but D55's
other-chunk list (`plan.md:39`) does not name it, so the surface's owner is
unstated. Fix: correct the count/anchors and add §9.5 to the D55 list.

**F5 [Minor|clarity] EV5's file count is off by one.**
`plan.md:52` says 6,433 test lines "across 21 `kb*`/`embed` files". The 6,433
total is correct; the glob `src/kb*` + `src/embed*` matches 22 files.

**F6 [Minor|clarity] The deep-trigger paraphrase overstates D4.**
`plan.md:3` says the surface "touches at-rest encryption and secret handling …
and a one-way store-format migration …, which worklist D4 names as deep
triggers." D4 (`worklist.md:37-38`) names "release, credentials, or schema
migration". The store-format migration supports deep; at-rest encryption and
"store-format" are not D4's words. Quote D4 rather than paraphrase it.

**F7 [Minor|clarity] Tracker drift is under-recorded.**
EV9 (`plan.md:56`) misses that the R6 and R7 status-board rows are merged on
`worklist.md:379` (`… | R5 closed || R7 | …`) and that R7's next-trigger already
says "R6 closed" before R6 has run. Step 21's status-board update should repair
the row structure, not only add §1 goal 6.

**F8 [Minor|clarity] D2's split amendment reaches the worklist too late.**
D2 (`worklist.md:32-34`) requires a split "by a recorded amendment to this
worklist". Step 10 (`plan.md:94`) records only `split: triggered`; the R6a/R6b
REQ partition is written at close (step 21, `plan.md:111`). A split session that
stops mid-flight leaves the tracker without the partition. Write the partition
at step 10.

**F9 [Minor|clarity] The G0 "live" evidence path is static as written.**
D52 (`plan.md:36`) requires "the live advertised schema"; step 9 (`plan.md:93`)
cites only the registration literal (`src/index.ts:1975-2060`). The live
capture exists in the carrying tests (`src/tool-surface.test.ts:94`,
`debate-club/src/mcp-contract.test.ts:91`); name it in step 9 so the G0 leg is
not satisfied by a static read.

## Stage 2 — Comprehension (artifact only, ≤200 words)

R6 is a read-only, deep-depth review chunk of the full-repository spec-vs-code
sweep covering the knowledge base: 29 REQs in §4.9 plus §1 goal 6. It enumerates
`file:line` anchors per cluster A–G, confirms the REQ/check/citation map, decides
whether to split into R6a (19 REQs plus the prose row, clusters A/B/F/G) and R6b
(10 REQs, clusters C/D/E), runs isolated probes under `/tmp/opencode/r6-probe/`,
reviews each cluster against its carrying tests, reads gate assertions,
dispositions findings P0–P3, appends verdict tables and a finding register to
`worklist.md`, updates the tracker and the ROADMAP trigger, runs `check` and
`check:fast`, writes the AAR, and splits the commits. Done means every REQ (or
R6a's 19) and the prose unit have a verdict, every in-scope finding has a
terminal disposition, no P0 is open, every new P1 is on `ROADMAP.md`, the
tracker carries the tables, the trigger names R7 (or R6b), `check` is green
before the roadmap edit and final-tree `check:fast` is green after it, and the
AAR ends `LOOP PAUSED`.

Could not determine from the document alone: whether a self pass ran (it says
pending); what "report-receipt fixtures" are; how probe (g) builds an oversized
store; which clusters are probe-dependent; and whether D57 notes replace or
accompany R6 register rows.

Verdict: **faithful-with-gaps**. No clarity Blocker at Stage 2 — the mechanism
and the done bar are stated — but the disposal and probe mechanics are
ambiguous, and Stage 3/5 escalate them.

## Stage 3 — Critics

### Design lens

**F10 [Major|design] D53 does not isolate the real secret environment.**
`plan.md:37` promises "synthetic passphrases" and no real key. The key-source
chain is fixed at `src/kb-crypto.ts:197-215`: key file →
`INFOBROKER_KB_KEY` → `INFOBROKER_KB_PASSPHRASE`; `src/kb.ts:1248-1253` reports
the same precedence. If the developer's shell exports a real
`INFOBROKER_KB_KEY`, it overrides the probe's synthetic passphrase, the probe
uses real key material, and `key_source` reports `raw_env`. D53 names only
`kb.storage_path`, `kb.keys_dir`, and `kb.reports_dir`. Fix: mandate clearing or
overriding `kb.encryption.key_file`, `INFOBROKER_KB_KEY`,
`INFOBROKER_KB_PASSPHRASE`, and `INFOBROKER_KB_REKEY_*`, and assert the resolved
`key_source` is the synthetic source before any encryption leg.

**F11 [Major|design] Probe legs (d) and (g) are not rehearsable as written.**
Leg (g) (`plan.md:98`) says "a store larger than a constrained child heap is
retrieved and inspected completely (`--max-old-space-size`)". It names no seed
source, no target store size, no heap value, and no harness; D56 (`plan.md:40`)
requires the exact command but does not say how the store is built. The repo
already ships `scripts/benchmark-kb-store.ts` (`npm run benchmark-kb`,
`package.json:84`) as the REQ-108 measurement harness; EV11 (`plan.md:58`) does
not cite it. Leg (d) says "a changed report reports drift" but does not say
whether the probe mutates the stored row directly or re-ingests. Fix: name the
seeding method, the size-vs-heap pair, the child command, whether
`benchmark-kb` is used, and the drift-induction mechanism.

**F12 [Minor|design] Leg (c)'s locked transition is unspelled.**
`plan.md:98` requires "`status` stays reachable while the store is locked" but
does not say how the probe reaches `locked` (enable encryption, then remove the
key source and restart). The code path exists (`src/index.ts:2062-2070`); the
plan should state the transition so the leg is reproducible.

### Structural lens

F1 (split leg routing) is the structural failure: the split gate's step set is
not derived from the cluster map. `plan.md:34` also says "the R6a cluster
steps" without enumerating them (R5's D42 listed them), so the split path
requires a second mapping decision. No other ordering defect: Phase 0 → 1 → 2 →
3 is executable, and the step 0 AAR stub correctly keeps `check-loop-artifacts`
green throughout.

### Style lens

Naming is consistent (`R6a`/`R6b`, `F-R6-<cluster>-<n>`, `D50`–`D58`).
"Report-receipt fixtures" (F3) is the one undefined term. "Probe-dependent"
is defined. The status-board `||` (F7) hides a decision in a broken row.

## Stage 4 — Re-zoom

Not triggered: the author has not edited the artifact in response to Stage 3
(one cold pass, no diff). The findings were instead checked against the whole
document for contradictions: F1 and F2 are independent; F3 contradicts
`plan.md:27` within the same artifact; F10 rolls up F1's encryption exposure but
does not depend on a split. No fix has been applied, so no post-fix
contradiction check is possible.

## Stage 5 — Readiness

**Not ready.** An implementer must still decide:

1. Which probe legs belong to R6a vs R6b (F1) — the conditional path is wrong as
   written.
2. Whether a config/encryption finding is an R6 register row or a D57 note (F2)
   — the two rules contradict.
3. What "report-receipt fixtures" names, or that the item should be dropped (F3).
4. How the encryption probe is isolated from ambient secret env vars (F10).
5. How probe (g) is seeded and bounded, and how probe (d) induces drift (F11,
   F12).

Everything else needed is present: all 13 target files exist; the nine
`manage_kb` actions, the seven auto-index hook sites, the config block, and the
29 REQ bodies are anchored; the rollback/backout section covers docs and a
bounded P0 fix; the cold-pass path and stamp rule are stated; R2/R3/R4/R5/R7/R8/R9
boundaries and D57 routing are named.

## Evidence-base audit

| # | Result | Notes |
|---|---|---|
| EV1 | Verified in part | HEAD `76613a2`, 14 unpushed, clean tree (only the new dir) confirmed; 51.0 s / 22 gates / oldest 4.0 h not re-run |
| EV2 | Verified | `worklist.md:321-327` and `infobroker.md:1251-1279` agree; 7 G0+G1, 22 G1-only |
| EV3 | Unverified | Test counts not re-run (read-only shell); citation files all exist |
| EV4 | Verified | Citation map matches `@implements`; 084→5, 085→6, 108→6 files |
| EV5 | Verified in part | All module line counts match; 6,433 total confirmed; 21→22 file count (F5) |
| EV6 | Verified | `config.json:393-418` matches every listed field |
| EV7 | Verified | Registration `1975-2056` (handler starts 2057), 7 hook sites `586,588,662,1095,1242,1333,1926`, import `:24`, resolution `:1637-1639` |
| EV8 | **Incorrect** | §9.5 count/anchors wrong (F4); §2 F9 `:74` and §5.4 item 9 `:763` correct |
| EV9 | Verified in part | Code-line omissions and nonexistent `src/kb-hardening.ts` confirmed; "receipt fixtures" false (F3); misses `worklist.md:379` (F7) |
| EV10 | Verified | All five findings are `Scheduled-roadmap` in the register |
| EV11 | Unverified | Gate outputs not re-run; `benchmark-kb` omitted (F11) |
| EV12 | Plausible | 13 prior `docs/plans/*/plan.md`; loop-artifact contract not re-run |

## Worklist conformance

| Item | Result |
|---|---|
| 1. Anchors enumerated | Deferred to Phase 1 (step 5); plan-time estimate only — correct for a draft |
| 2. Standard depth + cold pass | Deep by D4 exception; cold pass planned; **self pass not evidenced** |
| 3. `code-review` + `drift-report` | `drift-report` named (step 18); `code-review` not named |
| 4. REQ + prose verdicts | Done bar covers 29 + §1 goal 6; split covers 19 + prose |
| 5. ID/predicate/severity/disposition | Stated, but D57 routing breaks it (F2) |
| 6. Zero open P0 | Non-closure rule present |
| 7. Exit evidence un-piped | Steps 22 and 25 |
| 8. AAR/trigger/split commits | Steps 23–26 |
| D2 | Split amendment timing (F8) |
| D4 | Deep justified by the store-format migration; paraphrased (F6) |
| D11 | §1 goal 6 only; correct (`worklist.md:89`) |

## Unknowns

- EV3's 131 tests, EV11's gate results, and EV12's pass are tool-output claims
  this pass did not re-run.
- The artifact says "Self pass pending" (`plan.md:5,147`) while this cold pass is
  running; whether a self pass preceded it is unevidenced.
- Phase 1's anchor count and the probe-dependent cluster set do not exist yet;
  the ~87-anchor estimate and the split decision are unverifiable until step 5.
- Oldest unpushed commit age (4.0 h) and the 51.0 s baseline were not measured.
- Stage 3's three lenses were one reader's sequential application, not three
  independent reviewers; the skill's fresh-context-per-stage rule was not met
  because the parent forbade nested subagents. This does not change the FAILED
  verdict.

## Readiness verdict

Two Critical design defects (F1 split probe routing, F2 D57 disposal) and three
Major gaps (F3 phantom receipt fixtures, F10 secret-env isolation, F11 probe
rehearsal) remain. Fix F1–F3, F10, and F11, then re-audit Stage 3 and Stage 5.
F4–F9 and F12 are wording/tracker corrections that can ride the same edit.

independent-review FAILED.
