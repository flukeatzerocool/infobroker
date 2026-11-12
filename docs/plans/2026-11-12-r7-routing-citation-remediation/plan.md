# Plan — R7 routing-citation remediation

**Status:** revision 3, cap spent · **Date:** 2026-11-12 · **Depth:** standard (one production module, one gate script, two test surfaces, one README paragraph, three registers; no destructive, credential, schema-migration, or publish surface)
**Review independence:** fresh — one cold pass (`independent-review`) on revision 1 returned `FAILED` with 1 Blocker, 2 Majors, 5 Minors, 5 Nits (`/tmp/opencode/r7-routing-cold-report.md`); revision 2 resolved every item. The single permitted diff re-review returned `FAILED` on two mechanical items — a stale corpus sub-count and an evidence sidecar still bound to revision 1 — both applied in revision 3 with no design change. The cold pass ran four stages in one fresh context (stage 4 not triggered). No further review pass will run: the cap is spent.
**Rollback cost:** 1 — additive parser rule, directory-derived surface in an existing gate, unit tests, one README paragraph, one decision row, register edits; `git revert` of the series restores the prior gate. No data, config, or schema is touched.
**Roadmap item:** `ROADMAP.md` § R7 routing-citation remediation (`ROADMAP.md:17-22`); removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); 135 unpushed commits, oldest 3.0 d; 11 open roadmap items; `HEAD` `0852120`, clean tree apart from this plan directory.

## Why this section

`ROADMAP.md` § R7 routing-citation remediation is the **first open section** in
the file, and the ordering rule is top section first. Its trigger — "start
after chunk R8 closes" — is satisfied: the sweep status board records R8
**closed 2026-11-10** and M1 **closed 2026-11-10**
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:596-604`). The previous
increment's AAR names this section as the next open one
(`docs/plans/2026-11-12-r7-confidence-technique-remediation/aar.md`, "Dispositions and next work").

The three findings are one defect class: the gate that is supposed to keep the
client routing surface honest only sees part of that surface and only part of
the citation shapes in it.

- **F-R7-G-2 (P1)** — a *renamed* tool written in bare form is treated as prose,
  so the gate stays green while the routing text points at a tool that does not
  exist (`src/intent-citations.ts:89-96`). This is the acceptance criterion in
  REQ-107 failing for one shape.
- **F-R7-G-1 (P2)** — the surface itself is a hand-maintained five-file list
  (`src/intent-citations.ts:57-63`); the other bundled reference files are never
  parsed, so a new or edited reference file is outside the gate by default.
- **F-R7-G-3 (P2)** — the README tells a reader to enable an optional provider in
  the shipped `config.json` (`README.md:483-485`) instead of the user layer,
  contradicting the deployment model documented 45 lines later
  (`README.md:529-533`; REQ-010/REQ-042/REQ-043).

No REQ body changes. REQ-107 requires that "a renamed tool or operation fails the
gate" (`infobroker.md:476-477`), and this increment closes that requirement for
the shapes a parser can distinguish from prose: a near-miss of a registered
name, a registered name with an affix, and any citation carrying
`action:`/`operation:` arguments. A bare token with no arguments and no
resemblance to a slug (`web_search`, `lookup`) stays prose — that residual is a
by-design limit of a text gate, recorded in `D-108`, not a claim this plan makes
about REQ-107's full generality. The terminology table defines the routing
surface as "the instruction file and skill reference files that map user intent
to Infobroker tools" (`infobroker.md:172`); this plan takes that as every file in
`skills/infobroker/references/`, a modest superset of the routing tables, and
says so in `D-108`.

## Baseline (verified this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **135
  unpushed commits, oldest 3.0 d**, 11 open roadmap items.
- `npm run check` → **PASS (full, 159.0 s, 22 gates, recorded for `0852120`)`,
  run before this plan directory was created. One pre-existing warning, not a
  failure: `check-loop-artifacts` reports
  `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`.
  `npm run audit` reports 4 low-severity `markdownlint`/`katex` advisories; the
  gate fails only on high/critical (REQ-101).
- Working tree clean at `0852120` before this plan directory was created.

## Predicates re-verified by reading the artifacts this session

