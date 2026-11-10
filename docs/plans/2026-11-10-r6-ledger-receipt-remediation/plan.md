# Plan — R6 ledger and receipt remediation

**Status:** draft (revised after cold pass) · **Date:** 2026-11-10 · **Depth:** standard
**Review independence:** self (cold pass returned 1 Blocker + 6 Majors; all resolved in this revision)
**Rollback cost:** 1 — three small behavior edits in `src/index.ts`, `src/kb-sqlite.ts`, `src/kb-receipt.ts` (+ one call site in `src/kb.ts`), plus tests and bookkeeping. No schema-column change, no dependency, no config key, no release-surface change. A downgrade after new writes loses only the clear copy of a retrieval time; see Rollback.
**Roadmap item:** `ROADMAP.md` § R6 ledger and receipt remediation (retire on close)
**Predecessor:** `571c7d3` (R6 encryption close). Every review-sweep chunk (R1–R9, M1) is closed with `LOOP PAUSED`, so this section's trigger — "start after chunk R7 closes" — and the top-section-first rule both select it.

## Baseline (verified this session)

- `git log -1` → `571c7d3`; 52 unpushed commits, oldest 23.8 h; version 2026.11.7; 22 open roadmap items; last pipeline run 2026-11-07.
- `npm run check:fast` → PASS (19 gates, 22.2 s).
- Working tree changes at plan time: only this plan file.
- `ROADMAP.md:17-21` is the top scheduled section and names exactly F-R6-F-1, F-R6-F-2, F-R6-F-4.
- `docs/plans/2026-11-09-full-review-sweep/worklist.md:827-830` carries those three rows as `Scheduled-roadmap`; F-R6-F-3, F-R6-F-5, and F-R6-F-6 in the same cluster are already `Closed-P3`.
- Predicates re-verified by reading the code this session (not taken from the worklist):
  - `src/index.ts:1939` filters out every finding whose sources carry no URL before `kbRecordClaims`; upstream, `src/corroborate.ts:770` retains an unattributed claim only in batch mode.
  - `src/kb-sqlite.ts:106` declares `claim_sources.retrieved_at TEXT NOT NULL` in the clear; `upsertClaims` writes it at `:826`, `claimSources` reads it at `:964-970`, `resealAll` carries it through at `:1082`.
  - `src/kb-receipt.ts:302-306` stamps `retrieved_at` only for document-basis sources (`cached !== null`), so the source is present in the manifest but its retrieval time is absent for a snippet-basis source with no caller timestamp.
- Cold-pass premises confirmed: zero-source claims round-trip through `upsertClaims`/`claims()` (`src/kb-sqlite.ts:818-830`, `:874-885`; `src/kb-claims.test.ts:291`); `verifyReceipt` recomputes the digest over the *stored* manifest and never regenerates timestamps (`src/kb-receipt.ts:353-355`), so existing receipts keep their digests; 22 `##` sections excluding `## Non-goals`.

## Done bar

