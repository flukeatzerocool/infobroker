# AGENTS.md — Infobroker MCP Server (v2026.11.16)

## Layer Map

```
src/types.ts  →  src/config.ts  →  src/rate-limiter.ts  →  src/quota.ts  →  src/normalizer.ts  →  src/providers/ (→ src/corroborate.ts)  →  src/index.ts

Knowledge base: src/kb.ts (tool logic) → src/kb-store.ts (seam + artifact predicates) → src/kb-sqlite.ts (only backend) → src/kb-prefilter.ts (in-memory lexical prefilter); src/kb-migrate.ts (one-way legacy JSON migration), src/kb-row-crypto.ts, src/kb-crypto.ts.
```

## Tool Surface (7 tools)

| Tool | Purpose |
|------|---------|
| `infobroker_search_web` | Unified search across providers with fallback chain, task-type auto-selection, and suggestion mode |
| `infobroker_fetch_page` | Fetch URL content through the renderer chain (Jina Reader primary) or native HTTP |
| `infobroker_verify_claims` | Multi-pass truth-finding with cross-source verification |
| `infobroker_get_citations` | Academic references as BibTeX citations |
| `infobroker_inspect_providers` | Provider operational state: list, health, or spec actions |
| `infobroker_manage_kb` | Knowledge base: search, ingest, stats, or delete actions |
| `infobroker_reload_config` | Hot-reload config.json without restart |

## Provider Backends

| Provider | File | Tier |
|----------|------|------|
| DuckDuckGo | `src/providers/duckduckgo.ts` | builtin |
| Jina Reader | `src/providers/jina.ts` | free_http |
| Wikipedia | `src/providers/wikipedia.ts` | free_http |
| Wiktionary | `src/providers/wiktionary.ts` | free_http |
| Wikidata | `src/providers/wikidata.ts` | free_http |
| OpenStreetMap | `src/providers/openstreetmap.ts` | free_http |
| Internet Archive | `src/providers/internet_archive.ts` | free_http |
| arXiv | `src/providers/arxiv.ts` | free_http |
| Semantic Scholar | `src/providers/semantic_scholar.ts` | free_http |
| Stack Exchange | `src/providers/stack_exchange.ts` | free_http |
| GitHub | `src/providers/github.ts` | free_http |
| CORE | `src/providers/core.ts` | free_http |
| OpenAlex | `src/providers/openalex.ts` | free_http |
| Europe PMC | `src/providers/europe_pmc.ts` | free_http |
| Crossref | `src/providers/crossref.ts` | free_http |
| Hacker News | `src/providers/hacker_news.ts` | free_http |
| GDELT | `src/providers/gdelt.ts` | free_http |
| SEC EDGAR | `src/providers/sec_edgar.ts` | free_http |
| World Bank | `src/providers/world_bank.ts` | free_http |
| Marginalia | `src/providers/marginalia.ts` | builtin |
| Mojeek | `src/providers/mojeek.ts` | builtin |
| Wiby | `src/providers/wiby.ts` | builtin |
| Exa | `src/providers/exa.ts` | keyed_http |
| Tavily | `src/providers/tavily.ts` | keyed_http |
| Yep | `src/providers/yep.ts` | keyed_http |
| SearXNG | `src/providers/searxng.ts` | self_hosted_http |

Provider auth requirements are generated from `config.json` into
`skills/infobroker/references/provider-auth.md` (`npm run generate-auth`).

## Running

```
npm run start       # start server via tsx
npm run typecheck   # tsc --noEmit
```

## Push Pipeline

`npm run prep` runs the AI steps (read-through, server sync, changelog, scan,
README) and leaves the tree dirty for review; `npm run release` is
deterministic (gates, one commit, tag, atomic push) and needs a clean tree
whose version and CHANGELOG already agree. The pipeline commits once by
default; `--split-commits` opts into the convention series. See
`docs/push-pipeline.md` for shard rotation, bounded repair loops, resume and
range modes, and publication rules.

## Agent Operating Routine

The maintainer's habits are fixed; the agent absorbs the routine so the
commands stay the same. These mappings are the standing agreement.

