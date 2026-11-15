# Goal and audience evidence matrix

Each §1 design goal has one row: the §D feature group that carries it, the
requirement family that binds it, the gate that proves the contract, the
scenario that exercises it as a user would, and the signal the run reports.
`npm run check-user-surface` fails when a goal has no row or a persona has no
scenario, so the matrix cannot silently fall behind the spec.

## §1 goals

| Goal | §D group | Requirement family | Gate | Scenario | Signal |
|---|---|---|---|---|---|
| Free first, privacy always | 1, 2 | REQ-020, REQ-024, REQ-129 | `check-tdqs`, Arena | Lab L7 (fresh scholar), S3 | Cold-start tool success; no key required |
| Upgrade path | 2, 5 | REQ-010, REQ-104, REQ-071 | Arena, `validate-spec` | Lab L6 (ops), S2 | Keyed provider status; reload without restart |
| Provider intelligence | 2 | REQ-013, REQ-034, REQ-111a | Arena, `check-tdqs` | Lab L6, S10 | Status/degraded/exhausted; bounded notice |
| Truth by iteration | 3 | REQ-026a–i, REQ-121–123 | Arena, `check-gate-coverage` | Lab L1, L8; S2, N3 | Verdict + confidence; contradiction reported |
| Writing pipeline | 7 | REQ-050–054, REQ-114–120 | `check-skill-harness`, G3 | Lab L9; S9, A1a/A1b | Completion token; audience-shaped answer |
| Knowledge persistence | 4 | REQ-060a–i, REQ-076, REQ-108 | Arena, `check-gate-coverage` | Lab L4, L7; S3 | Ingest→recall; tier decay; report receipt |

Groups 6 (tool surface and contracts), 8 (spec governance), and 9 (security)
are cross-cutting: Arena, `validate-spec`, and the security suite carry them.
They are exempt from the persona requirement by `check-user-surface`.

## README Quick Start audit

The README is the product; this table records whether a new user can do what
it promises without reading the spec. Findings are fixed in the same increment
or filed on `ROADMAP.md`.

| Claim | Where | Evidence | Status |
|---|---|---|---|
| Start the server with no configuration | Quick Start | `check-pack` handshake from an empty directory | verified by gate |
| Search, extract, verify, cite, and manage a KB | §3 feature tour | `npm run test-debate-club` (Arena) | verified by gate |
| Zero-config providers are free and private | Hero, §4 | Arena cold-start; Lab L7 under the `fresh` profile | verified |
| Optional keys raise throughput | §4 providers | Lab L6 under `solo-override` | evidence pending |
| Bundled skills route research requests | §3.5 | Lab L9 (repo mode, `research complete.`); repo-mode research pair pending | verified by L9 |

## New-REQ user-impact checklist

Before a new REQ is admitted, answer these four questions in the commit body
or the increment record. The checklist is a review gate, not a new REQ.

1. **Goal.** Which §1 goal does this serve? If none, the change is out of scope.
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