| Claim | Evidence | Verdict |
|---|---|---|
| The gate's surface is a five-entry hand list | `src/intent-citations.ts:57-63` | Confirmed — F-R7-G-1 |
| The gate reads only those five files | `scripts/check-intent-citations.ts:155-162` iterates `Object.keys(FILE_PREFIX_POLICY)` | Confirmed |
| An unknown bare token is prose by construction | `src/intent-citations.ts:89-96` — `return prefix !== "bare" || knownSlugs.has(slug)` | Confirmed — F-R7-G-2 |
| A prefixed rename is already caught | `src/intent-citations.ts:276-284`; tests at `src/intent-citations.test.ts:156-164, 283-287` | Confirmed — only the bare shape is blind |
| The prose guard is pinned by a test | `src/intent-citations.test.ts:166-170` — `teleport` yields no citation and no finding | Confirmed — the fix must keep this green |
| Reference files not in the surface still carry tool citations | Probe over all 14 `skills/infobroker/references/*.md`: **125 citations, 0 findings** when parsed with the bare policy | Confirmed — the extension needs no content repair |
| Eight reference files outside the surface name a registered tool | `grep -c` per file: `troubleshooting.md` 14, `corroboration.md` 5, `config-tune.md` 4, `decision-tree.md` 32, `journeys.md` 40, `glossary.md` 3, `confidence.md` 2, `provider-map.md` 1 (plus `workflows.md` 22, already in the surface) | Confirmed |
| A near-miss rule has zero false positives on today's corpus | Line-based probe over the instruction file, `SKILL.md`, and all 14 references: **16 files, 599 backticked tokens** — 165 known tools, 183 non-name shapes, 251 prose tokens, **0** near-miss, containment, or citation-arg hits | Confirmed — §2 false-positive budget |
| Seeded renames classify as citations, prose does not | Probe: `fetch_pages (crawl)` → near, `search_webb` → near, `reload_configs` → near, `search_web_v2` / `fetch_page_plus` → contained, `lookup_page (action: search)` → arg-shaped; `teleport`, `file (see above)`, `manage`, `web_search` → prose | Confirmed — the signals are discriminative, and the residual class is named |
| No reference file carries a placeholder citation | `grep -rn "action: value" skills/infobroker/references` → 0; the only `infobroker_*` tokens in the corpus are the three correct instruction-file citations (`instructions/search-preferences.md:8,13,17`) | Confirmed — the corpus probe is not hiding a placeholder |
| Other skill reference directories carry no tool citation | `grep -rE "search_web|fetch_page|verify_claims|get_citations|inspect_providers|manage_kb|reload_config" skills/analysis-loop/references` → 0 matches | Confirmed — the boundary is stated in `D-108` | 
| No other gate enumerates the routing files | `grep -rn "FILE_PREFIX_POLICY" src scripts` → `intent-citations.ts`, its test, and the gate only | Confirmed — no duplicate check exists |
| `validate-spec` does not read the citation surface | `scripts/validate-spec.ts:621-701` reads `workflows.md` and `SKILL.md` for REQ-052/REQ-120 content, never for citations | Confirmed |
| The README instruction names the shipped file | `README.md:483-485` — "set `\"enabled\": true` in `config.json` for those" | Confirmed — F-R7-G-3 |
| The user layer is the documented override surface | `README.md:529-533` (`~/.config/infobroker/config.local.json`, `INFOBROKER_CONFIG_LOCAL`, preserved across updates) | Confirmed — the ruling the fix must cite |
| REQ-107 already requires the renamed-tool failure | `infobroker.md:476-477` | Confirmed — no REQ edit |
| The provider section carries no word budget | `README.md:82-86` bounds the hero, North Star, and §3 feature h3 only | Confirmed — a one-sentence edit needs no budget arithmetic |
| The visited worklist rows are stale by line | REQ-054 row (`:429`) and the `F-R7-G-3` register row (`:856`) cite `README.md:476-477` / `:516-522`; live lines are `:483-485` / `:529-533` | Confirmed — correct both rows in the same edit |
| The worklist carries five matching lines, not six | `grep -n "F-R7-G-1\\|F-R7-G-2\\|F-R7-G-3"` → `:429` (REQ-054 → G-3), `:430` (REQ-107 → G-2), `:840` (G-2), `:855` (G-1), `:856` (G-3); no verdict row cites G-1 | Confirmed — T14's acceptance is five lines |
| The version/CHANGELOG rule | `scripts/version.ts:163-175` pins the top entry date to `package.json` (2026.11.11) | Confirmed — the plan names the real carrier |
| `intent-citations.ts` stays I/O-free by contract | `src/intent-citations.ts:2-4` — "this module stays free of I/O" | Confirmed — directory enumeration belongs in the gate |

