# AAR — Close `F-R6-E-3`: gate-asserted heap-bounded retrieval

**Date:** 2026-11-14 · **Plan:** `plan.md` revision 3 · **Roadmap item:** `ROADMAP.md` § Missing test evidence across R4–R6 (retired)
**Review cap:** 2; used 2 passes (plan gate: cold pass + one diff re-review; post-build AAR). A 3-read binding check confirmed revision 3's three cosmetic nits and is not counted as a pass.

## What happened

1. Drafted the plan from the roadmap row and the prior increment's measurements, then ran the plan gate. The cold pass returned **FAILED** (1 Blocker, 4 Majors, 6 Nits); revision 2 applied all of them, and the diff re-review returned `independent-review passed.` with 3 nits, applied as revision 3.
2. Executed step 1 with a single probe: 8/8 exit-race children, a 146.6 MiB payload built in 2.76 s, 20/20 `get` and 15/15 inspection actions at 64 MB, and a boot ladder that puts 48 MB on the floor.
3. Wrote `src/kb-capacity-heap.test.ts`, proved it with two mutations, and confirmed three consecutive green runs at ~11 s.
4. Retired the roadmap section, resolved `F-R6-E-3`, and added one CHANGELOG entry.

## What went right

- Diagnosing before building paid off twice. The probe-6 hang was a harness race (`once(child, "exit")` attached after `SIGKILL`), and the one `get` crash did not reproduce once the heap had a 16 MB margin — so the row was closed on measurement, not on a lucky run.
- `SqliteStore.insertChunks` removed the build blocker rather than accommodating it: 2.76 s against 17–25 s for the same volume through `kbIngest`, because ingest re-scans the whole store per document (`src/kb.ts:684`). The plan's D2 assumption held.
- Both search paths are proven, not asserted: disabling `iterateChunksByIds` fails only the second pass, and materializing the store inside `list` fails with a V8 heap abort.

## What went wrong

- **The plan's payload geometry was wrong for MCP (deviation 1).** The server truncates every response above the response cap (`src/index.ts:1893`, REQ-004), so the planned 96 documents of ~1.5 MiB would have produced untestable "complete results" and silently measured truncation instead of capacity. Found on the first suite run; the payload became one huge document plus eight small ones. The plan should have checked the response cap while designing the assertions.
- Two test-side mistakes cost cycles: ranking by similarity needed the target's chunks to carry the full query vector, and 2023-era timestamps decayed `freshness_score` to 0 in the shipped config, which made ranking arbitrary and surfaced as a wrong first hit.
- The first draft asserted a byte-equal `get` body over a 1.5 MiB document, which cannot survive the cap; the fix and its reason are recorded as a deviation.

## Findings and dispositions

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | Plan payload geometry ignored the 50k response cap, so "complete results" was unobservable as planned | P2 | Resolved in-session (deviation 1); the suite now keeps responses small and the store large |
| 2 | The single `get` crash recorded on 2026-11-14 did not reproduce at 64 MB over a larger store | P3 | Closed as informational — the margin addressed it; no defect filed |
| 3 | `withServer` is now duplicated in eleven suites | P3 | Closed as informational (recorded follow-up, unchanged) |
| 4 | The response cap and `manage_kb` result shapes are now load-bearing for this suite | P3 | Recorded here; if the cap changes, the small-document sizing must be re-checked |

## Evidence

- Probe 7: payload 153,739,264 B / 288 chunks / 2759 ms; boot ladder 32 MB 1023 ms (a earlier run aborted at 32 MB), 48 MB 520 ms, 64 MB 522 ms; 8/8 sequential children 1123–1369 ms; 20/20 `get`; 15/15 `search`/`list`/`stats`; both searches 4309-byte `[OK]` envelopes.
- Mutations: `sqliteList` materialization → V8 heap abort in the `list` child (21.1 s); `iterateChunksByIds` throw → only the by-id search pass failed. Both reverted, `git diff src/` empty.
- `npx vitest run src/kb-capacity-heap.test.ts` → 6 passed three times (11.11 s / 10.90 s / 11.14 s); `npm run test` → 136 files, 1609 tests, 27.97 s.
- `npm run validate-spec` → 142 REQs, 127 cited, 0 source files without `@implements`; `npm run check-gate-coverage` → 118 G1 REQs, 117 cited, 1 exempt, 0 waived; `npm run check-roadmap` → PASS; `npm run version-sync` → OK.
- `npm run check` → PASS, 22 gates, 166.5 s.

## Residual

None on this row. The roadmap section is retired; the two remaining items are the register reconciliation and the calibration refresh. The `withServer` duplication stays a recorded follow-up, not a defect.

LOOP PAUSED
