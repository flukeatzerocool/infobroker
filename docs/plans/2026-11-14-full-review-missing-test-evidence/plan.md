# Plan — Close the full-review register's pure evidence rows

**Status:** revision 2 — cold pass ran and returned FAILED with 7 Majors, 0 Blockers; every Major and Nit is applied below · **Date:** 2026-11-14
**Depth:** standard — test-only edits across nineteen test files plus one new handler suite; no production source is expected to change
**Review independence:** fresh — cold pass report at `plan.cold/report.md` (21/40 reads); revision 2 is not independently re-read (a standard-depth run gets one cold pass; findings applied, residual recorded in the AAR)
**Rollback cost:** 1 — every change is an added assertion or a named `@implements` tag; a commit revert loses only coverage
**Roadmap item:** `ROADMAP.md:17-22` § Missing test evidence across R4–R6 (retire on close)
**Predecessor:** `e916ef4` (KB migration artifact preservation, `LOOP PAUSED`)

## Scope

The register rows whose predicate is "the behavior exists but nothing asserts
it" — a missing driving test or a missing named clause tag, not a claimed
behavior defect. Each row is closed by adding a test (or a named tag bound to a
test that drives the branch) to a named test file, then updating the row's
disposition to `Resolved` with the file and line that prove it.

Not in scope: any row whose predicate claims the code does the wrong thing
(those are behavior increments), the two rows the register-reconciliation
section owns, and any production-code change discovered mid-increment — a
discovered defect is recorded and the row moves to a follow-on, per the
narrowing rule.

## Why this item

`ROADMAP.md:17` is the first section in file order, and file order selects it.
Its trigger ("start with a regression that a missing test would have caught, or
the next increment in the same module") is satisfied by adjacency: the
2026-11-14 fetch/KB resource-bounds increment closed the last R4/R6 behavior
rows in the same modules.

## Census (derived this session)

Rule: a register row is pure evidence when its predicate reads as a coverage
gap — "no driving test", "untested", "no positive test", "static-only",
"never exercised", "no end-to-end assertion", "carry no named clause tag" — and
names no behavioral deviation. `docs/plans/2026-11-09-full-review-sweep/worklist.md`
yields **22 rows** (R4 6, R5 13, R6 3). The roadmap headline says twenty
(6 / 12 / 2); the census below is the authority and the section text is
corrected in the same increment.

| # | Row (worklist line) | What is missing | Test home |
|---|---|---|---|
| 1 | `F-R4-A-3` (`:697`) | Hop cap has no end-to-end assertion; the only pass is a literal | `src/fetch-page-extraction.test.ts` (spawned server; drives `config.output.max_redirect_hops`) |
| 2 | `F-R4-B-3` (`:702`) | REQ-021f "continue to the next renderer" has no driving test | `src/fetch-page-extraction.test.ts` — two renderers over loopback. **Feasibility risk:** `jina` and the free_http renderers hardcode their base URLs (`src/providers/jina.ts:7`), so a second pullable renderer may not be expressible hermetically; if not, the row is `blocked` (C-2), never approximated |
| 3 | `F-R4-C-3` (`:709`) | REQ-021d page-cap, depth-cap, per-hop-guard clauses have no driving test | page-cap: `src/fetch-page-extraction.test.ts:290` (existing `crawl attempt cap`); depth-cap and per-hop-guard: a crawl driving test in the same file |
| 4 | `F-R4-C-10` (`:716`) | REQ-021d/021e/021g tests carry bare tags, no named clause tag | `src/extract.test.ts`, `src/fetch-cache.test.ts` |
| 5 | `F-R4-E-3` (`:730`) | REQ-021i status branches (resolved, not found, ambiguous, unavailable) carry no named tags; the detector reads one slug per line | `src/structured-fact.test.ts` |
| 6 | `F-R4-F-2` (`:735`) | Tool surface never asserts the REQ-021 parameter set, defaults, or array cap | `src/tool-surface.test.ts` |
| 7 | `F-R5-A-4` (`:743`) | REQ-026g dual-input rejection, empty-list rejection, and `max_batch_claims` bound untested | **new** `src/verify-claims-bounds.test.ts` (spawned server; no existing src handler suite drives `infobroker_verify_claims`) |
| 8 | `F-R5-A-5` (`:744`) | Agreement-map green/yellow classification has no positive test | `src/corroborate.test.ts` (through `reconcileClaims`, the only exported carrier) |
| 9 | `F-R5-B-3` (`:750`) | REQ-123 disableability unasserted end to end | `src/calibration.test.ts` |
| 10 | `F-R5-B-4` (`:751`) | REQ-121 `family_count` never asserted on a finding | `src/corroborate.test.ts` |
| 11 | `F-R5-B-5` (`:752`) | Authority weights and calibration options never exercised through `reconcileClaims` | `src/corroborate.test.ts` |
| 12 | `F-R5-B-10` (`:757`) | `family_similarity_threshold` configurability unproven (only 0.9) | `src/source-family.test.ts` |
| 13 | `F-R5-C-7` (`:766`) | REQ-122 document-vs-snippet and truncated-copy branches carry no named tags | `src/preservation.test.ts` |
| 14 | `F-R5-D-4` (`:772`) | KB result cap unasserted | `src/corroborate.test.ts` |
| 15 | `F-R5-D-5` (`:773`) | KB source-URL propagation asserted by count, not value | `src/corroborate.test.ts` |
| 16 | `F-R5-D-6` (`:774`) | Recall-before-external-search ordering unasserted | `src/corroborate.test.ts` |
| 17 | `F-R5-D-7` (`:775`) | Failing-KB `catch` never exercised (`src/corroborate.ts:701` today) | `src/corroborate.test.ts` |
| 18 | `F-R5-E-4` (`:779`) | REQ-027a zero-result and all-exhausted branches carry no named tags | `src/cite.test.ts` |
| 19 | `F-R5-F-2` (`:784`) | Regression floor compares four aggregates; `baseline.raw`, `cases`, `version`, `k` unchecked | `src/retrieval-benchmark.test.ts` |
| 20 | `F-R6-C-3` (`:813`) | REQ-075 decay reduction, zero-decay exemption, freshness ordering unasserted | `src/kb.test.ts` |
| 21 | `F-R6-D-3` (`:820`) | Lock refusal, `stats.encryption`, locked reachability, key-source precedence are code-reading only | `src/kb-encryption-tools.test.ts` (encryption ops), `src/kb-claims.test.ts` (locked-store read), `src/kb-action-evidence.test.ts` (stats) |
| 22 | `F-R6-E-3` (`:823`) | REQ-108 clause (a) has no gate-asserted test; `test-isolation.test.ts` tag is a false citation | `src/kb-sqlite.test.ts`; remove the false tag |

## Measured state (this session, before any edit)

- `git log -1` → `e916ef4`; working tree clean; version `2026.11.11`, latest tag
  `v2026.11.07`; 217 unpushed commits, oldest 4.7 d.
- `npm run status` → 3 open roadmap items; the 4.7 d backlog is past the 24 h
  AAR trigger and is handled at session close.
- Baseline `npm run check` at `e916ef4` (run while this directory already
  existed): 21 of 22 gates passed. The only failure was `check-loop-artifacts`
  — `missing aar.md` for this directory — which is expected mid-increment and
  is the same signal the 2026-11-14 KB migration plan recorded. The manifest
  stops at the first failure, so `typecheck:scripts` (last in the manifest) was
  run separately and passed. One pre-existing warning stands:
  `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`.
- Row text and line numbers above are read from
  `docs/plans/2026-11-09-full-review-sweep/worklist.md` this session; several
  rows' cited source lines have drifted (F-R5-D-7's `catch` is now at
  `src/corroborate.ts:701`), which is why step 0 re-locates every anchor before
  a test is written.

