# Plan — Close the handler-level evidence rows, re-scope the seam-blocked residual

**Status:** revision 3 — cold pass FAILED (1 Blocker, 5 Majors, 8 Nits), diff re-review FAILED (0 Blockers, 1 Major, 6 Nits); every finding of both is applied below
**Date:** 2026-11-14
**Depth:** standard — two new spawned-server test files plus one conditional file, two register re-scopes, one roadmap restructuring; no production source change expected
**Review independence:** fresh — cold pass report at `/tmp/opencode/cold-pass-report.md` (revision 1, 34/40 reads) and diff re-review at `/tmp/opencode/cold-pass-rereview.md` (revision 2, 12 reads); revision 3 is a diff-level fix of the re-review's findings
**Rollback cost:** 1 — every change is an added test file, a named `@implements` tag, or a tracker disposition; a revert loses only coverage
**Roadmap item:** `ROADMAP.md:17-29` § Missing test evidence across R4–R6
**Predecessor:** `6893c13` (`docs(tracker): close the first evidence rows and record the residual`, ended `LOOP OPEN` with five rows)

## Scope

The five register rows the 2026-11-14 increment left open after closing
seventeen. Two are drivable once a spawned server exercises the handler rather
than the module API; one is drivable only if a harness seam is measurable; two
cannot be driven hermetically at all without a production seam and are
re-scoped out of this section rather than approximated.

Not in scope: any row whose predicate claims the code does the wrong thing; a
production seam for the two blocked rows (its own increment); extracting the
duplicated spawned-server helper (D2).

## Census (re-verified this session)

Read from `docs/plans/2026-11-09-full-review-sweep/worklist.md` and re-checked
against the live tree, not taken from the roadmap prose.

| # | Row (worklist line) | Live verdict | Evidence |
|---|---|---|---|
| 1 | `F-R5-A-4` (`:743`) | **open — drivable** | `src/index.ts:2088-2115` holds all four handler gates; no test calls `infobroker_verify_claims` (`grep infobroker_verify_claims src/*.test.ts` → `src/tool-surface.test.ts` only, which lists the tool) |
| 2 | `F-R6-D-3` (`:820`) | **open — drivable (handler half)** | Handler gate at `src/index.ts:2264-2273`; `kbEncryptionStatus()` returns `state`/`on_disk_format`/`key_source`/`key_resolvable`/`lock` (`src/kb.ts:1416-1436`); `key_source` is asserted only through the module API (`src/kb-encryption-tools.test.ts:146-147`), never through `tools/call`, and no spawned suite asserts it |
| 3 | `F-R6-E-3` (`:823`) | **open — feasibility gated** | REQ-108 clause (a) (`infobroker.md:625`); no reduced-heap harness exists (`grep max-old-space src` → none); decision rule in step 3 |
| 4 | `F-R4-B-3` (`:702`) | **blocked — pointer only** | `JINA_BASE` is a module constant (`src/providers/jina.ts:6`); `config.json:18` carries no base-URL override; no env override exists. The register row already reads "blocked … needs a production seam", so the disposition text is unchanged — only a pointer to the new roadmap section is added |
| 5 | `F-R4-C-3` per-hop-guard (`:709`) | **blocked — sub-clause only** | Refusal is gated solely by `allowPrivate` (`src/lib/url-guard.ts:97-98`, `:123-136`): with it true a loopback hop is never refused, with it false the start hop is refused first. Page-cap and depth-cap are already resolved (`:709`), so only the per-hop-guard clause is re-scoped |

Rows 1–3 stay in this section. Rows 4–5 are re-scoped per D1.

## Measured state (this session, before any edit)

- `git log -1` → `6893c13`; working tree clean; version `2026.11.11`; latest
  tag `v2026.11.07`; 225 unpushed commits, oldest 4.8 d.
- `npm run status` → 3 open roadmap items; last pipeline run 2026-11-07. The
  4.8 d backlog is past the 24 h AAR trigger and belongs to session close, not
  to this increment.
