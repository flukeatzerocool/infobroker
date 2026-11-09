# Plan — R1 contract remediation

**Status:** approved by user ("r1") · **Date:** 2026-11-09 · **Depth:** light
**Review independence:** self pass; the three findings were produced by the cold-reviewed R1 chunk.
**Rollback cost:** 1 — source and tests only; no config, dependency, or destructive change.
**Roadmap item:** `ROADMAP.md` § R1 contract remediation (retire on close)
**Predecessor:** chunk R1, commit `ce7ed34`.

## Done bar

**Done bar:** all three R1 findings are fixed with a regression test each; the cross-tool envelope check still passes 7/7; `npm run check:fast` and `npm run check` exit 0; the finding register marks F-R1-1, F-R1-2, and F-R1-3 `Resolved`; the roadmap remediation section is retired; and the increment lands as its own commit.

## Fixes

1. **F-R1-1 — compact verbosity is global.** Add `compactEnvelope()` to `src/verbosity.ts`; apply it in `finalizeToolResult` so every tool's text and `structuredContent` compact together. Retain `notices` with `severity: "action_required"` and the required meta keys `per_query` and `fact_status`; trim search-shaped results to title/url/snippet; leave finding-shaped results intact.
2. **F-R1-2 — cache-hit truncation.** In `src/index.ts` (KB cache path), replace the raw `slice` with `maybeTruncate`, so a truncated cached page writes the full file, appends the in-band note, and reports `output_path`.
3. **F-R1-3 — max-results headroom.** Add `requestLimit(maxResults)` to `src/normalizer.ts`; the provider call asks for that headroom and slices after normalization, so discarded rows do not consume the caller's maximum.

## Tests

- `verbosity.test.ts`: compact envelope trims results and optional meta, keeps action-required notices and required meta, and leaves finding-shaped results intact.
- `structured-output.test.ts`: compact mode rewrites the text envelope to match `structuredContent`; raw mode keeps the plain text.
- `normalizer.test.ts`: `requestLimit` returns more than the caller's max and stays bounded.
- `truncate.test.ts` already proves the full-file and note contract used by fix 2.

## Verification

1. `npx vitest run` for the four touched test files.
2. Cross-tool envelope check 7/7.
3. `npm run check:fast`, then `npm run check`.
4. `check-roadmap`, `check-loop-artifacts`.

## Risks

- Compacting inside `finalizeToolResult` changes the text payload of every tool in compact mode; the cross-tool check and the new text-rewrite test are the guard.
- `verify_claims` findings are not search results; the shape guard must leave them intact.
