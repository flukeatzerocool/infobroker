# Plan — Corroboration pool routing and provenance fidelity

**Status:** plan-review — cold pass passed (0 blockers; 5 majors and 5 nits
resolved), one diff re-review raised a Major on the commit series (resolved
in-text), and a third, user-authorized targeted re-review (cap waived) raised
two prose Majors (header history, rollback granularity) which this revision
applies; the residual amendments are conditions for `build-review`
· **Date:** 2026-11-14
**Depth:** standard — three source sites in one module, one new REQ plus one amended REQ, five registration surfaces, and a review register; every change is reversible
**Review independence:** fresh — three cold dispatches (initial, diff
re-review, user-authorized targeted re-review) over frozen artifacts; no
reviewer saw the authoring context
**Rollback cost:** 1 — a commit-series revert restores code, spec, and register
**Roadmap item:** `ROADMAP.md:17-31` § Corroboration, citation, and benchmark fidelity (section stays open; this increment closes three of its seven rows)
**Predecessor:** `09a1374`
**Findings:** `F-R5-A-3`, `F-R5-C-4`, `F-R5-C-6`

## Scope

Three register rows, each re-verified against the current tree rather than
trusted from the roadmap text.

1. **`F-R5-A-3` — the caller's allowlist is discarded by `privacy`, and
   `quality` has no branch.** `applyPriority` (`src/corroborate.ts:498-524`)
   returns the whole `privacy_critical` chain for `privacy` (`:503-505`),
   so a caller who passed `providers: ["wikipedia"]` is served
   searxng/mojeek/duckduckgo instead. The replacement happens *after* the
   operational filter (`:626-638`), so the chain can also re-admit a provider
   that `providerOperational` had just rejected. `quality` falls through to
   `return slugs` (`:523`), so the intent has no defined effect. The current
   contract is pinned by a test ("is a no-op for the quality intent",
   `src/corroborate.test.ts:1604-1606`) and by `README.md:750`.
2. **`F-R5-C-4` — a source that arrives already hashed is never graded.**
   `snapshotCondensedSources` schedules a source only when
   `!source.content_sha256` (`src/corroborate.ts:936`). This is a latent hole
   rather than a reachable defect today: the KB recall mapping (`:689-699`)
   deliberately copies only title, url, snippet, source_type, provider, and
   retrieval_origin, and no provider or normalizer populates
   `SearchResult.content_sha256` (only the deep-read path, `src/deep-search.ts:
   105`, does). It is still a defect against REQ-122, which requires every
   cited source's snapshot to report its grade: a caller that supplies results
   through the `searchers` option (`:604`, `:738-757`) — the documented test
   seam, and any embedder — can hand in a hashed source, which then reaches
   `provenance.sources[]` (`:909-920`) with a `content_sha256` and no
   `snapshot_tier`, `snapshot_basis`, or `snapshot_truncated`. Wiring the KB
   recall hash into `:689-699` would make the hole reachable; that is a
   separate behaviour change and is out of scope here.
3. **`F-R5-C-6` — provenance has no per-finding attribution.** The flat
   `provenance.sources[]` projection (`src/corroborate.ts:909-921`) names the
   URL, timestamps, and snapshot fields but not the finding a source supports,
   and the top-level `source_types` (`:879-885`) is a single global tally
   across every finding. A finding does carry its own `source_types`
   (`:846-858`), so the surviving defect is the missing finding index on each
   provenance source: with a two-claim batch a consumer cannot tell which
   finding a recorded source belongs to.

**Not in scope, and why.**

- **`F-R5-C-8`** (preservation awaited inline) is not a local fix: REQ-026c
  requires preservation to be non-blocking, while REQ-122 requires the
  response to report the snapshot hash and freshness tier. Those two
  contracts cannot both hold for work deferred past the response. The
  increment that takes C-8 must choose (defer and report a pending state,
  with a REQ-122 amendment and a DECISIONS record) or re-disposition it as a
  bounded inline budget. Folding that decision into this increment would make
  a routing/provenance change carry an unannounced contract change.
