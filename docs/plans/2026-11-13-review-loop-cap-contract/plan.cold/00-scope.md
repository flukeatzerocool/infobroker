# Cold pass — scope and dispatch record

**Artifact:** `/home/fluke/Infobroker/docs/plans/2026-11-13-review-loop-cap-contract/plan.md`
**Revision 1 sha256:** `796e34e79602426bf6b683d0c352f1b50de17d20cc712ec9b0076b010c9096e4` (stages 1–2)
**Revision 2 sha256:** `3005237387aadcb5847c95dc436fe2bf22c94027797b292f65b578a2b69182f6` (stage 1 re-audit)
**Revision 3 sha256:** `a1528e45f400c5a5dc53991dbec1dcc4391402f68ce2242a494652480cb04bc2` (stage 3 critics)
**Revision 4 sha256:** `b858e263e1b17ec37b637fa88ce3b3e0913f6168b70deaafac72932edfa510ff` (stage 5, NO-GO)
**Revision 5 sha256:** `bae98daf2a9fce161cc247d9274d2f25440823428bdfd27671f168df5ea4788c` (stage 5 re-audit, NO-GO)
**Revision 6 sha256:** `120a37be20b1ef45173a2a37825beaa1504caab9670d7f524c39a23c89b4adb1` (condition-only amendment, not re-audited)
**Depth:** standard · **Budget:** ≤10 read/glob calls per dispatch, ≤40 total
**Dispatches cap:** 7

| Stage | Reviewer | Reads allowed | Status |
|---|---|---|---|
| 1 — zoom out | fresh `review` | 10 | rev 1 NO-GO; re-audit on rev 2 |
| 2 — comprehension | fresh `review` | 2 | faithful-with-gaps (2 Major) |
| 3 — design | fresh `review` | 10 | pending |
| 3 — structural | fresh `review` | 10 | pending |
| 3 — style | fresh `review` | 10 | pending |
| 4 — re-zoom | fresh `review` | 10 | only if stage 3 findings were resolved by edits |
| 5 — readiness | fresh `review` | 10 | pending |

## Target list handed to reviewers

- `/home/fluke/Infobroker/scripts/lib/loop-artifacts.ts`
- `/home/fluke/Infobroker/scripts/lib/loop-artifacts.test.ts`
- `/home/fluke/Infobroker/scripts/check-loop-artifacts.ts`
- `/home/fluke/Infobroker/scripts/session-close.ts`
- `/home/fluke/Infobroker/docs/plans/README.md`
- `/home/fluke/Infobroker/AGENTS.md`
- `/home/fluke/Infobroker/DECISIONS.md`
- `/home/fluke/Infobroker/CHANGELOG.md`
- `/home/fluke/Infobroker/ROADMAP.md`

## Standards handed out

- `/home/fluke/Infobroker/AGENTS.md` (Script Discipline, Review-Loop Governance, Spec Authoring)
- `/home/fluke/Infobroker/docs/plans/README.md` (increment artifact contract)

## Not handed out

The authoring conversation, the parent's findings, the plan's self-review, and any
instruction to agree with the plan. Reviewers are told to challenge the plan's
premises from the document alone.
