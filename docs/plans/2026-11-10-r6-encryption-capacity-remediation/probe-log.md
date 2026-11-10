# Probe log — R6 encryption and capacity remediation

Output of `npx tsx probe.ts` against `03cfc0d` (2026-11-10). Disposable temp dirs; no repository state touched.

```
P1 zero-length dir: [
  'vector-store.sqlite',
  'vector-store.sqlite-shm',
  'vector-store.sqlite-wal'
] meta: []
P2 (truncated, magic intact) throw: ERR_SQLITE_ERROR 11 "database disk image is malformed"
P2 dir: [ 'vector-store.sqlite' ] backup? none expected
P3 (non-SQLite bytes) throw: ERR_SQLITE_ERROR 26 "file is not a database"
P3 dir: [ 'vector-store.sqlite' ]
P4 (zeroed page 2) throw: ERR_SQLITE_ERROR 11 "database disk image is malformed"
P4 before: [ 'vector-store.sqlite' ] after: [
  'vector-store.sqlite',
  'vector-store.sqlite-shm',
  'vector-store.sqlite-wal'
] main sha: fc476fe3ca8759fb
P5 quick_check (zeroed page 2) throw: ERR_SQLITE_ERROR 11 "database disk image is malformed"
P6 before: [ 'vector-store.sqlite' ] format: plaintext after: [
  'vector-store.sqlite',
  'vector-store.sqlite-shm',
  'vector-store.sqlite-wal'
]
P7 magic: "SQLite format 3\u0000" user_version: 0 dir: [ 'vector-store.sqlite' ]
P8 before: [ 'event-before-rekey', 'second-event-before-rekey' ]
P8 after rekey: []
P8 reopened after rekey: []
P8 after disable: []
P8 reopened after disable: [
  'INFOKB1\x01\x00�~��!�橳��́��!��{�ÒG��k��\r\x16�j\r�l�\x11�����7$\x1C"',
  'INFOKB1\x01\x00\x10Q\n2���T3�@�џ���0�\x1A�\x01��\x14L���dC����\t\x02����aWI�8���X'
]
P8 meta keys: [{"key":"idf"}]
```