- **"commit"** — one commit per increment. Stage the whole increment
  (behavior, tests, spec, and records) and commit it with a conventional
  subject and a body carrying the why and the increment slug. Run `npm run
  typecheck` before the commit and the full `npm run check` once on the final
  tree. Split into more than one commit only when the change exceeds ~300
  lines or touches release, credentials, or a schema migration; then report the
  split and its order. Stop and report rather than commit a failing tree.
- **"push" / "commit and push" / "ship"** — run `npm run prep` first (the AI
  steps), review the diff and commit it once, then `npm run release`
  (deterministic; no AI steps, no `opencode`). A bare "push" is explicit
  authorization to publish. If `prep` leaves no diff, skip straight to
  `release`. The pipeline commits once by default; `--split-commits` is the
  exception for a change that needs a bisectable series.
- **"plan" / "build"** — start with `npm run status` and `npm run check` and
  report the baseline before planning or editing. A red baseline is fixed
  first, as its own commit, never folded into the feature work.
- **"status" / "what's left"** — `npm run status`, plus `npm run metrics` when
  the question is about cadence rather than content.
- **"weekly"** — `npm run check` once, then `npm run weekly`. Act on the
  gate-cost candidates only through
  `npm run gate-cost -- --retire <gate> --note "why"`; the ledger is committed
  and the weekly run never mutates it.
- **Split limits** — one commit per increment is the default for "commit",
  "push", and `scripts/push-pipeline.sh` (`--split-commits` is the opt-in;
  `--single-commit` remains a deprecated alias). Split only when one commit
  would exceed roughly 300 changed lines or touches release, credentials, or a
  schema migration; then split by concern, keep each commit under that bound,
  and print the planned grouping before executing.

## Script Discipline

All scripts in `scripts/` — the spec tooling, shell entry points
(`scripts/*.sh`, `scripts/pipeline/*.sh`, `.githooks/*`), and CI workflow
steps — follow one discipline. These rules apply to new scripts and to
modifications of existing scripts.

**Roles.** Every script declares one role in its header: **gate** (exits
non-zero on failure; wired into a package.json script), **build tool**
(mutates tracked artifacts deterministically), **entry point** (implements
a spec contract and cites the REQ), or **informational** (reports findings,
exits 0).

**Mechanically enforced** (`npm run check-script-discipline`, part of
`npm run check`):

- Every top-level script starts with `#!/usr/bin/env npx tsx` (TS) and a
  header comment naming the script's role, purpose, and exit-code contract.
  `scripts/lib/` modules are exempt from the shebang but still carry a
  header comment.
- Exit codes: 0 = pass, 1 = gate/check failure or build error, 2 = fatal
  unexpected error. No other exit codes.
- Path resolution: use `import.meta.dirname` to derive repo-root paths;
  no `fileURLToPath(import.meta.url)` boilerplate.
- No invocation of a CLI flag a tool release removed. The check scans shell
  entry points (`scripts/**/*.sh`, `debate-club/scripts/*.sh`, `.githooks/*`)
  and `scripts/**/*.mjs` for `opencode run --attach`, which opencode v2
  replaced with `--server`.
- Empty `catch {}` blocks carry a comment explaining why the error is
  safely ignored.

**Conventions (documented, not mechanically checked):**

- stdout carries the result payload; stderr carries diagnostics, warnings,
  and progress. Machine-readable output goes to stdout.
- Flag-taking scripts implement `--help`/`-h` (usage to stdout, exit 0)
  and reject unknown flags. Scripts with more than one flag parse through
  `scripts/lib/args.ts`.
- Deterministic by default: no wall-clock-dependent output, no network, no
  hidden state. Mutating scripts offer `--dry-run`.
- A script implementing a spec contract cites the REQ ID in its header; a
  behavioral change to a gate requires a CHANGELOG entry and a re-run of
  the gates it feeds.
- Shell discipline: `set -euo pipefail`, a case-based flag parser, `--help`,
  color only on a TTY. Shell scripts are gate-checked with `bash -n`
  (`scripts/**/*.sh`, `debate-club/scripts/*.sh`, `.githooks/*`) and for
  removed CLI flags.

