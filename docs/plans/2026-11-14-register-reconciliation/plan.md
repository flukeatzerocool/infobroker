# Plan — Full-review register reconciliation and clause-tag binding

**Status:** plan-review passed (standard, cold pass) — conditions in `## Conditions` · **Date:** 2026-11-14
**Depth:** standard — a docs register, one gate module, the validator that calls it, and one response field; every change is reversible
**Review independence:** fresh — three cold passes (initial, diff re-review, user-authorized targeted) over the final artifact; report under `plan.cold/`
**Rollback cost:** 1 — a commit revert restores both the register and the gate
**Roadmap item:** `ROADMAP.md:17-23` § Full-review register reconciliation (retire on close)
**Predecessor:** `2a7c7a1`
**Findings:** `F-R5-C-5`, `F-M1-3`, and the open-row census recorded under `F-M1-2`

## Scope

The roadmap section carries three claims. Each is checked, not assumed.

1. **The disposition census is wrong on its face.** `worklist.md:585` records
   `Resolved 17, Scheduled-roadmap 161, Closed-P3 93, Deferred-R1 1` (272 rows).
   The file holds **276** distinct finding rows today, and a mechanical count
   reads `Resolved 167, Closed-P3 93, Scheduled-roadmap 16` with zero
   `Deferred-R1`. The recorded census was adjusted by deltas at each increment
   and never re-derived.
2. **`F-M1-3` is already resolved.** `worklist.md:895`'s disposition column
   reads `**Resolved 2026-11-10** — …`. The roadmap bullet saying it "still
   says `Scheduled-roadmap`" is stale. The row is verified and the bullet is
   retired.
3. **`F-R5-C-5` is not fixed the way the roadmap says.** The bullet cites
   `src/corroborate.ts:958` writing the tier; that write is at `:973` and sets
   `source.snapshot_tier` on the finding's source. The finding's predicate is
   narrower and still true: the `provenance.sources[]` projection
   (`src/corroborate.ts:909-919`) lists `content_sha256`, `snapshot_basis`,
   `snapshot_url`, `snapshot_truncated`, `source_family`, and `provider`, and
   omits `snapshot_tier`. REQ-122 (`infobroker.md:346`) requires the freshness
   tier be reported alongside the live URL, so this is fixed here.
4. **16 rows carry `Scheduled-roadmap` with no roadmap home** and must each be
   verified: retired as fixed, closed as a standing P3, or re-homed.
5. **`clauseTagsFromPayload` silently drops slugs and cannot bind a tag to a
   test.** `src/clause-coverage.ts:106-119` registers only the token immediately
   after a REQ ID. Five named tag lines write a run of slugs and lose 17 slugs
   without a word: `src/fetch-fallback.test.ts:1` (8 slugs, 7 lost),
   `src/structured-fact.test.ts:1` (4, 3 lost), `src/batch.test.ts:1` (6, 5
   lost), `src/lib/infobox.test.ts:1` (2, 1 lost), `src/error-envelope.test.ts:2`
   (2, 1 lost). The G3 gate then compares a name count against a branch count,
   so a tag on an unrelated test satisfies it.
6. **The reconciliation record is wrong in four places, not one.** Besides the
   disposition census (`worklist.md:585`), the same block records "272 register
   rows, 272 distinct IDs" (`:583`) against 276 rows; a roadmap-home census
   (`:588`) that the 16 re-dispositions invalidate; and `F-M1-2` (`:894`) still
   says "re-disposition deferred to a remediation pass". The roadmap's close
   condition is that the census and the live tree agree, so all four move.

Not in scope: fixing every open row (the close condition is that the census and
the tree agree, not that every row is resolved); the calibration gold-set
refresh (`ROADMAP.md:25-36`, a separate section); any change to confidence
math; the 236-commit unpushed backlog, which is a separate AAR trigger.

## Baseline (verified this session)

- `git log -1` → `2a7c7a1`; `npm run status` → 236 unpushed commits, oldest
  4.9 d, version `2026.11.11`, latest tag `v2026.11.07`, 2 open roadmap items,
  last pipeline run 2026-11-07.
