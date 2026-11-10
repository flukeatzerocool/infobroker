# Plan — R6 `manage_kb` action-evidence remediation

**Status:** draft for approval · **Date:** 2026-11-10 · **Depth:** light
**Review independence:** self — light depth; a cold pass is out of depth by
`plan-review` §0.5.
**Rollback cost:** 0 — tests and register/docs only; no production code, config,
dependency, or persisted-state change.
**Roadmap item:** `ROADMAP.md` § R6 `manage_kb` action-evidence remediation
(retire on close).
**Predecessor:** `a9c756c` (R6 action-contract remediation, `LOOP PAUSED`). The
review program closed at M1, so this item's trigger — "start after chunk R7
closes" — is satisfied.

## Baseline (verified this session)

- `npm run check` → PASS (full, 22 gates, 54.3 s) at HEAD `a9c756c`, tree clean.
- `npm run status` → version 2026.11.7, 26 open roadmap items, 33 unpushed
  commits (oldest 20.1 h), last pipeline run 2026-11-07.
- `npm run check-gate-coverage` → 118 G1 REQs: 117 cited, 1 exempt, 0 waived.
- This is the first roadmap section; every earlier chunk (R1–R9, M1) is closed.

## Done bar

**Done bar:** F-R6-A-4, F-R6-A-5, and F-R6-A-6 are `Resolved` in the
`docs/plans/2026-11-09-full-review-sweep/worklist.md` register; every new test
fails under its named mutation and passes after the mutation is reverted (the
tree is clean afterwards); the R6 action-evidence section is retired from
`ROADMAP.md` (26 work items → 25); no production behavior changes, so no
CHANGELOG entry is required; `npm run check:fast` and `npm run check` exit 0 on
the final tree; the increment record under
`docs/plans/2026-11-10-r6-a-action-evidence/` carries plan, tasks, and an AAR
ending `LOOP PAUSED`.

## Findings in scope

| ID | Predicate (verified by reading the branch) | Fix |
|---|---|---|
| F-R6-A-4 | REQ-060c per-collection counts and `last_ingestion`, REQ-060d's at-least-one-filter rule, REQ-060e newest-first order and `chunk_count`, and REQ-060f chunk order and the no-document error are cited but unasserted (`src/kb.test.ts:113-184`; handler guards `src/index.ts:2357-2359,2161-2167`) | Tests only |
| F-R6-A-5 | The tool-level locked-store error mapping is static-only; the unit test asserts `kbClaims` does not throw (`src/kb-claims.test.ts:339-354`; guard `src/index.ts:2065-2069`) | Tests only (Arena) |
| F-R6-A-6 | REQ-060i `stale=true` and the document-basis source-absent branch are unasserted (`src/kb-report-receipt.test.ts:556`; branch `src/kb-receipt.ts:360-373`) | Tests only |

## Design decisions

**D1 — The conformant behavior is an assumption until the new tests run.** The
predicates say "cited but unasserted", not "wrong". I read each branch this
session and it matches the REQ, so the expected outcome is pinning tests. Step 2
proves that by running the new tests before any mutation. If any leg fails on
the current tree, it is a defect: convert that leg to a fix, add a CHANGELOG
entry, and record the redistribution in `tasks.md` — do not weaken the assertion
to match the code.

**D2 — Mutation proof replaces the fail-first run.** There is no pre-fix tree to
fail against because the behavior is already correct. Evidence that each test
constrains the behavior is a named mutation per finding, applied locally and
reverted before staging: flip the `sqliteList` sort (A-4 ordering), delete the
handler delete-filter guard (A-4 filter), remove the tool lock guard (A-5),
force `stale` undefined (A-6 stale), and change the document-basis absent-source
branch to `drift` (A-6 absent). `git diff --quiet` confirms every mutation is
gone.

**D3 — A dedicated isolated unit file.** The shared store in `src/kb.test.ts`
accumulates documents across tests and one earlier test re-points `initKb` at a
second directory. Ordering assertions need controlled `ingested_at` values, so
they go in a new `src/kb-action-evidence.test.ts` with its own temp store and a
`Date.now` spy (`src/kb.ts:602,647` stamps `ingested_at`). The existing
`src/kb.test.ts` is left unchanged; its current assertions stay as broader
coverage.

