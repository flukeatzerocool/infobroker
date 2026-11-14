# Cold review — 2026-11-14-corroboration-citation-benchmark-fidelity

Reviewer: review (independent-review cold subagent)
Plan sha256: 43813a84c766b9f5578d1186352bd596c8c5c39c442d41a7e5dc67e3ea5d3e21
Artifact: /home/fluke/Infobroker/docs/plans/2026-11-14-corroboration-citation-benchmark-fidelity/plan.md
Evidence: /home/fluke/.local/state/opencode/plans/3b34aea2bce9fb4da60d99c296e2000157a146aca988b48969a73d1a3d3aec94/plan.evidence.json
Depth: standard · Stages run: 1, 2, 3, 5 (Stage 4 not triggered — no author edits during review)
Reads used: 34 of 40

> Persisted by the authoring session from the reviewer's returned text: the cold
> dispatch was read-only (no write tool), so the reviewer produced the report inline and
> could not write this file or hash it. Body below is verbatim. The sha256 recorded above
> is the reviewer's hash of the plan artifact, not of this file.

## Isolation disclosure

- **Fresh context:** this reviewer received only the artifact, the target-file list,
  the cited standards, and the task's verification targets. No authoring history.
- **Stage isolation:** the skill's Stage 1–5 fresh-subagent requirement could not be
  met (nesting is prohibited in this dispatch). Stages were run sequentially in one
  fresh context, each written up before the next, with no prior finding passed
  forward. Artifact-level independence holds; inter-stage blindness is weaker.
  Recorded as Unknown U-6.
- **Inherited instructions:** this context was injected with the repository's
  `AGENTS.md` and user-level instructions. Per the independent-review context
  contract this weakens isolation; it is disclosed, not corrected for. I verified
  the plan's claims against the repository rather than trusting either side.
- **Sidecar:** used only for `generated_at`, `git_head`, and the target list; its
  `reqs[]` matches were not treated as evidence (they do not include the
  `infobroker.md` body hits, so I read the bodies directly).

## Coverage — the six claims under test

1. **`src/cite.ts:148`, dedupe `:104-139`, five-slug chain — CONFIRMED.**
   `const chain = (options.chain ?? getDispatchChain("academic")).slice(0, config.output.fallback_depth)`
   (`src/cite.ts:148`); `titleKey` folds the year (`:115-117`); one namespace per
   citation (`:123`); richer-field merge (`:129-136`); shipped chain is exactly
   `semantic_scholar, arxiv, openalex, europe_pmc, crossref` (`config.json:251`);
   `fallback_depth: 5` (`config.json:360`). `getDispatchChain` filters to usable
   providers (`src/config.ts:1184-1190`). D-036 quote accurate
   (`DECISIONS.md:1869-1871`).
2. **`src/retrieval-benchmark.ts:99-106` — CONFIRMED, with two signature defects
   (M3, M4).** Bare `try/catch` returning raw order at `:101-105`;
   `runBenchmark` is **synchronous** (`:108`) and consumed synchronously by
   `scripts/benchmark-retrieval.ts:59` and `src/retrieval-benchmark.test.ts:54,58,71`;
   the third `rankedUrls` parameter is already named `reconcile` and typed `boolean`
   (`:99-100`).
3. **`src/corroborate.ts:873-881`, budget constants, `snapshotSource` — CONFIRMED.**
   The two sequential awaits are exactly `:875-881`; `ARCHIVE_CONCURRENCY = 4`,
   `ARCHIVE_TIMEOUT_MS = 4000`, `ARCHIVE_TOTAL_BUDGET_MS = 2000`
   (`:1017-1019`); `snapshotSource` is synchronous and calls `kbIngest`
   (`src/preservation.ts:61-88`); `fetchSource` is only the corroborate seam and
   one test (`src/corroborate.ts:580,940,959`; `src/corroborate.test.ts:736`).
   Content-policy 8 s timeout confirmed (`src/content-policy.ts:106`, default
   `off` at `:48`).
4. **REQ-026c / REQ-122 / Appendix B — bodies CONFIRMED; the amendment's counted
   limits are wrong (M5, M6).** REQ-026c at `infobroker.md:325` (5 SHALL, 3
   sentences); REQ-122 at `:349`; REQ-027a at `:361`; REQ-130 at `:355`; limits at
   `:1719-1721`. The clause detector matches only `when … declares` and
   parenthesized `or` enumerations (`src/clause-coverage.ts:19,23`), so the
   proposed "when the attempt completes" text does **not** add a detected branch —
   no G3 rejection.