## Decisions

**D1 — The census, not the headline, sets the scope.** The roadmap's
"six / twelve / two" is a hand count from the 2026-11-13 mining pass. The rule
above yields 6 / 13 / 3. Closing 22 rows and correcting the section text is
cheaper than arguing the delta, and the done bar is stated row by row.

**D2 — Step 0 re-verifies every row before it is written.** A row that no
longer holds (behavior already asserted, or the gap silently fixed by an
earlier increment) is marked `Resolved` with the existing test as its evidence
and no new code. A row whose gap is actually a behavior defect stops and moves
to a follow-on increment; its test is never written to encode a bug. A row that
cannot be driven without a production seam is marked `blocked` and named in the
AAR; blocked rows do not fail the increment (done bar 7).

**D3 — Clause tags are one slug per tag line, bound to a driving test.** The
tag gate (`scripts/validate-spec.ts:328-368`) counts unique slugs per REQ and
cannot tell whether the tagged file drives the branch. So a tag row closes only
when the tag sits on a file whose tests exercise that branch, and the file's
own driving test is named in the register note. `clauseTagsFromPayload`
(`src/clause-coverage.ts:104-118`) registers only the token after the REQ ID, so
each branch gets its own `// @implements REQ-NNN <branch-slug>` line. The
detector limitation is scheduled, not dropped: step 8.2 adds one bullet to the
`ROADMAP.md` § Full-review register reconciliation section.

**D4 — No production source changes in this increment.** Every committed
change lands in a `*.test.ts` file plus the tracker. Source edits exist only as
the temporary mutations D5 requires; each is applied, run, reverted, and never
staged.

