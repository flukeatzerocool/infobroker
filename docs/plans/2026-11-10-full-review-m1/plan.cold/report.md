# Diff re-review — plan.md (cold pass 2)

**Reviewer:** `review` subagent (cold diff re-review; no authoring context)
**Plan:** `docs/plans/2026-11-10-full-review-m1/plan.md`
**Revised sha256:** `b0a0c77f162e204cc25e1d2afea60a7f4a67cfe015a6b000e7a51c7a1351d2ba` (23799 bytes)
**Prior sha256:** `877f6cd7c39b3850d0182023510de638b5f6548ec1210cb842ff72537c1d7beb` (reconstructed from the stage-1 report; bytes no longer on disk)
**Date:** 2026-11-10 · **Depth:** standard · **Protocol:** diff re-review against `plan.cold/report-stage1.md`
**Persisted by:** the parent session — the reviewer ran under a read-only harness.

`independent-review passed.`

Scope: whether each stage-1 finding is resolved in the revision and whether the resolution introduced a new hard blocker. Not a fresh full sweep; findings in unchanged text would be recorded as Deferred.

## Finding dispositions

| ID | Disposition | Revised anchor | Basis |
|---|---|---|---|
| B1 | Resolved | done bar (b) plan.md:16; M1-D3 :40; EV10 :61; step 11 :85 | Form (ii) verified: R2 27 rows (`worklist.md:580–619`) + R3 15 (`:627–654`) = 42; the three forms partition the 168 rows. The false universal is replaced by the tracker's three real forms. |
| M1 | Resolved | EV5 :56; done bar (c) :17; step 10 :84 | Evidence named and present: `REQ-020a/c/h` at `worklist.md:209,211,216`; `F-R2-27` at `:605` (P1, REQ-036). Verdict is `finding:`, not bare `holds`. |
| M2 | Resolved | steps 16–18 :93–95; (e) :19; non-closure :22; step 14 :91 | Step 16 = first authoritative gate, "Do not write a terminal token before this run is green"; step 17 carries its status; step 18 red path rewrites both tokens and restores the section. |
| M3 | Resolved | (a) :15; M1-D1 :38; EV6 :57; steps 3/5 :71,76; tasks.md:16–30 | Gating vs informational legs split; parsed content (structural-violation count, G1 coverage/exemptions, fixture ages) is the evidence. |
| M4 | Resolved | M1-D4 :41; step 15 :92; step 19 :96 | Sweep `tasks.md` added to the live-register list; program `plan.md` treatment stated (stays as opened, README immutability rationale). |
| M5 | Resolved | (f) :20; C-3 :28; risk :110 | (f) defines the `NOT_RUN` aggregate (`check:fast` + recorded non-fast legs; "green with N environmental NOT_RUN"). |
| N1 | Resolved | :16, :56, :84 | Cites corrected to `worklist.md:83-104`. |
| N2 | Resolved | EV5 :56; step 10 :84 | Coverage now includes §2 failure modes and §6.1–§6.2; uncovered sections handled by the per-chunk `Spec:` walk. |
| N3 | Resolved | (d) :18; step 12 :86; EV11 :62; Verification :103 | Heading-list diff is normative. Verified: 29 `##` headings in `ROADMAP.md` (`:17` sweep, `:25`–`:213` 27 remediation, `:220` Non-goals) → 28. |
| N4 | Resolved | EV1 :52 | "17 increments … (the untracked M1 directory was created after it)". |
| N5 | Resolved | EV3 :54; (b) :16; step 9 :83 | "no row with severity `P0` lacks a `Resolved` disposition". |
| N6 | Resolved | M1-D5 :42; tasks.md:35,37 | `grep`/`sort -u`/`sed` recorded; the `comm` claim is gone. |
| N7 | Resolved | step 15 :92; M1-D4 :41 | R1–R9 chunk boxes and Phase A ticked per status board and each AAR. |

## New findings

