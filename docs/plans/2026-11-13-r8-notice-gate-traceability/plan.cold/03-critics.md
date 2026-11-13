# Cold pass — stage 3 (critics)

Reviewed revision 2 (`8365e30c…`). Three fresh reviewers: design (10 reads),
structural (5 reads), style (1 read). Synthesized, deduplicated by defect.

## Blockers

1. **[design] REQ attribution challenged** — the structural lens read
   `worklist.md:475` ("REQ-111a Call record") as evidence the cooldown clause
   belongs to REQ-111. Verified in the authoring context against
   `infobroker.md:653-657`: `REQ-111` owns the general `notices` channel
   (`:647-651`); the cooldown sentence is in **REQ-111a**. Revision 3 records
   that verification and keeps the REQ-111a attribution.
2. **[design] E.5 step contradiction** — "different tool" vs "the same
   `inspect_providers` call". Revision 3 says "a tool other than the search".
3. **[design] E.5 duplicates §9.5** — every future gate edit becomes a
   two-place spec edit, and the check degenerates into comparing a copy with
   its source. Accepted: revision 3 drops §E.5 and asserts the non-duplicating
   chain (category row + manifest gate). Recorded as Alternative H.

## Majors

4. **Cooldown causal chain unpinned** — no `a.requests` delta; startup health
   could confuse the cause. Revision 3 adds the delta guard and records that
   `startupHealthCheck` never marks a cooldown.
5. **Hedge race** — `hedge_enabled` shipped `true`; neighbouring single-outcome
   tests disable it. Revision 3 passes `output: { hedge_enabled: false }`.
6. **Load-bearing anchor wrong** — `injectNotices` is `state-health.ts:172-192`,
   not `index.ts:172-192` (that is `startupHealthCheck`). Corrected, and every
   helper anchor re-derived (`:23-27`, `:44-93`, `:95-99`, `:101-105`,
   `:107-117`, `:119-125`, `:143-149`).
7. **Empty gate set passes** — revision 3 requires ≥1 gate token per security
   REQ and reports an empty cell as a finding.
8. **Check count / order inconsistent** — revision 3 states three preserved
   messages, one modified check, two new checks, in emission order, with the
   early-return on a missing §E preserved.
9. **Fixture count unmapped** — revision 3 gives a ten-row fixture→message
   table, each fixture asserting its own precondition before mutating.
10. **Bookkeeping rows incomplete** — `:474`, `:500`, `:547` added; `:583-585`
    and the R8 chunk AAR recorded as dated closure snapshots.
11. **Roadmap dispositions missing** — Review-loop convergence is a user
    decision (precedent); Hermetic option forwarding's trigger does not fire.
12. **Commits 1–6 unowned** — each phase now names its commit.
13. **Rollback claim** — revision 3 states the rollback unit (commits 1–6 as a
    set) and the bucket-order CHANGELOG placement.
14. **E.5 slice vs edge-case text** — moot after dropping §E.5; remaining
    slices are stated per section.
15. **"assertion-only by construction"** — removed; check 4 is labelled
    *modified*.

## Nits applied

R9 sweep-chunk vs roadmap §R9 qualified; M1 expanded; rollback-cost scale
stated; "four sweep-register rows" split into surface and register rows;
table-shape description fixed for E.3; "mapped" defined as a non-empty
controlling cell; message placeholders named; `retry-after`-vs-config
distinction removed from the test's claims; bound explained as a ceiling;
"satisfiability" sentence referent fixed.
