# Cold pass scope

Plan artifact: `/home/fluke/Infobroker/docs/plans/2026-11-14-corroboration-confidence-contract/plan.md`
Revision 6 sha256: `3b15ce361ce0f461ac9cf47f0c29e2b353d5af2a19ce027e76cc0b9e19bcf9bb`
(Rev 1 `d6c17a9f…` Stage 1 FAILED; rev 2 `af9f81a7…` Stage 3 + re-audit; rev 4 `ab7817dc…` Stage 4 FAILED, Stage 5 NO-GO; rev 5 `109a01ff…` Stage 4 + Stage 5 re-audits NO-GO. Prepare budget: 10 dispatches used; revision 6's final Stage 5 runs on explicit user authorization after the repeated-stage rule fired — recorded in `report.md`.)
Evidence sidecar: `/home/fluke/.local/state/opencode/plans/3b34aea2bce9fb4da60d99c296e2000157a146aca988b48969a73d1a3d3aec94/plan.evidence.json`
Depth: standard · Budget: 40 reads total, 10 per dispatch · Max 6 reviewer dispatches

## Targets handed to reviewers

- /home/fluke/Infobroker/src/corroborate.ts
- /home/fluke/Infobroker/src/calibration.ts
- /home/fluke/Infobroker/src/source-family.ts
- /home/fluke/Infobroker/src/corroborate.test.ts
- /home/fluke/Infobroker/src/source-family.test.ts
- /home/fluke/Infobroker/src/calibration.test.ts
- /home/fluke/Infobroker/scripts/calibrate-confidence.ts
- /home/fluke/Infobroker/infobroker.md
- /home/fluke/Infobroker/CHANGELOG.md
- /home/fluke/Infobroker/ROADMAP.md
- /home/fluke/Infobroker/docs/plans/2026-11-09-full-review-sweep/worklist.md
- /home/fluke/Infobroker/README.md

## Stage plan

1. Stage 1 — zoom out
2. Stage 2 — comprehension (artifact only)
3. Stage 3 — critics: design, structural, style (parallel)
4. Stage 4 — re-zoom, only if Stage 3 blockers/majors were edited
5. Stage 5 — readiness