## State Model

- **Config**: `config.json` (shipped default) — provider config, dispatch tables, limits, hot-reloadable. The shipped default resolves relative to the installed package when `INFOBROKER_CONFIG` is unset. A user layer at `$XDG_CONFIG_HOME/infobroker/config.local.json` (or an existing sibling `config.local.json`, or `INFOBROKER_CONFIG_LOCAL`) is merged over the shipped default; user values take precedence and survive updates (REQ-010, REQ-042, REQ-043). `config.local.json` is git-ignored.
- **KB**: the repository ships an **empty** knowledge base. The vector store
  lives at the user-scoped `storage_path` (`~/.local/share/infobroker/knowledge-base`
  by default), outside the repo tree, and is never committed. Personal KB
  content belongs only to the deploying instance's local store. The
  `scripts/check-shipped-kb-empty.ts` gate (part of `npm run check`) fails if
  any KB artifact or an in-repo `storage_path` is present.
- **Quota**: `$TMPDIR/infobroker/quota.json` — daily/monthly counters, persists across restarts.
- **Truncation**: `$TMPDIR/infobroker/trunc-*.txt` — full content of truncated responses.
- **State notices**: `inspect_providers action=spec` reports `state_health`; successful tool responses carry a bounded top-level `notices` array only when config drift, pending migrations, backend-limited features, an available update, or a provider cooldown needs attention; cooldown notices are informational and follow the action-required ones. An invalid user layer starts on shipped defaults without rewriting it (REQ-111, REQ-111a, REQ-113).
- **Update check**: `$TMPDIR/infobroker/update-check.json` — opt-in, cached npm version comparison. No update is downloaded or applied (REQ-112).

## Response Contract

All tool responses use `[OK]` / `[ERROR]` prefix with JSON bodies per REQ-001. Errors include `code`, `message`, `provider`, and `remediation` fields (REQ-002).

## README Governance

The README is a single file driven by three cooperating pieces that keep it
in sync with the project:

- **Style guide**: the `README DESIGN` HTML comment at the top of `README.md`.
  It is the canonical, AI-actionable style guide — readme-driven development,
  voice, structure, word budget, non-goals, and a 10-item binary style
  checklist. Edit the style guide here, not in prose elsewhere.
- **Validator**: `scripts/validate-readme.ts` (`npm run validate-readme`).
  It derives the tool surface and provider registry from `src/index.ts` and
  `config.json` at validate time (single source of truth — never hardcoded),
  then checks structure, voice, links, comparison table, and that every tool
  and provider is referenced. It also reconciles the README's §MCP Server
  feature tour against the §D feature taxonomy in `infobroker.md` (see
  `src/lib/feature-taxonomy.ts`): every feature subsection must map to a real
  §D group and every user-facing §D group (1–5, 7) must be covered. Do not
  hardcode tool/provider names in the validator.
- **Updater**: `scripts/pipeline/prompts/readme.md` — the push-pipeline step
  that auto-refreshes the README. It runs a two-phase Generate → Verify loop
  in a single prompt: phase 1 updates the README against the spec and
  config, phase 2 re-checks every claim against its source and emits a
  `VERIFY ... N high-severity finding(s).` summary. The mechanical
  `validate-readme` gate runs afterward.

When a change to tools, providers, or the spec changes what the README
claims, update the README in the same commit. A README that promises
something the server does not deliver is a defect. The push pipeline enforces
this: after the README step, if a REQ body changed this run but `README.md`
has no non-whitespace diff, the pipeline fails (spec→README binding).

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `INFOBROKER_CONFIG` | Path to config.json (default: package-relative `config.json`) |
| `INFOBROKER_<PROVIDER>_API_KEY` | API key for keyed providers |
| `INFOBROKER_<PROVIDER>_URL` | URL for self-hosted providers (SearXNG) or an alternate renderer endpoint (`INFOBROKER_JINA_URL`) |
| `INFOBROKER_PLANS_DIR` | Increment record store (default: `.opencode/plans`, git-ignored); a relative value resolves against the repository root |

## Spec Authoring

