# Delta amendment — chunk R4

**Date:** 2026-11-10 · **Plan:** `plan.md` sha256 `a1351273…18c5`

## What changed

D33 bounds a P0 fix to one source file plus its regression test. During
execution, the only test seam for the crawl P0 (F-R4-C-1) is the debate-club
Arena, which drives the real server over stdio; its fixture set is committed
data, so the regression takes the test file (`debate-club/src/mcp-contract.test.ts`)
plus three fixture entries in the existing `debate-club/fixtures/index.json`.
That is three touched paths (one source, one test, one fixture data file).

## Why

- `src/index.ts` starts the MCP server on import, so it cannot be imported by a
  unit test; `doFetchPage`/`fetchPageContent` are not exported. A unit seam
  would require exporting or moving code, which is itself a larger source
  change than the bug.
- The Arena is the plan's own deterministic preference (D38) and it exercised
  the failure before the fix: the new test returned `["https://example.com/crawl"]`
  and failed, then passed after the one-line fix.

## Bound

- Source: `src/index.ts` — one changed argument (`cleanHtml` false for the
  crawl fetch).
- Test: `debate-club/src/mcp-contract.test.ts` — one new test, one header tag.
- Data: `debate-club/fixtures/index.json` — three deterministic replay entries.
- No other source file changed; the fixture file is test data, not a behavior
  surface.

## Verification

- `npx vitest -c debate-club/vitest.config.ts run -t "crawl follows same-origin links"` → FAIL before the fix (only the start page), PASS after.
- `npm run test-debate-club` → 3 files / 37 tests PASS.
- Carrying tests → 18 files / 229 tests PASS.