- Baseline `npm run check` at `6893c13` → **PASS**, 22 gates, 159.6 s, one
  pre-existing warning (`2026-11-10-r6-encryption-capacity-remediation: plan.md
  has no **Done bar:** line`). No red baseline to fix.
- Harness assets confirmed present: `withServer` over stdio at
  `src/structured-output.test.ts:218-264`, `makeIsolatedConfig()` at
  `src/lib/test-isolation.ts:23`, `vitest.config.ts` `testTimeout: 30_000`
  (`vitest.config.ts:9`).
- `makeIsolatedConfig()` rewrites only the `kb` block of the temp config
  (`src/lib/test-isolation.ts:28-37`), so any other setting a suite needs is
  written into the returned `configPath` before spawn.
- Existing REQ-026g tags at `src/corroborate.test.ts:1605-1612` cover order,
  unsourced, partial, budget, duplicate, and lone-claim branches; none covers
  the two-input rejection, the empty list, or the configured cap — the exact
  gap row 1 names.

## Decisions

**D1 — A row that needs a production seam is not an evidence row.** The
section's close condition is "the register holds no open evidence-only row".
Rows 4–5 cannot be proven without changing production code, so their
disposition text moves to a seam pointer and they move to a new roadmap
section naming the seam. Nothing is dropped: both keep a register note with the
probe that re-confirmed the blocker. Row 3 is different — it is an evidence row
whose harness does not exist yet, so if the spike fails it **stays** in this
section with its numbers (Major 3).

**D2 — The spawned-server helper is copied, not extracted.** Eight suites
already carry a private `withServer` (`dispatch-orchestration`,
`structured-output`, `fetch-page-extraction`, `tool-surface`,
`provider-health-action`, `key-safety-action`, `provider-list`, `quota`). A
shared `src/lib/mcp-stdio.ts` is the right end state but touches eight existing
files; extracting it here would mix a refactor into a test-only increment.
Recorded as a soft flag and a follow-up. The copy is **parameterized by env**:
it takes the environment from its caller instead of calling
`isolatedConfigEnv()` internally (Major 2).

**D3 — No production source changes.** Every committed change lands in a
`*.test.ts` file plus the trackers. Source edits exist only as the temporary
mutations D4 requires; each is applied, run, reverted, never staged.

**D4 — The mutation proof is per branch assertion.** Each new assertion that
drives a branch is shown to fail under a recorded source mutation and pass on
the restored tree. One assertion is exempt: the REQ-085 store-unchanged check
restates a preservation contract already asserted at the unit level, and the
exemption is named in `tasks.md` (Major 6, Nit B).

**D5 — One slug per tag line, bound to a driving test.** `clauseTagsFromPayload`
registers only the token after the REQ ID (`src/clause-coverage.ts:106-118`), so
each branch gets its own `// @implements REQ-NNN <slug>` line, and the tag lives
in the file whose test drives that branch. **These tags are traceability, not a
G3 requirement:** `evaluateClauseCoverage` counts only parenthesized "or"
enumerations and "when … declares" conditionals (`src/clause-coverage.ts:19,23,
134-139`), and none of REQ-026g, REQ-084, REQ-086, REQ-060h, REQ-108 contains
either (Major 5).

**D6 — Row 3's spike may legitimately end `blocked`.** The row asks for a
process whose heap is smaller than the stored chunk data. That is measurable
only if the harness boots under a small heap and the store can be built inside
the probe's budget. The decision rule is in step 3, the probe runs **outside**
vitest's 30 s timeout (Blocker 1), and a blocked outcome with recorded numbers
is a delivered result, not a failed increment.

## Steps

### Step 0 — Increment record and baseline re-check

- 0.1 Create `docs/plans/2026-11-14-handler-level-evidence-rows/` and copy this
  plan to `plan.md`; write `tasks.md` seeded with this step list **and** the
  Census table above (Nit D).
- 0.2 Run `npm run check:fast` on the unchanged tree and record it as the
  increment's session baseline; any red gate aborts the increment and is fixed
  in its own commit first. (The full `npm run check` PASS above remains the
  pre-push baseline; `check:fast` is a different gate subset, so it is recorded
  separately rather than compared to the 22-gate run — Nit 5.)
