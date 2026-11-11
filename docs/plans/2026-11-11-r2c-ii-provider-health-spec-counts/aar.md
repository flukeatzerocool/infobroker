# AAR — R2c-ii provider health and spec counts

**Executed:** 2026-11-11 · **Plan:** revision 2a (stamped sha256 `acaefa96`)
**Depth:** standard · **Plan gate:** `plan-review passed.` (cold pass + diff
re-review + clarity re-audit)

## Outcome

All three roadmap findings are `Resolved`, and the deferral R2c-i left behind
(the health action's probe wiring) is closed.

| Finding | Disposition |
|---|---|
| F-R2-22 | `Resolved` — a config-disabled provider is not probed and reports `inactive` + `inactive_reason: "disabled"`; `isOperational` is the one truth table |
| F-R2-23 | `Resolved` — history extracted to `src/provider-history.ts`, unit-asserted, and driven end-to-end through a loopback stub; REQ-024b says "since server start" |
| F-R2-24 | `Resolved` — `total_requests_served` is `toolMetrics.totalCalls()` |
| R2c-i DB-3 deferral | `Resolved` — the health action drives a real probe into `assessProvider` for active/degraded/inactive |

## Done-bar to evidence

| Clause | Evidence |
|---|---|
| DB-1 | `src/provider-health-action.test.ts` disabled-provider and `native_fetch` pin; `src/provider-status.test.ts` operational + probe-status cases; pre-change probe showed `inactive` with **no** reason field |
| DB-2 | `src/provider-history.test.ts`; `src/provider-health.test.ts` timestamp mapping; `src/provider-health-action.test.ts` stub success/failure round-trip and probe-does-not-record-success assertion |
| DB-3 | `src/provider-health-action.test.ts` 2 → 4 phases; `src/tool-metrics.test.ts` `totalCalls`; pre-change probe showed `total_requests_served: 0` while tool calls were 2 |
| DB-4 | `src/provider-health-action.test.ts` three legs through the stub; pre-change probe recorded the same three statuses as regression evidence |
| DB-5 | REQ-024b 483 chars / 3 sentences / 4 SHALLs; REQ-024c 513 / 2 / 3, both under Appendix B; `validate-spec` and `check-gate-coverage` pass |
| DB-6 | ROADMAP section retired (24 sections); worklist rows 638–640 resolved and summary rows 169/170 corrected; CHANGELOG entry; DECISIONS D-103–D-105; README audited, no change needed |
| DB-7 | `npm run check` → **PASS** (full, 22 gates, 113.1 s) |
| DB-8 | `git diff --stat` limited to the blast radius; no config, fixture, or list-action change |

## What went right

- The hermetic loopback stub plus a config whose dispatch chains are pinned to
  one provider made every end-to-end claim deterministic and offline on the
  first run; the same harness produced the pre-change matrix.
- The cold pass caught the two blockers the author missed (the shipped
  `searxng` entry is disabled; a failing stub search would fall through to live
  providers) before any code was written.
- Moving `isOperational` next to `providerUsable` avoided the second truth table
  the first draft would have created.

## What went wrong

- DB-3's expected call count was off by one: phase A's `spec` call is itself a
  tool request. Caught by the test on first run and recorded as a deviation.
- The first cold review report was not persisted by the reviewer (read-only
  context); the parent recorded it verbatim. The review trail is intact but the
  reviewer cannot own its artifact.

## Findings

- **P3, closed** — DB-3 arithmetic correction (3 → 4) recorded as a deviation;
  no behavior or scope change.
- **P3, closed** — `last_spec_review` still reports boot time; REQ-024c does not
  bind it (already `Closed-P3` as F-R2-25). Informational only.

## Recommendations

- A plan that asserts exact tool-call arithmetic should state the full call
  sequence including the observing call, not just the delta.

`npm run check` → PASS (full, 22 gates, 113.1 s) on the final tree.

LOOP PAUSED — gates green; no open P0/P1 beyond the scheduled roadmap. § R2d is
the next unblocked item.