**Done bar:** F-R6-F-1, F-R6-F-2, and F-R6-F-4 are fixed and marked `Resolved` in the sweep worklist; each fix is shown to fail under a recorded source mutation and to pass on the restored tree; a **batch** `verify_claims` run whose findings carry no URL-bearing source still appears in `manage_kb (action: claims)` with an empty `sources` array; with at-rest encryption enabled the raw `claim_sources.retrieved_at` column holds no timestamp while the ledger read returns the supplied one and the value survives an enable/disable (or rekey) transition, which also blanks a value written by the previous build; a receipt whose only source is a snippet with no caller timestamp records a retrieval time in the canonical manifest; the R6 ledger section is retired from `ROADMAP.md` (22 work items → 21); `DECISIONS.md` records the residual for already-encrypted stores (D-096); `CHANGELOG.md` gains an entry naming the three behavior changes; `npm run check:fast` exits 0 and `npm run test-debate-club` exits 0 on the final tree, and `npm run check` exits 0 when the `npm audit` probe answers (otherwise recorded under C-2); the increment record under `docs/plans/2026-11-10-r6-ledger-receipt-remediation/` carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`.

**Conditions:**
- **C-1** — an assertion that fails on the unmodified tree exposes a real defect; the defect is fixed in this increment and the plan amended, never weakened to green.
- **C-2** — if the `npm audit --json` probe cannot reach the registry, the full `npm run check` is recorded as not-run for that reason and the terminal evidence is `npm run check:fast` **plus an explicit `npm run test-debate-club`**, because `check:fast` excludes the Arena and the Arena is the only end-to-end proof of F-R6-F-1. The AAR says so.
- **C-3** — no REQ body edit is planned: REQ-109 already requires a retrieval time per source and sealing at rest, and REQ-110 already requires a retrieval time in the manifest. If the cold pass shows a body must change, Appendix B limits are measured before commit and the pipeline's spec→README binding applies.
- **C-4** — the cold pass runs in a fresh context; if one cannot be created the run records `NOT_RUN.` and the plan does not claim `independence: fresh`.
- **C-5** — the Arena precondition is a batch finding with `sources: []`. The probe is a first assertion inside the same test that the `verify_claims` response actually contains the seeded claim with an empty `sources` array (the pool-restriction path at `src/corroborate.ts:566-583` can otherwise yield `findings: []`). If the response has no finding, only the provider slug may change; the claim text may change only when the probe shows the claim was attributed, because the assertion is about the ledger row, not the wording. The test never mocks corroboration and never asserts against an empty result set.

## Findings in scope

| ID | Predicate (re-verified this session) | Fix |
|---|---|---|
| F-R6-F-1 | The ledger persists only findings with a URL-bearing source (`src/index.ts:1939`), so an unsourced **batch** claim — the only kind that becomes a finding without a source (`src/corroborate.ts:770`) — is never stored and "persist each finding" is unmet | Behavior change (`src/index.ts`), Arena test |
| F-R6-F-2 | `claim_sources.retrieved_at` is a clear `TEXT NOT NULL` column (`src/kb-sqlite.ts:106`) while the URL and title on the same edge are sealed (`:765-767`), so a retrieval time is readable at rest under encryption | Behavior change (`src/kb-sqlite.ts`), unit test on the raw store |
| F-R6-F-4 | `buildReceiptManifest` stamps `retrieved_at` only when a cached document backs the source (`src/kb-receipt.ts:302-306`), so a snippet-basis source with no caller timestamp reaches the canonical manifest with a source but no retrieval time, against REQ-110's field list | Behavior change (`src/kb-receipt.ts`, `src/kb.ts`), unit test |

## Design decisions

**D1 — Persist every finding; link only the sources that have a URL.** The `kbRecordClaims` call keeps all findings and maps each finding's URL-bearing sources to edges, so an unsourced finding becomes a claim row with zero edges. Zero-edge claims already round-trip: `upsertClaims` accepts `sources: []` and `claims()` returns them (`src/kb-claims.test.ts:291` seeds them, and the `source_url` filter at `src/kb-sqlite.ts:875` simply never matches an empty edge list). Scope is batch mode by construction: in single-query mode an unattributed claim is filtered out before the response and therefore never reaches the ledger (`src/corroborate.ts:762-770`), so the done bar and the test name a `claims` batch and the AAR records the single-query behavior as unchanged, not as a fixed path. Rejected: narrowing REQ-109 to "persist findings that carry a source" — the roadmap names persistence of unsourced findings as the remedy and the REQ text is unconditional. Rejected: persisting an unsourced finding against a synthetic local URL — it would fabricate a source the ledger then reports as real.

**D2 — The retrieval time moves inside the sealed edge payload; the clear column is written empty.** `encodeEdge`/`decodeEdge` carry `retrieved_at`; `upsertClaims` writes `""` to the column; `claimSources` prefers the payload value and falls back to the column for a row written by the previous build. The column stays declared (`TEXT NOT NULL`) so no schema change and no `SQLITE_FORMAT_VERSION` bump is needed. `resealAll` already deletes and reinserts every edge row inside its transaction, so it carries the fallback value into the payload and writes the empty slot: any enable/disable/rekey transition scrubs a legacy clear value, inside the existing atomic transition, under the event that transition already reports. **No init-time migration.** Residual: a store that was already encrypted by the previous build keeps the clear value for a claim until that claim is re-verified or a key transition runs. D-096 records that as a standing fact and names `manage_kb (action: encryption, operation: rekey)` with a fresh key file (the operation reads the target key from `key_file`, `src/index.ts:1988-1989,2125-2131`), or disable-then-enable, as the remediation. Rejected: an init-time scrub — it rewrites stored rows outside any transition, so REQ-108's upgrade clause would require a recoverable artifact and a status event for it, and it needs its own marker to avoid re-running on every init. Rejected: lazy re-seal on read — REQ-060h defines the claims action as read-only. Rejected: dropping the column — a table rebuild and store-format change. Rejected: sealing the column text in place — a second cipher path, a per-read "base64 or legacy plaintext" reclassification, and a reseal branch, while the edge payload already exists and is already re-encoded.

**D3 — A source with no retrieval time is stamped at ingest, once per manifest.** `buildReceiptManifest` takes the ingest instant as an argument; every source with no caller `retrieved_at` gets that value, whether document-basis or snippet-basis, so the manifest always carries a retrieval time per source. The manifest already discloses provenance through `hash_basis: "snippet"`, so the stamped time is not presented as a server fetch. One manifest-level instant also keeps the digest stable within a single ingest. Rejected: rejecting a snippet-basis source with no retrieval time — `receipt.sources` is the report-level Source Register and the tool schema marks `retrieved_at` optional, so rejection would make a register of cited-but-unfetched URLs un-ingestable. Rejected: narrowing REQ-110 — the roadmap's sanctioned remedies are stamp or reject.

**D4 — No REQ body changes; the implementation is brought to the text.** REQ-109 states per-source retrieval time and sealing; REQ-110 states retrieval time in the canonical manifest. No edit means no Appendix B measurement and no spec→README binding obligation; the CHANGELOG records the behavior changes, and the ledger section comment at `src/kb-sqlite.ts:713-716` (which currently says timestamps stay in clear columns) is corrected in the source commit.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/index.ts` | `kbRecordClaims` mapping persists every finding; ledger comment updated | S |
| `src/kb-sqlite.ts` | Edge payload carries `retrieved_at`; empty clear slot; read preference with legacy fallback; reseal carries and blanks; section comment corrected | M |
| `src/kb-receipt.ts` | `buildReceiptManifest` takes the ingest instant and stamps every unlabelled source | S |
| `src/kb.ts` | Pass the ingest instant into `buildReceiptManifest` (`:1054`) | S |
| `src/kb-claims.test.ts` | At-rest assertion on the raw column, round-trip, transition scrub, legacy fallback | M |
| `src/kb-report-receipt.test.ts` | Snippet-basis source with no timestamp carries one | S |
| `debate-club/src/kb-ledger.test.ts` | New Arena file: unsourced batch finding reaches `action: claims` | M |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | F-R6-F-1/F-2/F-4 → `Resolved`; refresh the REQ-109/110 evidence rows at `:389-390` | S |
| `ROADMAP.md` | Retire § R6 ledger and receipt remediation | S |
| `DECISIONS.md` | Add D-096: legacy clear retrieval times and their remediation | S |
| `CHANGELOG.md` | One entry naming the three behavior changes | S |
| `docs/plans/2026-11-10-r6-ledger-receipt-remediation/` | `plan.md`, `tasks.md`, `aar.md` | S |

