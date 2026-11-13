# Cold pass — stage 4 (re-zoom)

Reviewed revision 3 (`ec661281…`) against the stage-3 critics. One fresh
reviewer, 9 reads. No Blockers; three Majors, all resolved in revision 4.

## Findings and disposition

1. **[Major|clarity] Fixture count contradicted itself** — "ten negative
   fixtures" vs a ten-row table whose row 1 is the pass case. Revision 4 says
   "ten negative fixtures (rows 2–11)" and adds an eleventh row, so the count
   and the table agree.
2. **[Major|clarity] Done bar demanded a red-first live-spec state that cannot
   exist** — every check passes on the untouched spec by construction.
   Revision 4 replaces that claim with per-fixture results plus T8's
   end-to-end `validate-spec` red on an emptied gate cell.
3. **[Major|design] "Single source of truth" was asserted, not grounded** —
   each REQ body also carries `_Check:_`, which the plan did not reconcile.
   Verified: `scripts/validate-spec.ts:430-454` reconciles §9.5 against the §4
   body for presence only, not the `_Check:_` field, so §9.5 is the only
   gate-read declaration. Revision 4 states that explicitly.
4. **[Major|design] The scope was a hand-maintained seven-id constant** — a
   new §4.11 REQ could be forgotten. Revision 4 derives the scope from §9.5
   Section `4.11` rows (`securityReqsFromManifest`), adds fixture 9 to prove
   derivation, and records the deleted-row boundary as fixture 10.
5. **[Major|clarity] The narrowed check kept a now-misleading message** —
   "does not reference" would print while the spec references the REQ in
   residual-risk prose. Revision 4 retires that string for
   `maps no OWASP category row to <REQ>`; the three heading messages stay
   byte-identical.
6. **[Nit|clarity] Anchor drift** — REQ-111 heading is `:650-651`; `details` is
   `:129`; `injectNotices` runs to `:200` with the merge at `:193-195`.
   Corrected throughout.
7. **[Nit|clarity] Slice identification by title text** — fixtures 3–4 remove
   the OWASP title token. Revision 4 slices E.2/E.3 by the heading's section
   number, so the fixture cannot destroy its own slice.

## Unknowns (unsettled, recorded)

- Whether the harness injects project instructions into reviewer contexts — a
  design-lens reviewer reported seeing `AGENTS.md` and user-level rules it was
  not given. Recorded as an isolation weakening, not an invalidation.
- The cooldown test's satisfiability rests on anchors the reviewer did not
  read (`stub-provider.ts`, `index.ts`); the authoring context verified them
  and they appear in the Baseline.