- 0.3 Confirm the three target files do not exist and the two blocker probes
  still hold (`src/providers/jina.ts:6`, `src/lib/url-guard.ts:97`).
- 0.4 `check-loop-artifacts` is red from 0.1 until 4.x lands `aar.md`; that is
  expected mid-increment and recorded in `tasks.md` (Nit 7).

### Step 1 — Row 1, REQ-026g handler bounds (`src/verify-claims-bounds.test.ts`, new)

- 1.1 Build the suite on the existing pattern: `makeIsolatedConfig()` for env,
  a `withServer(env, fn)` helper copied from `src/structured-output.test.ts:
  218-264` but taking its env from the caller (D2), `initialize` →
  `notifications/initialized` → `tools/call`.
- 1.2 Before spawning, rewrite the temp config's `corroboration.max_batch_claims`
  to `2` and write it back to `iso.configPath` (the helper's `kb`-only rewrite
  is the reason this is explicit — Nit 4).
- 1.3 Four rejection cases against `infobroker_verify_claims`:
  `{query, claims}` → `[ERROR]` `invalid_input` "Provide either query or
  claims, not both"; `{}` → "Provide a query or a claims list"; `{claims: []}`
  → "claims must contain at least one claim"; `{claims: ["a","b","c"]}` with the
  cap at 2 → "claims accepts at most 2 entries".
- 1.4 Assert on the parsed envelope: `[ERROR]` prefix, `code: "invalid_input"`,
  and the exact message. Each case short-circuits before `corroborate`, so the
  suite makes no outbound call.
- 1.5 Tags, one per case: `// @implements REQ-026g batch-both-inputs`,
  `... batch-no-input`, `... batch-empty-list`, `... batch-cap` (D5 — Nit 5).
- 1.6 Mutation proofs, each placed inside the branch it proves so no case is
  routed into `corroborate`:
  - both-inputs: replace that branch's body with `return invalidInput("sentinel")`
    → only the both-inputs case fails (Nit 6); the guard itself is untouched, so
    nothing reaches the network (Nit 1).
  - cap: change the refusal message to `claims accepts at most 10 entries` →
    the cap case fails on the exact-message assertion while the rejection path
    still short-circuits. This proves the bound shown to the caller comes from
    config; the threshold itself is proven by the unmodified rejection of 3
    claims at cap 2. A mutation of the comparison would admit the batch and
    make a real outbound call, so it is not used (Nit 2).
  Revert both; `npm run typecheck` and the file green.

### Step 2 — Row 2, handler lock refusal and key-source precedence (`src/kb-handler-lock.test.ts`, new)

- 2.1 Fixture in the parent process. From `makeIsolatedConfig()`, rewrite the
  temp config to `kb.encryption = { enabled: true }` with **no `key_file`**, and
  supply a raw secret in `process.env.INFOBROKER_KB_KEY` (32 random bytes, hex,
  in the format `decodeKeyFromString` accepts — `src/kb-crypto.ts:179-191`; the
  boot path resolves the variable at `:207-209`). Then `initKb` +
  `kbIngest` one document so the on-disk store is `encrypted`. Record the
  store's `mtimeMs` and byte size, and close the parent's store handle before
  Child A spawns so no maintenance write can move it. Because the config carries
  no key file, removing the env keys is what locks the store (Major 2).
- 2.2 Child A — same `INFOBROKER_CONFIG`, env = the isolated env with
  `INFOBROKER_KB_KEY` and `INFOBROKER_KB_PASSPHRASE` deleted. Assertions:
  `manage_kb {action:"claims"}` → `[ERROR]`, `code: "config_error"`,
  remediation matching `/key/i`; `manage_kb {action:"stats"}` → `[ERROR]`;
  `manage_kb {action:"encryption", operation:"status"}` → `[OK]` with
  `state: "locked"`, `on_disk_format: "encrypted"`, `key_source: "none"`,
  `key_resolvable: false`, non-null `lock`; the store file's `mtimeMs` and size
  unchanged (REQ-085).
