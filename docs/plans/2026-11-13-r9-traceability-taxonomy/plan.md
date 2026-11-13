# Plan — R9 traceability and taxonomy gate strength

**Status:** revision 6, stamped · **Date:** 2026-11-13 · **Depth:** standard
**Review independence:** self — one cold pass (five stages plus three stage-5 audits) ended `independent-review FAILED.` at the cap; the user recorded `risk accepted: no cold pass — authorized by fluke`, and revision 6 is the machine-checked, not independently re-read, artifact (see Review-loop cap).
**Rollback cost:** 1 of 2 — fully reversible; the rollback unit is commits 1–3 as a set, because the taxonomy gate is red without the spec cells and the spec cells are unasserted without the gate.
**Roadmap item:** `ROADMAP.md` § R9 traceability and taxonomy gate strength (`ROADMAP.md:17-22`); removed when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); `HEAD` `44f4f21`; clean tree before this plan directory was created.

## Why this item

`ROADMAP.md` § R9 traceability and taxonomy gate strength is the first open
section in file order, and file order selects it. Its trigger — "start after
chunk M1 closes" — is satisfied: the sweep status board records R1–R9 and M1
closed 2026-11-10 (`docs/plans/2026-11-09-full-review-sweep/worklist.md:603-604`).
The roadmap's other two §R9 sections are separate items; this plan closes only
F-R9-A-1 and F-R9-C-1.

- **F-R9-A-1 — pure drift: the clause guard counts tags, not branches.**
  `evaluateClauseCoverage()` fails an or-branch REQ only when fewer than **two**
  tags cover it (`src/clause-coverage.ts:133-135`), so a REQ with three or more
  branches passes on two tags. The G3 verification list already requires "a
  named clause tag **per branch**" (`infobroker.md:1158-1161`, in §9.4), and
  AGENTS.md repeats the rule. No REQ edit is needed.
- **F-R9-C-1 — two shapes, only one of them drift.** The presence-only taxonomy
  check (`scripts/validate-spec.ts:537-557`, called at `:559`) greps the whole
  appendix, so a duplicate home passes and a Notes mention satisfies it — drift
  from REQ-078's existing "exactly one feature area" (`infobroker.md:529-535`).
  But REQ-078 says nothing about the Gate column equalling the members'
  manifest gates, so that half is **new normative content**: REQ-078 is amended
  here, and the consequence is real — every future §9.5 gate change forces a §D
  edit in the same commit.

Both findings are P1 in the sweep register and `Scheduled-roadmap` today
(`worklist.md:882`, `:886`).

### Measured state (this session, before any edit)

The counts below come from a committed, read-only probe,
`docs/plans/2026-11-13-r9-traceability-taxonomy/evidence/measure-r9.ts`, whose
full output is `evidence/measure-r9.out`. It reuses
`detectClauseRequirements`/`clauseTagsFromPayload` and the same §4/§9.5/§D
slices as the gates, so the numbers are reproducible from the tree.

- **Clause population: 142 §4 bodies; 4 with `orBranches >= 2`** (REQ-013
  4 branches / 9 tags; REQ-020 2/2; REQ-021a 4/7; REQ-021f 3/3). Both the
  current `>= 2` rule and the per-branch rule report **0 failures**, so the
  tightening changes no existing test and no spec text. Consequence: the
  fail-before evidence must be a **unit fixture** (a 3-branch REQ with 2 tags),
  not a live-spec edit.
- **§4 ids: 142**, derived by the script's own predicate over the §4 slice.
- **REQ uniqueness: 142 distinct REQs, all in exactly one §D row; 0 missing.**
- **Tool uniqueness: 7 slugs, each in exactly one backticked Tools cell.** The
  five real tool cells are groups 1 (three tools), 2, 3, 4, 5 (one each); groups
  6 and 9 use `(all 7 tools)` / `(all 7 tools, enforced server-side)`, and
  groups 7 and 8 use `(no tools)`, none of which name a slug.
- **Gate column drift: 4 rows.** Group 2 union `G0,G1,G3` vs declared `G0,G1`
  (G0 from REQ-024/024a/024b/024c, G3 from REQ-129); group 5 union `G1,G3` vs
  declared `G0,G1` (G3 from REQ-091, no member supplies G0); group 6 union
  `G0,G1,G3` vs declared `G0` (G1 from REQ-079/089/090/092/106, G3 from
  REQ-092/106); group 7 union `G1,G3` vs declared `G3` (G1 from REQ-125).
  Groups 1, 3, 4, 8, 9 match (group 1 in `G0, G1` order).
- **No integer-first-cell table rows after §D** (0), which is what makes the
  to-EOF §D slice behaviour-identical (alternative J).

