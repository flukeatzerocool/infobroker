# Phase 1 enumeration — chunk R6 (knowledge base)

Date: 2026-11-09. Method: `grep -n 'REQ-'` over the R6 module set plus the
`manage_kb` handler/auto-index regions of `src/index.ts`, de-duplicated by
unique `file:line` (a range counts once). Cluster assignments follow
`plan.md` § Review surface.

## Anchor counts (D50)

| Source | Distinct anchors |
|---|---|
| `src/kb.ts` | 24 |
| `src/kb-sqlite.ts` | 17 |
| `src/kb-store.ts` | 10 |
| `src/kb-receipt.ts` | 10 |
| `src/embed.ts` | 4 |
| `src/kb-prefilter.ts` | 1 |
| `src/kb-migrate.ts` | 1 |
| `src/kb-crypto.ts` | 1 |
| `src/kb-row-crypto.ts` | 1 |
| `src/index.ts` (KB REQ comments, handler, auto-index hooks) | 17 |
| **Total** | **86** |

86 ≤ 120 → the anchor leg of the split rule is **not triggered**.

## Probe dependence (D50)

| Cluster | Probe-dependent? | Reason |
|---|---|---|
| A — tool surface/actions | no | The nine-action schema and every action's envelope are exercised by `kb.test.ts`, `kb-sqlite.test.ts`, `kb-claims.test.ts`, `kb-report-receipt.test.ts`, and `tool-surface.test.ts`. |
| B — ingestion/scoping/expiry/config/dedup/dates/reports | **yes** | `REQ-064`'s non-blocking, non-surfacing auto-index clause has no observing test (`deep-search.test.ts:103` asserts the call, not latency or error suppression); `REQ-066` startup/interval removal is asserted at the module level only. |
| C — retrieval/freshness/sufficiency/blend/consistency/embedding | **yes** | `REQ-076`'s cross-tool replacement of external search at both thresholds is unobserved (`kb.test.ts:222` asserts only that the score fields are independent); blend/skip/not-applicable legs are module-level (`batch.test.ts:341-400`). |
| D — encryption/preservation/transitions | no | Five carrying test files cover key refusal, locked-store reachability, atomic transition, rekey, and never-modify, including a process-boundary migration test. |
| E — capacity/corruption/migration | **yes** | No test opens a store whose chunk data exceeds the process heap; `kb-hardening.test.ts` covers corrupt-metadata reconstruction and migration refusal only. |
| F — ledger/receipts | no | `kb-claims.test.ts` and `kb-report-receipt.test.ts` (662 L) exercise persistence, sealing, bounds, drift, and unverifiable states. |
| G — prose | no | `drift-report` over §1 goal 6. |

Three probe-dependent clusters (B, C, E) < 4 → the probe leg is **not
triggered**. **Split decision: `not triggered`.**

## REQ / check / citation map (D52)

| REQ | Check | Carrying test(s) | Named branch tags |
|---|---|---|---|
| REQ-060 | G0, G1 | handler header + `tool-surface.test.ts` | — |
| REQ-060a | G0, G1 | `kb.test.ts`, `kb-sqlite.test.ts`, `kb-prefilter.test.ts` | `prefilter-soundness` |
| REQ-060b | G0, G1 | `kb.test.ts`, `kb-sqlite.test.ts`, `kb-report-receipt.test.ts` | `report-sources` |
| REQ-060c | G1 | `kb-sqlite.test.ts`, `kb-hardening.test.ts` | — |
| REQ-060d | G0, G1 | `kb.test.ts`, `kb-sqlite.test.ts` | — |
| REQ-060e | G1 | `kb.test.ts`, `kb-sqlite.test.ts` | — |
| REQ-060f | G1 | `kb.test.ts`, `kb-sqlite.test.ts` | — |
| REQ-060g | G0, G1 | `kb-encryption-tools.test.ts` | — |
| REQ-060h | G0, G1 | `kb-claims.test.ts` | — |
| REQ-060i | G0, G1 | `kb-report-receipt.test.ts` | `caller-digest`, `offline` |
| REQ-064 | G1 | `deep-search.test.ts` | — |
| REQ-065 | G1 | `kb.test.ts` | `collection-recall` |
| REQ-066 | G1 | `kb-hardening.test.ts` | — |
| REQ-067 | G1 | `config.test.ts`, `kb-hardening.test.ts` | — |
| REQ-072 | G1 | `kb.test.ts`, `kb-sqlite.test.ts` | — |
| REQ-074 | G1 | `kb.test.ts` | — |
| REQ-075 | G1 | `kb.test.ts` | — |
| REQ-076 | G1 | `kb.test.ts` | — |
| REQ-076a | G1 | `batch.test.ts` | `blend` (×3) |
| REQ-082 | G1 | `kb.test.ts`, `kb-model.test.ts` | — |
| REQ-083 | G1 | `kb.test.ts` | — |
| REQ-084 | G1 | 5 files | — |
| REQ-085 | G1 | 6 files | — |
| REQ-086 | G1 | `kb-sqlite.test.ts`, `kb-encryption-tools.test.ts` | — |
| REQ-087 | G1 | `kb.test.ts`, `kb-sqlite.test.ts` | — |
| REQ-103 | G1 | `embed.test.ts`, `kb-model.test.ts` | — |
| REQ-108 | G1 | 6 files | `corrupt-metadata`, `unreadable-store` |
| REQ-109 | G1 | `kb-claims.test.ts`, `corroborate.test.ts` | — |
| REQ-110 | G1 | `kb-report-receipt.test.ts` | `report-sources` |

Clause-bearing REQs with no per-branch tag: `060b`, `060g`, `060i` (partial),
`064`, `065`, `066`, `067`, `072`, `074`, `076`, `082`, `084`, `085`, `086`,
`087`, `103`, `108` (partial), `110`, `074` — flagged for cluster review, not
predetermined as findings (calibration rules 4–5).

## G0 surface

`manage_kb` advertises nine actions — `search`, `ingest`, `list`, `get`,
`stats`, `delete`, `encryption`, `claims`, `verify_report` — with
`max_results` bounded 1–50 and default 8, `save_to` default `kb`, `format`
default `markdown`, and the encryption `operation` enum
(`status`, `generate_key`, `verify`, `backup`, `rekey`). Live capture path:
`src/tool-surface.test.ts:94` and `debate-club/src/mcp-contract.test.ts:91`.

## Tracker drift

- R6 `Code:` line omits the `manage_kb` handler, the auto-index call sites,
  and the `config.json` `kb` block.
- R6 coverage row omits §1 goal 6.
- R8 code line names nonexistent `src/kb-hardening.ts`.
- Status board merges the R6 and R7 rows (`worklist.md:379`).