- **`F-R5-E-1`, `F-R5-E-2`** live in `src/cite.ts` and the citation contract
  (REQ-027a); **`F-R5-F-1`** lives in `src/retrieval-benchmark.ts` (REQ-130).
  Separate modules and separate concerns, left scheduled on the same roadmap
  section.

## Baseline (verified this session)

- `git log -1` → `09a1374`; `git status --short` → clean.
- `npm run status` → 249 unpushed commits, oldest 5.0 d, version `2026.11.11`,
  latest tag `v2026.11.07`, 2 open roadmap items, last pipeline run
  2026-11-07. The backlog is past AGENTS' 24 h AAR trigger; it is recorded
  here and handled at session close, not folded into this increment.
- `npm run check` → **PASS**, full suite, 162.7 s, recorded for `09a1374b3785`.
  Pre-existing, not this increment's: `2026-11-10-r6-encryption-capacity-
  remediation` warns `plan.md has no **Done bar:** line`; `npm audit` reports
  5 advisories (4 low, 1 moderate, none high/critical, so the gate passes).
- **Register census today** (`docs/plans/2026-11-09-full-review-sweep/
  worklist.md:585`): 276 rows, 276 distinct IDs; `Resolved` 176,
  `Scheduled-roadmap` 7, `Closed-P3` 93. All 7 scheduled rows are the ones
  named in this roadmap section.
- **Interim gate state:** once this directory exists, `check-loop-artifacts`
  reports `missing tasks.md`/`missing aar.md` until both are written.
  `tasks.md` is created with the plan; `aar.md` is written at close.

## Design decisions

- **D1 — `privacy` filters the pool instead of replacing it.**
  `applyPriority` keeps the input order and returns
  `slugs.filter((s) => privacyChain.includes(s))`. When the intersection is
  empty the caller's list is returned unchanged. Rejected: returning the
  privacy chain (violates the allowlist this finding is about); throwing
  `UnusableProviderError` (turns a routing preference into a request
  failure, and the caller's providers *are* usable — they are merely not
  private).
- **D2 — `quality` orders the pool by configured provider priority.**
  Reuse `orderFirstPassPool` (`src/corroborate.ts:530-536`) so the whole pool,
  including gap-refinement rotation, reflects the authority order the
  first-pass cap already uses. Rejected: leaving it a no-op (the finding's
  defect); sorting by `authority_weights` (duplicates confidence math in a
  routing function and would couple two contracts).
- **D3 — a pre-hashed source is re-snapshotted, not synthesised into a
  graded one.** The scheduling predicate becomes "no hash **or** no
  `snapshot_tier`", and a successful snapshot overwrites the hash with the
  stored snapshot's hash so hash and tier/basis describe the same artifact.
  Because no production path supplies a corroboration hash today, this guards
  the reachable caller path rather than changing live behaviour; when a hash
  did come from a stored document, the live snapshot supersedes it, and that
  is the intended precedence (the response describes the snapshot it can
  retrieve).
  Rejected: inventing `snapshot_basis: "snippet"` for an ungraded hash (that
  fabricates the provenance REQ-122 asks us to report accurately); rejected:
  storing a second, parallel hash field (two hashes for one source is a
  worse contract than one hash that always covers the stored snapshot).
- **D4 — per-finding attribution is additive.** `provenance` gains
  `findings: Array<{ index: number; source_types: Record<string, number> }>`
  and every `provenance.sources[]` entry gains `finding_index`, the position
  of the finding in the returned `findings` array (D4 never uses
  `claim_index`, which skips when duplicate claims collapse). The two halves
  answer the two halves of the finding: the type contribution moves from one
  global tally to a per-finding record, and the flat source list becomes
  attributable. The global `source_types` stays for back-compatibility.
  `compact` output already deletes `provenance` entirely
  (`src/index.ts:2228`), so no compact change is needed.

## Contract surfaces checked

- **Sibling surfaces binding the same intent.** REQ-020c
  (`infobroker.md:247`) owns `search_web`'s priority semantics and defines
  `quality` as "the default dispatch chain"; it does not bind `verify_claims`,
  and `search_web` takes a singular `provider` (`:238`), so its privacy
  selection has no allowlist to replace. `src/chain.ts:54-83` (`selectChain`)
  is therefore left unchanged. The real collision is **non-REQ prose**:
  §7.4 Priority Routing (`infobroker.md:912-926`) tables `privacy` as replacing
  the chain and `quality` as unchanged, and the §3 glossary
  (`infobroker.md:174`) defines "Routing priority" as a `search_web`
  parameter only — the same two behaviours D1/D2 reverse. Step 1 scopes §7.4
  to `search_web`, adds the corroboration behavior, and extends the glossary
  term; the module comment that cites "REQ-026/§7.4" is updated in step 2.
- **Registration surface.** `check-intent-citations` (REQ-107) resolves tool
  routing citations against the live schema; REQ-026i adds a requirement, not
  an operation, so the check is run to prove no citation target moved.
  Parameter descriptions that state the intent live at `src/index.ts:2150`
  and are updated with the behavior; the `search_web` enum at `:1998` is
  untouched.
- **Interface seam.** No storage seam: `provenance` is response-only and
  nothing persisting reads it (`kbRecordClaims` at `src/index.ts:2214-2226`
  builds its own source projection).
- **Trust boundary.** Every premise above is `repo` evidence (source, spec,
  register, config). No web or tool-output content is an input to this plan.

## Steps

Each step names its files and its verification. The deliverable is four
commits (steps 1–3 land as one), so `npm run typecheck` runs on the code
commit and again before each later commit; `npm run check` runs once on the
close-time tree.

1. **Spec — new REQ-026i and REQ-026d amendment.**
   - Add `**REQ-026i — corroboration routing intent**` after REQ-026h
     (`infobroker.md:340`). Body (draft, ≤800 chars, ≤8 sentences, ≤8 SHALL,
     ≤5 backticks):
     "WHEN `verify_claims` receives a `priority`, it SHALL route its
     corroboration pool by that intent within the caller's provider list. A
     caller-supplied list SHALL bound the pool and SHALL NOT be replaced by a
     dispatch chain. `privacy` SHALL restrict the pool to providers that do
     not forward queries to third parties. `quality` SHALL order the pool by
     configured provider priority. `free_only` SHALL exclude keyed and
     self-hosted tiers. WHEN no provider in the list satisfies the intent,
     the list SHALL be used unchanged. _Check:_ G1."
   - Amend REQ-026d (`infobroker.md:328`, currently 369 chars) with one
     sentence: "Each recorded source SHALL identify the finding it supports."
   - Register the new REQ on every surface: the §9.5 manifest table
     (`infobroker.md:1279`, after the REQ-026h row), the §D feature-taxonomy
     coverage row for Corroboration (`infobroker.md:1872`), the §9.2 G1
     verification checklist (`infobroker.md:1137-1138` region), the §7.4
     Priority Routing section (`infobroker.md:912-926`, which today tables
     `privacy` and `quality` for `search_web` only — scope it to `search_web`
     and add the corroboration behaviour), and the §3 glossary term "Routing
     priority" (`infobroker.md:174`, which names only `search_web`).
   - Checklist bullet text: "Routing intent: pass a caller
     list with `priority:"privacy"` → verify only private providers from that
     list are called and the list is not replaced; pass `priority:"quality"`
     → verify the pool is ordered by provider priority (REQ-026i)".
   - Verify at the joint commit boundary (after step 3):
     `npm run validate-spec` (body limits, manifest parity, traceability) and
     a recorded body character count. `validate-spec` also requires the
     `@implements` citation, which arrives in step 3, so steps 1–3 land as one
     commit (see Commit series).
2. **Source — three sites in `src/corroborate.ts`.**
   - `applyPriority` (`:498-524`): privacy intersects, quality orders by
     `config.providers[slug].priority` descending (reuse `orderFirstPassPool`),
     and the comment at `:495-497` now cites REQ-026i instead of "§7.4".
   - `snapshotCondensedSources` (`:936`): schedule when
     `!source.content_sha256 || !source.snapshot_tier`.
   - `corroborate` (`:879-921`): build `findings` and emit `finding_index`
     per provenance source. **`finding_index` is the position of the finding
     in the returned `findings` array**, taken from the `condensed` map
     (`:846-858`) — not `claim_index`, which is the caller's input index and
     jumps when duplicate claims collapse (`:659-666`, `:840-843`).
   - `src/types.ts:505-519`: extend `CorroborationProvenance` with
     `findings` and the per-source `finding_index`, `snapshot_tier`,
     `snapshot_basis`, `snapshot_url`, `snapshot_truncated` fields the
     implementation already emits.
   - `src/index.ts:2150`: the `verify_claims` priority parameter description — name
     the `quality` effect and that `providers` bounds the pool. The
     `search_web` enum at `:1998` is untouched (REQ-020c governs it).
   - Verify: `npm run typecheck`.
3. **Tests — `src/corroborate.test.ts`.**
   - Replace the "no-op for the quality intent" case (`:1604-1606`) with a
     priority-order assertion and add: privacy + explicit `providers` list
     calls only listed private providers; privacy with a list containing no
     privacy provider leaves the list intact.
   - Add a source that arrives with a pre-existing `content_sha256` and no
     tier. Inject it through `corroborate`'s `searchers` option (the same seam
     the suite already uses, `src/corroborate.test.ts:657-663`), with
     `snapshotSource` mocked as in `:680-701`; verify `snapshot_tier` and
     `snapshot_basis` are present and `content_sha256` equals the stored
     snapshot hash.
   - Add a batch whose claims repeat non-adjacently (`["a", "b", "a", "c"]`)
     → every `provenance.sources[]` entry carries a `finding_index` that
     indexes the returned `findings` array (contiguous 0..n-1), and
     `provenance.findings[].source_types` sum to the global tally.
   - Clause tags: `// @implements REQ-026i privacy-within-list`,
     `// @implements REQ-026i quality-ordering`,
     `// @implements REQ-026i intent-unfulfilled`,
     `// @implements REQ-026d finding-attribution`.
   - Verify: `npx vitest run src/corroborate.test.ts`,
     `npm run check-gate-coverage`.