## Baseline

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), 174
  unpushed commits, oldest 3.9 d, 5 open roadmap items. These numbers and the
  full run's exit status are recorded in `tasks.md` T1 (the run log itself is
  transient, not a tracked artifact).
- `npm run check` → **exit 0**, `gates: PASS (full, 165.9 s)` on the clean tree
  at `44f4f21` before this directory existed
  (`/tmp/opencode/pre-plan-check-r9.log`; not in the tree-keyed journal, which
  records only a shipping tree).
- Predicate reads (this session):
  - `src/clause-coverage.ts:89-102` `detectClauseRequirements`; `:128-140`
    `evaluateClauseCoverage`, threshold at `:133`; `:121-124` the violation type.
  - `src/clause-coverage.test.ts:84-113` the regression guard: `orphanBranches`
    is a **two-branch** object and `:95-97` passes it with 2 tags.
  - `scripts/validate-spec.ts:14` imports the clause helpers; `:31-42`
    `deriveToolSlugs` (module-local, not exported — the dry-run probe re-derives
    slugs with the same regex); `:61-67` `allReqs`; `:154-172` `reqBodies` (the
    §4 body list and its ids); `:315-369` the clause gate block (message at
    `:360-366`, numeral at `:362`); `:537-557` `checkFeatureTaxonomy`, called at
    `:559`; `:431-439` the existing §9.5 id-only parse.
  - `src/lib/feature-taxonomy.ts:32-47` `deriveFeatureAreas` (to-EOF slice,
    integer-first-cell rows, empty-name filter at `:42`, dedupe at `:43`);
    `:58-106` `reconcileReadmeFeatures`; `:16` `USER_FACING_GROUPS`; `:19-28`
    the README title map. `scripts/validate-readme.ts:15` imports it; `:411`
    asserts the README cites it.
  - `src/lib/feature-taxonomy.test.ts:9-20` the inline `SPEC_TAXONOMY` fixture
    used by the README tests; `:32-46` the `deriveFeatureAreas` tests.
  - `infobroker.md:1814-1822` the §D table (columns `# | Feature area | Tools |
    Primary REQs | Gate`); `:1826-1835` the §D Notes; `:529-535` REQ-078;
    `:1157` the manifest bullet and `:1158-1161` the clause bullet, both in
    **§9.4 G3** (`:1138`); `:1182` §9.5 (`| REQ | Title | Section | Gate |`);
    `:1243-1246` the group-6 REQ gates (REQ-092/106 carry G1+G3).
  - `README.md:87-89` and `:217-220` the two places the README describes the
    feature taxonomy. A REQ-078 body edit must carry a non-whitespace README
    diff in the same run (AGENTS.md README Governance, spec→README binding).
  - `ROADMAP.md:17-22`; `worklist.md:527`, `:529`, `:882`, `:886`.
  - `DECISIONS.md` highest id `D-113`; `CHANGELOG.md:3` is the top section, also
    `## 2026.11.11 — …` (multiple sections per release is the established
    pattern; `version-sync` pins the top date to `package.json`).
  - `tsconfig.json:19` includes `src/**/*` only; `tsconfig.scripts.json:17`
    includes `scripts/**/*.ts` only, so `docs/plans/**/evidence/*.ts` is outside
    both projects.
  - `git check-ignore` on `docs/plans/.../evidence/measure-r9.out` → not
    ignored; `docs/` is not in the published tarball (`check-pack` derives its
    allowlist from `package.json` `files`).
  - `grep -rn "fingerprint" scripts src` → none, so no fingerprint artifact
    covers §D or REQ-078.

## Alternatives considered

- **A — tighten the clause guard to `taggedCount < orBranches`.** Chosen. It
  implements the sentence in §9.4 and AGENTS.md, needs no REQ edit, and the
  probe shows no spec churn. The detector is a heuristic (non-backticked
  parenthesised "or" groups plus narrow prose class lists), so a future false
  positive is fixed by narrowing `OR_ENUM_RE`/`detectProseClassLists` with a
  fixture — never by inventing a tag. That remedy is C-7.
- **B — narrow the detector to normative outcome sentences now.** Rejected as
  scope creep: the roadmap finding is the tag *count*, the detector already
  excludes backticked value unions and "such as" lists
  (`src/clause-coverage.test.ts:53-63`), and a modal filter would change every
  existing count without a demonstrated defect.
- **C — one tag per distinct branch slug matched to a branch name.** Rejected:
  the detector yields counts, not identities.
- **D — narrow §9.4's "per branch" wording to "at least two".** Rejected:
  removes the obligation rather than fixing the detector.
- **E — add the taxonomy assertions inline in `validate-spec.ts`.** Rejected: no
  unit-test seam.
