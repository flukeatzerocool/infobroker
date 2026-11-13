# Stage 4 — re-zoom (excerpt)

Reviewer: review subagent (fresh). Plan sha256: 8d75fce94708c305d0e4320ddb2b81dfa280845a65e8d9134e087660d671273d. Reads: 11 calls / 7 files.

Verdict: does not pass as-is — 0 Blockers, 3 Majors, 4 Nits.

- **Major** the commit-series closing sentence contradicted T11–T13 ("series made before T12" while commit 6 is made by T13 after it).
- **Major** the register enumeration missed `worklist.md:146` and `:547`, both live rows that still assert "no carrier / no asserting test".
- **Major** mutation check 2 (delete `xdg/`) removed the only `kb.storage_path`, so `initKb` would fall back to the real `~/.local/share` store.
- **Nit** done-bar failure set incomplete (mutation 1 also fails 6; mutation 2 also fails 1).
- **Nit** "three module instances" is two.
- **Nit** T6's Verdict-cell form dropped the finding id (R7 precedent keeps it parenthetical).
- **Nit** CHANGELOG insertion placed the newest entry below a newer one; prepend instead.

Verified sound: per-key merge; legacy-layer probe; drift null only without a layer; `flushWrite` no-op without a pending timer; fallback E payload shape; `initKb` close + maintenance clear; all cited anchors.
