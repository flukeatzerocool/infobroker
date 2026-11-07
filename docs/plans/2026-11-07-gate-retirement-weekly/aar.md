# AAR — Gate retirement and weekly cadence

**Status:** Complete. **Done bar:** met — see Verification.
**Loop:** LOOP PAUSED.

## What happened

1. Plan reviewed (`plan-review passed.`, standard depth) and approved; the
   open decision was which eligible gate to retire.
2. Built `scripts/lib/gate-retirement.ts` (timing read, cost summary, fail-closed
   ledger, eligibility, result classification), `scripts/gate-cost-report.ts`,
   `scripts/lib/weekly.ts`, and `scripts/weekly.ts`.
3. Wired advisory gates into `scripts/run-gates.ts`: an advisory failure prints
   `ADVISORY FAIL <gate>` and does not fail the suite; the gate still runs and
   is timed.
4. Chose `check-non-goals` and recorded it in `scripts/gate-ledger.json` with
   its evidence snapshot. Justification: it is the narrowest surface (a
   documentation pointer and list), has no product contract, and had 24 clean
   runs; the other eligible gates protect shipped contracts (TDQS, intent
   citations, report fixtures, harness expectations, skill harness, gate
   coverage, shipped-KB emptiness), version consistency, the spec, or the
   governance loop.
5. Proved the wiring end to end by breaking the `ROADMAP.md` non-goals pointer:
   the gate exited 1, the suite printed `ADVISORY FAIL check-non-goals` and
   exited 0, and restoring the file returned the gate to green.
6. Removed the `ROADMAP.md` section; the trigger was already satisfied on this
   checkout (16 of 22 gates at 20+ clean runs) and is now closed by a recorded
   advisory decision plus the weekly report.

**Deviation:** the increment artifacts (plan, tasks, final AAR) land in the
final commit rather than the first, so every earlier commit carries a complete
artifact set instead of an increment directory without an AAR.

## What went right

- The negative-path proof (break the gate, suite stays green, restore) caught
  nothing wrong and is the evidence the policy works rather than merely parses.
- The ledger stayed fail-closed: corrupt, malformed, and unknown entries leave
  gates gating, covered by unit tests.
- The weekly report degrades cleanly with no timing record and no delivery
  window; it still writes its artifact.
- The full suite stayed green before the first commit and after the last change.

## What went wrong

- The first timing probe printed only the top five gates; the plan initially
  claimed every gate had 23 clean runs. The actual record has 442 rows, 16 of
  22 eligible, and the full-only gates at 9–10 rows. Self-review caught this
  before execution and the plan was corrected and re-stamped.
- The first weekly test inferred `delivery: DeliveryReport`, so the missing-
  delivery case failed typecheck until the helper returned `WeeklyInputs`.
  Fixed immediately; the test suite now covers the null case.
- A test helper built the state directory with `join(path, "..")`; replaced
  with `dirname(path)` for clarity.

## Findings

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F1 | Plan overstated the timing record (all gates 23 clean; actual 16 of 22 eligible) | P1 | Resolved in-session: probe repeated, plan corrected, re-stamped before execution |
| F2 | A bulk `--apply` would have retired 16 gates at once | P1 | Resolved in plan: per-gate `--retire`, no bulk command |
| F3 | `run-gates` header named `.infobroker/gate-timing.json`, not the real `$TMPDIR` path | P3 | Resolved in-session (comment fix); record-and-close |
| F4 | "No findings" is a proxy for "no failing run" (the record has pass/fail only) | P3 | Recorded as D2 in the plan and stated in the report header and CHANGELOG; record-and-close |
| F5 | A fresh CI runner cannot re-evaluate eligibility | P3 | Ledger carries the evidence snapshot; CI honors the status; record-and-close |

No P0 findings. No open P1 beyond what `ROADMAP.md` schedules.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck:scripts` | PASS |
| `npx vitest run scripts/lib/gate-retirement.test.ts scripts/lib/weekly.test.ts` | 32 passed |
| `npm run gate-cost` | 461 rows, 16 eligible, 0 advisory before the decision |
| `npm run gate-cost -- --retire check-non-goals` | ledger entry written; `--dry-run` wrote nothing |
| Broken-pointer simulation | gate exit 1; suite exit 0 with `ADVISORY FAIL check-non-goals`; restore exit 0 |
| `npm run weekly` | artifact written; text and JSON modes both parse |
| `npm run check` | PASS (full, 51.2s) |
| `npm run check-script-discipline`, `version-sync`, `check-roadmap`, `check-non-goals` | PASS |

## Loop status

LOOP PAUSED — gates green, the roadmap item is closed, and no new action item
is open. The next plan comes from `ROADMAP.md` or a direct request.
