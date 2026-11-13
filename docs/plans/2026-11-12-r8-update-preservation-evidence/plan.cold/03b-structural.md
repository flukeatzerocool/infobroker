# Stage 3b — structural critic (excerpt)

Reviewer: review subagent (fresh). Plan sha256: 4898ebeae83bc395b3a2251df9f3c6e50de82ac9fde8cd779f9d0796ec48ad18. Reads: 9 calls / 7 files.

Verdict: not ready — 0 Blockers, 5 Majors, 5 Nits.

- **Major** T7 removes the roadmap section before the `validate-spec` its close condition names and before the CHANGELOG it must move into; commit split separates them.
- **Major** T8's CHANGELOG tail cites `D-111`, which T9 creates afterwards; commit order reverses the dependency.
- **Major** T12 records its exit in files already committed by commit 5 — circular; no step commits the post-check record.
- **Major** Done bar says six assertions, Test design enumerates five.
- **Major** Synchrony premise unverified; cite sync signatures.
- Nits: baseline attributes T0's action to T1; CHANGELOG anchor ambiguous (two same-date sections); T3 bundles two independent remedies; T10 omits `check-gate-coverage`/`test`; `update-preservation.test.ts` is confusable with `preservation.test.ts`.

Unknowns: KB/quota/initKb behaviour (outside read set); `validate-spec` source-file documentation rule; vitest isolation defaults.
