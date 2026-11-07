# Tasks — Gate retirement and weekly cadence

- [x] T1. Add `scripts/lib/gate-retirement.ts`: timing read, cost summary,
      ledger read/write, eligibility, result classification.
- [x] T2. Add `scripts/gate-ledger.json` (`schema: 1`, empty `gates`).
- [x] T3. Add `scripts/gate-cost-report.ts` with `--json`, `--retire`,
      `--restore`, `--dry-run`, `--help`; add the `gate-cost` npm script.
- [x] T4. Add `scripts/lib/gate-retirement.test.ts` and pass `npm run test`.
- [x] T5. Wire advisory gates into `scripts/run-gates.ts` (softened exit,
      `ADVISORY FAIL`, `--list` marker, header path fix) and test
      `classifyResults`.
- [x] T6. Add `scripts/lib/weekly.ts` + `scripts/weekly.ts`; write the dated
      JSON artifact and print the three sections; add the `weekly` npm script.
- [x] T7. Add `scripts/lib/weekly.test.ts` (composition, missing sources).
- [x] T8. Update `docs/workflow-cadence.md`, `AGENTS.md`, and `CHANGELOG.md`.
- [x] T9. Run `npm run gate-cost`; choose one eligible gate with the user;
      record it with `npm run gate-cost -- --retire <gate>`.
- [x] T10. Simulated-failure check: `ADVISORY FAIL <gate>`, exit 0; restore the
      file and confirm green.
- [x] T11. Run `npm run weekly` and confirm the artifact and all three
      sections; repeat with the timing file moved aside.
- [x] T12. Remove the `ROADMAP.md` section; write the final `aar.md` with the
      finding register and `LOOP PAUSED`.
- [x] T13. Run `npm run check` (full) and the split commit series.

T11 note: the live run wrote all three sections; with the timing file moved
aside it reports `no record`, still writes the artifact, and exits 0.