- **F — a second §D parser in `scripts/lib/`.** Rejected: `deriveFeatureAreas`
  already parses §D; keep one parser.
- **G — Gate cell as a subset or superset of member gates.** Rejected: subset
  hides today's dropped G3; superset hides today's phantom G0. Equality with
  the union catches both.
- **H — treat all-tools placeholder groups as tool homes.** Rejected:
  contradicts "exactly one". The carve-out is normative in REQ-078 and requires
  a placeholder, which is exactly what the checker's "backticked names only"
  rule enforces.
- **I — hand-edit the four cells without a gate.** Rejected: fixes today's
  drift, leaves tomorrow's.
- **J — bound the new parser at the next `## ` heading.** Rejected: today's
  `deriveFeatureAreas` slices to EOF, so bounding could change its output if a
  later appendix carried an integer-first-cell row (none does: probe reports 0
  after §D). Keeping the to-EOF slice plus the filter/dedupe in the projection
  makes `deriveFeatureAreas` behaviour-identical by construction (C-2).
- **K — pass a §9.5 gate map in from `validate-spec`.** Rejected: the existing
  parse (`:431-439`) collects ids only. A shared `parseManifestGates` exported
  from the lib is the single gate-column parser; id-presence reconciliation
  stays where it is. The checker slices §9.5 from the heading to the next
  `### `/`## ` heading so later §9 subsections cannot contribute rows.

## Blast radius

Sizes: **S** ≤ ~60 changed lines, **M** ≤ ~260.

| File | Change | Size |
|---|---|---|
| `src/clause-coverage.ts` | or-branch threshold `< 2` → `< req.orBranches`; comment states the per-branch rule | S |
| `src/clause-coverage.test.ts` | 3-branch/2-tag fails, 3/3 passes, 4-branch/3-tag fails; existing cases kept | S |
| `src/lib/feature-taxonomy.ts` | `FeatureTaxonomyRow`, `parseFeatureTaxonomy`, `parseManifestGates`, `checkFeatureTaxonomyCoverage`; `deriveFeatureAreas` becomes a filter/dedupe projection | M |
| `src/lib/feature-taxonomy.test.ts` | live-spec pass, one canonicalisation case, and eight negative fixtures; existing inline-`SPEC_TAXONOMY` tests unchanged | M |
| `scripts/validate-spec.ts` | import the lib checker, replace the inline `checkFeatureTaxonomy` (`:537-557`) with the call at `:559` passing `reqBodies.map((rb) => rb.id)`; update the or-branch message at `:360-366` | S |
| `infobroker.md` | four §D Gate cells (`:1815`, `:1818`, `:1819`, `:1820`), one §D Notes bullet after `:1835`, the §D intro's stale "also governs" sentence (`:1809`), REQ-078 body (`:529-535`), one §9.4 bullet after `:1157` | S |
| `README.md` | one sentence after `:219` stating the exactly-one-home and gate-union rule (spec→README binding) | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | surface rows `:527`/`:529`; register rows `:882`/`:886` → `**Resolved 2026-11-13**` | S |
| `ROADMAP.md` | remove § R9 traceability and taxonomy gate strength (`:17-22`) | S |
| `DECISIONS.md` | `D-114`: union rule, placeholder carve-out, detector-false-positive remedy | S |
| `CHANGELOG.md` | one `## 2026.11.11 — …` top section | S |
| `docs/plans/2026-11-13-r9-traceability-taxonomy/` | `plan.md`, `tasks.md`, `aar.md`, `evidence/measure-r9.{ts,out}`, `plan.cold/` | S |

No production runtime change (both modules are gate code), no config, schema,
dependency, provider-registry, tool-schema, or gate-manifest change.

## Design — per-branch clause guard (F-R9-A-1)

In `src/clause-coverage.ts`, `evaluateClauseCoverage` becomes:

```ts
if (req.orBranches >= 2 && taggedCount < req.orBranches) {
  return { reqId, kind: "or-branches" };
}
```

The conditional limb (`conditionals >= 1 && taggedCount < 1`) is unchanged. The
or-branch message in `scripts/validate-spec.ts:360-366` becomes exactly:

