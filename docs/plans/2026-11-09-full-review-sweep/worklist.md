# Worklist — full-repository review sweep

Cross-session tracker for `ROADMAP.md` § Full-repository review sweep. One row
per chunk in the status board; one verdict row per in-scope REQ when a chunk
runs. A chunk is closed only when its findings are dispositioned and its exit
evidence is recorded.

Bootstrap: `plan.md` (2026-11-09). Update this file at each chunk close; do not
restart the enumeration from scratch.

## How a chunk closes

1. Surface enumerated with `file:line` anchors.
2. Plan reviewed at standard depth with a fresh-context cold pass, then stamped.
3. Review run with `code-review` (and `drift-report` for a document surface).
4. Every in-scope REQ has a verdict — `holds`, `finding:<ID>`, or
   `deferred:<chunk>` only when the predicate lands wholly in a later chunk —
   and every chunk-owned prose surface has a prose verdict row
   (`| Surface | Verdict | Predicate |`).
5. Every finding has an ID, a `file:line` or `spec:line` predicate, a
   P-severity, and a terminal disposition: fixed · `Scheduled-roadmap` ·
   `Closed-P3` · `Deferred-by-user`.
6. Zero open P0 remains. A P0 that cannot be fixed inside the session stops the
   chunk and lands as `LOOP OPEN` naming it.
7. Exit evidence run un-piped and its exit status recorded.
8. AAR written; roadmap trigger advanced to the next chunk; split commits.

## Decisions (user-approved 2026-11-09)

- **D1 — Fix policy.** P0 fixed in-session (bounded), P1 scheduled on
  `ROADMAP.md`, P2 fixed only on a demonstrated failure, P3 record-and-close.
- **D2 — Chunk map.** R1–R9 plus M1. A chunk that cannot close in one session
  splits by a recorded amendment to this worklist; the coverage invariant must
  still hold.
- **D3 — Findings home.** This file carries the verdict tables and the finding
  register; each chunk's `aar.md` carries the terminal dispositions.
- **D4 — Plan depth.** Standard; deep only for a chunk that touches release,
  credentials, or schema migration.
- **D5 — Coverage.** §1–§3, §4, §5–§10, and Appendices A–E. Whole repo.
- **D11 — Prose ownership split (2026-11-09, R1 cold pass).** §1 goals and the
  §3 invariants are reviewed by the chunk that owns their behavior, not by R1
  as a block. R1 keeps §3 SR-009 (determinism in schemas and error contracts)
  and §6.1–§6.2. The ownership table below is the authority; a prose defect is
  filed once, under its owner.

## Calibration rules (apply before the first verdict)

These come from the Holonovel sweep's recorded mistakes and from Infobroker's
own gate shapes.

1. **Classify citation kind first.** Read the REQ's `_Check:_` before judging a
   missing `@implements`. G3-only REQs are verified by a deterministic gate or
   artifact check, not by a test; 13 of the 142 REQs are in this class. Only a
   G1 REQ with no citation and no exemption is a traceability finding.
2. **A citation is not evidence.** A literal `@implements REQ-NNN` proves the
   REQ was named, not that the test exercises the behavior. Open the test and
   read the assertion.
3. **No family inheritance.** Infobroker cites each REQ individually; there is
   no `spec/audit/req-coverage.md` family register. `REQ-020a` needs its own
   row and its own evidence.
4. **`check-gate-coverage` is existence-only.** It proves *a* citation exists.
   A test that asserts a narrower claim than the REQ is the primary finding
   class this sweep exists to find.
5. **Clause tags.** A REQ with an `or`-joined status branch or a "when …
   declares" conditional needs a named clause tag per branch, per AGENTS.md and
   `src/clause-coverage.ts`; a bare `@implements` does not satisfy it.
6. **Gate assertion vs REQ text.** A green gate that asserts less than the REQ
   states is a finding, not a pass. Read the gate's assertion, not its name.
7. **Artifact-exempt REQs.** `validate-spec` reports 15 artifact-exempt REQs;
   verify the artifact check itself, not a test that does not exist.