Before adding or modifying any REQ in `infobroker.md`, apply the standing
rule tests in SR-011 (contracts, not implementations) and SR-012
(red-team every REQ). See Appendices B and C for full authoring conventions
and SDD discipline. Appendix B defines the mechanical limits on a REQ body
(≤800 characters, ≤8 sentences, ≤8 SHALL clauses, one paragraph, ≤5 backtick
tokens outside the tool-signature exception) and an authoring checklist.

At minimum, every new REQ must pass:
- (a) states *what*, not *how* — no parameter types, default values, or
  algorithms in REQ prose
- (b) verifiable by a gate (G0/G1/G2/G3)
- (c) not duplicating content elsewhere in the spec
- (d) no "Default:" clause
- (e) valid across multiple implementation choices

When implementation behavior changes, update the corresponding REQ in
the same commit. `npm run validate-spec` must pass before committing.

A REQ whose body defines a status/outcome with "or"-joined branches (e.g.
`degraded (latency above a threshold or partial results)`) or a "when …
declares" conditional (e.g. "return `original_source` when the provider
declares the result aggregated or resold") must carry a named clause tag per
branch in a test file:

```
// @implements REQ-013 latency-threshold
// @implements REQ-013 provider-degraded
```

The G3 gate fails when such a REQ has fewer clause tags than branches — the
guard that would have caught an unimplemented/dead branch instead of letting a
bare `@implements REQ-NNN` satisfy the whole REQ. Add the tags in the same
commit as the REQ change. See `src/clause-coverage.ts` for the detector.

## Skill Authoring

Bundled skills (`skills/*/SKILL.md`) are client artifacts, verified by the
G3 content checks for REQ-050/051/052/053. When authoring a skill that
declares a grep-able completion token, the token must be stated as an
*imperative* "always emit" instruction inside the workflow/pipeline steps
— e.g. "End your reply with the token, verbatim, as the final line" — not
as a declarative note in a reference file. Declarative tokens (a `Token:`
line in `references/workflows.md` with no emit-instruction in the
orchestrator) do not surface in natural use: the agent does the work but
never writes the token, so downstream gates cannot observe the outcome.
`skills/infobroker/SKILL.md` and `skills/analysis-loop/SKILL.md` are the
reference examples of the imperative form.

## Gates

One manifest, `scripts/lib/gate-manifest.ts`, defines the gate suite. Two
commands run it:

```
npm run check        # every gate, sequential, stops at the first failure
npm run check:fast   # no network, no build artifact; up to four in flight
```

`npm run check` is the pre-push and CI gate. `npm run check:fast` is the
session-loop gate: it excludes only the gates that cannot run from a bare
checkout — `audit` (registry access), `check-pack` (packed-tarball handshake),
and `test-debate-club` (TypeScript build plus Arena). Both write per-gate
timings to `$TMPDIR/infobroker/` (local, keyed by repository, never committed).
The table below
is generated from the manifest by `npm run gates -- --list --format md` and
compared byte for byte by `npm run check-gate-table`; edit the manifest, not
the table.

