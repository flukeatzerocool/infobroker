# Cold review — R8 update-preservation evidence

Reviewer: five fresh `review` subagent dispatches (Stage 1 zoom-out, Stage 2 comprehension, Stage 3 design/structural/style critics in parallel, Stage 4 re-zoom, Stage 5 readiness). No authoring context was passed to any dispatch.
Plan sha256: de731577bae1d0a3f07231c0b7a54f89be7aef122494d604c0a74633ad0e1b52
Stages: 5/5 · Reads: 61 total (12 + 1 + 10 + 9 + 10 + 11 + 8)

## Result

**independent-review passed. plan.md — 5 reviewers, 5/5 stages.**
Blockers: 3 (all resolved across revisions 2–3) · Majors: 30 · Nits: 39 · final Stage 5 verdict: GO.

## Blockers and resolution

1. **[design] Fallback E seeded an invalid quota shape** — a top-level `{daily, monthly}` object is discarded by `sanitizeQuotaState` (`src/quota.ts:58-78`), so the only recovery for the timer unknown would have produced `used === 0`. Fixed: the fallback now uses the full provider-keyed payload, and the weaker path must be recorded in `tasks.md` and the AAR.
2. **[design] `getUserConfigDrift()` is never `null` while a layer exists** — `src/config.ts:263-266` returns an object; `hasDrift` is the predicate. Fixed: assertion 2 asserts non-null with `hasDrift === false`.
3. **[clarity] The assertion set was enumerated three ways (five bullets, "six", a different fifth)** — fixed by six numbered assertions, referenced by number from the done bar.

## Majors resolved

- Scenario stage naming was colliding with the plan's phases — renamed to setup / update / post-update read.
- KB release re-init armed a 60-minute maintenance interval over the store the update deletes — release now sets `maintenance_interval_minutes: 0` on `closed/`.
- Quota module instances stack `beforeExit`/signal listeners — only the stage-1 instance writes; the timer is flushed before teardown.
- Env/user-layer overrides bypassed the shipped default paths — scope stated, and assertion 6 checks resolved containment; the shipped defaults stay pinned by `check-shipped-kb-empty` and §10.1.
- The "SHALL NOT overwrite" limb had no carrier — assertion 3 asserts the user-layer bytes are unchanged.
- Mutation check 2 would have opened the real `~/.local/share` KB store — `HOME` is pinned inside the temp root.
- Roadmap removal preceded the `validate-spec` its close condition names — T9 now runs the gates before removal.
- CHANGELOG cited `D-111` before it was written — decisions now precede the changelog, and the commit order says so.
- The T12 record was circular with the increment-docs commit — T13 writes it, T14 verifies the committed tree.
- Register enumeration missed two live rows (`worklist.md:146`, `:547`) — both are now named and T6 updates them.
- Phase/commit ordering, assertion-to-module binding, stale anchors (`infobroker.md:74`→`:76`), and the Verdict-cell vocabulary are all made explicit.

## Unknowns

- `kbIngest`/`flushKbWrites`/`increment` synchrony — confirmed by the parent from their signatures; reviewers could not read the files in some stages.
- `config.json` values (shipped `max_chars`, maintenance interval) — unread by some reviewers; the integer guard turns a wrong premise into a loud failure.
- The host injected `AGENTS.md` and user instructions into every reviewer session; per `independent-review` § Context contract this weakens isolation for convention-dependent judgements but does not change the findings, which rest on the artifact and its named files.
- Whether `validate-spec` accepts the new test file — a stop-and-add remedy is recorded at T9.

## Per-stage reports

- `01-zoom-out.md` · `02-comprehension.md` · `03a-design.md` · `03b-structural.md` · `03c-style.md` · `04-rezoom.md` · `05-readiness.md`
