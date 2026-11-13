# Cold pass — stage 5 re-audit (cap reached)

Reviewed revision 5 (`080be7db…`). One fresh reviewer, 10 reads.
Verdict: **NO-GO** again. Per the review cap ("a stage that fails twice is
escalated to the user; do not loop"), no third audit was run. Revision 6
applies the remaining findings as editorial fixes.

## Findings at the cap

1. **[Blocker] Commit-series step numbers not renumbered** after the T10/T11
   swap, and "three surface rows" vs two. Fixed in revision 6.
2. **[Blocker] C-2 and the verification table still described the §9.5-derived
   scope** while the design had moved to §4.11 body derivation — the dead-logic
   contradiction returned. Fixed: C-2 and the table now say body-derived scope,
   §9.5 gate tokens only; unused `ManifestRow.section` /
   `declaredManifestGates` removed from the export surface.
3. **[Major] "four preserved messages" vs three** — stemmed from the check-4
   narrowing. Revision 6 drops the narrowing entirely: check 4 is unchanged, so
   four messages are preserved and three checks are new.
4. **[Major] The out-of-standard-category check was labelled 5b, 6, and 6b.**
   Revision 6 uses check 6 everywhere, and the E.2/E.3 parser no longer filters
   on a known prefix (fixture 8 uses `X01`).
5. **[Major] C-1 as written was falsified by the control call.** Revision 6
   scopes C-1 to responses after the cooldown is established and states the
   control call is expected to carry none.
6. **[Major] T8's restore had no baseline** and the §9.2 bullet had no done-bar
   item. Revision 6 captures the post-T7 sha256, restores to it, checks
   `git status`, and adds the bullet to done-bar item 6.
7. **[Major, design] Check 4 was stricter than REQ-096** — it required each
   security REQ to appear in a category row, while REQ-096 allows a category to
   map to a named residual risk. Revision 6 removes that strictness by leaving
   check 4 as the existing §E reference assertion; the mapping requirement is
   carried by category-row completeness (checks 5–6), which is what REQ-096
   actually names.
8. Nits: REQ-111a anchor `:653-654`; `details` at `:129`; hedge anchors
   `:240,:335`; `search()` cannot serve the inspect calls, so the test adds a
   local `toolPayload()` helper.

## Residual risk (escalated, not reviewed)

Revision 6 is not independently audited. Its changes are consistency fixes
plus the check-4 simplification; the design premise (drive a real cooldown
through the tool boundary; assert category completeness and manifest gate
presence) was accepted by stages 1–4 after revision 4. Approval of revision 6
carries the risk that one of these edits introduced a new contradiction
unseen by a cold reader.