## Coverage invariant — exact REQ lists

Counts sum to 142. Each ID belongs to exactly one chunk.

### Prose ownership (§1 goals and §3 invariants)

The §4 REQ partition is below. The mission and invariants are split here so a
prose defect is filed once, under the chunk that owns the behavior.

| Prose unit | Owner |
|---|---|
| §1 preamble and North Star paragraph | R9 |
| §1 goal 1 (free first, privacy) | R2 |
| §1 goal 2 (upgrade path) | R2 |
| §1 goal 3 (provider intelligence) | R3 |
| §1 goal 4 (truth by iteration) | R5 |
| §1 goal 5 (writing pipeline) | R7 |
| §1 goal 6 (knowledge persistence) | R6 |
| §2 failure modes | R8 |
| §3 SR-001 outbound by design | R2 |
| §3 SR-002 single user | R8 |
| §3 SR-003 keys never surfaced | R8 |
| §3 SR-004 zero-config works | R2 |
| §3 SR-005 standalone provider modules | R2 |
| §3 SR-006 config hot-reload | R2 |
| §3 SR-007 quota persists | R8 |
| §3 SR-008 corroboration bounded | R5 |
| §3 SR-009 determinism in schemas/error contracts | R1 |
| §3 SR-010 server-side validation before outbound | R2 |
| §3 SR-011 contracts not implementations | R9 |
| §3 SR-012 red-team every REQ | R9 |
| §6.1 Tool naming | R1 |
| §6.2 Output format | R1 |

### R1 — Contracts and envelope (6)

`REQ-001` `REQ-002` `REQ-003` `REQ-004` `REQ-073` `REQ-079`

Spec: §3 SR-009, §4.1, §6.1–6.2.
Code: `src/index.ts` envelope/dispatch, `ok()`, `instrumentTool`, the
`search_web` suggest/expand return paths, `src/error-envelope.ts`,
`src/output-schema.ts`, `src/structured-output.ts`, `src/truncate.ts`,
`src/verbosity.ts`, `src/normalizer.ts`, `src/types.ts`.

#### R1 verdict table (2026-11-09)

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-001 Status Prefix Contract | `holds` | 7/7 tools declare `outputSchema`; live stdio check on all 7 returned `structuredContent` deep-equal to `parseEnvelopeObject(text)` (`src/structured-output.test.ts:168`; R1 cross-tool run) |
| REQ-002 Error Taxonomy | `holds` | `err()` includes code/message/provider/remediation; `chainExhaustion` prefers `rate_limited`; `access_blocked`/`network_error`/`internal_error` call sites present (`src/error-envelope.ts:11`; `src/error-envelope.test.ts`) |
| REQ-003 Result Format Normalization | `holds` | every search provider calls `normalize()`; scholarly fields additive; generic-http `original_source` declared by `field_map` (`src/providers/generic-http.test.ts:111`) |
| REQ-004 Truncation | `finding:F-R1-2` | KB cache-hit path sets `truncated: true` with no `output_path`, no full file, no in-band note (`src/index.ts:1037`); other paths comply (`src/truncate.ts:16`) |
| REQ-073 Minimum Viable Result | `finding:F-R1-3` | discard works, but invalid rows still consume the requested `max_results` budget (`.slice(0, maxResults)` after `normalize`, `src/index.ts:505`) |
| REQ-079 Output Verbosity | `finding:F-R1-1` | compact applies only through `ok()`; `fetch_page`, `inspect_providers`, `manage_kb`, `reload_config` build envelopes directly |
| §3 SR-009 determinism | `holds` | schemas and error envelopes are deterministic; no wall-clock in the contract surface |
| §6.1 Tool naming | `holds` | seven `infobroker_*` snake_case names; live `tools/list` matches |
| §6.2 Output format | `holds` | live envelopes carry status/provider/results/meta; `[OK]`/`[ERROR]` prefix present |

### R2 — Config, providers, resilience (25)

