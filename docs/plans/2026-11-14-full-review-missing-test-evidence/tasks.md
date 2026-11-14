# Tasks — Close the full-review register's pure evidence rows

Execution order. A step is ticked only when it is verified.

## Step 0 — Baseline and row census

- [x] 0.1 Baseline recorded: `git log -1` → `e916ef4`, tree clean, version `2026.11.11`, 217 unpushed (oldest 4.7 d). `npm run check` → 21/22; the single failure was `check-loop-artifacts` (`missing aar.md`), expected mid-increment; `typecheck:scripts` run separately and passed.
- [x] 0.2 Every row re-located in `docs/plans/2026-11-09-full-review-sweep/worklist.md`; cited anchors re-checked (F-R5-D-7 `catch` now `src/corroborate.ts:701`).
- [ ] 0.3 Verdict per row: `still-open` / `already-closed` / `behavior-defect` / `blocked`.
- [ ] 0.4 Verdict table written here; the `still-open` set becomes the working set.
- [ ] 0.5 Test-only feasibility confirmed per row; a row needing a seam is `blocked` (C-2).

| # | Row | Verdict | Evidence |
|---|---|---|---|
| 1 | F-R4-A-3 | done | `src/fetch-page-extraction.test.ts` `redirect-hop cap` (2 tests) |
| 2 | F-R4-B-3 | blocked (C-2) — no second hermetic fetch renderer | `src/providers/jina.ts:6` hardcodes the base URL |
| 3 | F-R4-C-3 | partial — page-cap existing, depth-cap done, per-hop-guard blocked | `crawl attempt cap` + `crawl depth cap`; the guard cannot be refused on a loopback hop with `allow_private_urls: true` |
| 4 | F-R4-C-10 | done | named tags in `src/extract.test.ts`, `src/fetch-cache.test.ts` |
| 5 | F-R4-E-3 | done | four status tags in `src/structured-fact.test.ts` |
| 6 | F-R4-F-2 | done | `src/tool-surface.test.ts` `REQ-021 parameter contract` |
| 7 | F-R5-A-4 | pending | `src/verify-claims-bounds.test.ts` (new) |
| 8 | F-R5-A-5 | done | `src/corroborate.test.ts` `agreement-map classification` (green + yellow) |
| 9 | F-R5-B-3 | pending | `src/calibration.test.ts` |
| 10 | F-R5-B-4 | already-closed | `src/corroborate.test.ts:1945,1960,1983` assert `family_count` on a finding |
| 11 | F-R5-B-5 | already-closed | `src/corroborate.test.ts:1926-2013` drives weights/calibration through `reconcileClaims` |
| 12 | F-R5-B-10 | done | `src/source-family.test.ts` threshold 0.7 vs 0.8 |
| 13 | F-R5-C-7 | pending | `src/preservation.test.ts` |
| 14 | F-R5-D-4 | pending | `src/corroborate.test.ts` |
| 15 | F-R5-D-5 | pending | `src/corroborate.test.ts` |
| 16 | F-R5-D-6 | pending | `src/corroborate.test.ts` |
| 17 | F-R5-D-7 | pending | `src/corroborate.test.ts` |
| 18 | F-R5-E-4 | pending | `src/cite.test.ts` |
| 19 | F-R5-F-2 | pending | `src/retrieval-benchmark.test.ts` |
| 20 | F-R6-C-3 | pending | `src/kb.test.ts` |
| 21 | F-R6-D-3 | pending | `src/kb-encryption-tools.test.ts`, `src/kb-claims.test.ts`, `src/kb-action-evidence.test.ts` |
| 22 | F-R6-E-3 | pending | `src/kb-sqlite.test.ts`; drop the false tag |

## Step 1 — C1 fetch and extraction (rows 1, 3, 4)

- [x] 1.1 `F-R4-A-3`: end-to-end hop-cap assertion at the configured cap
      (`src/fetch-page-extraction.test.ts`, a loopback redirect chain, config
      `output.max_redirect_hops: 2`).
- [x] 1.2 `F-R4-C-3` page-cap: already asserted by `crawl attempt cap`
      (`src/fetch-page-extraction.test.ts:290`).
- [x] 1.3 `F-R4-C-3` depth-cap: `crawl depth cap` (a per-path loopback chain,
      config `crawl_max_depth: 1`).
- [ ] 1.4 `F-R4-C-3` per-hop-guard: **blocked** — with `allow_private_urls:
      true` a loopback hop is never refused, and with `false` the start hop is
      refused before the crawl loop. Residual recorded; the redirect-hop
      re-guard stays covered by `src/lib/url-guard.test.ts`
      `per-redirect-reguard`.
- [x] 1.5 `F-R4-C-10`: named tags on the REQ-021d/021e/021g test files
      (one tag line per branch, D3).
- [x] 1.6 Mutation proofs: hop cap (`max_redirect_hops` → literal 5) fails the
      cap test; depth cap (`maxDepth` → 99) fails the depth test.
      `npm run typecheck` green.

## Step 2 — C2 structured fact and tool surface (rows 5–6)