4. **Register — `docs/plans/2026-11-09-full-review-sweep/worklist.md`.**
   Mark rows `:742` (`F-R5-A-3`), `:763` (`F-R5-C-4`), `:765` (`F-R5-C-6`)
   `Resolved 2026-11-14` with the driving test as evidence, and update the
   REQ-026d verdict-table row (`:304`), whose "global across findings with no
   finding attribution" claim this increment retires. Re-derive the
   disposition census with `docs/plans/2026-11-14-register-reconciliation/
   evidence/census.ts` (never by delta) and update the **disposition** row at
   `:585`: expected `Resolved` 179, `Scheduled-roadmap` 4. Do not touch the
   severity row at `:584` — its P0–P3 tally sums to 272 against 276 rows, a
   pre-existing inconsistency outside this increment.
5. **Roadmap — `ROADMAP.md:17-31`.** Retire the `F-R5-A-3` bullet; rewrite
   the preservation bullet to keep only `F-R5-C-8` with its blocking decision
   recorded; keep the citation/benchmark bullet. Section stays open.
   Verify: `npm run check-roadmap`.
6. **README — `README.md:750`.** Replace "`priority` orders the first-pass
   provider pool for `verify_claims`" with the actual contract (privacy
   restricts within the listed providers, quality orders by provider
   priority, the list bounds the pool). REQ-026d's amendment also requires a
   README diff (spec→README binding). Verify: `npm run validate-readme`.
