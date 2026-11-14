# Plan — Close `F-R6-E-3`: a gate-asserted heap-bounded retrieval test (REQ-108 clause (a))

**Status:** revision 3 — self pass and cold pass complete; every finding and the
three re-review nits applied
**Date:** 2026-11-14
**Depth:** standard — one new spawned-child test file, one throwaway probe, three tracker edits; no production source change is expected
**Review independence:** fresh — cold pass at `/tmp/opencode/kb-heap-cold/report.md` (1 Blocker, 4 Majors, 6 Nits; all applied), diff re-review returned `independent-review passed.` with 3 nits, also applied
**Rollback cost:** 1 — every committed change is an added test file or a tracker disposition; a revert loses only coverage
**Roadmap item:** `ROADMAP.md:17-29` § Missing test evidence across R4–R6 (its only open row)
**Predecessor:** `da31c3c` (`docs(plans): record the hermetic fetch seams increment`)

## Scope

`F-R6-E-3` is the last open evidence row. REQ-108 clause (a) is the sentence
"retrieval and inspection operations SHALL return complete results under a heap
smaller than the stored chunk data" (`infobroker.md:625`), and no gate-asserted
test proves it. The 2026-11-14 probe blocked the row on
two measurements — a payload build that missed its 20 s budget and a read path
that was not deterministic (one `get` died at 48 MB; one sequential cycle hung).

In scope: (1) diagnose both blockers to a named cause, (2) build a deterministic
payload cheaply, (3) land a committed test that runs the real server at a fixed
reduced heap over a store larger than that heap, (4) retire the roadmap section.

Not in scope: any production change; the register-reconciliation section; the
calibration gold set; the `withServer` deduplication (still a recorded follow-up).

## Measured state (this session, before any edit)

- `git log -1` → `da31c3c`; version `2026.11.11`; latest tag `v2026.11.07`;
  232 unpushed commits, oldest 4.8 d (a session-close concern, not this increment).
- `npm run status` → 3 open roadmap items; last pipeline run 2026-11-07.
- `ROADMAP.md:19-29` carries the prior measurements: boot floor `H0 = 48 MB`
  (32 MB aborts with a V8 heap trace), payloads 99.0–128.8 MB built in
  16.9–24.5 s through `kbIngest`, reads at 48 MB passing 5 of 6 attempts, one
  repeated cycle hanging past 15 min.
- `worklist.md:823` (`F-R6-E-3`) records the same numbers and the removed false
  `REQ-108` tag from `src/test-isolation.test.ts`.

Repo facts the plan depends on (all read this session):

| Claim | Evidence |
|---|---|
| Reads stream; the store never materializes all chunk rows | `src/kb-sqlite.ts:488-497` (`iterateChunks` yields per row), `:499-517` (`iterateChunksByIds`, batches of 400) |
| `stats`, `list`, `get` iterate the store rather than loading it | `src/kb.ts:807-819`, `:843-868`, `:870-890` |
| `search`'s **first** call builds the prefilter and collects from a full scan; only a **later** call in the same process reads by id | `src/kb.ts:612-618` (build branch), `:621-623` (by-id branch); `src/kb-prefilter.ts:141` returns `null` (full scan) when the candidate set is not a strict subset |
| **The probe's build cost was ingest, not storage**: `sqliteIngest` scans every stored chunk once per ingested document to resolve dedup identity | `resolveMeaningIdentity` defined `src/kb.ts:669`, full scan `:684`; ingest call site `:732`, per-document loop `:744` |
| A test can seed the store directly, deterministically, with no embedding model and no ingest | `SqliteStore.insertChunks` `src/kb-sqlite.ts:526-531`, `close()` `:472-476`; precedent `src/kb-sqlite.test.ts:139-161` |
| Chunk vectors are 4096-wide, so synthetic vectors are cheap to build | `src/embed.ts:160,181`; payload encode is plain JSON, no compression `src/kb-sqlite.ts:458-461` |
| Probe 6's hang is a harness defect, not a KB hang | `/tmp/opencode/kb-heap-probe6.mts:107-108` — `await once(child, "exit")` is attached **after** `SIGKILL`; if the child already exited, the promise never settles |
| Timeouts are 30 s test / 30 s hook; a heavier test must override both | `vitest.config.ts:9-10` |
| The spawned-server pattern and isolation helper exist | `src/structured-output.test.ts:218-264`; `src/lib/test-isolation.ts:23-45` (rewrites only the `kb` block) |
| Prior throwaway probes are still on disk for re-reading | `/tmp/opencode/kb-heap-probe2.mts` … `/tmp/opencode/kb-heap-probe6.mts` |

