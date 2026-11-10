# Tasks — chunk R4 (`fetch_page`)

## Phase 0 — Baseline

- [ ] `npm run check` un-piped; record exit status, gate count, wall time. Red baseline → stop, fix as its own commit, restart Phase 0.
- [ ] R4 carrying tests un-piped (`rerank`, `batch`, `fetch-fallback`, `fetch-cache`, `datetime`, `extract`, `lib/url-guard`, `lib/bot-challenge`, `hedge`, `structured-fact`, `lib/infobox`, `structured-output`, `truncate`, `http`, `lib/html`, `tool-surface`, `intent-citations`); record file/test counts.
- [ ] Record `git status --porcelain`, `git rev-parse --short HEAD`, and the open unpushed commit list; check none changes an R4 verdict.
- [ ] `npm run test-debate-club` un-piped; record files/tests.

## Phase 1 — Enumerate

- [ ] Anchors for cluster A (transport and target safety).
- [ ] Anchors for cluster B (renderer chain, anti-bot, hedge race/grace, failure fallback).
- [ ] Anchors for cluster C (cache, date, crawl, structured extraction).
- [ ] Anchors for cluster D (passage ranking, raw mode, batch metadata, truncation fields).
- [ ] Anchors for cluster E (structured-fact extraction).
- [ ] Anchors for cluster F (handler contract, registration, citations, §6.4).
- [ ] Confirm 12 REQ rows against `worklist.md` § R4 and the §9.5 manifest (EV2).
- [ ] Record `_Check:_` kind, cited test, and existing clause tags per REQ (EV3, EV3a, EV9).
- [ ] Record tracker drift (EV10), shared-surface ownership (EV11), and the D41 non-R4 defect channel.
- [ ] Confirm the live `fetch_page` schema against the advertised `inputSchema` (G0 half of REQ-021).
- [ ] Apply D35: distinct-anchor count + per-cluster live-probe need → record `split: triggered | not triggered` in `worklist.md`.

## Phase 2 — Review

- [ ] Cluster A code review → verdict REQ-021a.
- [ ] Cluster B code review → verdicts REQ-021 (behavior half), REQ-021f, REQ-021h; re-verify resolved F-R1-1 on a `fetch_page` response.
- [ ] Cluster C code review → verdicts REQ-021c, REQ-021d, REQ-021e, REQ-021g; re-verify resolved F-R1-2 cache-hit metadata.
- [ ] Cluster D code review → verdicts REQ-021b, REQ-021j, REQ-021k.
- [ ] Cluster E code review → verdict REQ-021i.
- [ ] Cluster F handler contract, live schema, `check-intent-citations`/`check-tdqs`, `drift-report` over §6.4 → REQ-021 G0+behavior final verdict, REQ-021j/REQ-021k verdicts, prose row.
- [ ] Gate-assertion check for every carrying gate (calibration rule 6).
- [ ] Isolated loopback probe under `/tmp/opencode/r4-probe/` (temp `TMPDIR`, `fetch.allow_private_urls=true`, temp KB path): native fetch, crawl cap, extract, date header, raw mode, array with one failing URL; redirect refusal proved by a resolver-stub unit test.

## Phase 3 — Disposition and close

- [ ] Disposition every in-scope finding P0–P3 under D33; create the `ROADMAP.md` remediation section (1–3 bullets + `**Trigger:**`) only if a P1 exists; record D41 cross-chunk notes.
- [ ] Append the R4 (or R4a) verdict table and finding register rows to `worklist.md`; update the status board and correct the R4 code line exhaustively.
- [ ] `npm run check:fast` then `npm run check`, un-piped; record exit status. A red behavioral gate re-opens the affected disposition or lands `LOOP OPEN`; a formatting gate is repaired.
- [ ] Update the `ROADMAP.md` trigger line and worklist `Next trigger` under the split decision (R5 or R4b), preserving the program-close clause.
- [ ] Re-run `check:fast` on the final tree; record it.
- [ ] Write `aar.md` with step-21 and final-tree gate evidence, D41 notes, and the terminal token.
- [ ] Split commits; `npm run session:close`.
