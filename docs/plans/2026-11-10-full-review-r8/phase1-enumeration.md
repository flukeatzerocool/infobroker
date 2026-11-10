# Phase 1 enumeration — chunk R8

Generated 2026-11-10. Anchors are unique `file:line` matches of the 15 R8 REQ IDs across each cluster's reviewed files (the R4/R6 method). A range counts once. Prose `spec:line` units are listed separately and are not anchors.

## Cluster A — Distribution, update preservation, migration

**Anchors:** 29

```
src/config-migrations.ts:1 src/config-migrations.ts:2 src/config.ts:1 src/config.ts:189 src/config.ts:228 src/config.ts:248 src/config.ts:254 src/config.ts:264 src/config.ts:62 src/config.ts:66 src/config.ts:73 src/config.ts:979 src/index.ts:1 src/index.ts:1013 src/index.ts:1074 src/index.ts:1083 src/index.ts:1148 src/index.ts:1235 src/index.ts:1318 src/index.ts:2124 src/index.ts:2196 src/index.ts:2395 src/index.ts:2413 src/index.ts:483 src/index.ts:573 src/index.ts:636 src/index.ts:644 src/index.ts:89 src/index.ts:98 
```

## Cluster B — State health, notices, startup, update check

**Anchors:** 23

```
src/index.ts:1 src/index.ts:1013 src/index.ts:1074 src/index.ts:1083 src/index.ts:1148 src/index.ts:1235 src/index.ts:1318 src/index.ts:2124 src/index.ts:2196 src/index.ts:2395 src/index.ts:2413 src/index.ts:483 src/index.ts:573 src/index.ts:636 src/index.ts:644 src/index.ts:89 src/index.ts:98 src/state-health.ts:1 src/state-health.ts:119 src/state-health.ts:136 src/state-health.ts:168 src/update-check.ts:1 src/update-check.ts:125 
```

## Cluster C — Operational call record and session summary

**Anchors:** 5

```
src/call-log.ts:1 src/call-log.ts:21 src/call-log.ts:87 src/cooldown.ts:41 src/session-stats.ts:1 
```

## Cluster D — Security model and distribution gates

**Anchors:** 21

```
scripts/lib/gate-manifest.ts:126 scripts/lib/gate-manifest.ts:20 scripts/validate-spec.ts:70 scripts/validate-spec.ts:73 scripts/validate-spec.ts:840 scripts/validate-spec.ts:848 scripts/validate-spec.ts:852 scripts/validate-spec.ts:858 scripts/validate-spec.ts:865 scripts/validate-spec.ts:869 scripts/validate-spec.ts:921 scripts/validate-spec.ts:929 scripts/validate-spec.ts:934 scripts/validate-spec.ts:937 scripts/validate-spec.ts:939 scripts/validate-spec.ts:941 scripts/validate-spec.ts:947 scripts/validate-spec.ts:957 scripts/validate-spec.ts:964 scripts/validate-spec.ts:967 scripts/validate-spec.ts:970 
```

## Cluster E — Content policy

**Anchors:** 21

```
src/content-policy.ts:1 src/content-policy.ts:2 src/content-policy.ts:62 src/content-policy.ts:8 src/index.ts:1 src/index.ts:1013 src/index.ts:1074 src/index.ts:1083 src/index.ts:1148 src/index.ts:1235 src/index.ts:1318 src/index.ts:2124 src/index.ts:2196 src/index.ts:2395 src/index.ts:2413 src/index.ts:483 src/index.ts:573 src/index.ts:636 src/index.ts:644 src/index.ts:89 src/index.ts:98 
```

## Cluster F — Audit trail, key confinement, state hardening

**Anchors:** 39

```
src/audit-log.ts:1 src/audit-log.ts:2 src/audit-log.ts:20 src/audit-log.ts:32 src/audit-log.ts:49 src/config.ts:1 src/config.ts:189 src/config.ts:228 src/config.ts:248 src/config.ts:254 src/config.ts:264 src/config.ts:62 src/config.ts:66 src/config.ts:73 src/config.ts:979 src/index.ts:1 src/index.ts:1013 src/index.ts:1074 src/index.ts:1083 src/index.ts:1148 src/index.ts:1235 src/index.ts:1318 src/index.ts:2124 src/index.ts:2196 src/index.ts:2395 src/index.ts:2413 src/index.ts:483 src/index.ts:573 src/index.ts:636 src/index.ts:644 src/index.ts:89 src/index.ts:98 src/key-pool.ts:48 src/key-pool.ts:68 src/lib/atomic-write.ts:1 src/lib/atomic-write.ts:3 src/quota.ts:1 src/quota.ts:34 src/quota.ts:66 
```

## Cluster G — Exceptional-condition hygiene

**Anchors:** 20

```
src/error-envelope.ts:21 src/index.ts:1 src/index.ts:1013 src/index.ts:1074 src/index.ts:1083 src/index.ts:1148 src/index.ts:1235 src/index.ts:1318 src/index.ts:2124 src/index.ts:2196 src/index.ts:2395 src/index.ts:2413 src/index.ts:483 src/index.ts:573 src/index.ts:636 src/index.ts:644 src/index.ts:89 src/index.ts:98 src/lib/sanitize-error.ts:1 src/truncate.ts:1 
```

## Totals and split decision

Distinct anchors: 90 (63 across the twelve non-index/config modules and gate scripts, 17 in `src/index.ts`, 10 in `src/config.ts`), below the 120 threshold.

Probe-dependent clusters: **B and C** — REQ-111 and REQ-111a require the notice to appear on *every successful tool response*, and no test drives a tool handler through `finalizeToolResult`; `src/state-health.test.ts` covers `injectNotices`/collectNotices in isolation. A, D, E, F, G are observed by carrying tests or deterministic gates (A: `config.test.ts:528,573,627`, `config-migrations.test.ts:91,106`; E: three clause tags in `content-policy.test.ts`; F: `kb-encryption-tools.test.ts:171`, `audit-log.test.ts:58`, `quota.test.ts:26`; G: `sanitize-error.test.ts` + Arena).

**split: not triggered** (90 <= 120; 2 probe-dependent clusters < 4). Chunk R8 runs whole.