## Alternatives considered

- **A — keep the five-file list and append the three files the finding names.**
  Rejected: it fixes today's blind spot and leaves the next reference file
  outside the gate. The finding is about a hand-maintained surface, not about
  three specific files.
- **B — glob every `*.md` in the repository.** Rejected: `README.md`,
  `CHANGELOG.md`, and `docs/plans/**` cite tools in prose and historical
  registers; a gate over them would fail on its own artifacts.
- **C — derive the surface from `skills/infobroker/references/*.md` at gate
  time and keep the instruction file explicit (chosen).** The reference
  directory is the skill's own routing corpus; a file added there is covered
  without registration. I/O stays in `scripts/check-intent-citations.ts`, which
  is what the module's header contract requires.
- **D — flag every unknown bare token that contains an underscore.** Rejected:
  the corpus holds hundreds of non-name backticked shapes (183 of 599 tokens)
  and dozens of config keys (`chunk_size`, `first_pass_max_providers`,
  `max_http_calls`); this would over-capture massively.
- **E — flag every unknown bare token that carries parenthesized arguments.**
  Rejected alone: prose such as `file (see above)` or a parenthetical gloss
  would trip it. Kept only when the arguments are citation-shaped
  (`action:`/`operation:`), which no prose token in the corpus has.
- **F — detect renames structurally (chosen).** Three narrow signals, each
  measured against the corpus: Levenshtein ≤2 to a registered slug
  (`fetch_pages`, `search_webb`, `reload_configs`), a registered slug used as a
  prefix or suffix (`search_web_v2`, `fetch_page_plus`), and
  `action:`/`operation:` arguments on an unknown bare name (`lookup_page
  (action: search)`). `manage` (distance 3, no affix, no arguments) and
  `web_search` (reordered, no affix) stay prose; that residual is stated, not
  papered over.
- **G — a static deny-list of known misspellings.** Rejected: it only catches
  the renames someone already thought of, which is the review failure being
  remediated.