No README, provider, config-key, dependency, schema-column, or tool-signature change: the task-type table, parameter names, and descriptions are unchanged, so `check-non-goals`, `check-tdqs`, and `check-intent-citations` should stay green.

## Steps

### Phase 0 — preflight (no edits)

1. Confirm `git status --porcelain` shows only this plan file and HEAD is `571c7d3`.
2. Run `npm run check-tdqs` and `npm run check-intent-citations` and record the result; no tool-surface change is expected, so a failure here is a pre-existing defect to report, not to fix inside this increment.
3. Run `npm run validate-spec` and record the REQ/citation counts.
4. Grep `src/*.test.ts` and `debate-club/src` for an existing assertion that already covers an unsourced finding or a sealed edge timestamp (`grep -rn "sources: \[\]\|claim_sources\|retrieved_at"`); extend a covering test instead of adding a duplicate one.
5. Record the `npm run test` and `npm run test-debate-club` baselines (pass counts) so the increment reports the delta.

### Phase 1 — behavior

1. `src/index.ts`: drop the `.filter((f) => f.sources.some((s) => Boolean(s.url)))` at `:1939` that guards `kbRecordClaims`, keep the inner URL filter on a finding's sources, and rewrite the comment to say an unsourced batch finding persists with no edges.
2. `src/kb-sqlite.ts`: add `retrieved_at` to `encodeEdge`/`decodeEdge`; write `""` to the clear column in `upsertClaims`; have `claimSources` prefer the payload value and fall back to the column; in `resealAll`, carry the fallback value into the payload and write `""` to the column; correct the section comment at `:713-716`.
3. `src/kb-receipt.ts`: extend `buildReceiptManifest` with the ingest instant and use it for every source with no `retrieved_at`.
4. `src/kb.ts`: pass the instant (`buildReceiptManifest` call at `:1054`), reusing one ISO string per ingest.
5. Run `npm run typecheck` after each file.