7. **Version stamp and CHANGELOG.** The version gate pins the CHANGELOG's top
   entry date to `package.json`, so both move together: rewrite every version
   site with `npx tsx scripts/version.ts set 2026.11.14` (it rewrites
   `package.json`, `package-lock.json`, the `src/index.ts` McpServer version,
   `server.json`, `AGENTS.md`, the `infobroker.md` spec version, and the
   README spec reference plus its `Last updated:` stamp) and seed
   `## 2026.11.14 — <title>` with the bullets naming REQ-026i, the three fixed
   rows, and the provenance field addition. Verify: `npm run version-sync`.
8. **Targeted gates, then the full gate at close.** Run the targeted suite
   (`typecheck`, `validate-spec`, `check-gate-coverage`, `validate-readme`,
   `check-roadmap`, `check-intent-citations`, `version-sync`, the corroborate
   tests). The full `npm run check` runs **after** the close AAR is written:
   `check-loop-artifacts` treats a missing `aar.md` as an error, so the full
   suite is green only on the close-time tree.

## Commit series

The deliverable is four commits in convention-bucket order; each earlier
commit passes its own gate before the next is staged.

1. `feat(verify): define and implement corroboration routing intent` —
   steps 1–3 as **one** commit: `infobroker.md` (REQ-026i body, REQ-026d
   sentence, §9.5 manifest row, §D taxonomy row, §9.2 checklist bullet, §7.4
   scoping, §3 glossary), `src/corroborate.ts`, `src/types.ts`,
   `src/index.ts`, `src/corroborate.test.ts`. This is not a stylistic choice:
   `validate-spec` fails a REQ with no `@implements` citation, and AGENTS §
   Spec Authoring requires the tags in the same commit as the REQ change, so
   a spec-only commit cannot pass its own gate. Gate: `npm run validate-spec`,
   `npm run typecheck`, `npx vitest run src/corroborate.test.ts`,
   `npm run check-gate-coverage`.