**D5 — The mutation proof is per assertion, not per file.** Each new assertion
is shown to fail under a recorded source mutation (the branch removed, the cap
ignored, the ordering reversed) and pass on the restored tree. A test that
passes both ways closes nothing. Tag-only rows are proved differently: the tag
names a branch that an existing driving test exercises, and that test's own
mutation record (or the one added in this increment) is the proof.

## Batching (commit series, per the roadmap's "batch by module")

| Commit | Rows | Files |
|---|---|---|
| C1 `test(fetch):` | 1, 3, 4 | `fetch-page-extraction.test.ts`, `extract.test.ts`, `fetch-cache.test.ts` |
| C2 `test(structured):` | 5–6 | `structured-fact.test.ts`, `tool-surface.test.ts` |
| C3 `test(corroborate):` | 8, 10–12 | `corroborate.test.ts`, `source-family.test.ts` |
| C4 `test(verify):` | 7, 14–17 | `verify-claims-bounds.test.ts` (new), `corroborate.test.ts` |
| C5 `test(evidence):` | 9, 13, 18 | `calibration.test.ts`, `preservation.test.ts`, `cite.test.ts` |
| C6 `test(benchmark):` | 19 | `retrieval-benchmark.test.ts` |
| C7 `test(kb):` | 20–22 | `kb.test.ts`, `kb-encryption-tools.test.ts`, `kb-claims.test.ts`, `kb-action-evidence.test.ts`, `kb-sqlite.test.ts`, `test-isolation.test.ts` |
| C8 `docs(tracker):` | all | `worklist.md` dispositions, `ROADMAP.md`, `CHANGELOG.md` |

Row 2 belongs to C1 when it is drivable; if it is `blocked` it is named in the
AAR and in the roadmap residual. Each commit is `npm run typecheck`-verified;
C8 lands last.

## Blast radius

- Test files listed in the census (assertions and `@implements` tags only).
- `src/verify-claims-bounds.test.ts` — new handler-level suite.
- `docs/plans/2026-11-09-full-review-sweep/worklist.md` — dispositions and
  any REQ evidence row the sweep record carries for the same REQ.
- `ROADMAP.md` — the section retired on close (or amended to the residual) and
  one bullet added to the reconciliation section (D3).
- `CHANGELOG.md` — one entry.
- Not touched: `src/**` non-test production code, `config.json`,
  `infobroker.md`, `DECISIONS.md`.

**Done bar:** All of the following hold on the final tree:

1. Step 0's census table is recorded in `tasks.md` with a verdict per row
   (still-open / already-closed / behavior-defect / blocked).
2. Every row whose verdict is `still-open` has a driving assertion or a named
   clause tag bound to a driving test, and its `worklist.md` disposition reads
   `Resolved` with the test file and line. `blocked` and `behavior-defect` rows
   stay `Scheduled-roadmap` with a dated note naming the blocker.
3. Every new assertion fails under a recorded source mutation and passes on the
   restored tree (D5), and every tag names a branch an existing driving test
   exercises; the mutation list is in `tasks.md`.
4. `npm run validate-spec` exits 0, including the G3 clause-count rule for
   every REQ touched (REQ-021, REQ-021a, REQ-021d/e/f/g/i, REQ-026g, REQ-027a,
   REQ-075, REQ-108, REQ-121/122/123).
5. `npm run check-gate-coverage` reports no new uncovered REQ.
6. `npm run check:fast` exits 0 on the final tree; `aar.md` carries a
   line-initial `**Review cap:** 2; used <n> passes` line and a terminal
   `LOOP PAUSED` or `LOOP OPEN` token, or `check-loop-artifacts` fails.
7. `ROADMAP.md`: the section is retired when no row survives, otherwise it
   carries only the blocked/residual rows with corrected counts; `CHANGELOG.md`
   gains one entry; the reconciliation section gains the D3 bullet.
8. `docs/plans/2026-11-14-full-review-missing-test-evidence/` carries `plan.md`,
   `tasks.md`, `plan.cold/report.md`, and an `aar.md`.

**Review cap:** 2 passes (plan gate, post-build AAR review). A third dispatch
needs user authorization recorded in the AAR.

## Conditions

- **C-1** — an assertion that fails on the unmodified tree is a discovered
  defect: stop, record it, and let the row move to a follow-on. Never weaken
  the assertion to green.
- **C-2** — if a row needs a production-code change to be testable (a seam, an
  export, an injected clock), the row is blocked and reported; adding the seam
  is its own increment. Row 2 is the expected case.
- **C-3** — `npm run check` (full) is the pre-push gate; if the registry-backed
  `audit` cannot run, `check:fast` plus `test-debate-club` are the terminal
  gates and the AAR says so.
- **C-4** — the cold pass returned FAILED with Majors and no Blockers; its
  findings are applied in this revision and the residual (no second cold pass)
  is recorded in the AAR. A re-review is only a diff pass over revision 2 if a
  reviewer is dispatched.
