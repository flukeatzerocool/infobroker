# Cold pass scope — R8 plan

**Artifact:** `/home/fluke/Infobroker/docs/plans/2026-11-10-full-review-r8/plan.md`
**Artifact sha256 at stage 1–2 dispatch:** `203edeea2122ef84f6c8e48876cf0bba8d44a14a0cee85f34f4e865a79fa5219`
**Artifact sha256 at stage 3–5 dispatch:** `e39a7a6b18346a42180c1a571a3ffa400581be82f8d58b002798e7bfc4025627` (stage 3) → `bebff03cd91a1e19d69419482385bf26b7ce0b4fa0e4abc14297c374242973f6` (stage 4 and stage 5) → `c3768594d40b17956d7495c36b84abd469eeb3c1568d6044a04555c65f623bd2` (stage 5 re-audit) → **`2e8c0a4c9dcb6edc451e404136c92762391e7f25a89ebb7ab0a7eb89f7e21f4a` (current, post-escalation corrections)**
**Created:** 2026-11-10 · **Prepared:** 2026-11-10
**Depth:** deep · **Dispatch budget:** ≤7 reviewer dispatches, ≤80 total read/glob calls, ≤10 per dispatch.

**Amendment note.** Stage 1 and stage 3 findings were resolved by editing the artifact: the split cluster/step/leg mapping, the tracker-drift evidence, the probe-leg reachability (empty rename registry, content-policy mode names, update-check cache), the D72 isolation variables, the baseline acceptance bar, the P0 pool, the final-tree gate, the backout, and the provenance metadata. Stage 4 re-reads those changes; stage 5 is the readiness gate.

## Targets handed to reviewers

- /home/fluke/Infobroker/src/state-health.ts
- /home/fluke/Infobroker/src/config-migrations.ts
- /home/fluke/Infobroker/src/update-check.ts
- /home/fluke/Infobroker/src/content-policy.ts
- /home/fluke/Infobroker/src/call-log.ts
- /home/fluke/Infobroker/src/session-stats.ts
- /home/fluke/Infobroker/src/audit-log.ts
- /home/fluke/Infobroker/src/lib/atomic-write.ts
- /home/fluke/Infobroker/src/lib/sanitize-error.ts
- /home/fluke/Infobroker/src/index.ts
- /home/fluke/Infobroker/src/config.ts
- /home/fluke/Infobroker/vitest.config.ts
- /home/fluke/Infobroker/scripts/validate-spec.ts
- /home/fluke/Infobroker/docs/plans/2026-11-09-full-review-sweep/worklist.md
- /home/fluke/Infobroker/ROADMAP.md

## Cited standards

- /home/fluke/Infobroker/AGENTS.md (repository operating rules; also injected by the host)
- /home/fluke/.config/opencode/skills/plan-review/SKILL.md (gate depth and done-bar conventions)

## Stage plan

| Stage | Dispatch | Status |
|---|---|---|
| 1 — zoom out | reviewer 1 | pending |
| 2 — comprehension | reviewer 2 | pending |
| 3 — critics (design, structural, style) | reviewers 3–5 | pending |
| 4 — re-zoom | conditional | not triggered |
| 5 — readiness | reviewer 6 | pending |

No prior findings or authoring context is passed to any dispatch.