**D4 — Tool-level vs unit-level homes.** REQ-060d's filter requirement, REQ-060f's
no-document error, and the locked-store error exist only in the tool handler
(`src/index.ts`), so they are Arena assertions in a new
`debate-club/src/kb-action-tools.test.ts`. REQ-060c/060e and REQ-060f order are
library-level and are unit assertions. REQ-060i's `stale` value is computed in
the library (`src/kb.ts:996-1009`) from an unexposed `created_at`; the server
subprocess cannot age a receipt deterministically, so `stale=true` is asserted
at unit level and the document-basis absent-source branch is asserted at *both*
levels. The roadmap's "tool-level" reading therefore applies to the locked-store
and absent-source legs; this split is recorded as a deliberate narrowing, not
an omission.

**D5 — Pin the current no-document code.** The handler returns
`internal_error` for an unknown `source_url` (`src/index.ts:2166`). REQ-060f
requires only "an error"; REQ-002 assigns `internal_error` to errors with no
defined code, so the test pins `[ERROR]` plus `code: "internal_error"` and a
non-empty remediation. Reclassifying the code is a behavior change outside this
evidence item.

**D6 — Arena lock fixture.** A locked store is produced deterministically
without touching the operator's environment: the user layer sets
`kb.encryption.enabled: true` with a `key_file` inside the harness `keys_path`
that does not exist. `initKb` resolves the file first, gets no secret, and
records the `config_error` lock before opening the store
(`src/kb.ts:353-369`). The same layer needs `storage_path`/`keys_path`/
`auto_index` because the harness shallow-merges the top-level `kb` block
(`debate-club/src/client.ts:74-86`).

**D7 — No spec or routing edit.** No REQ body, parameter, action, or tool
changes; REQ-060a–i already state the asserted contracts and the handler already
registers them. Step 0 confirms `check-intent-citations` and
`validate-spec` pass unchanged.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/kb-action-evidence.test.ts` (new) | Isolated-store unit tests: stats per-collection counts + `last_ingestion`; list newest-first + `chunk_count`; get chunk order + unknown-document null; delete with no filter throws | M |
| `debate-club/src/kb-action-tools.test.ts` (new) | Arena tool tests: delete with no filter → `invalid_input`; get unknown → `[ERROR] internal_error`; locked store → `config_error` on `claims`/`list` and `encryption status` still `[OK]`; `verify_report` document-basis absent source → `unverifiable` | M |
| `src/kb-report-receipt.test.ts` (`:252-296,523-557`) | Add `stale=true` after the decay window; keep the existing `stale=false` assertion | S |
| `ROADMAP.md` (`:17-22`) | Retire the section; 26 work items → 25 | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` (`:801-803`) | Mark F-R6-A-4/5/6 `Resolved` with the new test references | S |
| `docs/plans/2026-11-10-r6-a-action-evidence/{plan,tasks,aar}.md` | Increment record | S |

No `src/` production file is planned to change; `CHANGELOG.md` is untouched
unless Step 2 uncovers a defect. No new parameter or action means the routing
files need no edit.

## Implementation steps

**Step 0 — Surface probes (read-only).**
1. `npm run validate-spec` and `npm run check-intent-citations` — confirm no
   REQ/registration surface moved; record both results.
2. Confirm the sibling REQs binding `manage_kb` (REQ-060, 060a–060i) do not
   contradict the assertions: REQ-060c enumerates stats fields, 060d requires a
   filter, 060e requires newest-first plus `chunk_count`, 060f requires order plus
   an error, 060h requires a locked-store error, 060i requires `stale` and the
   unverifiable-absent rule.
3. Record the current line anchors used by the mutations (`src/kb.ts:748` sort,
   `src/kb.ts:774` delete guard, `src/index.ts:2357-2359` tool guard,
   `src/index.ts:2065-2069` lock guard, `src/kb.ts:1001` stale,
   `src/kb-receipt.ts:371-373` absent-source branch) so a shifted line cannot
   misdirect a mutation.

