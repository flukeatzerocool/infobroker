# Tasks — chunk R2 (config, providers, resilience)

## Phase 0 — Baseline

- [x] `npm run check:fast` un-piped; record exit status.
- [x] R2 test files un-piped (config, config-path, config-patch, key-pool, privacy, rate-limiter, quota, retry, timeout, cooldown, chain, hedge, health-status, latency, generic-http, providers/index, tool-metrics).
- [x] Record `git status --porcelain` and `git rev-parse --short HEAD`.
- [x] Verify C-1: no `deferred:` token in a sub-defect instruction (D20/D21).
- [x] Verify C-2: non-closure names the current unit (Phase 3 step 5, D14).
- [x] Plan review: standard depth + fresh `independent-review` cold pass; apply conditions; stamp.

## Phase 1 — Enumerate

- [x] Anchors for cluster A (config resolution/validation).
- [x] Anchors for cluster B (reload/patch/migrations).
- [x] Anchors for cluster C (secrets, key pool, privacy posture).
- [x] Anchors for cluster D (registration, tiers, outbound identifier).
- [x] Anchors for cluster E (status, latency, `inspect_providers`).
- [x] Anchors for cluster F (throttle, quota, retry, timeout, cooldown, chain, hedge).
- [x] Anchors for cluster G (dispatch, financial task type).
- [x] Anchors for cluster H (§5.3, §6.3, §7.1–7.3, App A vs `config.json`).
- [x] Confirm 25 REQ rows against `worklist.md` and the §9.5 manifest.
- [x] Record G0/G3 classification and existing clause tags.
- [x] Apply D14: count predicates and live-probe clusters; record the R2a/R2b amendment before Phase 2, or `split: not triggered`.

## Phase 2 — Review

- [x] Cluster A code review → verdicts REQ-010, REQ-037.
- [x] Cluster B code review → verdict REQ-040; isolated live reload/patch probe.
- [x] Cluster C code review → verdicts REQ-011, REQ-104, REQ-129 (incl. privacy staleness gate).
- [x] Cluster D code review → verdicts REQ-014, REQ-015, REQ-070, REQ-071.
- [x] Cluster E code review + live `inspect_providers` → verdicts REQ-013, REQ-024, 024a, 024b, 024c, REQ-034, REQ-036.
- [x] Cluster F code review → verdicts REQ-030, 031, 031a, 032, 033, 035, 038.
- [x] Cluster G code review → verdict REQ-095.
- [x] Cluster H drift report → prose verdicts for §1 goals 1–2, SR-001/004/005/006/010, §5.3, §6.3, §7.1–7.3 (D18), App A.
- [x] Live probes: list/spec/health, health-without-provider error path, one success plus one forced failure before health, invalid-patch reload followed by a still-serving observation.
- [x] Quota-persistence probe under a temp `TMPDIR`; credential rehearsal per D19 (temp env only, no secret printed).
- [x] Gate-assertion check for every carrying gate.

## Phase 3 — Disposition and close

- [x] Disposition every finding (P0 fix, or P1/P2/P3).
- [x] Write the R2 verdict table and finding register to `worklist.md`.
- [x] Correct the tracker drift: both R2 entries (chunk entry and status-board row) gain §4.3 for `REQ-024*`; the R8 code line drops the nonexistent `src/config-path.ts`.
- [x] Run `npm run check:fast` then `npm run check`, un-piped; record exit status.
- [x] Write `aar.md` with the recorded gate evidence and the terminal token.
- [x] Update the `ROADMAP.md` trigger line and the worklist `Next trigger` cell (R3 on closure; R2 and `LOOP OPEN` on non-closure).
- [x] Split commits; `npm run session:close`.