### Phase 2 — tests

1. `src/kb-claims.test.ts`: with encryption enabled, store a claim whose source carries a known timestamp; assert the ledger read returns it, the raw `claim_sources.retrieved_at` column is empty, and no ISO timestamp appears in that row; then run a disable or rekey transition and assert the value survives and the column is still empty. Add a legacy case that inserts a row directly with a plaintext column value and a payload without the field, asserts `claims()` returns the time through the fallback, then asserts the transition blanks the column (the only scrub path — D2).
2. `src/kb-report-receipt.test.ts`: ingest a receipt whose only source is a snippet with no `retrieved_at`; assert the stored manifest source carries a retrieval time and `hash_basis: "snippet"`.
3. `debate-club/src/kb-ledger.test.ts`: start one Arena server with
   `configLayer: (tmpDir) => ({ kb: { storage_path: join(tmpDir, "kb"), keys_path: join(tmpDir, "keys"), reports_path: join(tmpDir, "reports"), auto_index: false, maintenance_interval_minutes: 0 } })`
   and the post-handshake wait used by `debate-club/src/kb-auto-index.test.ts:14-33`. The `content_policy: { mode: "off" }` pin from that harness is not needed here: `verify_claims` has no fetch-page policy branch. The Arena config includes `src/**/*.test.ts` (`debate-club/vitest.config.ts`), so the new file is discovered without registration. Call `verify_claims` with `claims: ["<one claim>"]` and `providers: ["duckduckgo"]` — a builtin provider with no fixture host, so replay answers with the synthetic 599 (`debate-club/scripts/preload.mjs:98-101`) and the batch finding is retained with `sources: []`. Assert the finding is present first (C-5), then `manage_kb (action: claims)` returns that claim with `sources: []`.
4. Run `npx vitest run src/kb-claims.test.ts src/kb-report-receipt.test.ts` at the root and the Arena file from `debate-club/`; then `npm run test-debate-club`.

### Phase 3 — mutation evidence

1. Restore the URL-bearing-source filter in `src/index.ts` → the Arena assertion must fail; revert.
2. Restore the clear column write and drop the payload field → the at-rest assertion must fail; revert.
3. Restore `row.retrieved_at` in `resealAll` and drop the payload carry → the transition-scrub assertion must fail; revert.
4. Restore `cached !== null` as the stamp condition → the receipt assertion must fail; revert.
5. Record each mutation, the failing test name, and the restored diff in the AAR.

### Phase 4 — bookkeeping

1. `worklist.md`: mark F-R6-F-1, F-R6-F-2, and F-R6-F-4 `Resolved` with the test and line that prove each; the F-R6-F-2 note points at D-096 so the sweep record does not imply REQ-109 compliance for a store that was never transitioned. Refresh the REQ-109/REQ-110 evidence rows.
2. `ROADMAP.md`: remove § R6 ledger and receipt remediation; confirm 21 work items remain (22 before removal).
3. `DECISIONS.md`: add `### D-096: Legacy Claim-Source Retrieval Times (2026.11.10)` stating the residual for an already-encrypted store, naming `manage_kb (action: encryption, operation: rekey)` as the remediation, and recording the rejected migration instead.
4. `CHANGELOG.md`: add an entry under the current top version heading. `npm run version-sync` asserts the CHANGELOG top entry's version equals `package.json` (2026.11.7), so the new entry carries that version.
5. Draft `tasks.md` progressively; write `aar.md` after Phase 5 so its `LOOP PAUSED` reflects the verified tree.

### Phase 5 — verification and commits

1. `npm run check:fast` and `npm run test-debate-club` on the final tree; plus `npm run check` when the audit probe answers.
2. Split commits in convention order, each followed by `npm run typecheck`:
   - `fix(kb): persist unsourced findings and seal the ledger retrieval time` — `src/index.ts`, `src/kb-sqlite.ts`;
   - `fix(kb): stamp receipt source retrieval time at ingest` — `src/kb-receipt.ts`, `src/kb.ts`;
   - `test(kb): assert unsourced persistence, sealed timestamps, and receipt stamps` — `src/kb-claims.test.ts`, `src/kb-report-receipt.test.ts`, `debate-club/src/kb-ledger.test.ts`;
   - `docs(kb): resolve the R6 ledger and receipt findings and retire the section` — `worklist.md`, `ROADMAP.md`, `DECISIONS.md`, `CHANGELOG.md`, the increment record.