## Decisions

**D1 — Diagnose before building anything.** Two questions stay open from the prior
increment and both change the test's design: why one `get` died at 48 MB in six
attempts, and whether the 15-minute hang was real. The probe-6 hang is already
explained by the `once(child, "exit")` race (`:107-108`), so step 1 only has to
confirm it once and then measure the read path with the race fixed. The crash is
diagnosed by repetition, not by theory: 20 `get` children at the chosen heap over
the new payload, stderr captured. Zero failures ⇒ the read path is stable and the
row proceeds. A failure whose trace shows heap exhaustion inside a read ⇒
**stop**: that is a REQ-108 clause (a) defect, it is reported as P0, and its fix
is its own increment (D7). A failure traced to the payload builder or to the
parent harness ⇒ fix the harness and re-run.

**D2 — Seed the payload through `SqliteStore.insertChunks`, never `kbIngest`.**
*Assumption — confirmed by step 1.2 before anything is built:* ingest cost is
dominated by the per-document dedup scan (`resolveMeaningIdentity`,
`src/kb.ts:669`, full scan `:684`, called at `:732`), which is quadratic in store
size, and by embedding every chunk. Direct insertion writes
exactly the rows the read path must handle, in one transaction, with no model and
no dedup — deterministic and one to two orders of magnitude cheaper. This is a
test seeding choice, not a production seam: `insertChunks` is already on the
`KbStore` interface and already used by a test.

**D3 — The heap is the measured boot floor plus margin, and the payload is twice
it.** The prior probe used the absolute floor (48 MB), leaving almost no headroom
for a single transient, which is the most plausible reading of the one crash. The
suite uses one constant, `HEAP_MB = 64` (floor 48 + 16), with
`HEAP_BYTES = HEAP_MB * 1024 * 1024`, and requires the physical payload to exceed
`2 × HEAP_BYTES`; the assertion runs before any spawn so a shrunken payload cannot
pass silently. The child is spawned with
`NODE_OPTIONS=--max-old-space-size=${HEAP_MB}`; a child that cannot boot at 64 MB
fails the test loudly rather than being retried at a larger heap, because a rising
floor is a real capacity signal.

**D4 — One fresh child per action, plus one sequential child.** Four children
(`search`, `list`, `get`, `stats`) each open the store cold, so one action's
transient cannot be masked by another's warmed heap, and a crash names its
action. A fifth child issues all four in sequence to cover the repeated-cycle
claim that hung in probe 6. Every child is killed and awaited with an
exit-code-or-event race (`child.exitCode !== null` before subscribing), never a
bare `once(child, "exit")`.

**D5 — Chunk sizing keeps every transient well under the heap, and the count is
derived from D3.** Text is emitted from a seeded LCG over a fixed token alphabet
so the payload is incompressible and byte-stable. Chunk text is 512 KB
(`CHUNK_BYTES`), so the required count is
`chunks = ceil(2 × HEAP_BYTES / CHUNK_BYTES) + 32` margin = **288 chunks**
(144 MiB of text), grouped 2–4 chunks per document into ~96 documents. Each chunk
carries a 4096-wide sparse vector, whose JSON is ~8 KB — negligible against
512 KB of text. No single decode, join, or JSON-RPC result approaches 64 MB, so a
failure can only come from accumulation, which is exactly clause (a).

**D6 — Both search paths are exercised, and the query text is derived, not
invented.** With a lexical model, a cold child's first `search` builds the
prefilter *and* collects from a full scan (`src/kb.ts:612-618`); the by-id branch
(`:621-623`) runs only once a prefilter exists. Two facts follow. First, a seed
that puts the query bucket on every chunk makes `src/kb-prefilter.ts:141` return
`null` (full scan) forever, so the by-id path would never run. Second, one
`tools/call` per child would only ever test the build path. Therefore: the parent
computes the query embedding with the real model
(`createModel("signed-hash-tfidf")`), seeds **half** the chunks with a nonzero at
the query's first nonzero bucket plus a document-specific bucket (the other half
get their own buckets), and the `search` child issues **two** searches with the
same query — the first covers build-then-full-scan, the second covers the bounded
`iterateChunksByIds` read. The query string is derived from the payload
generator: the parent takes the two leading tokens of document 1 (recorded in the
seed) and joins them with a space, so the tokens provably exist in the store.
Both searches must return the documented hit from a seeded document; the
query-bucket half explicitly includes the chunks of document 1, so the by-id call
must return that document's hit rather than merely some hit.