5. **Register rows and census — rows CONFIRMED, census count CONTESTED (M1).**
   All four rows are at the exact cited lines (`worklist.md:767,776,777,783`), all
   `Scheduled-roadmap`. The census value is internally contradictory in the
   register itself: `:585` says 4 scheduled, `:588` says "7 rows", `:894` says 13.
6. **Commit series / verification / done bar — executable except M2 and M8.**
   `npm run check:fast` = 19 gates is consistent with the manifest (22 minus
   `audit`, `check-pack`, `test-debate-club`). The blast-radius table names every
   file the steps change (`plan.md:266-280`) — no omission. `census.ts` exists
   (`docs/plans/2026-11-14-register-reconciliation/evidence/census.ts`).

## Stage log

### Stage 1 — zoom out
No unsupported code/spec citation found across 20+ checked `file:line` claims; the
line numbers are unusually accurate (only `worklist.md:584` → `:585` is off).
Internal contradictions found: "four remaining rows" (`plan.md:9,84-85`) vs "all
seven rows retired" (`:249`); "5 SHALL" (`:139-141`) vs the amendment's six;
"rejects" (`:203`) vs a synchronous target (`:114`); "0 open roadmap items"
(`:250`) vs a second live roadmap section.

### Stage 2 — comprehension (artifact only)
What is being built: four independent fixes plus bookkeeping. (1) `get_citations`
walks the whole configured academic chain instead of slicing it to
`output.fallback_depth`. (2) `dedupeCitations` merges a DOI-bearing reference with
its title-only twin under a year guard. (3) A reconciler exception fails the
retrieval benchmark instead of silently scoring the raw order. (4) `verify_claims`
stops awaiting archiving and snapshotting serially: both waves run under one
deadline, and REQ-026c is reworded from "non-blocking" to "bounded", reporting the
archive reference only when the save lands inside the budget. Bookkeeping:
DECISIONS D-122, one README sentence, four register rows flipped to Resolved, the
census re-derived, the ROADMAP section deleted, `config-tune.md` wording. Done:
four rows Resolved with a driving test, REQ-026c inside Appendix B, no
§ Corroboration section, census re-derived, `npm run check` green, `aar.md` ends
LOOP PAUSED — verified per test file, then by the doc gates, then full check.
Could not determine from the document: the reconciler parameter shape, how the raw
comparison is produced, whether the release commit is actually produced, and which
scheduled-row count is authoritative. **Faithful-with-gaps** (no clarity Blocker).

### Stage 3 — critics (design / structural / style)
- **Design:** deadline skip vs REQ-122's "each cited source" (M5); title-index
  shape and the two contradictory representative rules (M7).
- **Structural:** commit item 7 has no producing step (M8); Step 5.3's narrow line
  range leaves the register self-contradictory (M1); Step 5.4's expected status is
  unsatisfiable (M2).
- **Style:** current-vs-post-edit counts (M6); stale tag citation (N2); census line
  citation (N1).

### Stage 4 — re-zoom
Not run; the author did not edit the artifact during this review.

### Stage 5 — readiness
Signatures are the weak point: `rankedUrls`'s parameter collision (M4), the
`preserveCondensedSources` boundary is named but the changed
`archiveCondensedSources(findings, budgetMs)` → signal-taking signature is not
(part of M4/M5 family), and the acceptance criterion at `plan.md:203` is not
observable on a synchronous function (M3).

## Findings

BLOCKERS: 0

MAJOR

M1 [design] Register census is internally contradictory and the plan pins one
reading while also asserting another. `worklist.md:585` (disposition census,
"re-derived 2026-11-14") says `Scheduled-roadmap 4`; `:588` says "Every
`Scheduled-roadmap` row names a live `ROADMAP.md` section (7 rows …)"; `:894`
(F-M1-2) says "… 170 `Resolved` / 93 `Closed-P3` / 13 `Scheduled-roadmap`".
`plan.md:83-85` adopts 4 and `:247-248` expects `Resolved 183 /
Scheduled-roadmap 0 / Closed-P3 93`, then `:249` says "all seven rows retired".
Step 5.3 also restricts the census rewrite to `:584-586`, leaving `:588`'s
Roadmap-mapping cell false once the section is deleted. **What must change:**
reconcile the three figures in the baseline (or record that `census.ts` is
authoritative and why), and extend Step 5.3 to rewrite the `:588` and `:894` cells
in the same commit.

