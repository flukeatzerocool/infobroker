# Cold review — review cap contract

**Reviewer:** `review` subagents (eight dispatches; two stage re-audits)
**Plan sha256:** `120a37be20b1ef45173a2a37825beaa1504caab9670d7f524c39a23c89b4adb1`
(revision 6; stages reviewed revisions 1–5 as recorded in `00-scope.md`)

## Coverage

| Stage | Dispatches | Verdict |
|---|---|---|
| 1 — zoom out | 2 (initial, re-audit) | NO-GO twice |
| 2 — comprehension | 1 | faithful-with-gaps |
| 3 — design | 1 | no Blocker, 6 Major |
| 3 — structural | 1 | 1 Blocker, 3 Major |
| 3 — style | 1 | 1 Blocker, 7 Major |
| 4 — re-zoom | 0 | folded into stage 5: a dispatch would have exceeded the declared cap |
| 5 — readiness | 2 (initial, re-audit) | NO-GO twice |

Reads: 10, 10, 1, 10, 5, 6, 9, 6 — 57 total across eight dispatches.

## What the pass found

Four independent Blocker classes, none of them in the design premise:

1. **Self-refuting exemplar.** The plan's own `**Review cap:**` line had no count while the plan made a countless line an error; the grandfather date hid it.
2. **A check that could not fail.** The first done-bar step passed identically whether the requirement was present or absent.
3. **An unparseable marker.** The proposed regex matched any occurrence anywhere, so the plan's own quotation of the marker would have satisfied it. The parse is now line-initial and requires the canonical value shape.
4. **A fixture that could not produce the expected finding count.** Cases (a) and (g) needed a terminal token and a conforming cap value in the fixture AAR; the document now names both.

Majors resolved in the documents: rollback count against the commit order, `session-close` inheritance left unstated, the error-versus-warning level of the new findings, an untested AAR branch, the undefined "passes used" encoding, unsourced population counts, a supervisor command that would not forward its flag, the cap arithmetic contradicting itself, three names for one concept, and the plan/tasks divergence.

## Residual at the cap

Stage 5 failed twice. Its final Blocker — the fixture contents in cases (a) and (g) — was resolved by the author in revision 6, a **condition-only amendment**: no new file, gate, or destructive operation. Per `plan-review` § Re-review protocol the amendment is re-stamped and verified by `build-review`; it is not re-audited. The plan's declared cap (1 cold pass, at most 1 re-audit per failed stage) is therefore exhausted, and the readiness verdict below is the honest one.

## Token

`independent-review FAILED.` — 1 Blocker unresolved at the re-audit cap, resolved afterwards as a condition-only amendment that no reviewer has seen. The residual verdict belongs to the user.
