# Stage 4 — re-zoom (cold pass)

Reviewer: fresh `review` subagent
Plan sha256 reviewed: 6f88e55fb6c5c8820e65d7bd9c1fe8c6011ebab7a577aaad21b6ba8ee9c72686
Reads used: 8/8

## Findings

- **[Blocker]** `user_version = 0` was simultaneously "legacy version 1" and "outside the supported range", so the table as written refused every pre-existing store; the corrupt fixture could not catch it because new stores write 1.
- **[Blocker]** D4's first row swallowed the `unrecognized` row for any file under 100 bytes, so a 38-byte text file was classified `new` and opened read-write.
- **[Major]** The `locked` outcome claimed "file untouched" while the classification's own read-only open creates sidecars.
- **[Major]** The recovery sequence left the post-recovery continuation failure unspecified, so "same call" and the restore guarantee could both break; the event was written before the failing step.
- **[Nit]** The newest-100 retention can still evict a preserved row, so "not dropped" overstated the durable outcome.
- **[Nit]** `<ts>` must be digits for `ARCHIVE_RE`, which the artifact never stated.
- **[Nit]** "On `ok` write nothing" would have dropped the idempotent DDL and the pragma path.
- **[Nit]** D6's sentence count was off by one (3, not 4).

## Disposition

All resolved in the revision: the supported range is `marker ≤ SQLITE_FORMAT_VERSION` with 0 as the legacy marker; `new` is only "no file or zero bytes", every non-magic file is `unrecognized`, and a magic file under the header size is `corrupt`; the probe records/cleans its own sidecars; the event is written only after the continuation succeeds and any failure restores and rethrows the original error; retention wording scoped; `<ts>` digits stated; the `ok` path keeps the pragmas and DDL; the sentence counts are 3 and 4.
