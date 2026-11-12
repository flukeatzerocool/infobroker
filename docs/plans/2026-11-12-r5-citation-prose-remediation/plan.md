# R5 citation and prose remediation

**Done bar:** F-R5-E-3 is pinned by a spawned-server test that fails on the
current tree and passes after the change (compact `get_citations` keeps
per-provider status, and a zero-result answer keeps the provider list and
diagnostic); F-R5-G-1's §8.2 independence paragraph matches REQ-121 and
`src/source-family.ts`; `typecheck`, `validate-spec`, `validate-readme`,
`check-roadmap`, `test`, `test-debate-club`, and `npm run check` pass;
`CHANGELOG.md` records the behavior change; the roadmap section is retired, and
both the register rows and the verdict rows that name the two findings are
dispositioned `Resolved`.

**Date:** 2026-11-12 · **Roadmap section:** § R5 citation and prose remediation
**Findings:** F-R5-E-3, F-R5-G-1 · **Gate depth:** standard · **Rollback cost:** 1

## Evidence

- **F-R5-E-3** — `src/index.ts:2684-2701` builds `meta` only when
  `compactMode` is off. The per-provider status and zero-result diagnostic that
  REQ-027a requires unconditionally therefore never reach a compact caller.
  Two mechanisms are involved: the handler's own `compact ? undefined : …`
  branch, and the global shaper — `instrumentTool` (`src/index.ts:1823-1835`)
  calls `finalizeToolResult`, which applies `compactEnvelope`
  (`src/structured-output.ts:91-92`) and rewrites the text from the compacted
  object. `compactEnvelope` keeps only `REQUIRED_META_KEYS` = `per_query`,
  `fact_status`, `language_unsupported` (`src/verbosity.ts:24`) and deletes
  `meta` when none survive. Reproduced over the spawned server with
  `output.verbose: false` and a loopback academic-chain stub: the `[OK]` body
  carried `status`, `provider`, and `results` only — no `meta` key at all.
  Non-compact output carries `meta.providers`, `meta.deduped`, and the
  zero-result `no_results`/`diagnostic` pair.
- **F-R5-G-1** — §8.2 defines independence as "different registrable domains"
  (`infobroker.md:1030-1032`), while `computeConfidence` counts `source_family`
  (`src/corroborate.ts:377-400`) and `assignSourceFamilies` merges inputs on
  canonical-URL identity or text overlap at the configured
  `corroboration.family_similarity_threshold` (default 0.9) in addition to
  same-domain collapse (`src/source-family.ts:100-118`). REQ-121
  (`infobroker.md:342`) already states the family contract and `family_count`
  is implemented (`src/corroborate.ts:287`); §8.2 contradicts it.

## Changes

### 1. Tool-scoped required metadata under compact verbosity — M

- `src/verbosity.ts`: give `compactEnvelope` and `pickRequiredMeta` an optional
  `requiredMetaKeys` parameter defaulting to the current `REQUIRED_META_KEYS`,
  and export a named `CITATION_REQUIRED_META_KEYS = ["providers", "no_results",
  "diagnostic"]`. Existing callers keep today's behavior.
- `src/structured-output.ts`: thread an optional `requiredMetaKeys` through
  `finalizeToolResult` into its `compactEnvelope` call.
- `src/index.ts`: `instrumentTool` passes `TOOL_REQUIRED_META[name]` (one entry:
  `infobroker_get_citations` → `CITATION_REQUIRED_META_KEYS`). The
  `get_citations` handler always emits its full meta (`query_time_ms`,
  `deduped`, `providers`, and the zero-result `no_results`/`diagnostic` pair);
  the `compact ? undefined : …` branch and the now-dead `...(meta ? { meta } :
  {})` guard at `:2708` go away, so compaction happens in one place. Error
  paths are untouched.
- Sibling contracts: REQ-027 (reference fields and BibTeX) and REQ-079
  (compact omits *optional* metadata while required fields survive) bound the
  same response; `results` and the REQ-001 envelope are untouched, and only
  metadata REQ-027a requires survives compaction. No parameter or tool-schema
  change, so the REQ-107 routing files and the TDQS surface are unchanged;
  `npm run check` runs `check-intent-citations`, `check-tdqs`, and
  `check-harness-expectations` over them and must stay green.
- **Rejected alternative:** adding the three keys to the global
  `REQUIRED_META_KEYS`. Every tool's compact meta would then retain
  `no_results`/`diagnostic` even where no REQ requires them, changing compact
  `search_web` output beyond this finding. The cold review's blocker was that a
  handler-local fix is inert because the global shaper re-compacts; a
  tool-scoped key set fixes the real seam without widening behavior.

### 2. Regression coverage — M

- `src/verbosity.test.ts`: cases for `compactEnvelope` with an explicit
  required-key set — `providers`/`no_results`/`diagnostic` survive, optional
  keys still drop, and the default set is unchanged — plus `pickRequiredMeta`
  with an explicit set.
- `src/structured-output.test.ts`: one case that `finalizeToolResult` with a
  tool-scoped key set keeps those meta keys in both `structuredContent` and the
  rewritten text.
