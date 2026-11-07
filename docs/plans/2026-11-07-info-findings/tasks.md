# Tasks — info-findings remediation (2026-11-07)

- [x] Batch 1 — spec prose: F7 (scholarly literature), F4 (one parenthetical), F2 (§A.3 retitle + sentence), F3 (block reservations)
- [x] Batch 2 — gate retirement opt-in: manifest field + `isRetirable`, `protected` state, write/read guards, report field, 4 new tests
- [x] Batch 3 — records: CHANGELOG entry, CHANGELOG CalVer wording, D-095
- [x] Batch 4 — increment record: plan, tasks, aar
- [x] Verification 1–2: typecheck, targeted vitest (36/36)
- [x] Verification 3–4: gate-cost protected states; `--retire validate-spec --dry-run` exits 1
- [x] Verification 5–9: validate-spec, validate-readme, check-gate-table, version-sync
- [x] Verification 8: check-loop-artifacts (PASS, 5 increments)
- [x] Verification 10–11: check:fast (19 gates, 0), full check (0)
- [x] Commit series 1–4: 892bf26, a15a691, 5ba0c83, and this record commit

## Notes

- F1 and F5's README half were already fixed by the pipeline commits `937f2e0` and `6c8f4ca`; verification only.
- F5's remaining occurrence was `CHANGELOG.md:28`, corrected in Batch 3.
