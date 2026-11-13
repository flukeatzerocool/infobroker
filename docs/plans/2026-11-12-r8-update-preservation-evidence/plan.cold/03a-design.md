# Stage 3a — design critic (excerpt)

Reviewer: review subagent (fresh). Plan sha256: 4898ebeae83bc395b3a2251df9f3c6e50de82ac9fde8cd779f9d0796ec48ad18. Reads: 10/10.

Verdict: FAILED — 1 Blocker, 4 Majors, 5 Nits.

- **Blocker** `getUserConfigDrift()` is never `null` when a layer exists (`src/config.ts:263-266`); assert `hasDrift === false`.
- **Major** KB release re-init opens a new store and arms a maintenance interval (shipped 60 min); orphaned timer over a deleted tree on `resetModules`.
- **Major** three fresh quota module instances stack process-level `beforeExit`/signal listeners; a stale flush can recreate the removed quota directory after `afterAll`.
- **Major** env/user-layer overrides bypass the *default* path resolution for KB and quota; the test cannot fail if a release moves the shipped default.
- Nit: "six assertions" vs five bullets; `BODY` undefined; `checkQuota` is not read-only; `XDG_CONFIG_HOME` is Linux-only; unguarded `max_chars` arithmetic; fallback E not reflected in the done bar.

Unknowns: `kbIngest`/`flushKbWrites`/`increment` synchrony (unread); shipped `maintenance_interval_minutes` (60, confirmed by the parent); shipped encryption defaults; bookkeeping files outside the read set.