```ts
error(
  `${rb.id}: defines "or"-joined normative branches but tests tag fewer than ${req.orBranches} clause tags (one per branch, found: ${[...(clauseTagsByReq.get(rb.id) ?? [])].join(", ") || "none"}) — add an inline clause tag per branch, e.g. \`// @implements ${rb.id} <branch-slug>\``
);
```

The conditional message is untouched.

**Detector semantics (accepted, with remedy).** `orBranches` is whatever
`detectClauseRequirements` counts, and that count becomes the quota, so a REQ
whose body carries an explanatory "(a or b)" aside would be asked for a tag for
it. The measured population has four or-branch REQs and all already exceed their
quota, so this is not exercised today. C-7 binds the remedy: if a future REQ
trips the rule on a non-branch aside, narrow the detector with a fixture; never
invent a tag.

**Fail-before evidence.** The unit fixtures are the proof:
`evaluateClauseCoverage("REQ-900", { orBranches: 3, conditionals: 0 }, 2)` must
return the violation. Against today's code it returns `null`; T3 records the
red run, then the change makes it green. T4 re-runs `npm run validate-spec` →
exit 0 with the probe's numbers as the reason no spec edit was needed.

## Design — taxonomy assertion (F-R9-C-1)

### Parser and checker (`src/lib/feature-taxonomy.ts`)

```ts
export interface FeatureTaxonomyRow {
  group: number;
  name: string;
  tools: string[];   // backticks in the THIRD cell only; placeholders yield []
  reqs: string[];    // REQ ids in the FOURTH cell, in order
  gates: string[];   // G0..G3 tokens in the FIFTH cell, in order
}
export function parseFeatureTaxonomy(specText: string): FeatureTaxonomyRow[];
export function parseManifestGates(specText: string): Map<string, string[]>;
export function checkFeatureTaxonomyCoverage(
  specText: string,
  toolSlugs: string[],
  reqIds: string[],
): string[];
```

`parseFeatureTaxonomy` slices from `## §D Appendix: Feature Taxonomy` to EOF
(today's boundary), reads rows whose first cell is an integer, and takes each
column by index — Tools from cell 3 only, so a backticked name in a Title cell
is not a home. `parseManifestGates` slices `### 9.5 REQ Manifest` to the next
`### `/`## ` heading and returns the fourth cell's gate tokens per REQ.
`deriveFeatureAreas` becomes `parseFeatureTaxonomy(specText)` → keep entries
with a non-empty name → dedupe by group → `{group, name}` (today's `:42-43`).

Findings, in emission order:

1. §D heading absent → the existing message verbatim (`Feature taxonomy appendix
   (§D) not found`); return immediately.
2. A group number in more than one row → `Feature taxonomy (§D): group N
   appears more than once`; **return immediately** (a duplicated row also
   duplicates its tools and REQs, so later checks would report the same defect
   twelve times).
3. Each `toolSlugs` entry in exactly one row's `tools`: zero → the existing
   `Feature taxonomy (§D) is missing tool \`X\`` verbatim; two or more →
   `Feature taxonomy (§D) group N '<name>': tool \`X\` also appears in group M —
   exactly one home required`.
4. Each `reqIds` entry in exactly one row's `reqs`: zero → the existing
   `Feature taxonomy (§D) is missing <REQ>` verbatim; two or more →
   `Feature taxonomy (§D) group N '<name>': <REQ> also appears in group M —
   exactly one home required`.
5. §9.5 heading absent → `REQ manifest (§9.5) not found`; skip only this check.
   Otherwise, for each row, in row order: a REQ absent from §9.5 or with no gate
   token in its cell → `Feature taxonomy (§D) group N '<name>': <REQ> declares
   no gate in §9.5`, and that REQ contributes nothing to the union. Then the
   union of the row's gated REQs, canonicalised (`G0 < G1 < G2 < G3`), must
   equal the row's Gate cell as a set; a mismatch → `Feature taxonomy (§D) group
   N '<name>': Gate [<declared>] does not match its REQs' manifest gates
   [<union>]`. A row with no REQs unions to the empty set and must declare an
   empty Gate cell.

The per-row findings share one prefix and one noun ("group"); the three
preserved messages stay byte-identical to `:540`, `:548`, `:554`.

### `scripts/validate-spec.ts`

Add an import line for `checkFeatureTaxonomyCoverage` from
`../src/lib/feature-taxonomy.js` (none exists today — `validate-spec.ts` imports
only the clause helpers at `:14`), delete the inline `checkFeatureTaxonomy`
(`:537-557`), and call at `:559`:

```ts
for (const message of checkFeatureTaxonomyCoverage(
  specText,
  deriveToolSlugs(),
  reqBodies.map((rb) => rb.id),
)) {
  error(message);
}
```

`reqBodies` is the §4 body list (`:154-172`), so the REQ scope is exactly
REQ-078's "every §4 REQ" — an out-of-§4 bold heading is not read here.
`deriveToolSlugs()` is the live-registration derivation at `:31-42`; nothing is
hardcoded (C-1).

### Spec edits

Apply top-down; the §D anchors below are pre-edit coordinates, so after the
REQ-078 and §9.4 edits locate the §D rows by group number, not by line.

- **REQ-078 body** (`:529-535`):
  "The specification SHALL include a feature taxonomy appendix (§D) that lists
  every tool and every §4 REQ grouped by thematic feature area, with each area's
  primary REQ set and verification gate. The taxonomy SHALL be exhaustive:
  every tool and every §4 REQ SHALL appear in exactly one feature area's own
  list, and a group that restates the full tool set as a cross-cutting concern
  SHALL use a non-name placeholder rather than naming them. Each area's
  verification gate SHALL equal the union of the gates its primary REQs declare
  in the REQ manifest. The client-facing README SHALL link to the taxonomy."
  Counts: 4 sentences, 6 SHALL clauses, one paragraph, ~610 characters, no
  backticks, no list — inside Appendix B's limits. The existing `_Check:_ G3`
  line at `:535` is **retained** unchanged; the counts cover the prose body
  only, and `validate-spec`'s missing-`_Check:` error stays satisfied.
- **§9.4 bullet** after the manifest bullet (`:1157`): "The feature taxonomy
  lists every tool and every §4 REQ exactly once, and each area's gate column
  equals the union of its primary REQs' manifest gates".
- **§D Gate cells** (groups 2, 5, 6, 7): `G0, G1, G3`; `G1, G3`;
  `G0, G1, G3`; `G1, G3`. Groups 1, 3, 4, 8, 9 already match.
- **§D Notes** gains one bullet after `:1835` (explanatory): a Tools cell that
  begins with `(all 7 tools` or reads `(no tools)` restates tools as a
  cross-cutting concern; the normative requirement is in REQ-078.
- **README.md** `:216-219`: append, after line 219, "Each tool and requirement
  has exactly one home there, and each area's gate column matches its
  requirements' declared gates." This is the non-whitespace diff the
  spec→README binding requires.
- **§D intro** (`:1809`): the sentence promises an "also governs" column that the
  five-column table does not have; delete that clause while the appendix is
  being corrected (not gate-visible, but the edit set is its natural home).

### Fixtures (`src/lib/feature-taxonomy.test.ts`)

Keep the inline `SPEC_TAXONOMY` and its README tests unchanged. The new suite
reads the live spec once, like `scripts/lib/security-model.test.ts:13`:
`readFileSync(join(import.meta.dirname, "../../infobroker.md"), "utf-8")`.
The checker's two list arguments are derived **once from the unmutated live
spec, before any mutation**, and reused for every case:

```ts
const LIVE = readFileSync(join(import.meta.dirname, "../../infobroker.md"), "utf-8");
const toolSlugs = parseFeatureTaxonomy(LIVE).flatMap((row) => row.tools);
const reqIds = [...parseManifestGates(LIVE).keys()];
```

Never re-derive them from the mutated text (fixture 6 deletes a §9.5 row, so a
post-mutation derivation would shrink `reqIds` and suppress the finding it is
meant to assert). Each fixture asserts the tokens it will change are present
(and the gate premise it relies on), then mutates:

| # | Mutation (post-T2 live text) | Expected finding(s) |
|---|---|---|
| 1 | none | `[]` |
| 2 | add `REQ-003` to group 2's REQ cell; assert REQ-003's gates ⊆ group 2's union | duplicate REQ-003 only |
| 3 | add `` `inspect_providers` `` to group 1's Tools cell | duplicate tool only |
| 4 | set group 6's Gate cell to `G0` | group 6 gate mismatch only |
| 5 | add `REQ-125` to group 8's REQ cell and set group 8's Gate to `G1, G3`; assert REQ-125's gates = {G1, G3} | duplicate REQ-125 only |
| 6 | delete REQ-125's §9.5 row and set group 7's Gate to `G3`; assert every other group-7 REQ is G3 | `declares no gate` for REQ-125 only |
| 7 | reverse group 9's Gate to `G3, G1, G0` | `[]` (canonicalisation case) |
| 8 | duplicate group 3's whole row | `group 3 appears more than once` only (early return) |
| 9 | empty REQ-125's §9.5 gate cell **and** set group 7's Gate to `G3` | `declares no gate` for REQ-125 only (empty-cell variant) |
| 10 | insert `\| 10 \| Empty \| (no tools) \| \| G1 \|` after the group 9 row | group 10 gate mismatch to `[]` only |

Eight negative fixtures, one canonicalisation fixture (7), and one pass case
(1). Fixture 6 uses the absent-row variant; fixture 9 the empty-cell variant;
fixture 10 the no-REQs row. Each negative test asserts the exact finding array
(one element); fixtures 1 and 7 assert `[]`. Every fixture asserts its premise
tokens before mutating, so a spec edit that invalidates a premise turns the
fixture red instead of silently changing its meaning.

**Duplicate-message ordering.** `toolSlugs`/`reqIds` are iterated in the order
given; rows are scanned in file order. For a token found in more than one row,
the message is emitted once, anchored to the **first** row (that row's group
number and name are N), and names the **second** row as M. Fixtures 2, 3, and 5
therefore expect exactly one string, e.g. `Feature taxonomy (§D) group 1
'Core Retrieval': REQ-003 also appears in group 2 — exactly one home required`
for fixture 2.

### Error-gate dry run (T6)

### Error-gate dry run (T6)

With the checker implemented and the spec already corrected (T2), run it against
the saved pre-edit copy. Write the probe to a file (so the import resolves from
the repo root) rather than inline:

```sh
cp infobroker.md /tmp/opencode/pre-edit-spec-r9.md   # in T2, before the edits

cat > /tmp/opencode/probe-r9.ts <<'EOF'
import { readFileSync } from "node:fs";
import { checkFeatureTaxonomyCoverage } from "/home/fluke/Infobroker/src/lib/feature-taxonomy.ts";
const spec = readFileSync("/tmp/opencode/pre-edit-spec-r9.md", "utf8");
const index = readFileSync("/home/fluke/Infobroker/src/index.ts", "utf8");
const tools = [...index.matchAll(/(?:server\.registerTool|instrumentTool)\(\s*"infobroker_([a-z0-9_]+)"/g)].map((m) => m[1]);
const s4 = spec.slice(spec.indexOf("## §4 Requirements"), spec.indexOf("## §5 Build Process"));
// Same header split as scripts/validate-spec.ts:158-170.
const reqs = [...s4.matchAll(/\*\*REQ-(\d{3}[a-z]?)\b[^*]*\*\*\n?/g)].map((m) => `REQ-${m[1]}`);
if (reqs.length !== 142) throw new Error(`probe scope: ${reqs.length} ids, expected 142`);
if (tools.length !== 7) throw new Error(`probe scope: ${tools.length} tools, expected 7`);
for (const f of checkFeatureTaxonomyCoverage(spec, tools, reqs)) console.log(f);
EOF
npx tsx /tmp/opencode/probe-r9.ts
```

Expected: exactly four gate-mismatch messages (groups 2, 5, 6, 7) and nothing
else. The probe re-derives tools and REQ ids from the saved copy because
`deriveToolSlugs` is module-local to `validate-spec`; it hardcodes nothing, and
its `reqs` regex is the production header split. A `missing <REQ>` line means
the probe's scope assertion is wrong, not that the checker is over-reaching:
fix the probe and re-run (recorded in `tasks.md`), do not stop the increment.

## Done bar

**Done bar:** F-R9-A-1 and F-R9-C-1 each read `**Resolved 2026-11-13**` with
file:line evidence, and:

1. `src/clause-coverage.test.ts` proves a 3-branch REQ with 2 tags fails, with
   3 tags passes, and a 4-branch REQ with 3 tags fails; the red-before
   transcript (T3) is in `tasks.md`.
2. `src/lib/feature-taxonomy.test.ts` passes the live-spec case with zero
   findings and each of fixtures 2–10 produces exactly its listed finding.
3. The dry run (T6) against the saved pre-edit copy reports exactly the four
   group Gate mismatches and nothing else; `npm run validate-spec` is exit 0 on
   the corrected tree (T7).
4. `npm run typecheck`, `npm run typecheck:scripts`,
   `npx vitest run src/clause-coverage.test.ts src/lib/feature-taxonomy.test.ts`,
   `npm run validate-spec`, `npm run validate-readme`, and
   `npm run check-script-discipline` are green.
5. `ROADMAP.md` no longer carries § R9 traceability and taxonomy gate strength,
   with `check-roadmap` green; `worklist.md:527`, `:529`, `:882`, `:886` carry
   the resolution.
6. `README.md` carries the taxonomy sentence, `CHANGELOG.md` one new
   `## 2026.11.11 —` heading above `:3`, and `DECISIONS.md` `D-114`.
7. `npm run check` is green on the tree that carries the AAR's terminal token;
   the exit status is written into `tasks.md`/`aar.md`, `check-loop-artifacts`
   and `check-roadmap` re-run, and `npm run check:fast` passes on the final
   committed tree.
8. The AAR ends `LOOP PAUSED` with the review cap recorded.

## Review-loop cap

One cold pass at standard depth plus at most one targeted re-review of a failed
stage, with the user's explicit authorization extending it to two stage-5
re-audits. Stage 5 returned NOT READY on revision 3 (three blockers); revision 4
applied that list and the stage-4 findings; the first re-audit returned NOT
READY on revision 4 (two blockers); revision 5 applied that list; the
user-authorized third audit returned NOT READY on revision 5 (two clarity
blockers about fixture-input provenance and duplicate-message ordering); revision
6 states both. No fourth audit runs: the residual risk is that revision 6's
documentary fixes were not independently re-read, and the AAR records the plan
gate's disposition.

## Phases and steps

### Phase 0 — Scaffold

- **T0.** Create this directory with `plan.md`, `tasks.md`, `aar.md` (seeded
  `LOOP OPEN`), and `evidence/`.
- **T1.** Record the baseline in `tasks.md` (status numbers, check exit status
  and wall time, predicate reads).

### Phase 1 — Spec and README (commit 1)

- **T2.** Copy the pre-edit spec to `/tmp/opencode/pre-edit-spec-r9.md`, then
  apply the REQ-078 body, §9.4 bullet, four §D Gate cells, §D Notes bullet, and
  the README sentence. `npm run validate-spec` → exit 0 (the old inline gate
  ignores the Gate column); `npm run validate-readme` → exit 0. **Commit 1**
  (`docs(spec)`).

### Phase 2 — Clause guard (commit 2)

- **T3.** Add the per-branch fixtures and run them against the **unchanged**
  `src/clause-coverage.ts`: the 3-branch case must fail. Record the red
  transcript.
- **T4.** Change the threshold and comment, apply the exact new message, re-run
  the file → green; `npm run validate-spec` → exit 0.
- **T5.** `npm run typecheck` → green. **Commit 2** (`fix(clause-coverage)`).

### Phase 3 — Taxonomy (commit 3)

- **T6.** Add `parseFeatureTaxonomy`, `parseManifestGates`, and
  `checkFeatureTaxonomyCoverage`; run the dry-run command above against the
  saved copy → exactly four messages. Record all four.
- **T7.** Wire `scripts/validate-spec.ts` (import + call, delete the inline
  function). `npm run validate-spec` → exit 0; `npm run validate-readme` → exit
  0.
- **T8.** Add the ten fixtures (pass, canonicalisation, eight negative); run the
  test file → green.
- **T9.** `npx vitest run src/clause-coverage.test.ts src/lib/feature-taxonomy.test.ts`,
  `npm run typecheck`, `npm run typecheck:scripts`,
  `npm run check-script-discipline` → green. **Commit 3** (`fix(taxonomy-gate)`).

### Phase 4 — Bookkeeping (commits 4–7)

- **T10.** `worklist.md` surface rows `:527`/`:529` and register rows
  `:882`/`:886` → `**Resolved 2026-11-13**`. **Commit 4.**
- **T11.** `DECISIONS.md` `D-114`. **Commit 5.** `CHANGELOG.md` new top section.
  **Commit 6.**
- **T12.** Remove the roadmap section; `npm run check-roadmap` → green.
  **Commit 7.**

### Phase 5 — Gates and close (commit 8)

- **T13.** `npm run check-roadmap`, `npm run version-sync`, `npm run test`,
  `npm run check-loop-artifacts`, `npm run check-gate-coverage`.
- **T14.** Write `aar.md` with dispositions and the terminal token;
  `npm run session:close`.
- **T15.** `npm run check` on the complete tree; record the exit status in
  `tasks.md`/`aar.md`; re-run `check-loop-artifacts` and `check-roadmap`.
- **T16.** **Commit 8** (`docs(plans)`) with this directory, `aar.md`, and
  `evidence/`.
- **T17.** `npm run check:fast` on the committed tree; on failure, amend commit
  8 after the fix.

## Commit series

Eight commits, each `typecheck`-clean, cut in this order (the AGENTS bucket
order; the split exceeds five buckets, so the grouping is printed here).

1. `docs(spec)`: REQ-078, §9.4 bullet, four §D cells, Notes bullet, README
   sentence (T2). Gate: `validate-spec`, `validate-readme`, `version-sync`.
2. `fix(clause-coverage)`: `src/clause-coverage.ts` + test (T3–T5). Gate: the
   file's vitest run, `typecheck`, `validate-spec`.
3. `fix(taxonomy-gate)`: `src/lib/feature-taxonomy.ts` + test and the
   `validate-spec.ts` wiring (T6–T9). Gate: the two vitest files, `typecheck`,
   `typecheck:scripts`, `validate-spec`, `validate-readme`,
   `check-script-discipline`.
4. `docs(plans)`: the four `worklist.md` rows (T10).
5. `docs(decisions)`: `D-114` (T11).
6. `docs(changelog)`: the CHANGELOG section (T11); `version-sync`.
7. `docs(roadmap)`: roadmap removal (T12); `check-roadmap`, `validate-spec`.
8. `docs(plans)`: this increment's directory, AAR, and evidence (T14–T16);
   `check-loop-artifacts`.

Commits 1–3 are reversible as a set: reverting 3 leaves the spec cells
corrected but unasserted (harmless), and reverting 1 makes commit 3 red.

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| 3-branch REQ fails on 2 tags | `vitest run src/clause-coverage.test.ts` | pure input/output; old code returns `null` (`:133`) |
| live tree needs no tag changes | `validate-spec` | probe: 4 multi-branch REQs, all `tags >= branches`, 0 failures |
| tool appears once, Tools cell only | lib fixtures | probe: 7 slugs, one backticked Tools cell each; groups 6–9 placeholders name none |
| REQ appears once | lib fixtures | probe: 142 REQs, 0 duplicates, 0 missing |
| gate column equals union | lib fixtures, `validate-spec` | probe: 4 rows drift with named suppliers, 5 match |
| canonical order tolerated | lib fixture 7 | set comparison after `G0<G1<G2<G3` sort |
| README reconciliation unchanged | `validate-readme` | projection keeps the to-EOF slice, empty-name filter, and dedupe (`:32-47`) |
| spec→README binding | commit 1 diff | REQ-078 body and README sentence in one commit |
| whole-tree health | `npm run check` after the AAR | 22 gates sequential (`scripts/lib/gate-manifest.ts`); a failure means fix, rewrite the token, re-run |

## Edge cases and rollback

- **A REQ is added to two groups later.** The duplicate message names the REQ
  and both groups.
- **A group number is duplicated.** Check 2 returns after the first finding;
  fixture 8 pins it.
- **A group's Gate cell is reordered.** No finding (canonical set compare).
- **§9.5 gains a gate for a §D REQ.** The union check forces the §D cell to
  follow in the same commit.
- **A §D REQ is absent from §9.5, or its cell is empty.** Both report
  `declares no gate`; fixtures 6 and 9 cover the two variants.
- **The §9.5 heading is absent.** `parseManifestGates` yields an empty map and
  the checker reports one `REQ manifest (§9.5) not found`, not 142 gate
  findings.
- **A future REQ trips the clause rule on a non-branch aside.** C-7: narrow the
  detector with a fixture.
- **The §D table gains a footnote row.** The parser ignores non-integer first
  cells.
- **Rollback.** Revert commits 1–3 as a set.

## Conditions to verify during execution

- **C-1** — the production call site derives tools from live registration and
  REQs from `reqBodies`; hardcoding either is wrong.
- **C-2** — `deriveFeatureAreas` keeps the to-EOF slice, non-empty-name filter,
  and dedupe-by-group; `validate-readme` stays green with no edit.
- **C-3** — the per-branch rule applies to `orBranches` only; the conditional
  limb stays "at least one tag".
- **C-4** — no runtime production behaviour change; both edited modules are
  gate code.
- **C-5** — the dry run reports exactly four group Gate messages; a fifth gate
  or duplicate finding means the checker over-reaches and the increment stops.
  A `missing <REQ>` line is a probe-scope error (the probe asserts 142 ids) —
  fix the probe and re-run.
- **C-6** — the review cap: one cold pass, one stage-5 re-audit.
- **C-7** — if the stricter clause rule demands a tag for a non-branch aside,
  narrow `OR_ENUM_RE`/`detectProseClassLists` in the same commit with a
  fixture; never invent a tag.
- **C-8** — the REQ-078 body edit and the README sentence ship in commit 1.

## Unknowns

- Whether `check-gate-coverage` treats the existing `src/lib/feature-taxonomy.ts`
  citation differently once the module grows — it already carries
  `@implements REQ-078`; T13 confirms.
- Whether `scripts/validate-spec.ts` type-checks with the new call site —
  `reqBodies` is in scope at `:559`; T9 confirms.
- Whether any other gate reads the §D Gate column — `grep -rn "Feature
  taxonomy" scripts src` returns only `validate-spec.ts` and
  `feature-taxonomy.ts`; T9 and T13 confirm.
- The sweep register's dated rows may carry anchors that shifted since the R9
  chunk closed; T10 re-reads the four cited lines before editing.

## Evidence

- Plan artifact: stamped copy under `~/.local/state/opencode/plans/<repo-key>/`
  (sha256 on the stamp); cold pass under `plan.cold/` with `report.md` hashed
  into the stamp.
- Declared targets: the eleven file paths in the Blast radius table and the
  increment directory (its twelfth row).
- Measurement: `evidence/measure-r9.ts` → `evidence/measure-r9.out` (committed;
  read-only, not a gate; outside both `tsconfig` projects).
- Baseline numbers and check exit status: `tasks.md` T1.
- `D-114` is the next free decision id.