`REQ-010` `REQ-011` `REQ-013` `REQ-014` `REQ-015` `REQ-129` `REQ-104`
`REQ-030` `REQ-031` `REQ-031a` `REQ-032` `REQ-033` `REQ-034` `REQ-035`
`REQ-036` `REQ-037` `REQ-038` `REQ-040` `REQ-070` `REQ-071` `REQ-095`
`REQ-024` `REQ-024a` `REQ-024b` `REQ-024c`

Spec: §4.2, §4.4, §4.5, §4.6, §5.3, §6.3, §7.1–7.3, App A.
Code: `src/config*`, `src/key-pool.ts`, `src/rate-limiter.ts`, `src/quota.ts`,
`src/retry.ts`, `src/cooldown.ts`, `src/health-status.ts`, `src/providers/`.

### R3 — `search_web` (14)

`REQ-020` `REQ-020a` `REQ-020b` `REQ-020c` `REQ-020d` `REQ-020e` `REQ-020f`
`REQ-020g` `REQ-020h` `REQ-020i` `REQ-124` `REQ-127` `REQ-128` `REQ-028`

Spec: §4.3 (those IDs), §7.4.
Code: `src/chain.ts`, `src/task-type.ts`, `src/intent-citations.ts`,
`src/dedup.ts`, `src/source-quality.ts`, `src/batch.ts`, `src/expand.ts`,
`src/research.ts`, `src/deep-search.ts`, `src/analysis.ts`, `src/rerank.ts`,
`src/language.ts`, plus the `search_web` handler in `src/index.ts`.

### R4 — `fetch_page` (12)

`REQ-021` `REQ-021a` `REQ-021b` `REQ-021c` `REQ-021d` `REQ-021e` `REQ-021f`
`REQ-021g` `REQ-021h` `REQ-021i` `REQ-021j` `REQ-021k`

Spec: §4.3 (those IDs), §6.4.
Code: `src/fetch-fallback.ts`, `src/extract.ts`, `src/providers/jina.ts`,
`src/preservation.ts`, `src/modality.ts`, `src/http.ts`, `src/truncate.ts`,
`src/structured-fact.ts`, plus the `fetch_page` handler in `src/index.ts`.

### R5 — Corroboration and citations (15)

`REQ-026` `REQ-026a` `REQ-026b` `REQ-026c` `REQ-026d` `REQ-026e` `REQ-026f`
`REQ-026g` `REQ-026h` `REQ-121` `REQ-122` `REQ-123` `REQ-130` `REQ-027`
`REQ-027a`

Spec: §4.3 (those IDs), §5.5, §8.
Code: `src/corroborate.ts`, `src/calibration.ts`, `src/source-family.ts`,
`src/structured-fact.ts`, `src/cite.ts`, `src/bibtex.ts`.

### R6 — Knowledge base (29)

`REQ-060` `REQ-060a` `REQ-060b` `REQ-060c` `REQ-060d` `REQ-060e` `REQ-060f`
`REQ-060g` `REQ-060h` `REQ-060i` `REQ-064` `REQ-065` `REQ-066` `REQ-067`
`REQ-072` `REQ-074` `REQ-075` `REQ-076` `REQ-076a` `REQ-082` `REQ-083`
`REQ-084` `REQ-085` `REQ-086` `REQ-087` `REQ-108` `REQ-109` `REQ-110`
`REQ-103`

Spec: §4.9.
Code: `src/kb*.ts`, `src/embed.ts`, `src/retrieval-benchmark.ts`.

### R7 — Client artifacts and reporting (17)

`REQ-050` `REQ-051` `REQ-052` `REQ-053` `REQ-054` `REQ-107` `REQ-088`
`REQ-114` `REQ-115` `REQ-117` `REQ-116` `REQ-125` `REQ-118` `REQ-119`
`REQ-120` `REQ-120a` `REQ-126`

Spec: §4.7, §10.2–10.3, App D.
Code: `skills/`, `instructions/`, `README.md`, `src/report-*.ts`,
`src/monitor-*.ts`, `scripts/validate-readme.ts`.