2. `docs(tracker): retire three corroboration rows` — `worklist.md`,
   `ROADMAP.md`. Gate: `npm run typecheck`, `npm run check-roadmap`, plus the
   census re-derivation.
3. `docs(readme): describe the corroboration routing contract` —
   `README.md`. Gate: `npm run typecheck`, `npm run validate-readme`.
4. `release: 2026.11.14` — version sites plus `CHANGELOG.md`. Gate:
   `npm run typecheck`, `npm run version-sync`; the full `npm run check` runs
   at close, once `aar.md` exists.

## Edge cases and rollback

- **Empty privacy intersection** → caller list unchanged (D1), covered by a
  test; no error path added.
- **A pre-hashed source whose snapshot is refused** (content policy, fetch
  failure) keeps its arriving hash and stays ungraded. That is the honest
  outcome and matches today's behaviour for a refused snapshot; the test
  asserts the success path only.
- **A source with no `http`/`https` URL** is still scheduled; `snapshotSource`
  returns null for a non-http URL (`src/preservation.ts:63`) and the source is
  left unchanged. The provenance fix does not change this; noted as a
  residual, not a blocker.
- **Finding index semantics** — `finding_index` is the position in the
  returned `findings` array, which is contiguous even when duplicate claims
  collapse and `claim_index` skips (see D4 and step 2); it is never undefined.
- **Rollback:** the series is four commits; steps 1–3 land as one because the
  REQ citation must ship with the REQ. Reverting the series restores the
  previous contract with no data migration (provenance is response-only,
  nothing persisted reads it). Reverting only the tracker/README/release
  commits leaves the behavior change in place.

## User impact

- No restart or manual migration: the field additions are response-only and
  appear in verbose output; compact output is unchanged (provenance is already
  deleted there).