<!-- gates:begin -->
| Gate | What it checks |
|---|---|
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run version-sync` | Every version reference matches `package.json` |
| `npm run validate-spec` | Spec-code traceability, REQ body hygiene, bidirectional coverage |
| `npm run validate-readme` | README structure, tool/provider reconciliation, links, comparison table |
| `npm run check-roadmap` | Roadmap admission rule: one section per item, 1–3 bullets, a `**Trigger:**` line |
| `npm run check-non-goals` | Scope non-goals: list integrity in `DECISIONS.md` and a pointer from `ROADMAP.md` |
| `npm run check-report-fixtures` | Report contract fixtures: skeleton, manifest, citations, Source Register (REQ-116) |
| `npm run check-script-discipline` | Script discipline: shebang + header, exit-code contract, import.meta.dirname, no empty catch; `bash -n` syntax and removed-flag (`--attach`) checks over shell entry points and `scripts/**/*.mjs` |
| `npm run check-tdqs` | Deterministic TDQS 1.2 structural conformance over the live tool surface (REQ-106) |
| `npm run check-intent-citations` | Routing citations resolve against the live tool schema; every registered tool and declared operation is cited (REQ-107) |
| `npm run check-user-surface` | Persona↔§D group and persona↔scenario coverage, defaults register↔config agreement, §1 goal↔evidence matrix (REQ-055, REQ-078) |
| `npm run check-harness-expectations` | Harness `tool_audit` keys are registered with their encoded behavior and recognized by their evaluators |
| `npm run check-gate-coverage` | Every G1 REQ is backed by a test citation or a recorded exemption (REQ-055) |
| `npm run check-skill-harness` | Skill-check and event-stream evaluators: advisory exclusion, gating, intermediate-message tokens |
| `npm run test` | Vitest unit and integration tests |
| `npm run test-push-pipeline` | Hermetic push-pipeline harness: staging, commit, tag policy, atomic push, resume, and dry-run against a disposable bare remote |
| `npm run check-pack` | Published tarball allowlist/denylist and an MCP handshake from an empty config-less directory |
| `npm run test-debate-club` | debate-club Arena: deterministic, offline tool-contract suite (typecheck + fixture replay) |
| `npm run audit` | Dependency vulnerability gate — fails on high/critical `npm audit` findings (REQ-101); requires registry access |
| `npm run check-shipped-kb-empty` | Repo ships an empty KB — storage_path outside the tree, no KB artifacts |
| `npm run check-gate-table` | The AGENTS.md gates table matches this manifest |
| `npm run check-loop-artifacts` | Increment artifacts under `.opencode/plans/` carry plan, tasks, and a terminal LOOP token |
| `npm run typecheck:scripts` | TypeScript type checking for `scripts/` (`tsc -p tsconfig.scripts.json`) |
<!-- gates:end -->

A gate recorded as advisory in `scripts/gate-ledger.json` still runs and is
timed, but its failure does not fail `check`; restore it with
`npm run gate-cost -- --restore <gate>`.

Test and gate temp roots live under `$TMPDIR` and are removed by the harness: a
per-run root removed in vitest teardown, a per-file hook, and a process-exit
handler for gate scripts. `npm run clean:tmp -- --dry-run --all` lists what a
killed run left behind; `npm run clean:tmp -- --all` reaps it (60-minute age
bound by default), and the gate runner warns on stderr above 80% inodes
without failing the run.

All must pass. `npm run validate-spec` exits non-zero on errors (uncited
REQs with no waiver in the `## Spec Waivers` section of DECISIONS.md,
undocumented source files, Appendix B mechanical-limit violations, REQ
manifest mismatches, stale generated auth reference). A REQ listed in
`## Spec Waivers` is accepted as intentionally unimplemented and reported as
waived; remove its line when it is implemented and cited.

Shell scripts (`scripts/*.sh`, `scripts/pipeline/*.sh`, `.githooks/*`) are
gate-checked with `bash -n`. Running `shellcheck` on them before committing
is recommended but not required — it is not installed as a devDependency and
is not part of `npm run check`.

## Debate Club (evaluation harness)

`debate-club/` evaluates whether the MCP does what the spec says. It drives
the real server over stdio with every outbound request served from committed
fixtures, in two planes: a deterministic **Arena** (offline contract checks
across all seven tools, including negative paths) and an agentic **Lab**
(persona runs through headless `opencode` against a repo-scoped MCP, advisory
only). The Arena runs in
`npm run check` via `npm run test-debate-club`; the Lab and the live `record`
lane do not (they require network/`opencode`). A Lab run's critic pass is
evidence-aware and its result carries an explicit `critic_status` plus parsed
verdict and tool coverage; the run is copied to a durable directory outside the
repo and exits non-zero when feedback is incomplete. Run artifacts land in the
git-ignored `debate-club/.runs/`. See `debate-club/README.md`.

## Review-Loop Governance

The improvement loop terminates; it does not spiral. A completed plan is
clean when its AAR returns `LOOP PAUSED` with zero new action items.

- **Completion bar.** Every plan states its own done-bar — what must pass
  and what must close for *this* plan to be done. Bars are
  session-achievable. "Execute all <unbounded backlog>" is not a bar.
