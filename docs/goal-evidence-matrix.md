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
| Direction | 1, 2 | REQ-020a–e, REQ-124, REQ-127, REQ-128 | `check-tdqs`, Arena | Lab L6; S2, N3 | Task type chosen; inferred values disclosed; no key required |
| Collection | 1, 2 | REQ-020h, REQ-031, REQ-031a, REQ-129 | `check-tdqs`, Arena | Lab L5, L7; S3 | Cold-start tool success; fallback advances on provider failure |
| Processing and exploitation | 1, 5 | REQ-003, REQ-004, REQ-021c, REQ-038, REQ-121, REQ-122 | Arena, `validate-spec` | Lab L6; S2 | Normalized result; source identity and date preserved |
| Analysis and production | 3 | REQ-026a–i, REQ-115, REQ-123 | Arena, `check-gate-coverage` | Lab L1, L8; S2, N3 | Verdict and confidence; contradiction reported |
| Dissemination | 7 | REQ-114–REQ-120a, REQ-126, REQ-110 | `check-report-fixtures`, G3 | Lab L9; S9, A1a/A1b | Manifest, grade and receipt; audience-shaped answer |

The loop closes through the knowledge base: a disseminated product is stored
with its claims and source hashes and recalled at the next direction step
(REQ-076, REQ-117, REQ-125). Groups 4 (Knowledge Base), 6 (Tool Surface), 8 (Spec
Governance) and 9 (Security) are cross-cutting: Arena, `validate-spec` and the
security suite carry them. They are exempt from the persona requirement by
`check-user-surface`.

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
2. **Audience.** Which §D group and persona consume it? If none, it is
   maintainer-only and must say so.
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
