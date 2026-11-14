# Tasks — Close `F-R6-E-3`: gate-asserted heap-bounded retrieval

Execution order. A step is ticked only when it is verified.

**Plan:** `plan.md` (revision 3, sha256 `1dfc4562…99d8`) · **Roadmap item:** `ROADMAP.md` § Missing test evidence across R4–R6 (retired)

## Census (from plan.md)

| Row | Verdict | Test home |
|---|---|---|
| `F-R6-E-3` (`worklist.md:823`) | open — feasibility gated → **resolved** | `src/kb-capacity-heap.test.ts` (new) |

## Step 0 — Baseline and increment record

- [x] 0.1 `npm run check:fast` on the unchanged tree → **PASS** (fast, 29.7 s).
- [x] 0.2 Increment directory created; `plan.md` copied; this file seeded.
- [x] 0.3 `src/kb-capacity-heap.test.ts` absent; `kb-heap-probe2..6.mts` readable under `$TMPDIR`.

## Step 1 — Diagnosis probe (`$TMPDIR/kb-heap-probe7.mts`, not committed)

One script, one run, four measurements. Probe source at
`/tmp/opencode/kb-heap-probe7.mts`; output at `/tmp/opencode/probe7.out`.

- [x] 1.1 Exit race fixed (`once(child, "exit")` registered at spawn, awaited only
  when `exitCode === null && signalCode === null`) → **8/8 children answered**,
  1123–1369 ms each. No hang.
- [x] 1.2 Payload: direct `insertChunks`, 512 KiB chunks, 288 chunks →
  **153,739,264 bytes (146.6 MiB), 288 chunks, built in 2759 ms**.
  `payload_over_heap = true`, `payload_over_2x_heap = true`.
- [x] 1.3 Read stability at 64 MB over that payload: **20/20 `get`**, **15/15**
  `search`/`list`/`stats`, both searches returning the same hit (4309-byte
  envelopes). No failures, no stderr.
- [x] 1.4 Boot ladder with a tiny store: 32 MB **1023 ms** (a prior run aborted
  at 32 MB with a V8 trace, so 32 is not a stable floor), 48 MB **520 ms**,
  64 MB **522 ms**.
- [x] 1.5 Decision: **proceed** — every read passed at 64 MB, no child hung, the
  payload built in 2.8 s (budget 20 s). No defect to report.

## Step 2 — The suite, `src/kb-capacity-heap.test.ts`

- [x] 2.1 `beforeAll(fn, 120_000)` seeds `makeIsolatedConfig()`'s storage path
  with `SqliteStore` + `insertChunks` + `flush` + `close`; no `initKb`, no
  ingest, no network. Payload shape is a **deviation** (see below). Guard test
  asserts `bytes > 2 × HEAP_BYTES`.
- [x] 2.2 `withHeapedServer` helper: `tsx src/index.ts`, `NODE_OPTIONS` heap, a
  20 s per-call timeout, `[OK]` envelope parsing, `SIGKILL` plus an
  exit-code-aware wait. Copied from `src/structured-output.test.ts:218-264`.
- [x] 2.3 Action tests at `HEAP_MB = 64`: `search` (`:253`), `list` (`:266`),
  `get` (`:280`), `stats` (`:289`).
- [x] 2.4 Sequential child (`:298`).
- [x] 2.5 Tag `// @implements REQ-108 heap-bounded-retrieval`.
- [x] 2.6 Mutation proofs (below), each reverted; `git diff src/` empty after.
- [x] 2.7 No timeout override needed: whole file runs in ~11 s against the 30 s
  defaults (`vitest.config.ts:9-10`).

## Step 3 — Determinism and budget

- [x] 3.1 Three consecutive runs: **6 passed / 11.11 s**, **6 passed / 10.90 s**,
  **6 passed / 11.14 s**.
- [x] 3.2 `npm run test` → **136 files, 1609 tests passed, 27.97 s**. The new
  suite contributes ~11 s of that.
- [x] 3.3 `npm run check:fast` before the AAR → **FAIL, exactly one error**
  (`2026-11-14-kb-heap-bounded-retrieval: missing aar.md`) plus the known
  warning for `2026-11-10-r6-encryption-capacity-remediation`. Green again after
  5.4, below.

## Step 4 — Trackers

- [x] 4.1 `worklist.md:823` → `Resolved 2026-11-14` with file, test names, line
  numbers, measurements, and both mutation results.
- [x] 4.2 `ROADMAP.md` § Missing test evidence across R4–R6 retired; two work
  items remain plus the non-goals pointer.
- [x] 4.3 `CHANGELOG.md` new top section `## 2026.11.11 — Heap-bounded retrieval
  evidence for the knowledge base`.

## Step 5 — Verification and close

- [x] 5.1 `npm run validate-spec` → PASS (142 REQs, 127 cited, 0 uncited source
  files; the new tag resolves).
- [x] 5.2 `npm run check-gate-coverage` → PASS (118 G1 REQs: 117 cited, 1 exempt,
  0 waived).
- [x] 5.3 `npm run check` (full) → PASS, 22 gates, 166.5 s.
- [x] 5.4 `aar.md` written; terminal token recorded.

## Mutation log

| Mutation | Result |
|---|---|
| `src/kb.ts` `sqliteList`: `const allChunks = [...sqliteStore.iterateChunks()]` then loop over it | `list` test failed in 21.1 s with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` |
| `src/kb-sqlite.ts` `iterateChunksByIds`: throw `mutation: by-id read disabled` | `search` test failed; the error text names the mutation, and the cold first pass had already returned its hit — only the by-id second pass failed |

Both mutations were reverted before the next step; `git diff src/` is empty.

## Deviations from the plan

1. **Payload geometry (step 2.1, plan D5).** The plan specified "288 chunks,
   2–4 per document, ~96 documents". Executed as **one 288-chunk document of
   512 KiB chunks plus eight 3-chunk documents of 10 KiB**, because the server
   truncates every tool response above the configured response cap
   (`src/index.ts:1893` → `maybeTruncate`, REQ-004). With 96 documents of
   ~1.5 MiB, a complete `get` body is ~1.5 MiB and a complete `list` response
   ~14 KiB per entry — both over the cap, so "complete results" would have been
   unobservable through MCP and the suite would have been measuring REQ-004
   instead of REQ-108. The deviation keeps every *response* small while the
   *store* is 146.6 MiB, which is what clause (a) constrains. The huge document
   also makes the by-id read stream the whole store, so that path is not
   trivialised. No scope, file, or gate changed.
2. **`search` assertions (step 2.3).** The plan expected "the seeded hit"; the
   executed test asserts the hit is `results[0]` in both passes, which required
   the target document's chunks to carry the full query vector (a single shared
   bucket ties with every other candidate).
3. **Freshness timestamps.** Chunks are seeded 60 s in the past; 2023-era
   timestamps decayed `freshness_score` to 0 in the shipped config and made
   ranking arbitrary, which surfaced as a wrong first hit rather than as a
   capacity failure.