- 2.3 Child B — a second temp config copy whose `kb.encryption.key_file` is a
  key file **containing the fixture's own raw key**, and env with
  `INFOBROKER_KB_KEY` and `INFOBROKER_KB_PASSPHRASE` deleted. The store
  therefore decrypts only through the key file. Assertions:
  `encryption status` reports `key_source: "key_file"`, `key_resolvable: true`,
  `state: "enabled"`; `manage_kb {action:"claims"}` returns `[OK]` (Major 1 —
  no dual source, so the success path is falsifiable).
- 2.4 Child C — a third copy whose `key_file` is a bogus path, env carrying the
  fixture's raw key: reports `key_source: "key_file"`, `key_resolvable: false`,
  `state: "locked"` — the key file wins even when unreadable, with no fallback
  to the environment (`src/kb-crypto.ts:203-216`).
- 2.5 Tags: `// @implements REQ-084 handler-lock-refusal`,
  `... key-source-precedence`, `// @implements REQ-086
  locked-encryption-reachable`, `// @implements REQ-060h
  claims-locked-refusal`, `// @implements REQ-085 store-unchanged-while-locked`
  (Nit 2 of the first pass).
- 2.6 Mutation proofs, one per branch:
  - handler gate: change `action !== "encryption"` to `false` → 2.2's
    `claims`/`stats` refusals fail.
  - status shape: make `kbEncryptionStatus` return `key_resolvable: true`
    unconditionally → 2.2's status assertion fails.
  - key-file path: make `resolveKeySource` ignore a configured `key_file` and
    read only the environment → 2.3 fails (the store locks and `claims` is
    refused) — this is the mutation Child B is cited for.
  - precedence: make key-file resolution fall back to the environment when the
    key file is unreadable → 2.4 fails (it would decrypt and report enabled).
  The REQ-085 preservation assertion is exempt per D4 (its unit equivalent is
  `src/kb-encryption-sqlite.test.ts:125`). Revert; `typecheck` and the file
  green.

### Step 3 — Row 3, REQ-108 clause (a) feasibility probe (`src/kb-capacity-heap.test.ts`, conditional)

The probe runs **outside** vitest so its numbers exist even when the row ends
blocked (Blocker 1). It is not committed: it is a throwaway at
`$TMPDIR/kb-heap-probe.ts` whose source is pasted into `tasks.md` with its
measurements, so no script-discipline or packaging surface is added.

- 3.1 Write the probe. It: (a) measures the boot floor `H0` by spawning
  `tsx src/index.ts` with `NODE_OPTIONS=--max-old-space-size=H` for
  `H ∈ {32,48,64,96,128}` against a tiny isolated store, requiring `initialize`
  plus one `manage_kb stats` reply and recording the child's own wall time;
  (b) builds a payload by generating documents into an isolated store until the
  chunk text is ≥ 2 × `H0`, recording bytes and build time `W`; (c) prints one
  JSON object `{h0, payload_bytes, build_ms, child_completed}`.
- 3.2 Run it and paste the invocation and the JSON into `tasks.md`.
- 3.3 Decision rule (D6). **Lands** iff `H0 ≤ 128`, `W ≤ 20 s`, and a child at
  `H0` returns complete `search`, `list`, `get`, and `stats` results over the
  payload built in 3.1(b). **Blocked** otherwise, with the JSON verbatim in the
  register note and in this roadmap section; no in-process proxy and no
  reduced-store approximation is substituted.
- 3.4 If it lands, write `src/kb-capacity-heap.test.ts` as a single test with an
  explicit `{ timeout: 180_000 }` override (`vitest.config.ts:9` sets 30 s). It
  builds the payload once in `beforeAll(fn, 120_000)` — a test-level timeout does
  not extend `hookTimeout` (`vitest.config.ts:10` sets 30 s, and 3.3 allows
  `W ≤ 20 s`) — spawns the child at `H0`, and asserts
  complete result counts (search hits, list total, get body length, stats chunk
  count) with the heap below the payload; tagged `// @implements REQ-108
  heap-bounded-retrieval`. Mutation proof: make retrieval materialize every
  chunk body (remove the bounded read) → the child dies or the counts fail.