**D7 — Test-only; a discovered defect stops the increment.** No production file is
edited for gain. If step 1 or the suite shows the code failing clause (a), the row
becomes a defect item on `ROADMAP.md` with the trace, the test is not landed, and
the AAR records `LOOP OPEN`. Never weaken an assertion to green (C-1).

**D8 — The suite must fit the gate budget.** Target: ≤ 30 s wall added to
`npm test`, measured from three consecutive runs in step 3, with the parent build
and the five children broken out. If the first honest measurement exceeds 60 s,
the fallback is the module-level child (import `src/kb.ts`, call the same four
functions) recorded as a decision, not a silent trade — smaller floor, smaller
payload, same clause.

## Steps

### Step 0 — Baseline and increment record

- 0.1 `npm run check:fast` on the unchanged tree; record it as the increment
  baseline. A red gate stops the increment and is fixed as its own commit.
- 0.2 On approval, create `docs/plans/2026-11-14-kb-heap-bounded-retrieval/` with
  this plan as `plan.md` and a `tasks.md` seeded with these steps, the measured
  state table, and the D1 decision rule. `check-loop-artifacts` is expected red
  from 0.2 until 5.4 lands `aar.md`; note that in `tasks.md`.
- 0.3 Confirm the target file does not exist and the prior probe scripts are
  readable (`kb-heap-probe2.mts` … `kb-heap-probe6.mts` under `$TMPDIR`).

### Step 1 — Diagnosis probe (throwaway, `$TMPDIR/kb-heap-probe7.mts`)

One script, one run, all four measurements — the prior increment needed six
variants because the probe was under-specified; this one is specified to prevent
that. It is not committed; its source and output are pasted into `tasks.md`.

- 1.1 Re-run probe 6's failing shape with the exit race fixed
  (`if (child.exitCode === null) await once(child, "exit")`), eight children,
  and record wall time per child. Expected: no hang. If it hangs with the race
  fixed, capture the last action and stop — that is a real stall.
- 1.2 Build the D2/D5 payload once: direct `insertChunks` into a temp store,
  512 KB chunks, 288 chunks, ≥ 128 MiB physical payload; print bytes, chunk count,
  document count, and build ms.
- 1.3 Read stability: 20 `get` children at 64 MB (each cold, exit race fixed),
  then 5 children each for `search`/`list`/`stats`. Record pass count, per-run ms,
  and the last 3 stderr lines of any failure.
