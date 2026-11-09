# AAR — R1 contract remediation

**Status:** complete · **Date:** 2026-11-09 · **Loop:** `LOOP PAUSED`
**Plan:** `docs/plans/2026-11-09-r1-contract-remediation/plan.md`

## What happened

1. Baseline: clean tree at `ce7ed34`, 2 unpushed commits, `npm run check` green.
2. **F-R1-1** fixed: `compactEnvelope()` in `src/verbosity.ts` is applied by
   `finalizeToolResult` whenever compact mode is on, so every tool's text and
   `structuredContent` compact together. Search-shaped results trim to
   title/url/snippet; finding-shaped results are left intact; action-required
   notices and `per_query`/`fact_status` meta survive.
3. **F-R1-2** fixed: the KB cache-hit path now calls `cacheHitPayload`, which
   routes through `maybeTruncate` — full text written, in-band note appended,
   `output_path` reported.
4. **F-R1-3** fixed: `requestLimit()` in `src/normalizer.ts` asks the provider
   for bounded headroom, and the chain slices after normalization, so discarded
   rows no longer consume the caller's `max_results`.
5. Tests added: compact envelope (4 cases), compact text rewrite and raw-mode
   behaviour (2 cases), headroom bounds (1 case), cache-hit truncation file
   contract (2 cases). 40/40 targeted tests pass.
6. Cross-tool envelope check passes 7/7 in normal mode and 7/7 in compact mode.

## What went right

- Compacting at the `finalizeToolResult` seam fixed every tool at once,
  including the four that built envelopes directly; no per-tool edits.
- The shape guard kept `verify_claims` findings intact instead of reducing them
  to title/url/snippet.
- The live compact run proved the fix on the real surface, not only in the
  helper tests.

## What went wrong

- The first attempt to prove the cache path through the live server was blocked
  by ingest semantics (a text ingest without `url` stores an empty identity),
  so the fix was extracted into `cacheHitPayload` and covered directly. That is
  a better test anyway: it asserts the full file and the in-band note.

## Findings

| ID | Finding | Disposition |
|---|---|---|
| F-R1-1 | Compact verbosity not applied to all tools | **Resolved** — `compactEnvelope` at `finalizeToolResult` |
| F-R1-2 | Cache-hit truncation lost `output_path` and the full file | **Resolved** — `cacheHitPayload` in `src/fetch-cache.ts` |
| F-R1-3 | Invalid rows consumed `max_results` | **Resolved** — `requestLimit()` + provider headroom |

## Verification

- `npm run typecheck` → 0
- Targeted tests → 40/40
- Cross-tool envelope → 7/7 normal, 7/7 compact
- `npm run check:fast` → PASS (19/19)
- `npm run check` → see run log
- `check-roadmap`, `check-loop-artifacts` → PASS

## Next

Chunk R2 (config, providers, resilience; 25 REQs).

LOOP PAUSED
