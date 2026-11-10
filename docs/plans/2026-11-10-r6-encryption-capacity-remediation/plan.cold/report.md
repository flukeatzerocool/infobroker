# Independent review — R6 encryption and capacity remediation (cold pass)

Reviewer: fresh `review` subagents, one per stage
Plan sha256: 63811afc091e9b34fd360dd169b64a3938d332f2cc673601b1d4e51fe13c6abf
Date: 2026-11-10 · Depth: deep · Stages: 5/5 run · Dispatches: 10/7

`independent-review passed.` — readiness GO on the fourth check, with two wording findings folded in as amendments.

## Summary

| Stage | Verdict | Blockers | Majors | Nits |
|---|---|---|---|---|
| 1 zoom out | findings | 1 | 10 | 7 |
| 2 comprehension | faithful-with-gaps | 0 | 6 | 4 |
| 3 design critic | findings | 3 | 9 | 2 |
| 3 structural critic | findings | 1 | 5 | 2 |
| 3 style critic | findings | 1 | 5 | 10 |
| 4 re-zoom | findings | 2 | 2 | 4 |
| 5 readiness (run 1) | **NO-GO** | 5 | 4 | 0 |
| 5 readiness (run 2) | **NO-GO** | 2 | 2 | 4 |
| 5 readiness (run 3, user-authorized) | **NO-GO** | 3 | 0 | 2 |
| 5 readiness (run 4, user-authorized) | **GO** | 0 | 2 | 0 |

Every Blocker and Major from every run is resolved in the current artifact. The fourth readiness check returned **GO**; its two Majors were wording findings in D4 and Phase 2 step 6 and are folded into the final amendment (the sub-header parenthetical now names the 16-byte magic, and the missing-key assertion names the encrypted-store fixture and the `config_error` lock). A condition-only amendment is not re-reviewed.

## What the cold pass changed

1. **The spec decision moved into the plan.** REQ-085's non-modification clause and REQ-108's corrupt-store recovery clause genuinely collide. The plan appends one measured sentence to REQ-085 (`A recognized store with corrupt content SHALL be recovered per REQ-108.`) and classifies from the file header instead of deferring the adjudication to a reviewer.
2. **The format marker moved to the SQLite header.** A `meta` row can only be read by opening the database, and a read-only open of a WAL store creates `-wal`/`-shm` (P6) — so "the store was not touched" was unprovable. `user_version` at offset 60 is readable with no handle (P7), and existing stores report 0, which is now the reserved legacy marker.
3. **Classification became fail-closed and observable.** `SQLITE_IOERR` is not corruption; an unclassified failure is `locked`; every non-SQLite file is `unrecognized`; and corruption is detected only by `PRAGMA quick_check` (P5) — an open plus a schema read passes over a damaged store.
4. **Recovery became an ordered, single-open sequence** in the store layer, with the handle closed first, the event written only after success, a restore-on-failure path testable through the real `openDatabase` seam and one ordinary config, and a typed `corrupt` error when recovery is opted out.
5. **Error contracts, commit split, and test targets were pinned** so no intermediate tree is half-wired.

## Incidental finding

`sqliteStoreFormat()`'s read-only open creates `-wal`/`-shm` on a cleanly closed WAL store and reports `plaintext` for a corrupt-but-magic file (P6). This is pre-existing, outside the section's three IDs, and recorded for the AAR as a P3 informational finding rather than widened into this increment.

## Resolution

Readiness passed on the fourth check (user-authorized, `Verdict: GO`). The pass used ten dispatches against a seven-dispatch budget; every extra dispatch was authorized by the user, and each one removed a real design ambiguity rather than re-litigating a settled one.

Cold artifact sha256 is recorded by the plan stamp; `plan.cold/report.md` is not edited after stamping.