### R8 — Deployment, state, security (15)

`REQ-042` `REQ-043` `REQ-105` `REQ-111` `REQ-111a` `REQ-112` `REQ-113`
`REQ-091` `REQ-096` `REQ-097` `REQ-098` `REQ-099` `REQ-100` `REQ-101`
`REQ-102`

Spec: §2, §4.10, §4.11, §5.1–5.2, §5.4, §10.1, App E.
Code: `src/config-path.ts`, `src/config-migrations.ts`, `src/update-check.ts`,
`src/state-health.ts`, `src/audit-log.ts`, `src/content-policy.ts`,
`src/kb-hardening.ts`, `scripts/`, `.githooks/`.

### R9 — Spec integrity and tool quality (9)

`REQ-055` `REQ-077` `REQ-078` `REQ-080` `REQ-081` `REQ-089` `REQ-090`
`REQ-092` `REQ-106`

Spec: §3 Terminology, §4.3 (those IDs), §4.8, §9.1–9.5, App B–C.
Code: `src/tdqs.ts`, `src/tool-surface.ts`, `src/intent-citations.ts`,
`scripts/validate-spec.ts`, `scripts/check-*.ts`.

### M1 — Machine evidence

No REQ ownership. Runs the full suite, `check-pack`, debate-club Arena, TDQS,
intent citations, report fixtures, and the fixture-freshness check; records exit
status and any new evidence.

## Status board

| Chunk | Spec | REQs | Status | Next trigger |
|---|---|---|---|---|
| R1 | §3 SR-009, §4.1, §6.1–6.2 | 6 | **closed 2026-11-09** | R2 |
| R2 | §4.2, §4.4–4.6, §5.3, §6.3, §7.1–7.3, App A | 25 | not started | R1 closed |
| R3 | §4.3 (020 family, 124, 127, 128, 028), §7.4 | 14 | not started | R2 closed |
| R4 | §4.3 (021 family), §6.4 | 12 | not started | R3 closed |
| R5 | §4.3 (026 family, 121–123, 130, 027), §5.5, §8 | 15 | not started | R4 closed |
| R6 | §4.9 | 29 | not started | R5 closed |
| R7 | §4.7, §10.2–10.3, App D | 17 | not started | R6 closed |
| R8 | §2, §4.10–4.11, §5.1–5.2, §5.4, §10.1, App E | 15 | not started | R7 closed |
| R9 | §3 terminology, §4.3 (089/090/092/106), §4.8, §9, App B–C | 9 | not started | R8 closed |
| M1 | all | — | not started | R9 closed |

## Finding register

Empty at program start. Each chunk appends its rows here when it closes; the
AAR carries the terminal disposition and the roadmap entry names the scheduled
work.

| ID | Chunk | Predicate | Severity | Disposition |
|---|---|---|---|---|
| F-R1-1 | R1 | Compact verbosity applies only through `ok()`; `fetch_page`, `inspect_providers`, `manage_kb`, `reload_config` bypass it (`src/index.ts:103`, `:1142`–`:1390`, `:1490`–`:1590`, `:2046`–`:2290`) | P1 | `Scheduled-roadmap` |
| F-R1-2 | R1 | KB cache-hit truncation sets `truncated: true` with no `output_path`, full file, or in-band note (`src/index.ts:1037`) | P1 | `Scheduled-roadmap` |
| F-R1-3 | R1 | Invalid normalized results consume the requested `max_results`; `.slice(0, maxResults)` after `normalize` (`src/index.ts:505`) | P1 | `Scheduled-roadmap` |

## Program risks / notes

- R2 and R6 are the heaviest. If either does not close in one session, split by
  a recorded D-amendment and keep the REQ partition exact.
- `ROADMAP.md` carries one sweep section. Add a separate remediation section
  only when a finding needs scheduling; do not pre-list hypothetical work.
- The roadmap trigger advances at each chunk close. If a run stops mid-chunk,
  the trigger stays on that chunk and the AAR lands `LOOP OPEN`.
