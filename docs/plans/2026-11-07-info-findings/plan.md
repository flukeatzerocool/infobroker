# Plan — remediate the seven 2026-11-07 read-through info findings

**Increment record:** docs/plans/2026-11-07-info-findings/
**Project:** Infobroker (spec version 2026.11.7)
**Baseline:** main at 6c8f4ca; clean working tree; npm run check green on this exact tree (pipeline final gate, run-20261107-141154); 21 commits ahead of origin/main.
**Review depth:** standard — multiple files, fully reversible, no external state.
**Rollback cost:** 1 — edits only; no destructive, remote, credential, or schema operation.

**Done bar:** All seven findings carry a terminal disposition in the AAR finding register. npm run check:fast is green, and the full npm run check is green on the final tree. A unit test proves that a gate without a manifest opt-in cannot be retired and that a hand-edited ledger entry for such a gate is ignored. The CHANGELOG entry and D-095 are committed. The working tree is clean and the commits are split by AGENTS.md concern bucket.

## 1. Finding register

| ID | Finding | Evidence (verified this session) | Disposition |
|---|---|---|---|
| F1 | C.9 used the British spelling "relabelled" | Already fixed in commit 937f2e0 | Closed by verification; no further edit |
| F2 | SR-004 says these providers need no key while §A.3 is titled "Registration Required" | infobroker.md:88 vs :1473; config.json marks semantic_scholar, stack_exchange, and github auth_optional:true and core without it | Fix: retitle §A.3 and add one clarifying sentence |
| F3 | §3 block reservations label 126 "core tools", assign it twice, and put 129 (provider configuration) there | infobroker.md:184; §D table puts 125–126 in Client Artifacts and REQ-129 in §4.2 | Fix: restate three ranges |
| F4 | Provider status definition stacks two parentheticals | infobroker.md:158 | Fix: merge the citations into one parenthesis |
| F5 | README claimed package, tag, and npm version are "the same string" | README fixed in 6c8f4ca; the identical claim survives at CHANGELOG.md:28 | Fix: correct the CHANGELOG sentence |
| F6 | Gate retirement has no protected-gate list | scripts/lib/gate-retirement.ts decideRetirement; REQ-101 calls the dependency gate mandatory; C.6 says validate-spec must exit zero | Fix: retirement requires a manifest opt-in |
| F7 | §1 mission list mixes an adjective with noun phrases | infobroker.md:26 "structured knowledge, scholarly, and content-extraction APIs" | Fix: "scholarly literature" |

## 2. Batch 1 — spec prose (one file, four edits)

Target: infobroker.md. No REQ body changes, so C.10 requires no CHANGELOG entry for this batch.

E1 (F7), line 26:
- Replace "structured knowledge, scholarly, and content-extraction APIs" with "structured knowledge, scholarly literature, and content-extraction APIs".

E2 (F4), line 158:
- Replace "(quota consumed) (REQ-013, REQ-034)" with "(quota consumed; REQ-013, REQ-034)".

E3 (F2), line 1473:
- Replace the heading "### A.3 Free HTTP (Registration Required)" with "### A.3 Free HTTP (Free Key Optional)".
- Insert one paragraph immediately after the heading: "Keys are optional for these providers; CORE requires a free key."
- Rationale: config.json marks the three optional providers auth_optional:true; providers/core.ts sends Authorization only when a key exists, but the CORE API requires one, and src/corroborate.ts excludes a provider that declares auth_env without auth_optional. No other file references the A.3 title.

E4 (F3), line 184 — three substitutions inside the block-reservation sentence:
- "010–011, 013–015, 104 (provider configuration)" becomes "010–011, 013–015, 129, 104 (provider configuration)".
- "121–130, 031a (core tools)" becomes "121–124, 127–128, 130, 031a (core tools)".
- "114–120, 120a, 126 (client artifacts)" becomes "114–120, 120a, 125–126 (client artifacts)".
- Result: 129 appears once (provider configuration), 125–126 appear once (client artifacts), and no ID is assigned twice.

## 3. Batch 2 — gate retirement requires a manifest opt-in (F6)