- `npm run check` → **PASS**, full suite, 172.0 s, recorded for `2a7c7a1`. One
  pre-existing warning: `2026-11-10-r6-encryption-capacity-remediation: plan.md
  has no **Done bar:** line` (not this increment's file; left alone).
- **Interim gate state:** once this increment directory exists,
  `check-loop-artifacts` reports `missing tasks.md` and `missing aar.md` until
  both are written. `tasks.md` is created with the plan; `aar.md` is written at
  close. This is the same interim red the `2026-11-14-kb-migration-artifact-
  preservation` increment recorded, and it clears at step 13.
- The 4.9 d unpushed backlog is past AGENTS' 24 h AAR trigger. It is recorded
  here and handled at session close, not folded into this increment.

### Evidence read this session

| Claim | Evidence |
|---|---|
| The register holds 276 distinct rows | `python3` count of `^\| F-` lines in `docs/plans/2026-11-09-full-review-sweep/worklist.md`; 276 rows, 276 distinct IDs, every row 5 columns |
| Live dispositions are 167 / 93 / 16 / 0 | Same parse: `Resolved*` 167, `Closed-P3` 93, `Scheduled-roadmap` 16, `Deferred-*` 0 |
| The recorded reconciliation block is stale in four places | `worklist.md:583` (272 rows / 272 IDs), `:585` (17/161/93/1), `:588` (roadmap-home census), `:894` (`F-M1-2` "deferred to a remediation pass") |
| 16 rows still read `Scheduled-roadmap` | `worklist.md:696,710,711,712,717,724,729,742,753,763,764,765,767,776,777,783` → `F-R4-A-2, C-4, C-5, C-6, C-11, D-4, E-2`; `F-R5-A-3, B-6, C-4, C-5, C-6, C-8, E-1, E-2, F-1` |
| `provenance.sources[]` omits `snapshot_tier` | `src/corroborate.ts:909-919` projection vs `:973` `source.snapshot_tier = snap.snapshot_tier`; `src/index.ts:740` already reports it on the deep-reading path |
| REQ-122 requires the tier alongside the URL | `infobroker.md:346` |
| The clause-tag rule is a §9.4 prose bullet | `infobroker.md:1202-1205` — one pair per line, no run form |
| `clauseTagsFromPayload` consumes one slug per REQ | `src/clause-coverage.ts:106-119`; unit test `src/clause-coverage.test.ts:71-84` encodes it |
| A real tag line already loses slugs | `src/structured-fact.test.ts:1` — one REQ, four slugs, three unregistered |
| Named tags, and how many are file headers | 289 `@implements` tag lines under `src/**/*.test.ts`; 194 carry at least one slug (95 are bare citations or REQ-to-REQ pairs). Of the 194, 40 sit on line 1 and 89 on lines 1–5 |
| Exactly five named lines carry a slug run | Parse of all 194 slug-bearing lines: `src/fetch-fallback.test.ts:1` (8), `src/structured-fact.test.ts:1` (4), `src/batch.test.ts:1` (6), `src/lib/infobox.test.ts:1` (2), `src/error-envelope.test.ts:2` (2); 17 slugs unregistered in total |
| Every current run belongs to its immediately preceding REQ | `src/batch.test.ts:1`'s `content-mode`/`full-content-mode`/`match-*` match REQ-021b's own vocabulary (`infobroker.md:274`: extraction mode and the `match_quality` band strong/moderate/weak/none); `REQ-021` (`:268`) defines none of it. The other four runs name their preceding REQ's branches |
| `check-gate-coverage` already binds a REQ to a test file | `scripts/check-gate-coverage.ts:1-8` — file-level, no test-name binding; no existing check binds a tag to a test block |

## Decisions

**D1 — Verify before dispositioning; the roadmap's claims are evidence to
check, not facts.** Each of the 16 rows is resolved against the tree with a
`file:line` or a named test. A row is retired `Resolved` only when the
predicate is demonstrably false today, and the row body gains the proof.
`F-R5-C-5` shows why: the roadmap read a nearby write as the fix.

**D2 — The census is re-derived by a committed evidence script with a
self-check, not by hand.** `docs/plans/2026-11-14-register-reconciliation/
evidence/census.ts` parses the register and prints, deterministically: total
rows, distinct IDs, per-disposition counts, the `Scheduled-roadmap` IDs, and a
roadmap-home check (does the row's ID appear in `ROADMAP.md`?). Disposition is
the last cell's leading token with emphasis stripped, so `**Resolved 2026-11-14**
— …` counts as `Resolved`. The self-check pins only what dispositions cannot
change: **276 rows and 276 distinct IDs**. It does not bake the
`Scheduled-roadmap` ID set, because step 6 re-dispositions those rows and a
constant set would make the step-12 re-run exit 1 by construction; the set is
printed and diffed against the baseline recorded in `tasks.md`. Rejected: a
pinned scheduled-ID constant — it contradicts the work it is meant to verify.
The script is not wired into `npm run check` (the register is historical; a gate
would fail on every future row edit). Rejected: a hand count — that is how the
drift started.

**D3 — Survivors are re-homed under the roadmap admission rule, not dumped.**
Each open row takes one of four terminal dispositions in this increment: fixed
in-session (predicate demonstrably fixable within one file and one test);
`Resolved` with proof (already fixed); `Closed-P3` with a DECISIONS record when
the row is a standing limitation; or a grouped roadmap section. A roadmap
section carries 1–3 bullets and a `**Trigger:**` line (`npm run check-roadmap`
enforces both), so if more than three rows genuinely survive, they split into at
most two thematic sections — fetch/date/extraction and
corroboration/citations/benchmark — and the worklist rows name their section.
A row may not be retired merely because it is old.

**D4 — `clauseTagsFromPayload` consumes the whole slug run, and each tag binds
to a test.** After a `REQ-NNN` token, the parser registers every contiguous
non-REQ token as a slug for that REQ, so `REQ-021b a b c` registers three. All
five current runs belong to their immediately preceding REQ — `REQ-021b`'s own
body defines `content-mode`/`full-content-mode`/`match-*` (`infobroker.md:274`)
— so the widened parser binds them correctly and recovers 17 unregistered slugs.
The convention is stated: a slug run belongs to the REQ ID it follows. Rejected:
keeping the one-slug rule and repairing the five lines — it leaves the parser
unable to read a form authors already write, so the next author repeats the
defect silently. Rejected: accepting runs without stating the ownership rule —
a future line could append a run to a REQ that does not own it, with no
detection.

The same resolver binds each tag line to a test context: the following
`it(`/`test(` block for a standalone comment, the enclosing block when the
comment sits inside one, and file scope when the tag precedes every test. A tag
counts toward the G3 requirement only when its slug, hyphen-to-space
normalized, appears in the title of at least one bound test. Rejected: a hard
"tag must sit inside an `it` block" rule (40 of 194 slug-bearing tags are file
headers and would all fail); rejected: a new `:: test-name` syntax (rewrites
194 tag lines for no extra guarantee).

**D5 — The binding rule is measured before it is made fatal.** The heuristic's
false-positive rate is unknown, so step 10 runs the resolver in report mode over
every named tag and classifies each unbound tag as a real gap (the test does not
name the branch) or a benign mismatch (synonym or paraphrase). The denominator
is **distinct `(REQ, slug)` pairs** across all named tag lines; the report also
prints the line-level and file-level counts so the rate is reproducible. If
benign-unbound pairs exceed 10% of pairs, the binding dimension ships
report-only; the parser fix (D4) ships fatal regardless, because it can only
add slugs and cannot fail a REQ. The decision records the measured rate and the
denominator used. This is the §2 heuristic false-positive budget, applied rather
than assumed.

**D6 — The §9.4 bullet states the run form and the binding; no REQ body
changes.** `infobroker.md:1202-1205` gains one clause: a run of slugs after a
REQ ID belongs to that REQ, and (if D5 makes it fatal) a tag must sit on a test
that names the branch. That bullet is validator prose, not a REQ body, so
Appendix B's 800-character limit does not apply; `validate-spec` must still
pass. `REQ-055` is untouched — it already defines bidirectional
citation and does not define clause tags.

**D7 — Every register cross-reference moves in the same commit.** The four
stale sites in the reconciliation block (`worklist.md:583`, `:585`, `:588`,
`:894`), the `ROADMAP.md` section, and any `DECISIONS.md` records change
together; `worklist.md` is a register, and `check-roadmap` plus
`validate-spec` read it. A split commit that lands the roadmap retirement
without the row dispositions would leave the register citing a section that no
longer exists, and a census line that still says 272 rows would contradict the
276 it sits above.

## Blast radius

| Path | Change | Size |
|---|---|---|
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | Four reconciliation-block sites (`:583`, `:585`, `:588`, `:894`) re-derived; up to 16 row dispositions updated with proof | M |
| `docs/plans/2026-11-14-register-reconciliation/evidence/census.ts` | New deterministic census script with a literal self-check | S |
| `docs/plans/2026-11-14-register-reconciliation/{tasks,aar}.md` | Task log (with both baselines and the pinned post-change counts) and AAR | S |
| `src/clause-coverage.ts` | Slug-run consumption; exported test-context resolver if the binding lives here | S |
| `src/clause-coverage.test.ts` | Slug-run test (`REQ-021b a b c`), file-scope and block-scope binding tests | S |
| `scripts/validate-spec.ts` | Apply the binding rule; report mode | M |
| `src/corroborate.ts` | `snapshot_tier` added to the provenance projection | S |
| `src/corroborate.test.ts` | Assert the tier appears in `provenance.sources[]` | S |
| `infobroker.md` | One §9.4 clause: the run form, and the binding if D5 makes it fatal | S |
| `ROADMAP.md` | Section retired or narrowed to survivors | S |
| `DECISIONS.md` | One record for the new standing dispositions and the D5 measurement | S |
| `CHANGELOG.md` | One entry | S |
| Not touched | `src/preservation.ts`, `src/deep-search.ts`, `src/index.ts`, any REQ body, any tag line (no repair is needed under D4) | — |

## Steps

1. **Baseline** — recorded above; no action.
2. **Two baselines, recorded in `tasks.md`** — (a) write and run
   `evidence/census.ts`; it must self-check 276 rows / 276 distinct IDs, and
   print the disposition counts and the `Scheduled-roadmap` IDs, which are
   compared by hand against the 16 IDs in the evidence table. (b) capture the
   per-REQ distinct-slug counts with an independent `python3` parse over
   `src/**/*.test.ts` (one line `REQ<TAB>count<TAB>slugs`), so step 9's
   before/after comparison has a recorded pre-change number.
3. **Row verification, batch 1 (R4: A-2, C-4, C-5, C-6, C-11, D-4, E-2)** — for
   each row read only the predicate's cited lines plus the nearest test; record
   fixed / open / standing with `file:line`. Budget one probe per row beyond the
   cited range.
4. **Row verification, batch 2 (R5: A-3, B-6, C-4, C-5, C-6, C-8, E-1, E-2,
   F-1)** — same protocol. `F-R5-C-5` is already decided (fix).
5. **Fix `F-R5-C-5`** — add `snapshot_tier: s.snapshot_tier` to the provenance
   projection; assert it in the REQ-122 test that already mocks `snapshotSource`
   with `snapshot_tier: "evergreen"`. Verify the assertion fails with the field
   removed from the projection.
6. **Dispositions** — write each of the 16 rows' terminal disposition with its
   evidence. Any row fixed beyond C-5 gets its own test in the same commit.
7. **Re-home survivors** — grouped roadmap section(s) per D3, or one
   `DECISIONS.md` record per standing limitation.
8. **Parser fix** — register the full slug run in `clauseTagsFromPayload`; add
   the `src/batch.test.ts:1` shape as a unit case asserting `REQ-021b` receives
   all six slugs. Verify by reverting the loop change: the new case fails, and
   the step-2b parse shows 17 fewer slug instances.
9. **Independent post-change counts** — re-run the *same* step-2b `python3`
   parse and place its output beside the pre-change table in `tasks.md`. That
   two-column table is the comparator for done bar 6; `validate-spec` prints
   tags only for a violating REQ, so it cannot serve as one.
10. **Binding dry run** — implement the test-context resolver in report mode,
    run it over the 194 slug-bearing tag lines, classify every unbound tag as a
    real gap or a benign mismatch, and record the pair-level rate and examples
    in `tasks.md`.
11. **Binding decision** — per D5, make it fatal and update
    `infobroker.md:1202-1205`, or keep it report-only and record why. Either
    way, add the resolver's unit tests (file header, comment above a block,
    comment inside a block, unbound slug).
12. **Re-derive and record** — re-run the census script, rewrite the four
    reconciliation-block sites (`:583`, `:585`, `:588`, `:894`) with the new
    numbers and the command, retire the roadmap section, add the CHANGELOG
    entry.
13. **Close** — `npm run validate-spec`, `npm run check-roadmap`,
    `npm run check-non-goals`, `npm run check:fast`, then write `aar.md`.

## Done bar

**Done bar:** All of the following hold on the final tree:

1. `evidence/census.ts` self-checks 276 rows and 276 distinct IDs, exits 0
   before and after the dispositions, and its printed counts equal the counts
   pinned in `tasks.md` from the independent `python3` parse — not only its own
   recomputation. The `Scheduled-roadmap` ID set it prints before the change
   matches the 16 recorded in the task log, and after the change matches the
   terminal dispositions recorded there.
2. All four reconciliation-block sites agree with the live register: row and
   distinct-ID totals, disposition counts, the roadmap-home census, and
   `F-M1-2`'s disposition text. No site still says "272 rows", "161 scheduled",
   or "deferred to a remediation pass".
3. Each of the 16 `Scheduled-roadmap` rows is either `Resolved` with a cited
   proof, `Closed-P3` with a DECISIONS citation, or named in a roadmap section
   whose trigger a maintainer can act on.
4. `F-M1-3`'s roadmap bullet is gone; the row keeps its `Resolved` disposition.
5. `snapshot_tier` appears in `verify_claims` `provenance.sources[]`;
   `src/corroborate.test.ts` asserts it, and the assertion fails when the field
   is removed from the projection.
6. `clauseTagsFromPayload` registers every slug in a run; the
   `REQ-021b`/six-slug case passes, the existing single-slug and bare-ID cases
   still pass, and the step-9 two-column table shows no per-REQ count below its
   **pre-change** value with 17 more slug instances in total.
7. The binding rule either fails a test that tags a branch on a test whose title
   does not name it, or is report-only with a recorded pair-level
   false-positive rate; the choice and evidence are in `tasks.md`.
8. If binding is fatal, the validator reports the offending `file:line`, and
   `infobroker.md:1202-1205` states both the run form and the binding without
   changing any REQ body.
9. `ROADMAP.md` no longer carries the reconciliation section (or carries only
   surviving items with triggers); `npm run check-roadmap` passes.
10. `DECISIONS.md` records each new standing disposition and, if applicable, the
    D5 measurement; `npm run check-non-goals` passes.
11. `npm run validate-spec` and `npm run check:fast` exit 0 on the final tree.
12. `docs/plans/2026-11-14-register-reconciliation/` carries `plan.md`,
    `tasks.md`, `evidence/census.ts`, and an `aar.md` ending `LOOP PAUSED` or
    `LOOP OPEN`.

**Review cap:** 2 passes (the plan gate, and the post-build AAR review). A
third dispatch needs user authorization recorded in the AAR.

## Conditions

- **C-1** — a row is never retired on the roadmap's say-so. Only a `file:line`
  or a named test retires it; a row whose predicate cannot be decided in two
  probes is re-homed, not guessed.
- **C-2** — if fixing a surviving row would change response shape beyond adding
  an optional field, it is re-homed instead of fixed; only `F-R5-C-5` is
  pre-authorized as an in-session fix.
- **C-3** — the binding rule is never made fatal while its benign-unbound
  **pair** rate is above 10%; the report-only fallback is the expected outcome,
  not a failure. The parser fix is independent of this and always lands.
- **C-4** — the census script reads the register and prints; it never edits it,
  so a wrong parse is visible in review before a disposition moves.
- **C-5** — `npm run check` (full) is the pre-push gate; if the registry-backed
  audit cannot run, `check:fast` is the terminal gate and the AAR says so.
- **C-6** — while the increment is open, `check-loop-artifacts` stays red on
  the missing `aar.md`. That is expected and is not repaired by writing a
  synthetic AAR; the bar is satisfied only by the real one at step 13.