- **H — make F-R7-G-3 a spec change.** Rejected: the deployment model is
  already normative in REQ-010/REQ-042/REQ-043 and documented in the same file;
  one README sentence is the entire defect.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/intent-citations.ts` | Export `prefixPolicyFor(file)` (single for the instruction file, bare for `SKILL.md` and any `skills/infobroker/references/*.md`, `undefined` otherwise) and rename the explicit map to `EXPLICIT_PREFIX_POLICY`; add `isCitationShaped(args)`, `nearMiss(slug, knownSlugs)`, and `containsSlug(name, knownSlugs)`; extend the bare branch of `looksLikeTool` so an unknown bare token is a citation when its arguments are citation-shaped, its name is within edit distance 2 of a registered slug, or it uses a registered slug as a prefix or suffix; route it through the existing `unknown_tool` finding | M |
| `src/intent-citations.test.ts` | Update the `FILE_PREFIX_POLICY` import and the two assertions that read it (`:9`, `:138`, `:144`) to the new `EXPLICIT_PREFIX_POLICY` / `prefixPolicyFor` names; keep the `teleport` prose test green; add renamed-bare (near-miss), renamed-bare (slug affix), renamed-bare (arg-shaped), boundary (`manage` and `web_search` stay prose), derived-policy (an unlisted reference path gets `bare`), and composition (unknown bare tool in a previously unlisted reference file is detected) cases | M |
| `scripts/check-intent-citations.ts` | Replace the `FILE_PREFIX_POLICY` iteration with a surface builder: the instruction file, `SKILL.md`, and `readdirSync(skills/infobroker/references)` filtered to `*.md` and sorted; the `readdirSync` call is wrapped so a missing directory or permission error exits **2** with the path instead of throwing (Node would otherwise exit 1); an empty reference list is exit 2; header comment states the derived surface | S |
| `README.md` | Rewrite `:483-485` so enabling an optional provider names the user layer (`config.local.json`, path from `INFOBROKER_CONFIG_LOCAL`, preserved across updates) and keeps the keyed-provider exclusion sentence; no word-budget section is touched | S |
| `DECISIONS.md` | One `### D-108` row under `## Active Decisions`: the reference directory is the routing surface (a superset of the routing tables in `infobroker.md:172`); the detector is near-miss-or-affix-or-citation-shaped; the durable false-positive budget is the gate's **0 findings** on the corpus, with the 599-token classification as the one-off observation; the residual prose-shaped rename class is by design; other skill reference directories are out of contract because they cite no tool today | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | REQ-107 (`:430`) and REQ-054 (`:429`) verdict rows plus `F-R7-G-1` (`:855`), `F-R7-G-2` (`:840`), `F-R7-G-3` (`:856`) register rows → `Resolved 2026-11-12` with file:line evidence; correct the stale README line references in **both** the REQ-054 row and the `F-R7-G-3` row | S |
| `ROADMAP.md` | Remove § R7 routing-citation remediation (`:17-22`); remove § Review-loop convergence (`:80-85`) only if this increment holds its recorded cap | S |
| `CHANGELOG.md` | One new sibling `## 2026.11.11 — …` section between `# Changelog` and the current first section (`CHANGELOG.md:3`); the date must equal `package.json`'s version | S |
| `docs/plans/2026-11-12-r7-routing-citation-remediation/` | `plan.md`, `tasks.md`, `aar.md` | S |

No spec body change, no config, provider, dependency, or new-gate change. The
gate count stays 22, so `scripts/lib/gate-manifest.ts`, the generated AGENTS.md
table, and `check-gate-table` are untouched.

## Done bar

**Done bar:** F-R7-G-1, F-R7-G-2, and F-R7-G-3 each have a committed fix **and**
a deterministic check that fails when the fix is reverted. Concretely: (1) the
gate builds its file list from the instruction file, `SKILL.md`, and every
`skills/infobroker/references/*.md`, so a newly added reference file is covered
without registration; (2) an unknown bare tool is `unknown_tool` when its name
is within edit distance 2 of a registered slug, uses a registered slug as an
affix, or carries citation-shaped arguments, while the existing `teleport` prose
test and the `manage` / `web_search` boundaries stay green; (3) the README
provider-enable instruction names the user layer and matches `README.md:529-533`;
(4) recorded probes each go red then green: a renamed bare tool in
`troubleshooting.md` (blind before, `unknown_tool` after), a new reference file
carrying a bogus tool (uncovered before, `unknown_tool` after), and a corpus run
with **0 findings** after the change; (5) the worklist rows read `Resolved
2026-11-12` with evidence, `D-108` is present, the CHANGELOG section is present
with the pinned date and names the REQs it serves, and § R7 routing-citation
remediation is gone from `ROADMAP.md`; (6) `npm run check-intent-citations`,
`npm run validate-readme`, `npm run validate-spec`, `npm run check-roadmap`,
`npm run check-non-goals`, `npm run version-sync`,
`npm run check-script-discipline`, `npm run check-loop-artifacts`,
`npm run typecheck`, `npm run typecheck:scripts`, and `npm run test` are green
on the final tree, and `npm run check` is green **after** `aar.md` carries its
terminal token; (7) the AAR records the review cap and whether it was held, and
ends `LOOP PAUSED` when nothing is unresolved or `LOOP OPEN` naming an
escalated item.

## Review-loop cap (recorded, not judged at run time)

**One cold pass at standard depth, plus at most one targeted diff re-review of
the lines that changed.** At that cap any unresolved item is escalated to the
user with `LOOP OPEN` rather than re-scoped. This increment records the cap
because its trigger has fired — "start with the next increment that plans a
multi-finding remediation" (`ROADMAP.md:80-85`). § Review-loop convergence is
retired **only** if the AAR can record that the cap was held; otherwise it
stays and the AAR names the breach.

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Record the baseline in `tasks.md`: `npm run status` and the green
  `npm run check` run above.
- **T1.** Create `tasks.md` (with red/green transcript slots) and `aar.md`
  seeded `LOOP OPEN` with the finding list. `LOOP OPEN` is a valid terminal
  token, so every intermediate `check-loop-artifacts` run is satisfiable.

### Phase 1 — Derived surface (F-R7-G-1)

- **T2 — red-first surface probe.** With the tree unmodified, seed
  `skills/infobroker/references/troubleshooting.md` with a one-line
  `` `infobroker_fetch_pagez` `` reference. `npm run check-intent-citations` →
  **exit 0** (the file is not in the surface). Record; restore the file.
- **T3 — implement the policy function.** In `src/intent-citations.ts`, replace
  the five-entry map with `EXPLICIT_PREFIX_POLICY` (instruction file + `SKILL.md`)
  and `prefixPolicyFor(file)`: exact explicit hit first, then any
  `skills/infobroker/references/*.md` → `bare`, else `undefined`. `extractCitations`
  and `validateRoutingFiles` switch from the map to `prefixPolicyFor`; the
  `unregistered_file` finding stays for a path with no policy. No I/O is added
  to the module.
- **T4 — implement the surface builder.** In `scripts/check-intent-citations.ts`,
  build the file map from the instruction path, `SKILL.md`, and a sorted
  `readdirSync(join(ROOT, "skills/infobroker/references"))` filtered to `.md`.
  Wrap the `readdirSync` call in a `try`/`catch` that prints the path and exits
  **2** (an uncaught throw would exit 1), reject an empty reference list with
  exit 2, and keep per-file read failures at exit 2. Update the header comment.
  Acceptance: the gate still exits 0 on the real tree, and the catch path is
  confirmed in a scratch worktree by temporarily renaming the reference
  directory to `references-off` (expect exit 2, not 1), then restoring it and
  re-running.
- **T5 — green + surface probe.** `npm run check-intent-citations` → exit 0 on
  the unmodified corpus. Re-run T2's seed → **exit 1** with `unknown_tool` at
  the seeded line. Record both. Remove the seed.
- **T6 — new-file probe.** Create
  `skills/infobroker/references/probe-surface.md` containing
  `` `infobroker_bogus_tool` ``; the gate must fail without any registration
  edit. Delete the file and confirm green again.

### Phase 2 — Bare-tool detection (F-R7-G-2)

Detection contract, pinned so the tests and the parser share one definition:

- `isCitationShaped(args)` — true when the argument string contains an
  `action:` or `operation:` key/value pair; prose parentheticals do not.
- `nearMiss(name, knownSlugs)` — true when the Levenshtein distance from the
  bare name to some registered slug is ≤ 2.
- `containsSlug(name, knownSlugs)` — true when a registered slug is a prefix or
  suffix of the bare name (`search_web_v2`, `fetch_page_plus`).
- An unknown bare token is a citation when any of the three is true; it then
  follows the existing `unknown_tool` path (one finding, no argument parsing). A
  prefixed token is a citation unconditionally, as today. A bare token that is
  reordered (`web_search`) or unrelated remains prose, and `D-108` records that
  residual.
- **Probe hygiene.** T2, T5, T6, T7, and T9 seed or create a tracked file. After
  each probe run `git status --short` and confirm the only untracked path is
  this plan directory; a dirty `troubleshooting.md` or a leftover
  `probe-surface.md` is a stop.

- **T7 — red.** Seed `skills/infobroker/references/troubleshooting.md` with
  `` `fetch_pages (crawl)` `` and `npm run check-intent-citations` → exit 0
  (current blind spot). Record; restore.
- **T8 — implement the rule.** Add `isCitationShaped`, `nearMiss`, and
  `containsSlug` to `src/intent-citations.ts`; pass the argument string into the
  bare branch of `looksLikeTool`. Keep the prefixed branch unchanged and keep
  the finding code `unknown_tool`.
- **T9 — green.** Re-run T7's seed → exit 1 naming `unknown_tool` at the seeded
  line. Remove the seed; the corpus run stays green.
- **T10 — unit tests.** In `src/intent-citations.test.ts`: renamed bare with
  arguments (`fetch_pages (crawl)` → `unknown_tool`); renamed bare with an affix
  and no arguments (`search_web_v2` → `unknown_tool`); renamed bare outside both
  name bands but citation-shaped (`lookup_page (action: search)` →
  `unknown_tool`); prose and boundary guards (`teleport`, `file (see above)`,
  `manage`, `web_search` → no citation, no finding); `prefixPolicyFor` returns
  `bare` for an unlisted reference path, `single` for the instruction file, and
  `undefined` for `README.md`; one composition case that extracts from an
  unlisted reference path and gets `unknown_tool` for a renamed bare tool; and
  the `EXPLICIT_PREFIX_POLICY` import/assertion updates. `npm run test` → green.
- **T11 — false-positive audit.** Run the gate on the final corpus and record
  the finding count (**0 expected**). A non-zero count is a stop: classify each
  hit and narrow the signal rather than baselining.

### Phase 3 — Documentation and registers (F-R7-G-3 and bookkeeping)

- **T12 — README.** Rewrite `README.md:483-485` so the enable instruction names
  the user layer: set `"enabled": true` in
  `~/.config/infobroker/config.local.json` (or the path in
  `INFOBROKER_CONFIG_LOCAL`), then export the matching key; keep the
  keyed-provider exclusion sentence and the self-hosted paragraph unchanged.
  `npm run validate-readme` → exit 0.
- **T13 — decision.** Add `### D-108` under `## Active Decisions` in
  `DECISIONS.md`: the reference directory is the routing surface (a superset of
  `infobroker.md:172`'s routing tables), the detector is
  near-miss-or-affix-or-citation-shaped, the durable false-positive budget is
  the gate's **0 findings** on the corpus (the 599-token classification is the
  one-off observation), the reordered/unrelated bare rename is a recorded
  by-design residual, and a hit is fixed by rephrasing or registering the tool,
  never by loosening the rule silently.
- **T14 — worklist.** Set REQ-107 (`:430`) and REQ-054 (`:429`) verdict rows and
  `F-R7-G-1` (`:855`), `F-R7-G-2` (`:840`), `F-R7-G-3` (`:856`) register rows to
  `Resolved 2026-11-12` with the probe evidence; correct the stale README line
  references in **both** the REQ-054 row and the `F-R7-G-3` row to `:483-485` /
  `:529-533`. Acceptance:
  `grep -n "F-R7-G-1\\|F-R7-G-2\\|F-R7-G-3" docs/plans/2026-11-09-full-review-sweep/worklist.md`
  returns exactly **five** lines (two verdict rows plus three register rows),
  each carrying the resolved disposition. No verdict row cites `F-R7-G-1`
  today; do not invent one — the REQ-107 row carries the gate finding. D-108
  is the carrier for the surface claim.
- **T15 — roadmap.** Remove § R7 routing-citation remediation (`:17-22`). At the
  AAR, remove § Review-loop convergence (`:80-85`) **only** if the cap was held;
  otherwise leave it and record the breach. `npm run check-roadmap` → OK.
- **T16 — CHANGELOG.** Insert the new sibling section after `# Changelog`; the
  date stays `2026.11.11` because `package.json` is unchanged. The entry names
  the three findings, the gate surface and detector, `REQ-107` and `REQ-054`,
  and `D-108`, matching the existing bullet style. `npm run version-sync` → OK.

### Phase 4 — Gates and close

- **T17.** `npm run validate-spec`, `npm run check-roadmap`,
  `npm run check-non-goals`, `npm run version-sync`,
  `npm run check-script-discipline`, `npm run check-loop-artifacts`,
  `npm run typecheck`, `npm run typecheck:scripts`, `npm run test`,
  `npm run check-intent-citations`, `npm run validate-readme`.
- **T18.** Rewrite `aar.md`: dispositions, the cap record, the false-positive
  measurement, and a terminal token. `npm run session:close`.
- **T19.** `npm run check` on the final tree (full, un-piped, exit status
  recorded) after the terminal token is in place.

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| Reference files are covered | derived surface + T2/T5/T6 probes | probe already parses all 14 references with 0 findings, so the green is deterministic |
| Renamed bare tool fails | new `unknown_tool` rule + T7/T9 probes | probe classifies `fetch_pages`, `search_webb`, `search_web_v2`, `lookup_page (action: search)` as citations |
| Prose stays prose | existing `teleport` test + new guards | 0 near-miss/affix/arg-shaped hits over 599 corpus tokens; `manage`, `web_search` stay prose |
| README matches the deployment model | `validate-readme` + T12 | no word-budget rule covers §4; the two paragraphs agree after the edit |
| No new gate or manifest row | `check-gate-table` (22 gates) | no manifest edit |
| Register consistency | `check-roadmap`, `check-non-goals`, `check-loop-artifacts` | section removal, `D-108`, terminal AAR token |
| Whole-tree health | `npm run check` after T18 | baseline green at `0852120` |

## Edge cases and rollback

- **A prose token that is a near-miss of a slug.** `manage` (distance 3) is the
  closest observed; a future one trips the gate. The fix is to rephrase or
  register, not to widen the threshold. The threshold is a module constant with
  a test, so widening is a visible diff.
- **A reordered rename stays prose.** `web_search` is neither near, affixed, nor
  argument-bearing, so it is undetectable without a semantic model. This is the
  recorded residual in `D-108`; closing it is not in scope and REQ-107 is not
  claimed to be fully discharged for that shape.
- **A new tool is named in a reference before it is registered.** The gate
  fails (unknown or near-miss), which is the intended order: register first.
- **`provider-auth.md` is generated.** It is inside the derived surface; today
  it carries no tool citation. If a future generation emits a prefixed
  `infobroker_*` citation in a bare-policy file, the gate reports
  `wrong_prefix`; the fix belongs in the generator template, never in a
  hand-edit of the generated file.
- **Other skill directories.** `skills/analysis-loop/references/` is outside the
  surface; it cites no Infobroker tool today (verified), and `D-108` records
  that extending the surface there is a new decision, not an omission.
- **The gate reads more files.** Eleven extra small Markdown reads in the same
  script; no new process. T19 records the full-suite time against the 159.0 s
  baseline.
- **A reference file is missing or unreadable.** Exit 2 with the path, as today.
  A missing directory or permission error is caught and exits 2 rather than
  letting the throw become exit 1. An empty reference directory is exit 2
  rather than a vacuous pass.
- **A probe is not restored.** Every probe seeds or creates a tracked file;
  after each one `git status --short` must show only this plan directory.
- **Rollback.** `git revert` of the full series restores the prior gate cleanly.
  Partial reverts are not clean and are not the rollback path: reverting the
  gate script alone leaves it importing `FILE_PREFIX_POLICY`, which the parser
  rename removed, so typecheck fails; reverting the parser alone leaves the
  gate enumerating eleven files with no `prefixPolicyFor`, so the gate reports
  `unregistered_file`. Revert the whole series or none of it.

## Commit series

Six commits, one concern each. The gate script and the parser rule share one
contract (the same `looksLikeTool`/`prefixPolicyFor` surface), so they ship
together; a gate without the rule is blind, and a rule without the gate's
enumeration is only half-covered.

1. `fix(intent-citations)`: `src/intent-citations.ts`,
   `src/intent-citations.test.ts`, `scripts/check-intent-citations.ts`. Gate:
   `typecheck`, `typecheck:scripts`, `test`, `check-intent-citations`,
   `check-script-discipline`.
2. `docs(readme)`: the provider-enable sentence. Gate: `validate-readme`.
3. `docs(decisions)`: `D-108`. Gate: `check-non-goals`, `validate-spec`.
4. `docs(plans)`: worklist dispositions and roadmap removal. Gate:
   `check-roadmap`.
5. `docs(changelog)`: the new sibling section. Gate: `version-sync`.
6. `docs(plans)`: `plan.md`, `tasks.md`, `aar.md`. Gate:
   `check-loop-artifacts`, then `npm run check`.

Every commit is `typecheck`-clean; the full suite runs once on the final tree.

## Conditions to verify during execution

- **C-1** — the T2/T7/T9 transcripts are captured verbatim; a red that does not
  name the expected file:line is a stop.
- **C-2** — the gate stays one script with no new exit path (0 pass / 1 finding
  / 2 fatal), including the caught `readdirSync` failure, and the gate count
  stays 22.
- **C-3** — `src/intent-citations.ts` gains no filesystem import; enumeration is
  the gate's job.
- **C-4** — the cap: one cold pass plus at most one diff re-review; at the cap an
  unresolved item is escalated, never re-scoped. The cold pass covered four
  stages in one fresh context (stage 4 not triggered), so the stamp records 4.
- **C-5** — the false-positive measurement is re-taken on the final tree (T11),
  not inherited from this plan's probe; a drift above zero is triaged before
  the AAR.
- **C-6** — every probe leaves a clean tree; `git status --short` shows only
  this plan directory before the next step starts.
- **C-7** — the diff re-review's two mechanical items are applied after the
  review (the 331 → 183 sub-count and a regenerated evidence sidecar); no
  design decision changed, and no third review pass runs. The cap is spent.

## Unknowns

- Whether the derived surface changes `check-intent-citations` run time
  measurably. Eleven additional small reads in one process; T19 records the
  full-suite time.
- Whether any published fixture or skill-harness expectation snapshots the
  gate's file list. `grep -rn "FILE_PREFIX_POLICY"` covers the code; the
  `test-fixtures/skills/*` JSON files are prompts, and the T17 suite settles it.
- Whether a later reference edit introduces a prose token inside edit distance 2
  of a slug. If that happens, the decision is rephrasing the prose (preferred)
  or narrowing the signal in `D-108`; the plan does not pre-authorize baselining.