- One intentional behavior change: `priority:"privacy"` with an explicit
  `providers` list now calls only the listed private providers instead of
  substituting the privacy chain. `priority:"quality"` now orders the pool
  instead of doing nothing. Both are documented in the README in the same
  commit.

## Verification

- Each gate runs at the step whose Verify line names it:
  `npx vitest run src/corroborate.test.ts` and `npm run typecheck` on the
  step-2/step-3 working tree, `validate-spec` and `check-gate-coverage` first
  at the joint step-1–3 commit boundary (the `@implements` citation does not
  exist before step 3), and `validate-readme`, `check-roadmap`,
  `check-intent-citations`, and `version-sync` at the step or commit that
  changes their input.
- The full `npm run check` runs once at close, **after `aar.md` is written**;
  `check-loop-artifacts` is an error gate and a missing AAR would otherwise
  make the full suite unachievable. Record the wall time and run key in
  `tasks.md`.
- Manual spot-check: one `verify_claims` batch call through the handler
  asserting the provenance shape in verbose mode and its absence in compact
  mode.

## Done bar

**Done bar:** all of the following hold on the final tree:

1. `F-R5-A-3`, `F-R5-C-4`, and `F-R5-C-6` each carry `Resolved` in
   `worklist.md` with a driving test named as evidence; the `F-R5-C-6` verdict
   row (`:304`) no longer claims the provenance is unattributed; and the
   disposition census (`:585`) is re-derived (not delta-adjusted) with
   `Resolved` 179 / `Scheduled-roadmap` 4.
2. `REQ-026i` exists with a manifest row, a taxonomy citation, a
   verification-checklist bullet, the §7.4 and §3 prose aligned, and a test
   tag; REQ-026d names the finding attribution; `npm run validate-spec` passes.
3. The four clause-tag tests pass and `npm run check-gate-coverage` reports no
   uncited G1 REQ.
4. On the close-time tree, `npm run check` is green (after `aar.md` exists),
   `npm audit` still has no high/critical finding, and
   `check-loop-artifacts` reports 0 errors for this increment.
5. `ROADMAP.md` no longer claims A-3, C-4, or C-6, and still schedules C-8
   with its decision stated; `README.md` describes the routing contract the
   code now implements; `CHANGELOG.md` carries the `2026.11.14` entry and
   `npm run version-sync` passes.

## Review cap

**Review cap:** 2 cold passes (the plan gate at standard depth, then one
permitted diff re-review). A third dispatch needs user authorization recorded
in the AAR.

## Files expected

- `infobroker.md`
- `src/corroborate.ts`
- `src/types.ts`
- `src/index.ts`
- `src/corroborate.test.ts`
- `README.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `package.json`
- `package-lock.json`
- `server.json`
- `AGENTS.md`
- `docs/plans/2026-11-09-full-review-sweep/worklist.md`
- `docs/plans/2026-11-14-corroboration-routing-and-provenance/plan.md`
- `docs/plans/2026-11-14-corroboration-routing-and-provenance/plan.cold/report.md`
- `docs/plans/2026-11-14-corroboration-routing-and-provenance/plan.cold/re-review.md`
- `docs/plans/2026-11-14-corroboration-routing-and-provenance/plan.cold/re-review-3.md`
- `docs/plans/2026-11-14-corroboration-routing-and-provenance/tasks.md`
- `docs/plans/2026-11-14-corroboration-routing-and-provenance/aar.md`

Blast radius: 4 source files (`corroborate.ts`, `types.ts`, `index.ts`, the
test), 5 documentation files, 1 register file. No config, dependency, schema
migration, or destructive operation.

## Evidence

Preflight sidecar to be generated after the plan is final:
`plan-gate.mjs preflight --project /home/fluke/Infobroker --plan <this file>
--target <each Files expected path> --req REQ-026 --req REQ-026d --req
REQ-026i --req REQ-122`.

## Conditions

Filled in by the plan gate.