- 1.4 Measure the boot floor again at 32/48/64 MB with a tiny store, and (only if
  D8's fallback is needed) the module-level floor for the same 32/48/64 ladder.
- 1.5 Decision rule: **proceed** iff every read passes at 64 MB, no child hangs,
  and the payload builds in ≤ 20 s. **Stop as a defect** iff any pass failure
  carries a V8 heap trace from inside a read (D1/D7). **Fix the harness** iff the
  failure is in the parent or builder, then re-run 1.3 once and record both runs.

### Step 2 — The suite, `src/kb-capacity-heap.test.ts`

- 2.1 `beforeAll(fn, 120_000)` builds the payload in the test process with
  `makeIsolatedConfig()`, `new SqliteStore(storagePath)`, `init()`,
  `insertChunks(...)`, `close()`. No `initKb`, no ingest, no network. Assert the
  store's physical size exceeds `2 × HEAP_BYTES` and the chunk count is ≥ 288.
  Disk cost is a ~144 MiB temp store under `$TMPDIR`, deleted in `afterAll`; it is
  generated, never committed, and stays outside the repo tree so
  `check-shipped-kb-empty` is unaffected.
- 2.2 A `spawnChild(heapMb, calls)` helper in the file: `tsx src/index.ts`, env
  from the caller's isolated config plus `NODE_OPTIONS`, one `initialize` →
  `notifications/initialized` → `tools/call` per call, hard 20 s per-call timeout,
  `SIGKILL` and an exit-code-aware wait body. Copied from
  `src/structured-output.test.ts:218-264` per the recorded duplication follow-up;
  not extracted here.
- 2.3 Four action tests at `HEAP_MB = 64`, one child each, asserting complete
  results on the parsed envelope: `search` issues the two D6 searches and both
  return the seeded hit with its `source_url` and a nonempty snippet; `list`
  returns all seeded documents with the exact `chunk_count`; `get` returns the
  seeded document body joined by `"\n"` in `chunk_index` order, byte-equal to that
  string (`sqliteGet` joins with `"\n"`, `src/kb.ts:877-886`); `stats` reports the
  exact `chunk_count` and a payload above `2 × HEAP_BYTES`.
- 2.4 One sequential test: a single child issues all four actions in the probe-6
  order and must answer all four.
- 2.5 Tag `// @implements REQ-108 heap-bounded-retrieval`. Traceability only:
  `evaluateClauseCoverage` counts parenthesized "or" enumerations and "when …
  declares" conditionals (`src/clause-coverage.ts:19,23,134-139`), and REQ-108
  carries neither, so this tag is not a G3 count (the 2026-11-14 increment's D5
  reached the same conclusion for its REQs).
- 2.6 Mutation proof: make `sqliteList` materialize the store
  (`const all = [...sqliteStore.iterateChunks()]`) and confirm the `list` test
  fails at 64 MB over the ~144 MiB payload; revert and confirm green. Record the
  observed failure text. If the mutation does not fail, the payload margin is too
  small — raise the payload, not the heap (D3).
- 2.7 If a whole-file run exceeds the 30 s defaults, set explicit
  `{ timeout: 60_000 }` on the tests and `120_000` on `beforeAll`, and record the
  override in the commit message (C-4).

### Step 3 — Determinism and budget

- 3.1 Run `npx vitest run src/kb-capacity-heap.test.ts` three consecutive times;
  all three green, per-test wall times recorded.
- 3.2 `npm run test` once; record the suite's contribution and the new total.
- 3.3 `npm run check:fast`: every gate green **except `check-loop-artifacts`**,
  which stays red by design until 5.4 lands `aar.md` (0.2) and reports exactly one
  finding, the missing `aar.md`. Any other red is a failure of this step.

### Step 4 — Trackers

- 4.1 `docs/plans/2026-11-09-full-review-sweep/worklist.md:823`: `F-R6-E-3` →
  `Resolved` with the test file, test names, and lines, plus the step-1 numbers.
- 4.2 `ROADMAP.md`: retire § Missing test evidence across R4–R6 (it holds only
  this row) — remove the section, leaving two work items (the register
  reconciliation and the calibration refresh) and the non-goals pointer.
  `npm run check-roadmap` must stay green.
- 4.3 `CHANGELOG.md`: one new top section `## 2026.11.11 — <title>` in the reader
  standard of the two sections already there. A second heading dated 2026.11.11 is
  correct: one section per increment, as the existing 2026.11.11 sections above
  show, and `scripts/version.ts:266-267` compares only the top and latest date
  against `package.json`. The date is not free: `npm run version-sync` asserts the
  top entry equals the package version, which is `2026.11.11` until the release
  step stamps a new one.

### Step 5 — Verification and close

- 5.1 `npm run validate-spec` exits 0; the new `@implements` tag resolves.
- 5.2 `npm run check-gate-coverage` reports no new uncovered REQ.
- 5.3 `npm run check` (full) as the pre-push gate; if registry-backed `audit`
  cannot run, `check:fast` plus `test-debate-club` are terminal and the AAR says
  so (C-5).
- 5.4 `aar.md` with the disposition register, the probe JSON verbatim, the
  mutation record, the line-initial `**Review cap:** 2; used <n> passes`, and a
  terminal `LOOP PAUSED` / `LOOP OPEN`.

## Batching (commit series)

| Commit | Content | Size | Gate after commit |
|---|---|---|---|
| `test(kb):` | `src/kb-capacity-heap.test.ts` | M | `typecheck` + that file green |
| `docs(tracker):` | `worklist.md`, `ROADMAP.md`, `CHANGELOG.md`, increment `tasks.md`/`aar.md` | S | `check:fast` |

Two commits, each under ~300 changed lines; `docs(tracker)` lands last because it
is what makes `check-loop-artifacts` green.

## Blast radius

| Path | Change | Size |
|---|---|---|
| `src/kb-capacity-heap.test.ts` | new spawned-child suite | M |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | one row disposition (`:823`) | S |
| `ROADMAP.md` | one section retired | S |
| `CHANGELOG.md` | one entry | S |
| `docs/plans/2026-11-14-kb-heap-bounded-retrieval/{plan,tasks,aar}.md` | new increment record | S |

Not touched: `src/**` production code, `config.json`, `infobroker.md`,
`README.md`, `DECISIONS.md`, `package.json`, the throwaway probe (lives in
`$TMPDIR`), the ten existing spawned-server suites.

**Done bar:** all of the following hold on the final tree.

1. Step 1's single probe recorded: exit-race rerun, payload bytes/chunks/docs/build
   ms, 20 `get` + 5×3 action runs at 64 MB, and the boot floor ladder.
2. `src/kb-capacity-heap.test.ts` passes three consecutive runs, asserts
   `payload_bytes > 2 × HEAP_BYTES` and `HEAP_BYTES < payload_bytes` before any
   spawn, and its `search` case shows both the cold build-then-full-scan call and
   the second by-id call returning the seeded hit.
3. The `list` materialization mutation fails the suite and the revert is green;
   the failure text is in `tasks.md`.
4. `npm run test` and `npm run check:fast` are green; the suite's measured wall
   time is recorded and within the D8 budget.
5. `npm run validate-spec` and `npm run check-gate-coverage` report no new gap.
6. `worklist.md:823` reads `Resolved` with file/test/line; `ROADMAP.md` no longer
   carries § Missing test evidence; `CHANGELOG.md` has one new top entry dated
   `2026.11.11` and `npm run version-sync` is green.
7. `docs/plans/2026-11-14-kb-heap-bounded-retrieval/` carries `plan.md`,
   `tasks.md`, and an `aar.md` ending in `LOOP PAUSED` or `LOOP OPEN`.

**Review cap:** 2 passes — the plan gate (one full cold pass plus at most the one
diff re-review standard depth allows) and the post-build AAR review. A dispatch
past the cap needs user authorization recorded in the AAR (D-117).

## Conditions

- **C-1** — an assertion that fails on the unmodified tree is a discovered
  defect: stop, record it, and let the row move to a defect item. Never weaken an
  assertion to green.
- **C-2** — no production file changes; if the row cannot be tested without one,
  it is blocked and reported, and the seam is its own increment.
- **C-3** — every spawned child inherits `makeIsolatedConfig()`; no suite may read
  or write the real user store (`check-shipped-kb-empty` stays meaningful).
- **C-4** — any timeout override is explicit, recorded in the commit message, and
  justified by a measured wall time, never added pre-emptively.
- **C-5** — `npm run check` is the pre-push gate; if `audit` cannot reach the
  registry, `check:fast` plus `test-debate-club` are terminal and the AAR says so.
- **C-6** — the payload is deleted in `afterAll` and each child is reaped in a
  `finally`; a leftover child or a temp store is a failed run, since a hung child
  is exactly the prior increment's unresolvable symptom.

## Alternatives considered

- **Retry the old ingest-built payload with the budget raised to 30 s.** Rejected:
  the 17–25 s cost is the dedup scan, which grows with the store, so the margin
  shrinks as the payload grows; direct seeding removes the cost instead of
  accommodating it.
- **Test at the absolute boot floor (48 MB).** Rejected: the floor leaves no room
  for one chunk decode, which is the most plausible cause of the single crash;
  producing a nondeterministic gate is worse than paying 128 MB of payload for
  margin.
- **One child issuing all four actions only.** Rejected: a crash would not say
  which action caused it, and a warmed heap could mask accumulation. The
  sequential child is kept as an additional case, not the only one.
- **Seed every chunk with the query bucket so no candidate filtering happens.**
  Rejected after the cold pass: `src/kb-prefilter.ts:141` then returns `null` and
  the bounded by-id read is never exercised; D6 seeds a strict subset and issues
  two searches instead.
- **Measure peak heap in-process (a proxy).** Rejected by the register already: a
  GC-sensitive measurement is not the clause, and `--max-old-space-size` is the
  actual process heap the REQ names.
- **Commit the probe as `scripts/kb-heap-probe.ts`.** Rejected: it adds
  script-discipline, `typecheck:scripts`, and packaging surface for a one-off
  measurement.
- **Module-level child instead of the MCP server.** Held as D8's fallback only:
  cheaper floor and payload, but it stops short of the handler the REQ's
  retrieval and inspection tools run through.

## Evidence

Preflight sidecar: `plan.evidence.json` (generated by
`plan-gate.mjs preflight`), recording the plan sha256, git `HEAD`, target
existence, and the cited REQs (`REQ-108`).