**Step 1 — Write the tests.**
1. `src/kb-action-evidence.test.ts`, header
   `// @implements REQ-060c REQ-060d REQ-060e REQ-060f`, one temp store in
   `beforeAll`, `initKb` with `chunk_size: 64`, `chunk_overlap: 16`, a `report`
   tier, and `maintenance_interval_minutes: 0`:
   - **stats:** ingest into two collections with explicit `Date.now` values,
     then `flushKbWrites()`; assert `chunk_count` equals the sum, `collections`
     carries the exact per-collection counts, `last_ingestion` parses as ISO and
     equals the newest ingest second, and `storage_size_bytes > 0`.
   - **list order:** ingest A then B with `ingested_at` 1000 ms apart via a
     `Date.now` spy; assert `kbList()` returns `[B, A]` and
     `ingested_at[B] > ingested_at[A]`.
   - **list chunk_count:** ingest a long body; assert one entry whose
     `chunk_count` equals the returned ingest count and is `> 1`.
   - **get order:** ingest three numbered paragraphs; assert
     `text.indexOf("First") < indexOf("Second") < indexOf("Third")` and the text
     starts with the first paragraph (chunk overlap means exact equality is not
     the contract).
   - **get unknown:** assert `kbGet("report://absent")` is `null`.
   - **delete guard:** `expect(() => kbDelete()).toThrow(/invalid_input/)`.