- `src/dispatch-orchestration.test.ts` (the spawned-server harness): add
  `@implements REQ-027a` and a `citations()` call helper modeled on `search()`
  (`:101-105`). Case 1 boots the server with
  `provider("stub_a", a.url)` (the in-file idiom that gives the stub its
  `url`), `chains: { academic: ["stub_a"] }`, and
  `output: { verbose: false }`, then asserts `meta.providers` contains
  `{ slug: "stub_a", status: "ok" }`. Case 2 uses stub `mode: "empty"` and
  asserts `meta.providers` names `stub_a`, `meta.no_results === true`, and
  `meta.diagnostic` contains `stub_a`, with `status: "ok"` and empty
  `results`. Both fail on the current tree (verified: the compact body has no
  `meta`), so they are red before the fix.
- No `src/cite.ts` change: the handler-level guard was the wrong seam and the
  shaper owns compaction.

### 3. Align §8.2 independence with source families — S

Replace the registrable-domain-only independence paragraph in
`infobroker.md` (§8.2, currently lines 1030-1032) with one that states
independence is counted in source families per REQ-121: sources sharing a
canonical URL, republishing substantially the same text at
`corroboration.family_similarity_threshold`, or sitting on one registrable
domain are one family; the ladder counts families, and each finding reports
its family count. The example sentence keeps the wikipedia/britannica contrast
and adds the republished-copy case. No REQ body changes.

### 4. Records and roadmap — S

- `CHANGELOG.md`: one bullet under the existing `## 2026.11.11 — …` heading
  (header must stay equal to `package.json` for `version-sync`) covering the
  compact `get_citations` metadata guarantee and naming `src/verbosity.ts`,
  `src/structured-output.ts`, `src/index.ts`, the three test files, and
  REQ-027a.
- `ROADMAP.md`: remove the `## R5 citation and prose remediation` section.
- `docs/plans/2026-11-09-full-review-sweep/worklist.md`:
  - Register rows (F-R5-E-3 at `:778`, F-R5-G-1 at `:787`) take the dated
    resolved form used elsewhere in the register (`**Resolved 2026-11-12** —`
    plus a one-clause evidence note).
  - Verdict rows: the verdict cell at `:314` and `:324` changes from
    `finding:F-R5-E-3` / `finding:F-R5-G-1` to the same dated resolved note,
    and the predicate's stale line references (`src/index.ts:2512-2551`,
    `:2536-2551`, `infobroker.md:1013-1015`) are corrected to the live ones.
  - The M1 reconciliation block (`:585`) is a dated 2026-11-10 snapshot and is
    left unchanged. Its disposition census already lags a later disposition
    (F-R5-A-1 at `:740`), so bumping it by two would leave a number that is
    still wrong; the register rows are the maintained surface.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/verbosity.ts` | parameterized required-key set + citation keys | M |
| `src/structured-output.ts` | thread the key set through `finalizeToolResult` | S |
| `src/index.ts` | per-tool key map; `get_citations` emits full meta | M |
| `src/verbosity.test.ts` | shaper cases | S |
| `src/structured-output.test.ts` | finalize case | S |
| `src/dispatch-orchestration.test.ts` | citations helper + two spawned-server cases | M |
| `infobroker.md` | §8.2 independence paragraph | S |
| `CHANGELOG.md` | one bullet | S |
| `ROADMAP.md` | retire one section | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | two register rows + two verdict rows | S |

No config, dependency, data, or schema changes. No network in the new tests:
the stub answers on loopback and every other provider stays disabled.

## Verification

1. Red first: run the two new spawned-server cases before the change and record
   the failure (compact body lacks `meta`).
2. `npx vitest run src/verbosity.test.ts src/structured-output.test.ts
   src/dispatch-orchestration.test.ts` — green after the change.
3. `npm run typecheck`, `npm run validate-spec`, `npm run validate-readme`,
   `npm run check-roadmap`, `npm run version-sync`.
4. `npm run test` and `npm run test-debate-club` (the Arena citations scenario
   reads non-compact output and must stay green).
5. Final `npm run check` on the completed tree.

## Commit order

1. `fix(citations): retain REQ-027a metadata under compact verbosity` —
   `src/verbosity.ts`, `src/structured-output.ts`, `src/index.ts`, the three
   test files; `npm run typecheck` after.
2. `docs(spec): define independence by source family` — `infobroker.md`;
   `npm run validate-spec` after.
3. `docs(roadmap): resolve the R5 citation and prose findings` —
   `CHANGELOG.md`, `ROADMAP.md`, the worklist; `npm run check-roadmap` and
   `npm run version-sync` after.
4. `docs(plans): record the R5 citation and prose increment` — this plan,
   `tasks.md`, and the AAR (ending in a loop token).

## Failure modes

- **The generic_http provider returns no citation:** the academic chain
  resolves through `resolveProvider`, which serves generic_http entries; a
  feasibility probe using `writeHermeticConfig` with
  `chains: { academic: ["stub_a"] }` and `output: { verbose: false }` returned
  a `[OK]` citation body from a loopback stub, confirming the harness path.
- **The tool-scoped key leaks into other tools:** the map has one entry and the
  parameter is optional, so every other call keeps the default key set; the
  default-set case in `src/verbosity.test.ts` pins that.
- **A compact structured payload disagrees with the text:** `finalizeToolResult`
  already rewrites the text from the compacted object; the new
  `structured-output` case asserts both surfaces carry the retained keys.
- **A stale `status: "ok"` empty answer looks like a failure:** existing
  behavior is unchanged; the empty case asserts `status: "ok"` with zero
  results and adds only the metadata REQ-027a requires.