Design: a gate becomes advisory only if the manifest marks it retirable. An unknown gate and an unmarked gate are both refused, so a newly added gate is protected by default (fail closed). A hand-edited ledger entry for an unmarked gate is ignored at read time with a warning, so the rule holds on both the write path (gate-cost --retire) and the read path (run-gates).

Considered and rejected: a hardcoded protected deny-list (audit, validate-spec, ...). It fails open for every gate added later, which is the same defect one level down.

scripts/lib/gate-manifest.ts
- Add optional "retirable?: boolean" to the Gate interface, documented as the retirement opt-in; absent means protected.
- Set retirable: true on the check-non-goals entry (the one existing ledger entry).
- Add and export isRetirable(name: string): boolean, reading GATES so the manifest stays the single source of truth.

scripts/lib/gate-retirement.ts
- Import isRetirable from gate-manifest.js.
- Add "protected" to the RetirementState union.
- Change retirementState to (cost, advisory, { retirable = true, policy = CLEAN_RUNS } = {}): return "advisory" first, then "protected" when retirable is false, then the existing streak logic. Two-argument call sites keep working.
- In decideRetirement, after the unknown-gate guard, refuse an unmarked gate with the reason: "NAME" is not marked retirable in the manifest.
- In readLedger, after the KNOWN_GATES guard, push the warning gate-ledger.json: "NAME" is not retirable — entry ignored, and skip the entry.
- Update the file header to state the opt-in rule.
- decideRestore is unchanged; restoring always removes an entry.

scripts/gate-cost-report.ts
- buildReport passes { retirable: isRetirable(name) } to retirementState.
- buildReport adds a "protected" string array beside "eligible" and "advisory" (additive; schema stays 1). scripts/weekly.ts reads only advisoryGates(ledger), so it is unaffected.
- printReport's policy line reads "N eligible, N advisory, N protected".
- mutate() needs no change: it already prints decision.reason and exits 1 on refusal.

scripts/lib/gate-retirement.test.ts
- retirementState returns "protected" for a 30-run clean gate with { retirable: false }.
- decideRetirement refuses validate-spec and audit at 30 clean runs; the reason contains "not marked retirable".
- readLedger ignores a hand-written audit entry and emits exactly one warning.
- The existing check-non-goals cases keep passing unchanged.

scripts/lib/gate-manifest.test.ts
- New case: the retirable gate names equal ["check-non-goals"], so an accidental or forgotten opt-in fails the suite.

## 4. Batch 3 — records

CHANGELOG.md
- New top entry "## 2026.11.7 — Gate retirement is opt-in" with three bullets: retirement now requires a manifest opt-in; a protected gate stays gating even when the ledger names it; check-non-goals is the only retirable gate today.
- Correct line 28: "the package, the tag, and the npm-published version are the same string" becomes "the package, the tag (which carries the conventional v prefix), and the npm-published version all carry the same version". This closes F5 in its only remaining occurrence.
- The entry date must be 2026.11.7 because version-sync pins the top CHANGELOG date to package.json.

DECISIONS.md
- Insert "### D-095: Gate Retirement Requires a Manifest Opt-In (2026.11.07)" directly after D-094 and before D-090. Body: the rule; the contracts it protects (REQ-101 mandatory dependency gate, C.6 drift detector must exit zero); the rejected deny-list alternative; the consequence (opting a gate in is a reviewed manifest edit, and the ledger remains an explicit recorded decision).

## 5. Batch 4 — increment record and verification

Create docs/plans/2026-11-07-info-findings/plan.md (this plan, carrying the Done bar line), tasks.md (the four batches as checkable items), and aar.md (finding register with dispositions, ending exactly with LOOP PAUSED or LOOP OPEN). check-loop-artifacts requires all three files and the terminal token.

