# Workflow cadence

Two loops, one cadence. The rule is that routine things run routinely, and
anything that is not routine belongs in a plan with a tracked action.

## Per session

```
questions → research → plan → execute → AAR → fix if necessary → split commits → close
```

1. Create `docs/plans/<YYYY-MM-DD>-<slug>/` with `plan.md`, `tasks.md`, and
   `aar.md`. The directory is the durable record; `.opencode/session.md` is
   scratch (D-091).
2. Execute the plan. A deviation is an amendment to `plan.md`, re-stamped,
   not a silent improvise.
3. Every AAR finding ends as a dated `ROADMAP.md` entry, a `DECISIONS.md`
   entry, or an explicit record-and-close. A prose recommendation with no
   owner is not a finding.
4. Close with `npm run session:close`. It validates the increment's artifacts,
   runs `check:fast`, records the run for this tree, and prints the push
   cadence. It does not commit: the split-commit series owns commits (D-089).

**Push on demand, not on a schedule.** The obligation is a cost bound: a push
must be resumable (`--resume`, `--run-id`, `--from`/`--to`) so an on-demand
push stays single-purpose instead of accumulating into a batch. `npm run prep`
runs the AI steps, you review the diff and commit, then `npm run release` runs
the deterministic gates, commit, tag, and push. If a push fails, resume; do not
start over.

## Weekly

One command: `npm run check` once (it writes the timing rows), then
`npm run weekly`. The report combines gate cost and retirement candidates,
increment health and CHANGELOG date drift, hook invocations, and the delivery
numbers, and writes
`$TMPDIR/infobroker/weekly-<repoKey>-<YYYY-MM-DD>.json`. `npm run loop-audit`
and `npm run metrics` remain available for a single section.

This is the **replenishment point**: new findings may enter the schedule here
and nowhere else, so work in flight is not preempted. Items that are not
scheduled are explicitly parked, not "in progress".

## Monthly

- Release (`npm run release`). A published tag is immutable: never move one; a
  correction is a new CalVer (D-092). Branch and tag are pushed atomically.
- Dependency refresh (`npm outdated`, `npm audit`).
- Gate-retirement review: `npm run gate-cost` lists per-gate cost and the
  gates eligible under the 20-clean-run policy. Record one decision with
  `npm run gate-cost -- --retire <gate> --note "why"`; it writes
  `scripts/gate-ledger.json`, which the runner honors on every checkout.
  Deleting a gate stays a manual manifest edit. "No findings" means no failing
  run: the timing record carries pass/fail only.

## Limits

- **WIP:** one uncommitted logical change; at most three open threads.
- **Committed column:** keep `ROADMAP.md` short. Lead time is WIP ÷ throughput,
  so an unbounded ready column silently sets the delivery latency.
- **Push cost:** if a push costs more than the batch it would join, fix the
  push, not the cadence.
- **Fast suite:** `npm run check:fast` excludes only `audit` (registry),
  `check-pack` (packed tarball), and `test-debate-club` (build + Arena). A green
  fast suite never satisfies the pre-push gate; only a full run records one.

## Where the evidence lives

| Loop | Signal | Surface |
|---|---|---|
| Session | plans, AARs, loop tokens | `docs/plans/` (gated by `check-loop-artifacts`) |
| Session | increment health, date drift, hook invocations | `npm run loop-audit` |
| Publication | step outcomes, resume state | `$TMPDIR/infobroker/pipeline-logs/run-*` |
| Gates | duration, failure rate | `$TMPDIR/infobroker/gate-timing-*.json` |
| Gates | cost, eligibility, advisory decisions | `npm run gate-cost`, `scripts/gate-ledger.json` |
| Weekly | combined gate/loop/delivery report | `npm run weekly`, `$TMPDIR/infobroker/weekly-*.json` |
| Delivery | frequency, lead time, commits/push | `npm run loop-audit`, `npm run metrics` |