2. `src/kb-report-receipt.test.ts`, in the existing REQ-060i drift block, tagged
   the same as its siblings:
   - **stale:** `storeReceipt()`, then `vi.spyOn(Date, "now").mockReturnValue(realNow + 800 h)`;
     assert `stale === true`, `state === "verified"`, and `age_days >= 33` (the
     report tier's `decay_hours` is 720 in the test config).
   - **absent document-basis source:** `storeReceipt()`, assert the stored
     source `hash_basis === "document"`, delete the cached source with
     `kbDelete(undefined, sourceUrl)`, verify, and assert
     `sources.unverifiable === 1`, `sources.drift === 0`, `state === "unverifiable"`,
     and `details[0]` matches `{ state: "unverifiable", hash_basis: "document" }`.
     The `afterEach` already restores mocks and env.
3. `debate-club/src/kb-action-tools.test.ts`, header
   `// @implements REQ-060 REQ-060d REQ-060f REQ-060g REQ-060h REQ-060i REQ-084`,
   one default server in `beforeAll` (500 ms init beat, matching
   `kb-contract.test.ts`):
   - **delete filter:** `action: "delete"` with neither `collection` nor
     `source_url` → `expectError(..., "invalid_input")` and a non-empty
     remediation; then delete by an unknown collection → `[OK]` with
     `meta.chunks_removed === 0` (the REQ requires the filter, not a hit).
   - **get unknown:** `action: "get"` with `source_url: "report://absent"` →
     `[ERROR] code internal_error`, message names the URL, remediation points at
     `list`.
   - **verify_report absent source:** ingest the cached source document, ingest
     the report with a receipt whose claim cites it, delete the source with
     `action: "delete"`, then `action: "verify_report"` → `[OK]`,
     `results[0].state === "unverifiable"`, `sources.unverifiable === 1`,
     `sources.drift === 0`, `sources.details[0].hash_basis === "document"`.
   - A second server from `configLayer` (D6) for the lock: `claims` and `list`
     → `[ERROR] code config_error`, remediation mentions the key; `encryption`
     `operation: "status"` → `[OK]` (REQ-060g reachability). Stop it in
     `finally`.
4. Typecheck the harness: `npx tsc -p debate-club/tsconfig.json`.

**Step 2 — Run before mutating; classify.**
1. Run the new unit file and `src/kb-report-receipt.test.ts`, then the Arena file
   and the full Arena suite. Expected: all pass. A failure here is a defect per
   D1 — fix the source, add the CHANGELOG entry, and record the change in scope.
2. Record the pass output in `tasks.md` as the "conformant on the current tree"
   evidence.

**Step 3 — Mutation proof.**
For each row below: apply the one-line mutation, run only the asserting test,
record the failure message in `tasks.md`, then `git checkout -- <file>` and
confirm `git diff --quiet`.

| Finding | Mutation | Test that must fail |
|---|---|---|
| F-R6-A-4 order | `src/kb.ts:748` sort ascending | list newest-first |
| F-R6-A-4 filter | delete `src/index.ts:2357-2359` guard | Arena delete filter |
| F-R6-A-5 lock | delete `src/index.ts:2065-2070` guard | Arena locked store |
| F-R6-A-6 stale | `src/kb.ts:1001` force `stale = undefined` | stale=true |
| F-R6-A-6 absent | `src/kb-receipt.ts:371-373` count `drift` instead of `unverifiable` | unit + Arena absent source |

**Step 4 — Docs and close.**
1. Retire the roadmap section (26 work items → 25) and mark the three register
   rows `Resolved` in place with the new test references.
2. Write `plan.md` (this text, post-review), `tasks.md` (probe results, the
   conformant run, the five mutation failures), and `aar.md` ending
   `LOOP PAUSED`.
3. Run `npm run session:close` (validates loop artifacts, runs `check:fast`,
   prints cadence; does not commit).

## Verification

| Check | Command | Expected |
|---|---|---|
| Spec | `npm run validate-spec` | PASS, unchanged citations |
| Routing | `npm run check-intent-citations` | PASS, no edit needed |
| Harness typecheck | `npx tsc -p debate-club/tsconfig.json` | PASS |
| Unit | `npx vitest run src/kb-action-evidence.test.ts src/kb-report-receipt.test.ts` | PASS before mutations |
| Arena | `npm run test-debate-club` | PASS (existing files + 1 new) |
| Mutation proof | per Step 3 | 5/5 named failures, tree clean after revert |
| Coverage | `npm run check-gate-coverage` | 0 uncovered |
| Roadmap/loop | `npm run check-roadmap`, `npm run check-loop-artifacts` | PASS (inside fast) |
| Fast gates | `npm run check:fast` | PASS |
| Full gates | `npm run check` | PASS (22 gates; `audit` needs network) |

## Commit series

1. `test(kb): assert the remaining manage_kb action evidence` —
   `src/kb-action-evidence.test.ts`, `debate-club/src/kb-action-tools.test.ts`,
   `src/kb-report-receipt.test.ts`.
   Gate: `npm run typecheck`, `npx tsc -p debate-club/tsconfig.json`, the two
   vitest files, `npm run test-debate-club`.
2. `docs(kb): resolve the F-R6-A action-evidence findings and record the increment` —
   `ROADMAP.md`, `worklist.md`, the increment record.
   Gate: `npm run check:fast`, then full `npm run check` on the final tree.

## Edge cases and rollback

- **`Date.now` spy leaks.** Restore in `finally` and rely on `vi.restoreAllMocks`;
  a leaked mock would corrupt later freshness assertions.
- **Tied ingest timestamps.** The ordering test uses explicit values 1000 ms
  apart, so `sqliteList`'s descending sort is deterministic; no wall-clock sleep.
- **Arena startup race.** Reuse the established 500 ms post-handshake beat; the
  locked server needs the same wait because `initKb` runs at startup.
- **Locked fixture deletability.** The key file path is never created; the test
  must not call `generate_key` against the locked server, or the lock stops
  being the fixture.
- **Chunk-count brittleness.** `chunk_size: 64` forces multiple chunks; assert
  equality with the ingest return value rather than a magic number.
- **Mutation residue.** `git status --short` must be empty after each revert;
  if a mutation was committed by accident, reset before Step 4.
- **Rollback:** delete the two new test files and revert the two doc commits; no
  persisted state, config, or schema is touched.

## Out of scope

- Reclassifying the get/no-document code (D5) and any other behavior change.
- The remaining R6 sections: auto-index/scoping/expiry, config/dedup/report,
  retrieval, encryption/capacity, ledger/receipt.
- Strengthening the existing `src/kb.test.ts` assertions (D3); the new file adds
  the missing evidence without perturbing the shared store.

## Evidence

- `npm run check` PASS at `a9c756c` (this session, un-piped, 54.3 s, 22 gates,
  4 low `audit` advisories).
- `npm run status`: 26 roadmap items, 33 unpushed, version 2026.11.7.
- Lines read this session: `src/kb.ts:331-426,602,647,688-784,976-1018`;
  `src/index.ts:2058-2070,2152-2181,2351-2362`;
  `src/kb-receipt.ts:343-380`; `src/kb-report-receipt.test.ts:41-128,240-296,500-557`;
  `src/kb.test.ts:113-184`; `src/kb-claims.test.ts:339-354`;
  `src/kb-crypto.ts:203-216`; `debate-club/src/client.ts:59-195`;
  `debate-club/src/kb-contract.test.ts:1-40`.
- Finding predicates: `worklist.md:801-803`; roadmap text `ROADMAP.md:17-22`.
- Preflight sidecar: generated after the plan is stamped.
