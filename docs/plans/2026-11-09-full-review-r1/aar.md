# AAR — chunk R1 (contracts and envelope)

**Status:** complete · **Date:** 2026-11-09 · **Loop:** `LOOP PAUSED`
**Plan:** `docs/plans/2026-11-09-full-review-r1/plan.md` (cold pass 2, sha256 `ad2f9e58…`, stages 4/5; two majors applied and verified by build-review).

## What happened

1. Baseline: tree clean at `64ea04b`, `npm run check` PASS (22 gates, 1087
   tests), contract tests 33/33.
2. Cold plan review pass 1 FAILED (0 blockers, 4 majors, 6 minors): prose
   ownership was over-broad, the done bar was unsatisfiable with no P1, the
   REQ-073 suggest/expand path was unnamed, and the cross-tool verification was
   missing. All applied.
3. Cold plan review pass 2 FAILED (0 blockers, 2 majors, 6 minors): the
   cross-tool step was not executable as written, and the prose verdicts had no
   record slot. Both applied; conditions re-stamped and verified by build-review
   (the standard-depth re-review cap was reached).
4. Review executed read-only. Six REQ verdicts and three prose verdicts:
   REQ-001, REQ-002, REQ-003, SR-009, §6.1, §6.2 `holds`; REQ-004, REQ-073,
   REQ-079 are findings.
5. Cross-tool live check called all seven tools through stdio and asserted
   `structuredContent` deep-equals the parsed `[OK]`/`[ERROR]` text; 7/7 passed.
6. Three P1 findings scheduled under `ROADMAP.md` § R1 contract remediation.
   No P0, no source change.

## What went right

- The cold pass caught a real verification gap before execution: the first
  draft would have called stateful tools without an argument table and would
  have treated `provider: "none"` as a failure for legitimate error envelopes.
- The cross-tool check is the strongest evidence in the chunk: it proves the
  envelope contract on the live surface, not just in the helper unit tests.
- The REQ-073 suggest/expand path would have been missed by reading
  `normalizer.ts` alone; the cold pass pointed at `index.ts:282–:314`.

## What went wrong

- The first plan draft asserted a done bar that could not be met when no P1 was
  found, and assigned all of §1/§3 to R1. Both were plan-text defects, not code
  defects; the cold pass was worth its cost.
- The standard-depth re-review cap was reached with two majors still open. They
  were condition-only, so they were re-stamped and verified by build-review
  rather than a third full review.

## Findings

| ID | Finding | Disposition |
|---|---|---|
| F-R1-1 | Compact verbosity is not applied to `fetch_page`, `inspect_providers`, `manage_kb`, or `reload_config`; only `ok()` compacts (REQ-079) | `Scheduled-roadmap` — R1 contract remediation |
| F-R1-2 | KB cache-hit truncation reports `truncated: true` with no `output_path`, full file, or in-band note (REQ-004) | `Scheduled-roadmap` — R1 contract remediation |
| F-R1-3 | Discarded normalized results still consume the requested `max_results` (REQ-073) | `Scheduled-roadmap` — R1 contract remediation |

## Verification

- `npm run check:fast` → PASS (19/19)
- `npm run check` → PASS (22 gates)
- Contract tests → 33/33
- Cross-tool envelope check → 7/7 PASS
- `check-roadmap` → PASS (3 sections)
- `check-loop-artifacts` → PASS

## Next

Chunk R2 (config, providers, resilience; 25 REQs) is the next scheduled sweep
item. The R1 remediation is independent of the sweep and can run first.

LOOP PAUSED