Verification, in order:
1. npm run typecheck — exit 0.
2. npx vitest run scripts/lib/gate-retirement.test.ts scripts/lib/gate-manifest.test.ts — exit 0, new cases included.
3. npm run gate-cost — protected gates render state "protected"; the eligible list no longer offers validate-spec or audit.
4. npm run gate-cost -- --retire validate-spec --dry-run — exit 1, stderr names "not marked retirable"; the ledger is unchanged.
5. npm run validate-spec — exit 0 (prose edits only, no REQ body changed).
6. npm run validate-readme — exit 0.
7. npm run check-gate-table — exit 0 (descriptions unchanged, so the AGENTS.md table is byte-identical).
8. npm run check-loop-artifacts — exit 0.
9. npm run version-sync — exit 0 (new CHANGELOG date equals 2026.11.7).
10. npm run check:fast — exit 0.
11. npm run check — exit 0 (full suite; audit needs registry access).

## 6. Commit series

| # | Commit | Files | Gate before commit |
|---|---|---|---|
| 1 | spec(prose): reconcile provider tiers and REQ block reservations | infobroker.md | typecheck, validate-spec |
| 2 | feat(gates): require a manifest opt-in for gate retirement | gate-manifest.ts, gate-retirement.ts, gate-cost-report.ts, both test files | typecheck, vitest filter, check-gate-table |
| 3 | docs: record opt-in gate retirement in CHANGELOG and D-095 | CHANGELOG.md, DECISIONS.md | version-sync, validate-spec |
| 4 | docs(plans): increment record for the info-findings remediation | docs/plans/2026-11-07-info-findings/ | check-loop-artifacts |

Four commits, one concern each, each under the roughly 300-line split limit. Commit 4 lands last because its aar.md records the verified outcome.

## 7. Blast radius

| File | Change | Size |
|---|---|---|
| infobroker.md | 4 prose edits | S |
| scripts/lib/gate-manifest.ts | optional field, one opt-in, isRetirable | S |
| scripts/lib/gate-retirement.ts | new state, two guards, header | M |
| scripts/gate-cost-report.ts | pass the opt-in, protected list, summary line | S |
| scripts/lib/gate-retirement.test.ts | 3 new cases | S |
| scripts/lib/gate-manifest.test.ts | 1 new case | S |
| CHANGELOG.md | 1 new entry, 1 corrected sentence | S |
| DECISIONS.md | D-095 | S |
| docs/plans/2026-11-07-info-findings/ | plan, tasks, aar | S |
| README.md | verify only; expected no diff | — |

Eight edited files plus three new record files. No dependency, config, provider, or tool-schema change.

## 8. Edge cases and rollback

- The existing ledger entry for check-non-goals stays valid because that gate is marked retirable; no ledger migration is needed.
- A protected gate named in a hand-edited ledger is ignored with a warning, so npm run check keeps failing on it.
- Forgetting to mark a new gate retirable is the safe direction (protected), and the gate-manifest test names the current opt-in set explicitly.
- If the opt-in design is rejected at review, the fallback is a record-only disposition: D-095 documents the risk and no code changes (Batch 2 and its commit drop out).
- Rollback: git revert each commit; there is no external state, migration, or tag.

## 9. Assumptions and their verification

- A1: mutate() already prints the refusal reason — verified at scripts/gate-cost-report.ts this session.
- A2: the only call sites of retirementState and decideRetirement are gate-cost-report.ts and the tests — verified by grep this session.
- A3: no existing retirable or protected-gate logic exists — verified by grep over scripts/ and src/ returning nothing.
- A4: no file references the §A.3 title — verified by grep over the repo this session.
- A5: docs/plans/README.md is a file, which listIncrements ignores (it filters directories) — verified by ls and test -f this session.

## 10. Trust boundary

Every premise is repository-sourced (spec, config, source, tests, and the run's readthrough.json). No web, issue, or log content informs a step.

## 11. Spec-project checks

- No REQ body is edited; no coverage-map row, fingerprint, or generated artifact depends on the edited prose.
- Register coupling: DECISIONS.md gains D-095 in the same commit series; ROADMAP.md gets no item because the fix ships in-session (triage P2, no standing work remains).
- No new REQ, so the spec-addition blast radius (coverage map, register regeneration, test-name prefix, runtime config list) does not apply.
- Resolves coverage: the findings come from the pipeline read-through (readthrough.json, 7 info), not a spec-review report; F1 and F5 were already fixed by the pipeline's own commits and are recorded as verified, not silently dropped.
