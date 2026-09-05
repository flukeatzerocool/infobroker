# AGENTS.md — Infobroker MCP Server (v2026.09.04)

## Layer Map

```
src/types.ts  →  src/config.ts  →  src/rate-limiter.ts  →  src/quota.ts  →  src/normalizer.ts  →  src/providers/ (→ src/corroborate.ts)  →  src/index.ts
```

## Tool Surface (7 tools)

| Tool | Purpose |
|------|---------|
| `infobroker_web_search` | Unified search across providers with fallback chain, task-type auto-selection, and suggestion mode |
| `infobroker_fetch_page` | Fetch URL content via Jina Reader (default) or native HTTP |
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
| Hacker News | `src/providers/hacker_news.ts` | free_http |
| GDELT | `src/providers/gdelt.ts` | free_http |
| SEC EDGAR | `src/providers/sec_edgar.ts` | free_http |
| World Bank | `src/providers/world_bank.ts` | free_http |
| Marginalia | `src/providers/marginalia.ts` | builtin |
| Mojeek | `src/providers/mojeek.ts` | builtin |
| Wiby | `src/providers/wiby.ts` | builtin |
| Brave Search | `src/providers/brave.ts` | keyed_http |
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
  color only on a TTY. Shell scripts are gate-checked with `bash -n`.

## State Model

- **Config**: `config.json` (shipped default) — provider config, dispatch tables, limits, hot-reloadable. A user layer at `config.local.json` (or `INFOBROKER_CONFIG_LOCAL`) is merged over the shipped default; user values take precedence and survive updates (REQ-010, REQ-042, REQ-043). `config.local.json` is git-ignored.
- **KB**: the repository ships an **empty** knowledge base. The vector store
  lives at the user-scoped `storage_path` (`~/.local/share/infobroker/knowledge-base`
  by default), outside the repo tree, and is never committed. Personal KB
  content belongs only to the deploying instance's local store. The
  `scripts/check-shipped-kb-empty.ts` gate (part of `npm run check`) fails if
  any KB artifact or an in-repo `storage_path` is present.
- **Quota**: `$TMPDIR/infobroker/quota.json` — daily/monthly counters, persists across restarts.
- **Truncation**: `$TMPDIR/infobroker/trunc-*.txt` — full content of truncated responses.

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
  and provider is referenced. Do not hardcode tool/provider names in the
  validator.
- **Updater**: `scripts/pipeline/prompts/readme.md` — the push-pipeline step
  that auto-refreshes the README. It runs a two-phase Generate → Verify loop
  in a single prompt: phase 1 updates the README against the spec and
  config, phase 2 re-checks every claim against its source and emits a
  `VERIFY ... N high-severity finding(s).` summary. The mechanical
  `validate-readme` gate runs afterward.

When a change to tools, providers, or the spec changes what the README
claims, update the README in the same commit. A README that promises
something the server does not deliver is a defect.

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `INFOBROKER_CONFIG` | Path to config.json (default: `./config.json`) |
| `INFOBROKER_<PROVIDER>_API_KEY` | API key for keyed providers |
| `INFOBROKER_<PROVIDER>_URL` | URL for self-hosted providers (SearXNG) |

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
// @implements REQ-013 partial-results
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

Run before committing or after any change to `infobroker.md` or `src/`:

```
npm run check
```

This runs:

| Command              | What it checks                                     |
|----------------------|----------------------------------------------------|
| `npm run typecheck`  | TypeScript type checking (`tsc --noEmit`)          |
| `npm run validate-spec` | Spec-code traceability, REQ body hygiene, bidirectional coverage |
| `npm run validate-readme` | README structure, tool/provider reconciliation, links, comparison table |
| `npm run check-script-discipline` | Script discipline: shebang + header, exit-code contract, import.meta.dirname, no empty catch |
| `npm run test`       | Vitest unit and integration tests                  |
| `scripts/check-shipped-kb-empty.ts` | Repo ships an empty KB — storage_path outside the tree, no KB artifacts |

All must pass. `npm run validate-spec` exits non-zero on errors (uncited
REQs with no waiver in DECISIONS.md, undocumented source files, Appendix B
mechanical-limit violations, REQ manifest mismatches, stale generated auth
reference).

Shell scripts (`scripts/*.sh`, `scripts/pipeline/*.sh`, `.githooks/*`) are
gate-checked with `bash -n`. Running `shellcheck` on them before committing
is recommended but not required — it is not installed as a devDependency and
is not part of `npm run check`.

## Review-Loop Governance

The improvement loop terminates; it does not spiral. A completed plan is
clean when its AAR returns `LOOP PAUSED` with zero new action items.

- **Completion bar.** Every plan states its own done-bar — what must pass
  and what must close for *this* plan to be done. Bars are
  session-achievable. "Execute all <unbounded backlog>" is not a bar.
- **Finding triage (P0–P3).** P0 = demonstrated wrong output or gate
  failure — fix in-session. P1 = normative gap unscheduled — schedule on
  `ROADMAP.md`. P2 = improvement preventing a demonstrated failure —
  bounded, else downgraded. P3 = informational — record-and-close, no
  action. "Audit X" is P3 unless a failure is demonstrated.
- **Register hygiene.** Findings live in `REVIEW-REGISTER.md` with terminal
  dispositions: `Resolved` / `Scheduled-roadmap` / `Closed-P3` /
  `Deferred-by-user`. `ROADMAP.md` is the tracking surface for scheduled
  work; the AAR references it and never restates it as recommendations.
- **Loop status.** Every AAR ends with `LOOP PAUSED` or `LOOP OPEN`.
  PAUSED requires: gates green, no open P0/P1 beyond the scheduled
  roadmap. When PAUSED, the AAR lists zero new action items; the next plan
  comes from `ROADMAP.md` or a direct user request — never from "AAR
  recommendations."