- 3.5 Record the measurement in `tasks.md` either way.

### Step 4 — Rows 4–5, register re-scope

- 4.1 `worklist.md`: rows 1–2 → `Resolved` with the test file, test name, and
  line. Row 3 → `Resolved` with the same, or `blocked` with the 3.3 JSON. Row 4
  keeps its existing `blocked … needs a production seam` text and gains a
  pointer to the new roadmap section. Row 5 keeps "Partially resolved
  2026-11-14 — page-cap and depth-cap are driven", and its remaining
  per-hop-guard clause gains the same pointer (Major 4).
- 4.2 `ROADMAP.md`: § Missing test evidence across R4–R6 keeps row 3 when it is
  blocked and retires when no row survives. A new section **Hermetic seam for
  the fetch-renderer chain and the crawl guard** carries exactly two bullets —
  a config/env base-URL override for the Jina renderer (closes row 4) and a
  per-hop guard driven at a seam that accepts an injected refusal (closes row
  5's remaining clause) — plus a `**Trigger:**` line, within the admission rule
  `npm run check-roadmap` enforces.
- 4.3 `CHANGELOG.md`: one entry.

### Step 5 — Verification and close

- 5.1 `npm run validate-spec` exits 0 and every new tag resolves to a file that
  drives its branch. This is traceability, not the G3 count: none of the five
  cited REQs triggers the detector's branch rules (D5 — Major 5).
- 5.2 `npm run check-gate-coverage`, then `npm run check:fast`.
- 5.3 `npm run check` (full) as the pre-push gate; if the registry-backed
  `audit` cannot run, `check:fast` plus `npm run test-debate-club` are terminal
  and the AAR says so (C-3).
- 5.4 Write `aar.md`: disposition register, the probe JSON, mutation list, the
  line-initial `**Review cap:** 2; used 3 passes (third findings-closure
  dispatch authorized 2026-11-14)` line, and a terminal
  `LOOP PAUSED` / `LOOP OPEN`.

## Batching (commit series)

| Commit | Content | Gate after commit |
|---|---|---|
| `test(verify):` | `src/verify-claims-bounds.test.ts` | `typecheck` + file green |
| `test(kb):` | `src/kb-handler-lock.test.ts` | `typecheck` + file green |
| `test(kb):` | `src/kb-capacity-heap.test.ts` (only if 3.3 says lands) | `typecheck` + file green |
| `docs(tracker):` | `worklist.md`, `ROADMAP.md`, `CHANGELOG.md`, `tasks.md`, `aar.md` | `check:fast` |

Each commit stays under ~300 changed lines; the largest is step 2's suite.
`docs(tracker)` lands last because it is the commit that makes
`check-loop-artifacts` green.

## Blast radius

- `src/verify-claims-bounds.test.ts` — new.
- `src/kb-handler-lock.test.ts` — new.
- `src/kb-capacity-heap.test.ts` — new, conditional on step 3.3.
- `docs/plans/2026-11-09-full-review-sweep/worklist.md` — five dispositions.
- `ROADMAP.md` — evidence section shrinks (or retires); one new seam section.
- `CHANGELOG.md` — one entry.
- `docs/plans/2026-11-14-handler-level-evidence-rows/{plan,tasks,aar}.md` — new.
- Not touched: `src/**` production code, `config.json`, `infobroker.md`,
  `README.md`, `DECISIONS.md`, `package.json`, the throwaway probe (lives in
  `$TMPDIR`), the eight existing spawned-server suites.

**Done bar:** all of the following hold on the final tree.

1. `tasks.md` carries the census table with a verdict per row and, for row 3,
   the probe JSON verbatim.
2. Rows 1–2 read `Resolved` in `worklist.md` with test file, test name, and
   line; row 3 reads `Resolved` or `blocked` with the numbers; rows 4–5 keep
   their existing partial/blocked text plus the new section pointer.
3. Every new branch assertion fails under its recorded mutation and passes on
   the restored tree, and the D4 exemption (REQ-085) is named in `tasks.md`; the
   mutation list is in `tasks.md`.
4. `npm run validate-spec` exits 0 and each new `@implements` tag sits in a
   file that drives its branch (no G3 claim is made for these REQs).
5. `npm run check-gate-coverage` reports no new uncovered REQ.
6. `npm run check:fast` exits 0 on the final tree; `npm run check` exits 0 or
   its only unrunnable gate is `audit` and the AAR records that (C-3).
7. `ROADMAP.md` § Missing test evidence carries only open evidence rows (row 3
   when blocked; empty otherwise) and the seam section exists with its two
   bullets and a trigger; `CHANGELOG.md` gains one entry.
8. `docs/plans/2026-11-14-handler-level-evidence-rows/` carries `plan.md`,
   `tasks.md`, and an `aar.md` ending in `LOOP PAUSED` or `LOOP OPEN`.

**Review cap:** 2 passes — the plan gate (whose cold work is one full pass plus
the single diff re-review the standard depth allows) and the post-build AAR
review. A dispatch beyond that needs user authorization recorded in the AAR.

## Conditions

- **C-1** — an assertion that fails on the unmodified tree is a discovered
  defect: stop, record it, and let the row move to a follow-on. Never weaken the
  assertion to green.
- **C-2** — if a row needs a production-code change to be testable (a seam, an
  export, an injected clock), the row is blocked and reported; adding the seam
  is its own increment.
- **C-3** — `npm run check` is the pre-push gate; if `audit` cannot reach the
  registry, `check:fast` plus `test-debate-club` are terminal and the AAR says so.
- **C-4** — the plan gate used three cold dispatches: a 5-stage pass on
  revision 1 (FAILED: 1 Blocker, 5 Majors, 8 Nits), a diff re-review of
  revision 2 (FAILED: 1 Major, 6 Nits), and an explicitly authorized
  findings-closure re-audit of revision 3 (`independent-review passed.`,
  0 Blockers, 0 Majors, 4 Nits — all applied). The third dispatch exceeds the
  standard depth's one-diff-re-review allowance and is recorded in the AAR per
  D-117.
- **C-5** — every new spawned suite must inherit `makeIsolatedConfig()` so
  `src/test-isolation.test.ts` and `check-shipped-kb-empty` stay meaningful; no
  suite may read or write the real user store.
- **C-6** — step 2's child count is three spawns plus the fixture; if the whole
  file exceeds the 30 s default it takes an explicit per-test timeout override,
  recorded in the commit message.
- **C-7** — revision 3's re-review Major is closed by construction — Child B
  carries a single key source, so its `[OK]` claims read is falsifiable by the
  key-file-ignored mutation — and that falsifiability is demonstrated during
  step 2.6 as defense in depth. If the mutation leaves 2.3 green, stop and
  report rather than weakening the assertion (C-1).

## Alternatives considered

- **Start with the register-reconciliation section instead.** Rejected: file
  order selects item 1 and its trigger ("the next increment in the same module")
  is satisfied — rows 1–2 are the same handler surface as the last increment's
  unit half.
- **Add the Jina base-URL seam in this increment to close row 4.** Rejected:
  it changes production code and `config.json`, widening a test-only increment
  into a config-contract change with README and spec surface.
- **Merge the new suites into one `handler-evidence.test.ts`.** Rejected: each
  spawns its own server and belongs to a different module; one file would mix
  two modules and lose per-module blame.
- **Prove row 3 in-process with a peak-heap measurement.** Rejected for now: it
  is the proxy the register already rejected (a GC-sensitive measurement is not
  the clause). The probe measures the real thing first.
- **Commit the heap probe as `scripts/kb-heap-probe.ts`.** Rejected: it would
  add script-discipline, `typecheck:scripts`, and packaging surface for a
  one-off measurement; a `$TMPDIR` probe with its source recorded in `tasks.md`
  is reproducible without permanent maintenance cost.
