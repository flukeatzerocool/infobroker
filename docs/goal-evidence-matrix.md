# Function and audience evidence matrix

Each §1 intelligence-process function has one row: the §D feature group that
carries it, the requirement family that binds it, the gate that proves the
contract, the scenario that exercises it as a user would, and the signal the run
reports. `npm run check-user-surface` fails when a function has no row or a
persona has no scenario, so the matrix cannot silently fall behind the spec.

The five functions are re-entrant, not phases: a corroboration gap re-enters
collection, and a failed fetch re-enters direction. The matrix records where
each function is *evidenced*, not a sequence to be enforced.

## §1 functions

| Function | §D group | Requirement family | Gate | Scenario | Signal |
|---|---|---|---|---|---|
| Direction | 1, 2 | REQ-020a–e, REQ-124, REQ-127, REQ-128 | `check-tdqs`, Arena | Lab L6; S2 (repo, 2026-11-15), N3 (repo, 2026-11-15) | Task type chosen; inferred values disclosed; no key required |
| Collection | 1, 2 | REQ-020h, REQ-031, REQ-031a, REQ-129 | `check-tdqs`, Arena | Lab L5, L7; S3 (repo, 2026-11-15, predecessor record) | Cold-start tool success; fallback advances on provider failure |
| Processing and exploitation | 11 | REQ-003, REQ-004, REQ-021c, REQ-038, REQ-121, REQ-122, REQ-133, REQ-136 | Arena, `validate-spec` | Lab L6; S2 (repo, 2026-11-15) | Normalized result; source identity and date preserved |
| Analysis and production | 3 | REQ-026a–i, REQ-115, REQ-123 | Arena, `check-gate-coverage` | Lab L1, L8; S2 (repo, 2026-11-15), N3 (repo, 2026-11-15) | Verdict and confidence; contradiction reported |
| Dissemination | 7 | REQ-114–REQ-120a, REQ-126, REQ-110 | `check-report-fixtures`, G3 | Lab L9; S9 (repo, 2026-11-15), A1a/A1b (repo, 2026-11-15, predecessor record) | Manifest, grade and receipt; audience-shaped answer |

The loop closes through the knowledge base: a disseminated product is stored
with its claims and source hashes and recalled at the next direction step
(REQ-076, REQ-117, REQ-125). Groups 4 (Knowledge Base), 6 (Tool Surface), 8 (Spec
Governance), 9 (Security) and 11 (Processing & Provenance) are cross-cutting: Arena, `validate-spec` and the
security suite carry them. They are exempt from the persona requirement by
`check-user-surface`.

## Parity: surface, evidence, measurement

The five functions are not equally productised, and this table says so rather
than implying parity. "Surface" is what a caller can invoke; "evidence" is what
a gate proves; "measurement" is what can regress and be caught.

| Function | Runtime surface | Gate evidence | Measurement |
|---|---|---|---|
| Direction | `search_web` direction block, incl. the deferred choice | `check-tdqs`, Arena, `test-fixtures/direction` | REQ-135: offer rate, false-offer rate, slot recall |
| Collection | `search_web`, `fetch_page`, `get_citations`, `inspect_providers` | Arena, `check-tdqs` | REQ-130: precision/recall/MRR/nDCG over 26 cases; REQ-076b: KB-first admission — 4.8% of admitted snippet-scale chunks are cross-topic, 0% at page scale, and no case is made sufficient by unrelated content (26 cases) |
| Processing and exploitation | `meta.processing` on search and fetch (no tool of its own) | Arena, `check-gate-coverage` | REQ-136/REQ-020j: dedup recall/precision and collapse-total accuracy over 8 cases |
| Analysis and production | `verify_claims`, `search_web (analyze)` | Arena, `check-gate-coverage` | REQ-123: Brier score and reliability curve over the documented gold set |
| Dissemination | `manage_kb` ingest with a required receipt and grade; the report itself is client-authored | `check-report-fixtures`, `check-gate-coverage` | REQ-134: structural grade and offline grounding score |

Processing and Dissemination have no dedicated tool; that is a design decision
(an eighth tool was rejected), not an omission. The measurement column is the
honest part: Processing's benchmark measures 1.000 dedup recall over 8 cases now
that snippet-based collapse is guarded, while the reconciler still admits one
residual class — long shared boilerplate with no identifying values on either
side — and the full-text branch keeps its pre-existing precision bound. The
Analysis Brier score measures whether
the confidence ladder is ordered against documented truth; it does not measure
truth the server discovered, which would need an `observed` label.

## README Quick Start audit

The README is the product; this table records whether a new user can do what
it promises without reading the spec. Findings are fixed in the same increment
or filed on `ROADMAP.md`.

| Claim | Where | Evidence | Status |
|---|---|---|---|
| Start the server with no configuration | Quick Start | `check-pack` handshake from an empty directory | verified by gate |
| Search, extract, verify, cite, and manage a KB | §3 feature tour | `npm run test-debate-club` (Arena) | verified by gate |
| Zero-config providers are free and private | Hero, §4 | Lab L7 under the `fresh` profile | evidence pending |
| Optional keys raise throughput | §4 providers | Lab L6 under `solo-override` | evidence pending |
| Bundled skills route research requests | §3.5 | `npm run test-research` (repo mode) | evidence pending |

## New-REQ user-impact checklist

Before a new REQ is admitted, answer these four questions in the commit body
or the increment record. The checklist is a review gate, not a new REQ.

1. **Function.** Which §1 function does this serve — direction, collection,
   processing, analysis, or dissemination? If none, the change is out of scope.
2. **Audience.** Which §D group, audience value, and persona consume it? If
   none, it is maintainer-only and must say so.
3. **Default.** What happens on shipped defaults with no keys, no KB, and no
   user layer? If the answer is "an error", the remediation must be named.
4. **Error and notice text.** What does the user read when it fails or
   degrades? It must name the file, key, or knob to change.

## Evidence runs

| Run | Command | Scope | Gating |
|---|---|---|---|
| Arena | `npm run test-debate-club` | all seven tools, negative paths | yes |
| Lab | `./run.sh lab --only=L5,L6,L7,L8` | four personas across four profiles | advisory |
| Research pair | `npm run test-research -- --only=A1a,A1b,S3,N1 --mcp=repo` | audience pair + negative cases | advisory |
| Research matrix | `npm run test-research -- --mcp=repo` (batches: S1–S7, S8–M2, N2–N4) | 13 scenarios across every workflow shape; per-scenario rows in `docs/research-evidence-2026-11-15.md` | advisory |