- **Triggers.** Run the AAR when a session hits a gate failure, an unexpected
  diff, a finding that repeats an earlier one, or an unpushed backlog older
  than 24 hours — not after every edit. A trigger that has not fired needs no
  review.
- **Increment record.** The durable record is a local, git-ignored directory,
  `.opencode/plans/<YYYY-MM-DD>-<slug>/` (override with
  `INFOBROKER_PLANS_DIR`), carrying `plan.md` (with a `**Done bar:**` and a
  line-initial `**Review cap:**`), `tasks.md`, and `aar.md` ending in
  `LOOP PAUSED` or `LOOP OPEN`. The directory date is the session date; the
  slug is lowercase and hyphenated. `npm run check-loop-artifacts` gates the
  contract; `npm run session:close` validates it, runs `check:fast`, records the
  run, and prints the push cadence. It does not commit — the increment's single
  commit follows the seal (D-123, D-124). The record is local by design: the
  commit body, `CHANGELOG.md`, and `DECISIONS.md` carry the durable why, and a
  fresh checkout has no records, so the gate passes with zero increments.
- **Record contract rules.** A missing done bar is a warning, not an error.
  An increment dated 2026-11-14 or later declares its cap in `plan.md` and
  records `<cap>; used <n> passes` in `aar.md`; a dispatch past the cap needs a
  user authorization recorded in the AAR. `LOOP PAUSED` requires every finding
  to carry a terminal disposition and a green suite; `LOOP OPEN` names the
  finding without one, and the seal refuses an `aar.md` that ends OPEN. The
  terminal token is the last `LOOP PAUSED` / `LOOP OPEN` occurrence in the
  file — an earlier mention in prose is not terminal. A deviation is recorded
  in `aar.md` and, when it changes scope, as an amendment to `plan.md`. Plans
  are not edited after close; a follow-on change is a new increment.
- **Review cap.** Every increment dated 2026-11-14 or later declares its cap
  in `plan.md` and records the passes used in `aar.md`; the cap is the plan's
  declaration, not an agent judgement. A dispatch past it requires a user
  authorization recorded in the AAR, otherwise stop and escalate (D-117).
- **Narrowing rule.** When the first blocker's cause is confined to one
  finding's evidence, narrow the increment to that finding and move the rest
  to a follow-on increment; do not revise the combined scope again.
- **Finding triage (P0–P3).** P0 = demonstrated wrong output or gate
  failure — fix in-session. P1 = normative gap unscheduled — schedule on
  `ROADMAP.md`. P2 = improvement preventing a demonstrated failure —
  bounded, else downgraded. P3 = informational — record-and-close, no
  action. "Audit X" is P3 unless a failure is demonstrated.
- **Finding dispositions.** The AAR carries its own register: each finding
  gets a terminal disposition — resolved in-session, scheduled on
  `ROADMAP.md`, closed as informational (P3), or deferred by the user.
  `ROADMAP.md` is the tracking surface for scheduled work; the AAR
  references it and never restates it as recommendations.
- **Roadmap admission rule.** `ROADMAP.md` holds scheduled work only: a
  `## <title>` section with an action a maintainer can take, 1–3 bullets, and
  a `**Trigger:**` line naming what starts or closes it. Standing facts —
  accepted advisories, by-design limitations — are decisions recorded in
  `DECISIONS.md`, and a review cites the decision instead of filing a roadmap
  item. The open-web non-goals are listed in the `## Scope Non-goals` block of
  `DECISIONS.md` (rationale in D-061); `ROADMAP.md` carries only a pointer.
  `npm run check-roadmap` enforces the section shape and the `**Trigger:**`
  line, and `npm run check-non-goals` checks the list and the pointer
  (`## Non-goals` is exempt from the item shape because of that check).
- **Loop status.** Every AAR ends with `LOOP PAUSED` or `LOOP OPEN`; the
  definition of both is the increment-record contract above — do not restate it
  here. When PAUSED, the AAR lists zero new action items; the next plan comes
  from `ROADMAP.md` or a direct user request — never from "AAR
  recommendations."