**New-M1 — [clarity] Census total off by one; its two splits disagree (Major, non-blocking).**
- EV10 (`plan.md:61`): "169 register rows … 78 P1, 89 P2, and 1 … unparseable" — 78 + 89 + 1 = 168.
- By form: 75 + 42 + 51 + 1 = 169, but the register has exactly 168 such rows (`^\| F-[A-Za-z0-9-]+ \| R[0-9] \|.*Scheduled-roadmap` → 168). The unanchored token count 169 includes the schema prose at `worklist.md:21`. The malformed row `F-R5-B-8` (`worklist.md:717`) is an R5 P2 row, already inside the "R5 27", so "51 + 1 malformed" double-counts it.
- Propagates to done bar (b)(iii) `:16`, step 11 `:85`, step 17 `:94` ("75-42-51+1"), Verification `:102` ("169 dispositions"), and the cold-pass-1 paragraph `:132` ("94 rows are unnamed"; true 93).
- Not a blocker: step 11 requires re-deriving the census ("make the claim true, not make it pass") and no step premise is falsified. Must be corrected before stamping because the plan itself (`:111`) makes these counts the substantive evidence.
- Fix: total 168; state the malformed row as inside the 52 (R4 18 / R5 27 + malformed / R6 6) and align (b)(iii), steps 11/17, Verification, and `:132`.

**New-N1 — [clarity] Stale step cross-reference.** EV5 (`:56`) says the goal-3 row "is written at step 11"; the write is step 10 (`:84`), and step 15 (`:92`) already says "step 10 row".

No new hard blocker: no contradiction that halts a step, no impossible done-bar clause, no step whose premise is false. No Deferred items (all stage-1 findings touched text that changed).

## Verified claims

1. **Disposition census:** 168 `Scheduled-roadmap` register rows; R2 = 27, R3 = 15. Unanchored token count 169 includes `worklist.md:21`.
2. **§1 goal 3 evidence path:** `REQ-020a` (`worklist.md:209`), `REQ-020c` (`:211`), `REQ-020h` (`:216`) are provider-selection/routing/quality verdicts; `F-R2-27` (`:605`) is a P1 REQ-036 latency finding.
3. **Retirement heading diff:** 29 `##` headings → 28 after retirement (sweep + 27 remediation + `## Non-goals`), matching EV11.

## Verdict and counts

`independent-review passed.` — B1 and M1–M5 resolved; N1–N7 resolved; 1 new Major (New-M1), 1 new Nit (New-N1); 0 new blockers.

**Stamp condition:** apply the New-M1 count correction (168; malformed row inside the 52) to `plan.md` before the plan gate stamp. No further cold pass is required for a textual count correction; if the correction changes the mapping rather than the arithmetic, that is a new artifact and re-review applies.

Reads: 9 content reads/greps (10 tool calls, one `shell` permission-denied).

## Resolution note (parent, post-review)

The New-M1 correction was applied exactly as required — 168 rows; the malformed row inside the 52, split R4 18 / R5 27 + malformed / R6 6; the three forms now 74 / 42 / 52 — in done bar (b)(iii), M1-D9, EV10, step 11, step 17, Verification, the unbacked-P2 risk, and the cold-pass-1 paragraph. New-N1 was applied (EV5 now says "step 10"). The mapping itself is unchanged, so per the reviewer's stamp condition no further cold pass is required.

## Unknowns / isolation caveats

- `plan.evidence.json` not opened (budget); the census was re-derived from `worklist.md` directly.
- `npm run check` (EV1), C-1's 28-commit state, and the post-retirement `check-roadmap` were not re-executed (read-only stage).
- The R4/R5/R6 unbacked split was not re-derived per ID against `ROADMAP.md` section membership; only the 52 total is confirmed (168 − 74 − 42), and the split is confirmed by the parent's anchored parse.
- Single-context diff re-review (no nested subagents permitted).

## Plan binding (parent, post-review)

Plan sha256: 0157b90f5892a5caeaa2923355795efa2919b777262b08b5cb9a7487b109e16f

The report above reviews revision `b0a0c77f…` and returned `independent-review passed.` with one stamp condition: apply the New-M1 count correction. The final revision `0157b90f…` differs from the reviewed one only by (a) that count correction (168 rows; 74 ID-named / 42 chunk-register / 52 unbacked; the malformed row inside the 52), and (b) status, C-2, and review-independence metadata recording the outcome of both passes. No mapping, step, scope, or done-bar clause changed. Per the reviewer's own stamp condition, no further cold pass is required; this line binds the report to the final artifact for the plan gate.