3. Report the commit list and stop before `npm run release`.

## Alternatives considered (summary)

- **Persist unsourced findings with a synthetic placeholder source.** Rejected in D1: the ledger would report a source that does not exist, which `verify_report`-style consumers would treat as evidence.
- **Add a second `retrieved_at` column with a sealed copy.** Rejected in D2: two columns for one value invites divergence, and the payload is already re-encoded on every transition.
- **Bump `SQLITE_FORMAT_VERSION` to force a migration.** Rejected in D2: the column layout does not change, so a version bump would refuse older stores for no compatibility reason.
- **Close the finding for new writes only and say nothing.** Rejected: the residual for a store encrypted by the previous build is real; D-096 records it with a remediation rather than leaving it unstated.
- **Reject snippet sources without a retrieval time.** Rejected in D3: it breaks the Source Register ingest path for the schema's own optional parameter.

## Edge cases and rollback

- **Zero-source claim and the `source_url` filter.** `claims()` compares against decoded edges; an empty edge list never matches, so the claim is filtered out of a URL-scoped query and returned by an unscoped one. No crash path.
- **A field-assignment mistake makes every finding a claim with the claim text as its topic.** The mapping uses `f.claim || f.topic` exactly as today; only the outer filter changes.
- **Legacy encrypted rows.** The read path falls back to the clear column so an upgraded store stays readable; the transition scrubs the value. If the store is locked, `init()` throws before any read and nothing is modified — there is no init-time write in this plan at all.
- **Mixed build or downgrade.** After this build writes or reseals a row, the previous build's `claimSources` reads `""` and reports an empty retrieval time (content is untouched), and its `resealAll` re-encodes `{url,title}` only, discarding the payload field. The change is therefore not downgrade-lossless for the retrieval time; see Rollback.
- **Existing receipts keep their digests.** `verifyReceipt` compares the stored manifest against its own stored digest and never regenerates timestamps, so previously stored receipts stay `verified`; only a re-ingest produces a manifest with a stamped source.
- **A missing `retrieved_at` in the caller's claim sources.** `src/index.ts` already defaults to `new Date().toISOString()` per source when recording the ledger; unchanged.
- **Rollback:** the code revert is clean (two source commits, one test commit, one docs commit). The data consequence is one-way for the clear copy of a retrieval time: rows written or resealed by this build have the timestamp only in the payload, so a revert reports an empty retrieval time for them and can drop the field on a later reseal. Content, sources, and hashes are unaffected. The AAR records that rollback is only fully lossless before a transition or a new verification writes rows.

## Verification

| Claim | How verified |
|---|---|
| An unsourced **batch** finding reaches the ledger | Arena `kb-ledger.test.ts`: `verify_claims` with `providers: ["duckduckgo"]`, finding asserted present with `sources: []`, then `action: claims` |
| The retrieval time is sealed at rest | Raw `claim_sources.retrieved_at` is empty while the ledger read returns the value (`src/kb-claims.test.ts`) |
| The timestamp survives a key transition | Enable/disable or rekey, then read the ledger back |
| A legacy clear value is scrubbed by the transition | Direct insert, transition, raw column empty, value still returned |
| A snippet-basis source carries a retrieval time | `src/kb-report-receipt.test.ts` manifest assertion |
| No regression in the tool surface | `check-tdqs`, `check-intent-citations`, `validate-spec`, `npm run test`, `test-debate-club` |
| Gates green | `check:fast` + explicit `test-debate-club`, then `check` (audit-conditioned) |

## Review independence

Self pass completed against this artifact. Cold pass (first pass) returned `independent-review FAILED.` with 1 Blocker (Arena step named a nonexistent `task_type` input) and 6 Majors (unversioned init-time migration, overstated rollback, unbacked scrub verification, unready Arena harness shape, batch-only premise, Arena excluded from the terminal gate); all are resolved in this revision, which drops the init-time migration in favor of the existing transition, names `providers: ["duckduckgo"]` and the harness shape, scopes F-R6-F-1 to batch mode, adds D-096, and promotes `test-debate-club` into terminal evidence. Diff re-review returned `independent-review passed.` with 2 Minors and 3 Nits, all folded in: the worklist note cites D-096, the Arena discovery mechanism is stated, the omitted `content_policy` pin is justified, the rekey remediation names the fresh-key-file requirement, and C-5's fallback is bounded.
