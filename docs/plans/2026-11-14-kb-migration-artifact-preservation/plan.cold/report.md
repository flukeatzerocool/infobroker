# Cold review — KB migration artifact preservation

Reviewer: `independent-review` (fresh context, no authoring conversation)
Date: 2026-11-14
Plan under review: `docs/plans/2026-11-14-kb-migration-artifact-preservation/plan.md`
Plan sha256: e91a8236634913a3a97ee43f6fc2bebce0f8e7ca301a9668d2bb0a9617176d9b
Draft reviewed by the cold pass: `e441b3ea8c5d27f03e1a465cb4de7c5b9ef09293b83513aed289150c9d855f67`; the plan was revised to resolve every finding below and re-stamped.
Repository HEAD: `487c597`
Reads used: 30/40. Stages 1–5 performed in one cold context.

## Findings and dispositions

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Major | D4's character arithmetic was wrong (733/67/793); the validator definition gives 707 chars and a 64-char sentence → 772. The "800-char ceiling" that motivated trimming `at upgrade time` did not exist, and the arithmetic was internally inconsistent (733 + 68 − 5 ≠ 793) | Resolved: D4 re-measured from `scripts/validate-spec.ts:253-255` → 707 / 5 / 7 → 772 / 6 / 8; the prose trim dropped |
| 2 | Major | The `.enc` name collides with the benchmark's seed discovery (`scripts/benchmark-kb-store.ts:141-150`, used at `:236`); a sealed artifact becomes a ciphertext seed and the plaintext lane measures an empty store. The script was absent from the blast radius | Resolved: new D6, `scripts/benchmark-kb-store.ts` added to the blast radius, done-bar item 8 and a mutation proof |
| 3 | Major | The artifact write was non-atomic, contradicting REQ-085, and no done-bar item covered a partial file | Resolved: D1 now specifies temp → `fsync` → `rename` → directory `fsync`; done-bar item 7 |
| 4 | Minor | REQ-108 was cited at `infobroker.md:634` (REQ-103); the body is at `:625` | Resolved: citation corrected; REQ-084 corrected to `:613` |
| 5 | Minor | D5 named `isKbStoreArtifact` as the deletion mechanism; the sweep tests `isKbArchiveArtifact` / `ARCHIVE_RE` | Resolved: D5 re-phrased and the gate predicate distinguished |
| 6 | Minor | The seal-failure case had no named injection seam; `migrateLegacyJson` is the only export | Resolved: exported `writeMigrationArtifact` seam named in the blast radius and C-3; read-only-directory simulation demoted to a non-primary proof |
| 7 | Minor | Done bar 6 ("existing tests unmodified") was unachievable because step 2.1 rewrites the encrypted-migration test | Resolved: scoped to the encryption-disabled and corrupt-store tests by line range |
| 8 | Minor | Retention and deletion semantics for the preserved artifact were unstated | Resolved: D3 now states the retention rule, the disk cost, the rekey caveat, and that it is a standing decision rather than a roadmap item |
| 9 | Nit | "REQ-108(b)" used a register clause label as if it were spec text | Resolved: re-phrased as "the register's clause (b)" |

## Unknowns recorded by the reviewer

- The 733-char figure could not be reproduced under any counting rule; 707 follows the gate's definition exactly. (Confirmed by the author with the same definition.)
- Baseline gate claims were not executed by the reviewer. (Verified by the author; see the plan's Baseline section.)
- D-092's full text and the R6 AAR were accepted as cited, not re-read.
- Whether a writable-directory simulation works under the CI runner's user was not inspected — which is why the plan prefers a named seam.

## Verdict

`independent-review passed.` — no Blockers; all Majors and Minors resolved in the revision above.