- [x] 2.1 `F-R4-E-3`: status-branch tags in `src/structured-fact.test.ts`.
- [x] 2.2 `F-R4-F-2`: REQ-021 parameter set, defaults, and `maxItems: 5` in
      `src/tool-surface.test.ts`.
- [x] 2.3 Mutation proof: `maxItems 5 → 6` fails the new test. `typecheck` green.

## Step 3 — C3 corroboration confidence (rows 8, 10–12)

- [x] 3.1 `F-R5-A-5`: green (three families, 0.9 ≥ 0.8) and yellow (0.7 in
      [0.5, 0.8)) through `corroborate`.
- [x] 3.2 `F-R5-B-4`: already asserted; disposition only.
- [x] 3.3 `F-R5-B-5`: already asserted through `reconcileClaims`; disposition
      only.
- [x] 3.4 `F-R5-B-10`: threshold 0.7 merges and 0.8 splits the same pair.
- [ ] 3.5 Mutation proof for the two new tests; `typecheck`; commit.

## Step 4 — C4 corroborate KB recall (rows 7, 14–17)

- [ ] 4.1 `F-R5-A-4`: REQ-026g dual-input rejection, empty-list rejection, and
      the `max_batch_claims` bound in a new spawned-server suite
      `src/verify-claims-bounds.test.ts`.
- [ ] 4.2 `F-R5-D-4`: KB result cap — the limit passed to `kbSearch` and the
      truncation report.
- [ ] 4.3 `F-R5-D-5`: source-URL propagation asserted by value.
- [ ] 4.4 `F-R5-D-6`: recall-before-external ordering.
- [ ] 4.5 `F-R5-D-7`: failing-KB `catch` exercised; the external pass still runs.
- [ ] 4.6 Mutation proof; `typecheck`; commit.

## Step 5 — C5 calibration, preservation, citations (rows 9, 13, 18)

- [ ] 5.1 `F-R5-B-3`: `capConfidence(..., {enabled:false})` and config
      `calibration.enabled:false` reaching a finding.
- [ ] 5.2 `F-R5-C-7`: REQ-122 document-vs-snippet and truncated-copy tags.
- [ ] 5.3 `F-R5-E-4`: REQ-027a zero-result and all-exhausted tags.
- [ ] 5.4 Mutation proof (tag rows: the tag names a branch whose driving test
      is cited in the register note); `typecheck`; commit.

## Step 6 — C6 retrieval benchmark (row 19)

- [ ] 6.1 `F-R5-F-2`: assert `baseline.raw`, `cases`, `version`, and `k`.
- [ ] 6.2 Mutation proof; `typecheck`; commit.

## Step 7 — C7 KB freshness and state (rows 20–22)

- [ ] 7.1 `F-R6-C-3`: REQ-075 decay reduction, zero-decay exemption, and
      freshness ordering in `src/kb.test.ts`.
- [ ] 7.2 `F-R6-D-3`: lock refusal (`src/kb-claims.test.ts`), `stats.encryption`
      (`src/kb-action-evidence.test.ts`), locked-status reachability and
      key-source precedence (`src/kb-encryption-tools.test.ts`).
- [ ] 7.3 `F-R6-E-3`: REQ-108 clause (a) asserted in `src/kb-sqlite.test.ts`;
      remove the false tag in `src/test-isolation.test.ts:1`.
- [ ] 7.4 Mutation proof; `typecheck`; commit.

## Step 8 — C8 tracker, roadmap, release note

- [ ] 8.1 `worklist.md`: every closed row → `Resolved` with test file and line;
      refresh any REQ evidence row for the same REQ.
- [ ] 8.2 `ROADMAP.md`: correct the section counts to the census; retire the
      section if no row survives, otherwise state the residual. Add one bullet
      to § Full-review register reconciliation for the D3 detector limitation
      (`clauseTagsFromPayload` cannot bind a tag to a driving test).
- [ ] 8.3 `CHANGELOG.md`: one entry.
- [ ] 8.4 `npm run validate-spec`, `npm run check-gate-coverage`,
      `npm run check:fast`.
- [ ] 8.5 Write `aar.md`: disposition register, the cold-pass outcome, and the
      line-initial `**Review cap:** 2; used <n> passes` plus the terminal token.

## Planned mutation proofs (D5)

| Row | Mutation that must break the new assertion |
|---|---|
| F-R4-A-3 | pass a literal 5 instead of `config.output.max_redirect_hops` |
| F-R4-C-3 | `maxDepth = 99` |
| F-R4-F-2 | `maxItems 5 → 6` |
| F-R5-A-5 | widen the green band to "always green" |
| F-R5-B-10 | hardcode 0.9 in `assignSourceFamilies` |
| F-R5-D-4 | ignore the KB result cap |
| F-R5-D-5 | emit the count without the URL |
| F-R5-D-6 | move the external pass ahead of recall |
| F-R5-D-7 | rethrow from the KB `catch` |
| F-R5-F-2 | corrupt `baseline.version` in the fixture |
| F-R6-C-3 | skip the decay reduction |
| F-R6-D-3 | return unlocked status for a locked store |
| F-R6-E-3 | remove the clause-(a) assertion |
| Tag rows (4, 5, 13, 18) | none: a tag is proved by naming a branch that the cited driving test exercises (D5) |
