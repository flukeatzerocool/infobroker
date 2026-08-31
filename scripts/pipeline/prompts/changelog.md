Load and apply the changelog-before-commit skill. Read CHANGELOG.md,
including the embedded CHANGELOG WRITING STYLE comment — honor every rule in
it (human-readable description first, REQ reference in parentheses as a
traceability anchor, no internal diffs, group by user/operator impact).

Inspect what changed this run:
1. `git diff` (unstaged) and `git diff --staged` on infobroker.md, README.md,
   and src/ — identify every REQ that was added or modified, and every
   behavior change to src/.
2. The spec requires provenance: any modified or new REQ SHALL have a
   CHANGELOG entry citing the REQ ID and the nature of the change.
3. Add a single date-stamped entry at the top of CHANGELOG.md with the format
   `## YYYY.MM.DD — <short human title>` matching the existing entries.
   Group bullets by impact area. Each bullet opens with what changed and why
   it matters in plain English, then the REQ reference in parentheses.
4. If nothing semantic changed (no REQ added/modified, no behavior change),
   do not add an entry — and do NOT remove or alter the `## YYYY.MM.DD — `
   version header that `version-bump` seeded at the top of CHANGELOG.md.
   Leave CHANGELOG.md exactly as version-bump left it and report
   `CHANGELOG NO CHANGE.`

Do NOT commit. End your reply with exactly one line:
- `CHANGELOG UPDATED.` if you added an entry, or
- `CHANGELOG NO CHANGE.` if nothing semantic changed.