M2 [design] An expected observable cannot be produced. `plan.md:249-250` says
"`npm run status` should then report 0 open roadmap items", but `ROADMAP.md`
keeps a second live item, § Calibration gold-set refresh (`ROADMAP.md:33-44`),
and Step 5.4 keeps it (`plan.md:249`). The baseline's "2 open roadmap items"
(`plan.md:77`) is consistent with two sections, so removing one leaves **1**.
**What must change:** expect 1, or scope the assertion to "no § Corroboration
section remains".

M3 [clarity] The benchmark test contract contradicts the target's signature.
`runBenchmark` is synchronous and returns `BenchmarkReport`
(`src/retrieval-benchmark.ts:108`), and is called synchronously from
`scripts/benchmark-retrieval.ts:59` and `src/retrieval-benchmark.test.ts:54,58,71`.
`plan.md:202-204` requires that
`runBenchmark(..., () => { throw new Error("boom") })` **rejects**. A synchronous
throw is `toThrow`, not `rejects`; taking "rejects" literally means making the
function async, which changes two callers the plan sizes as "S" (`plan.md:271-272`)
and does not list `scripts/benchmark-retrieval.ts` in the blast radius.
**What must change:** specify `expect(() => runBenchmark(...)).toThrow("boom")`,
or name the async conversion and its callers.

M4 [design] `rankedUrls`'s signature is unimplementable as written. Its third
parameter is already `reconcile: boolean` (`src/retrieval-benchmark.ts:99-100`).
`plan.md:198-201` says `rankedUrls` "gains a `reconcile` function parameter" and
`runBenchmark` gains `reconcile = reconcileResults`, without renaming the boolean
or specifying the identity function used for the raw comparison (`plan.md:115-116`
says "passing the identity path", but no such function exists at `:99-106`).
**What must change:** name the boolean's new name and the identity function (e.g.
`(results) => results.map((r) => r.url)`).

M5 [design] The amendment resolves REQ-026c but introduces an unamended
divergence from REQ-122. The bounded wave may skip a source
(`plan.md:212-218,226-227`), but REQ-122 requires a snapshot of **each** cited
source and bounds snapshots "per finding and per source" — not in time
(`infobroker.md:349`). D-122 (`plan.md:134`) records the tradeoff in
`DECISIONS.md`, which does not change the normative body. Reachable only with a
non-`off` content-policy assessor (`src/content-policy.ts:48,106`), but the plan's
own test asserts the skip path (`plan.md:226-227`). **What must change:** either
amend REQ-122 with the same "when the assessment completes within the budget"
qualifier, or record a named disposition for the resulting normative divergence.

M6 [clarity] The mechanical-limit certification is numerically wrong. The quoted
amendment (`plan.md:163-166`) keeps all five existing SHALL clauses
(`infobroker.md:325`) and adds "SHALL run concurrently with snapshot storage" —
**six**, not the "five `SHALL` clauses" claimed (`plan.md:139-141`). The same
sentence calls the current body "4 sentences" while claiming the result "stays …
three sentences"; the current body is three (`infobroker.md:325`). Six still fits
the ≤8 limit (`infobroker.md:1721`), so the body is compliant — but plan-review §6
requires the *post-edit* count, and the plan records only the pre-edit one.
**What must change:** state the post-edit counts (6 SHALL, 3 sentences, character
count) and drop the "4 sentences" figure.

M7 [design] The cross-namespace merge data structure is unspecified and its two
stated rules conflict. `plan.md:101-108` needs a title index that holds possibly
several works sharing a title (two DOI-bearing records, different years) plus a
year-guard search; a single `Map<title, CitationResult>` collapses them. It also
says a title-only reference "merges into the DOI-bearing representative" *and*
that "the representative stays the first citation in chain order" — contradictory
when the title-only record arrives first (which is the exact case `F-R5-E-2`
names). **What must change:** specify `Map<normalizedTitle, CitationResult[]>`
(or equivalent) and one representative rule that covers the title-first order.

M8 [clarity] Commit-series item 7 has no producing step. `plan.md:296-298` lists
`release: <version>` "handled by `npm run prep` version stamps and the CHANGELOG
entry", but Steps 1-6 end at `npm run session:close` (`plan.md:256-262`) and the
verification summary (`plan.md:311-317`) never runs `npm run prep` or
`npm run release`. AGENTS' ship path is prep → split commits → release. An
implementer cannot tell whether to produce commit 7 and publish or stop at local
commits. **What must change:** state that the increment stops at commit 6 (push is
a separate instruction), or add the prep/release step and its gate.

NIT

N1 [clarity] `plan.md:83` cites `worklist.md:584` for the disposition census; the
disposition census is at `:585` (`:584` is the severity census), and `:247` then
says to re-derive `:584-586`.

N2 [clarity] `plan.md:141-143` says REQ-026c's "existing clause tag
(`// @implements REQ-026c archive-opt-out`, `src/corroborate.test.ts:991`) stays
sufficient". The REQ already carries four tags — `preservation-gate` (`:965`),
`archive-opt-out` (`:991`), `archive-failure-tolerant` (`:1013`),
`archive-wave-budget` (`:1049`) — so the citation understates the existing
binding even though the conclusion is right.

N3 [clarity] `plan.md:47-48` says a throwing reconciler "can never trip the REQ-130
regression gate". The floor test compares the *reconciled* aggregate
(`src/retrieval-benchmark.test.ts:61-66`), which degrades to the raw metrics, so
the claim is plausible but unshown: nothing verifies that today's raw-order
metrics actually clear the recorded floor. The fix is right; the evidence is
asserted.

N4 [clarity] Step 0.3 (`plan.md:152-155`) ends "each must match the Baseline
section", but the baseline gives no expected `grep -c "F-R5-"` value, so that
probe has nothing to match against.

N5 [clarity] `plan.md:169` lists the Appendix B limits but omits "REQ contains
exactly one logical contract" (`infobroker.md:1722-1723`); the amendment adds a
concurrency SHALL beside the budget SHALL, which is the clause that rule tests.

## Unknowns

- U-1 `npm run status`'s roadmap-item counting was inferred from `ROADMAP.md`
  structure (two live `##` sections → one after removal), not executed.
- U-2 Whether `validate-spec` emits any warning for the amended REQ-026c. The
  detector (`src/clause-coverage.ts:19,23`) matches only `when … declares` and
  parenthesized `or` enumerations, so it should not — but the gate was not run.
- U-3 Whether `census.ts` counts 4 or 13 scheduled rows. The script prints and
  never asserts the scheduled set (`census.ts:6-7,42`), so only running it
  resolves M1.
- U-4 The 253-unpushed / version / tag baseline (`plan.md:76-79`) was not re-run.
- U-5 The plan's "`git status --short` → clean" (`plan.md:80`) is already stale:
  the evidence sidecar records the plan directory as untracked
  (`plan.evidence.json:6-8`). Harmless, since commit 6 adds it.
- U-6 Stage isolation: stages 1–5 were not separate fresh contexts (nesting
  prohibited in this dispatch); findings stand, but a Stage-3 lens could have been
  anchored by Stage 1's contradictions list.
- U-7 The injected `AGENTS.md` in this reviewer's context states a fatal G3
  clause-count rule, while `DECISIONS.md:21-39` (D-120) records clause-tag
  *binding* as report-only. I applied the detector source, not either prose
  summary; the parent should confirm which reading governs.

## Reads

34 read/grep calls of a 40 budget: plan.md; evidence.json; independent-review
reviewer-prompt.md; plan-review SKILL.md; plan-review/spec-project-checks.md;
src/cite.ts; src/cite.test.ts; src/retrieval-benchmark.ts;
src/retrieval-benchmark.test.ts; src/corroborate.ts (three ranges);
src/corroborate.test.ts (one range + grep); src/preservation.ts;
src/content-policy.ts (grep); src/config.ts; src/clause-coverage.ts;
src/retrieval-benchmark callers (grep); src/fetchSource (grep); infobroker.md
(four ranges + two greps); config.json (grep); config-tune.md; README.md;
ROADMAP.md (two ranges); DECISIONS.md (two ranges + grep); worklist.md (grep ×2 +
one range); census.ts; sha256sum.

```text
independent-review passed. plan.md — 0 blockers, 8 majors, 5 nits
Cold pass: stages 1,2,3,5 (Stage 4 not triggered) · reads 34/40
Target: plan.md · sha256 43813a84c766b9f5578d1186352bd596c8c5c39c442d41a7e5dc67e3ea5d3e21 · independence fresh (single-context stages; see U-6)
Blockers: 0 · Majors: 8 · Nits: 5
Comprehension: faithful-with-gaps
```
