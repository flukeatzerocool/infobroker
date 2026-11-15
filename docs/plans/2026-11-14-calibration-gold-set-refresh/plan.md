# Plan — Calibration gold-set refresh

**Status:** revision 5 (cold pass: Stage 1 3 Blockers / 12 Majors / 7 Nits; Stage 2 faithful; Stage 3 structural 2 Blockers / 8 Majors / 3 Nits and design 8 Majors / 9 Nits; Stage 4 2 Majors / 5 Nits; Stage 5 NO-GO with 5 Blockers, then an authorized re-audit — past the read cap — FAILED with 3 Blockers; all findings are resolved in this revision; Stage 5 has failed twice, so the cold pass is escalated rather than re-run a third time) · **Date:** 2026-11-14 · **Depth:** standard (one fixture, two source modules, one script loader, two test files, one spec prose section, bookkeeping; reversible edits, no destructive, remote, or schema-migration surface)

**Review independence:** self pass complete; one cold pass run to completion (5 of 5 stages) and one authorized Stage 5 re-audit past the read cap, both FAILED at Stage 5; record in `plan.cold/`. Revision 5 is not cold-certified.

**Review cap:** 2 passes (1 self + 1 cold); used 2. A further cold dispatch requires user authorization (D-117).

**Rollback cost:** 1 (a reversible edit). C1 is one unit (fixture + `CalibrationEntry` + `parseGoldSet` + loader + audit test + fixture README); C2/C3 revert as a pair; C4 reverts alone. Every `CalibrationEntry` field the parser requires stays optional in the type so existing call sites compile. No state format, credential, dependency, or config-shape change.

**Roadmap item:** `ROADMAP.md:17-28` § Calibration gold-set refresh (removed when this increment closes; both limbs of its close condition addressed in §Roadmap close condition).

**Predecessor:** `HEAD edd0076`; version `2026.11.14` (latest tag `v2026.11.07`); 259 unpushed commits, oldest 5.0 d.

**Done bar:** C1–C4 land and `npm run check` passes on the final tree (all gates); `npx tsx scripts/calibrate-confidence.ts` runs before and after C1 are both recorded in `aar.md`, and the after-run curve holds at least two entries in every reliability band with both outcomes represented in the `0.9-1.0` band; the excerpt measurement (C2) is asserted by a test and the same literals appear in `infobroker.md` §8.2 (C3); the roadmap section is removed with both limbs stated as met; `CHANGELOG.md` carries the entry.

## Why this section

`ROADMAP.md` § Calibration gold-set refresh is the only open roadmap section
and its trigger holds: the next change to `test-fixtures/calibration/gold.json`
is this increment. The section was written by the
`2026-11-14-corroboration-confidence-contract` increment (C4 changed the
calibration tool from the raw ladder to the adjusted value) and it names two
limbs:

1. **Labels.** The entries' `correct` flags were stipulated against the
   pre-damping ladder. After C4 the `0.9-1.0` reliability band holds two
   entries instead of five because `0.9 × (1 − 0.25 × (1 − mean))` and the
   secondary-only cap move most `0.9` rows down a band. Nothing in the fixture
   records *what a label means* or *what settles it*, so the label cannot be
   audited against the reported number.
2. **Excerpt trade.** `textSimilarity` divides by the larger shingle set
   (`src/source-family.ts:75-83`), so a genuine republication seen through a
   short excerpt scores low and may split into two families. §8.2 states the
   direction of the trade but records no measured consequence.

## Baseline (verified this session)

- `git log -1` → `edd0076`; `git status --porcelain` clean.
- `npm run status` → version `2026.11.14` (tag `v2026.11.07`), **259 unpushed
  commits, oldest 5.0 d**, 1 open roadmap item, last pipeline run 2026-11-07.
- `npm run check` → **PASS** (full, 22 gates, 163.0 s, run record for
  `edd00765471c`). One pre-existing warning: `check-loop-artifacts` reports
  `2026-11-10-r6-encryption-capacity-remediation` has no `**Done bar:**` line.
  The gate reads the working tree, and it is inside `check:fast`.
- `npx tsx scripts/calibrate-confidence.ts` on the committed gold set:
  `entries: 12`, `brier_score: 0.1865`, `0.0-0.3 count=3 mean=0.28 observed=0.33`,
  `0.3-0.5 count=0`, `0.5-0.7 count=4 mean=0.66 observed=0.75`,
  `0.7-0.9 count=3 mean=0.88 observed=0.67`, `0.9-1.0 count=2 mean=0.95
  observed=1.00` (the two adjusted values are `0.9` and `0.99`; the displayed
  mean rounds up).
- `test-fixtures/calibration/gold.json` is `version: 1`, 12 anonymous entries
  (`c01`–`c12`), fields `{id, confidence, correct, sources}` only.
- **Reliability bands** are half-open (`lo` inclusive, `hi` exclusive) at
  `[0.0,0.3)`, `[0.3,0.5)`, `[0.5,0.7)`, `[0.7,0.9)`, `[0.9,1.01)`
  (`src/calibration.ts:94-114`). A reported value of exactly `0.3000`
  therefore belongs to `0.3-0.5`, and `0.7000` belongs to `0.7-0.9`.
- **The ladder rungs** are the §8.2 table rows: `0.0` (no source), `0.3`
  (one), `0.7` (two independent), `0.9` (three or four), `1.0` (five or
  more). There is no `0.5` rung. `applyAuthorityWeight` (`src/calibration.ts:41-45`)
  damps a rung by `0.25 × (1 − mean)`; `capConfidence` (`:67-76`) clamps a
  finding whose sources are all secondary (`web_search`, `news`, `semantic`,
  `synthesis`, no `original_source`) to `0.7`.
- **Ladder/rung inconsistency in v1.** `c09` and `c12` carry `confidence: 0.7`
  with three source labels; under the fixture's own one-label-per-family
  premise, three families is the `0.9` rung. `buildCalibrationReport` trusts
  the stated rung as the predictor input (`src/calibration.ts:147-160`), so the
  refresh corrects both rungs to `0.9` (C1).
- Measured this session with the real `assignSourceFamilies` and
  `computeConfidence`, shipped weights, default threshold `0.9`:
  - a 43-word article against a 14-word excerpt of it, same headline, on
    different registrable domains (`outlet-a.example`, `syndicator-b.example`)
    scores `textSimilarity = 0.3721` and splits into **2** families; body-only
    is `0.2703`;
  - one `web_search` family reports `0.2775`; two `web_search` families report
    `0.6475`;
  - a `0.3`-rung row whose single source type has weight `1.0` reports exactly
    `0.3000`.

## Decisions

**D1 — A label is the truth of an explicitly documented claim.** Every entry
gains `claim`, `label_basis`, and (for `documented` rows) `truth_sources`;
`correct` is the truth of the claim, settled by a cited source, not by the
reported confidence. Literal derivation of a label from the post-adjustment
curve is circular — a calibration set cannot use its own predictor as ground
truth — so the roadmap's limb is met by re-deriving every label from a
documented claim and then re-running the curve. `label_basis` is a union of:

- `documented` — a real-world claim whose truth `truth_sources` settles; all
  18 rows in this refresh are `documented`;
- `constructed` — a mechanics-only row whose outcome is stipulated (allowed,
  not used here);
- `observed` — a claim whose outcome came from a recorded verification run
  (reserved; no such record exists in the repo).

`truth_sources` is required and non-empty on `documented`/`observed`, and
absent on `constructed`; `truth_note` is required on `constructed` and
optional elsewhere. The fixture README states the axis this does **not** fix:
a `documented` row's `confidence` and `sources` are still stipulated, so the
Brier score is a mechanics value until `observed` rows exist. Rejected:
(a) keeping anonymous synthetic labels and only re-running — the audit limb is
unmet; (b) labelling rows from their reported band — circular, and the defect
the roadmap names.

**D2 — `0.3-0.5` is reachable at exactly `0.3000` and the refresh populates
it.** A `0.3`-rung row whose single family has weight `1.0` (`academic`,
`encyclopedia`, `archive`, `structured_fact`, `definition`, or `location`)
reports exactly `0.3000`, which the half-open bands place in `0.3-0.5`. Every
v1 `0.3` row uses a damped type (`0.2775`–`0.2925`), which is why the band is
empty. The refresh adds two `0.3`-rung weight-`1.0` rows. Rejected:
(a) declaring the gap structural — it is not; (b) adding a raw value that is
not a ladder rung; (c) widening the reliability buckets — a change to a
tested reporting contract for a cosmetic reason.

**D3 — The excerpt measurement is a test plus one spec sentence, not a new
gate.** The family split is asserted in `src/source-family.test.ts` (REQ-121);
the confidence consequence is asserted in `src/calibration.test.ts` (where the
shipped weight map lives) so neither test file duplicates the other's
constants. §8.2 states the same literals. Rejected: a package script or gate —
F-R5-B-7 (no calibration gate) is `Closed-P3`, the measurement is deterministic
and cheap, and a gate would add maintenance surface for a value that changes
only with the similarity algorithm.

**D4 — No REQ body changes.** The gold-set format is owned by the fixture
README and enforced by `parseGoldSet`; REQ-123 requires a deterministic gold
set and a reported Brier score and curve, all of which still hold. REQ-130
keeps the retrieval benchmark separate and is untouched. A grep of
`infobroker.md` for `REQ-121`, `REQ-123`, and `REQ-130` shows no body that
binds the gold-set format or the report shape. The loader, not the README, is
the normative surface; the README documents what the loader enforces.

**D5 — The spec sentence and the family test are separate commits, and C2/C3
revert together.** The standing buckets put a test change in the source/test
commit and spec text in `docs(spec)`. The spec sentence cites the test's
literals, so dropping C2 alone would leave unbacked prose: the pair is one
revert unit.

**D6 — Source types and rungs are validated, not assumed.** `parseGoldSet`
rejects a `sources` value that is not a configured authority-weight key (a typo
would otherwise take the `?? 1.0` fallback and silently move a row's band) and
rejects a `confidence` that does not match the rung implied by its family
count. The rung rule is what fixes `c09`/`c12`.

## Changes

### C1 — Ground the labels and re-derive the curve (M) — revert unit `{C1}`

`src/calibration.ts`: export a narrowed `ValidatedGoldEntry` type
(`claim: string`, `label_basis: GoldLabelBasis`, `truth_sources?: string[]`,
`truth_note?: string`, plus the existing required fields), have `parseGoldSet`
return `ValidatedGoldEntry[]`, and keep `buildCalibrationReport`'s parameter as
`CalibrationEntry[]` (which `ValidatedGoldEntry` extends). Then extend
`CalibrationEntry` with **optional**
`claim?: string`, `label_basis?: "documented" | "constructed" | "observed"`,
`truth_sources?: string[]`, and `truth_note?: string`; optional keeps the
existing `buildCalibrationReport` call sites in `src/calibration.test.ts:60-73`
compiling. `parseGoldSet` is the enforcing boundary and returns entries whose
validated fields are present. The report builder still reads only `id`,
`confidence`, `correct`, and `sources`. Add and
export `parseGoldSet(raw: unknown, weights: Record<string, number>):
CalibrationEntry[]`, which validates:

- `version === 2`, a non-empty `entries` array;
- `id` a non-empty unique string;
- `claim` a non-empty string;
- `confidence` one of `0.3, 0.7, 0.9, 1.0` **and** equal to the rung implied
  by `sources.length` (`1→0.3`, `2→0.7`, `3–4→0.9`, `5+→1.0`; the `0.0` rung is
  unreachable because `sources` is non-empty, and the parser does not accept
  it);
- `sources` a non-empty array of strings, each a key of `weights`, with no
  repeated type (one label per family — the report's mean-equality premise);
- `correct` a boolean;
- the per-basis `truth_sources`/`truth_note` rules above.

It throws `Error` with a message naming the offending entry; the script catches
and exits 1 with the existing message shape.

`scripts/calibrate-confidence.ts`: call `loadShippedSettings()` **before**
the gold load (it currently runs after `loadGold`, lines 91-92), then replace
the `loadGold(gold)` call with exactly:

```ts
const { weights, options } = loadShippedSettings();
const parsed: unknown = JSON.parse(readFileSync(gold, "utf-8"));
const entries = parseGoldSet(parsed, weights);
```

The file read and `JSON.parse` stay at the call site; `parseGoldSet` takes the
parsed value. Output is unchanged (aggregate lines plus one `id raw adjusted`
line per entry).

`test-fixtures/calibration/gold.json` → `version: 2`, 18 entries, the `note`
updated to describe the v2 fields. Each entry states a real proposition, a
`truth_sources` URL set that settles it, and `label_basis: "documented"`. The
12 existing rows keep their `sources` and their v1 `confidence` except `c09`
and `c12`, whose rung is corrected to `0.9` (D6). Six rows are added:

- `n0`: `0.9`-rung, `correct: true`, `sources: ["academic","encyclopedia","archive"]`
  → `0.9000` (top band), so the top band's correct outcome does not depend on
  `c04` or `c07` surviving re-derivation;
- `n1`: `0.9`-rung, `correct: false`, same source types → `0.9000` (top band).
  The claim is one that was accepted on primary-looking evidence and later
  retracted; `truth_sources` cites the retraction.
- `n2`: `0.7`-rung, `correct: false`, `sources: ["web_search","news"]`
  → `0.6563` (`0.5-0.7`; the `0.7` cap does not bind).
- `n3`: `0.3`-rung, `correct: true`, `sources: ["web_search"]` → `0.2775`
  (`0.0-0.3`).
- `n4`, `n5`: `0.3`-rung, `sources: ["academic"]` and `["structured_fact"]`,
  one correct and one incorrect, each `0.3000` (`0.3-0.5`, D2).

Claim wording and the twelve `c01`–`c12` propositions are deferred authoring
work: each existing row keeps its `sources` and its (corrected) `confidence`,
and gains one documented claim whose truth matches the row's label. The six new
rows above have fixed source types, rungs, and target bands. No label is chosen
to make a band look better than its cited source supports.

Expected after-counts: `0.0-0.3` 4 (`c03`, `c06`, `c10`, `n3`), `0.3-0.5` 2
(`n4`, `n5`), `0.5-0.7` 3 (`c02`, `c05`, `n2`), `0.7-0.9` 5 (`c01`, `c08`,
`c09`, `c11`, `c12`), `0.9-1.0` 4 (`c04`, `c07`, `n0`, `n1`). The top band holds
`n0` (correct) and `n1` (incorrect) whatever the re-derivation does to `c04`
and `c07`; if both survive as correct the observed rate is `3 of 4`.

`src/calibration.test.ts`: hoist `SHIPPED_WEIGHTS` (currently inside the second
`describe`, lines 39-55) to module scope. Add a case that reads the fixture
with `readFileSync(join(import.meta.dirname, "..", "test-fixtures",
"calibration", "gold.json"), "utf-8")` — the `ROOT` pattern of
`src/retrieval-benchmark.test.ts:13` — and asserts:

- `entries === 18`;
- every entry has a non-empty `claim`, a `label_basis`, and a non-empty
  `truth_sources`;
- all five bands have `count >= 2`;
- the `0.9-1.0` band contains at least one `correct` and one `incorrect` row;
- `brier_score` is `toBeCloseTo(<literal from the final run>, 4)` — a
  stability lock, not an independent check; the verification is that the run
  reproduces it.

Also add a `computeConfidence` case pinning one `web_search` family at
`0.2775` (the two-family `0.6475` is already pinned at line 96); this is the
confidence consequence the §8.2 sentence cites.

Add a drift guard in the same file, reading the shipped config with
`JSON.parse(readFileSync(join(import.meta.dirname, "..", "config.json"), "utf-8"))`
— the same path the script uses; the test deliberately ignores
`INFOBROKER_CONFIG`, matching the tool's shipped-ladder determinism. For every
source type the fixture uses, `corroboration.authority_weights` has that key
and the same value as `SHIPPED_WEIGHTS` (the projection, not a whole-map
`toEqual`, so an unused configured key does not fail the suite), **and** its
`corroboration.calibration` block equals `{ enabled: true, secondary_only_cap:
0.7 }`; a weight or cap edit that moves a row then fails the suite instead of
passing against stale hardcoded constants. Rewrite the existing comment at
`src/calibration.test.ts:40-42` so it no longer claims the file never reads
`config.json`; the assertion stays hardcoded and the drift guard is the
separate reconciliation.

Add `parseGoldSet` cases: the committed fixture parses; a missing `claim`, a
`label_basis: "bogus"`, a duplicate `id`, an unknown source type, and a rung
that disagrees with `sources.length` each throw; a `constructed` row without
`truth_note` throws and one carrying `truth_sources` throws; an `observed` row
without `truth_sources` throws; a thrown message names the offending `id`.
The audit case's data flow is explicit:
`const entries = parseGoldSet(JSON.parse(readFileSync(fixturePath, "utf-8")),
SHIPPED_WEIGHTS); const report = buildCalibrationReport(entries,
SHIPPED_WEIGHTS, { enabled: true, secondaryOnlyCap: 0.7 });` where
`fixturePath = join(import.meta.dirname, "..", "test-fixtures", "calibration",
"gold.json")`. Band counts come from `report.reliability` (do not re-derive the
bounds); the top band's mixed outcome comes from `report.rows` filtered by
`row.adjusted >= 0.9` and inspected for `row.correct`.

`test-fixtures/calibration/README.md`: describe the v2 fields, the label-basis
rule, the `documented`-vs-`observed` provenance gap, the rung rule, and why a
`0.3`-rung weight-`1.0` row lands in `0.3-0.5`.

### C2 — Pin the excerpt measurement (S) — revert pair `{C2, C3}`

`src/source-family.test.ts`, in the `REQ-121` block: a case
"a genuine republication seen through a short excerpt splits into two
families", with the text fixed in the test:

- article (43 words): `The committee released its findings on Tuesday after a
  year-long inquiry into procurement practices across three agencies and two
  contractors, concluding that competitive bidding had been routinely
  circumvented and that senior officials had approved at least four contracts
  without a documented tender process.`
- excerpt (14 words): `The committee released its findings on Tuesday after a
  year-long inquiry into procurement practices.`
- shared title: `Procurement inquiry finds competitive bidding bypassed`;
- URLs `https://outlet-a.example/story` and
  `https://syndicator-b.example/wire` — different registrable domains, because
  `assignSourceFamilies` unions on equal domain regardless of similarity
  (`src/source-family.ts:143`).

Assert `textSimilarity(title + " " + article, title + " " + excerpt)` is
`0.3721` (4 dp) — the same `title + " " + snippet` form `familyText` builds;
with the tokenizer's 3+-character filter and hyphen splitting the article
string is 46 tokens / 43 four-gram shingles and the excerpt string 19 / 16, so
`16 / 43 = 0.372093`. Call `assignSourceFamilies(pair, 0.9)` explicitly and
assert `familyCount === 2`. The comment cites §8.2 and says the split is
conservative for family counting at the cost of inflated confidence.



### C3 — State the measurement in the spec (S) — revert pair `{C2, C3}`

`infobroker.md` §8.2, after the existing truncated-republication trade
statement: one sentence recording that a 43-word article and a 14-word excerpt
of it, same headline, score `0.3721` and split into two families, so two
`web_search` results that split into two families report `0.6475` instead of
`0.2775`. The literals are exactly the C2 test values. No REQ body changes.

### C4 — Bookkeeping (S)

`CHANGELOG.md`: one entry under the current version describing the v2 gold set,
the documented label basis, the rung correction, the six added rows, the
populated `0.3-0.5` band, and the excerpt measurement, plus one sentence
stating both roadmap limbs as met. `ROADMAP.md`: remove the
section. `docs/plans/2026-11-14-calibration-gold-set-refresh/`: `tasks.md`, and
`aar.md` finalized with the before/after calibration runs, the three
invalid-input probe results, the excerpt measurement, the `**Review cap:** 2
passes; used 2` line, a sentence stating both roadmap limbs as met, and the
terminal token.

## Blast radius

| File | Change | Size | Gate |
|---|---|---|---|
| `test-fixtures/calibration/gold.json` | C1 — v2, 18 documented rows, `note` | M | `test` |
| `test-fixtures/calibration/README.md` | C1 — field docs, provenance gap, rung rule | S | — |
| `src/calibration.ts` | C1 — `CalibrationEntry` + `parseGoldSet` | M | `typecheck`, `test` |
| `scripts/calibrate-confidence.ts` | C1 — call `parseGoldSet` | S | `typecheck:scripts`, `check-script-discipline` |
| `src/calibration.test.ts` | C1 — hoist weights, audit case, parser cases, drift guard, `0.2775` literal | M | `test`, `check-gate-coverage` |
| `src/source-family.test.ts` | C2 — split measurement | S | `test`, `check-gate-coverage` |
| `infobroker.md` | C3 — §8.2 measured sentence | S | `validate-spec`, `validate-readme` |
| `CHANGELOG.md` | C4 | S | `version-sync` |
| `ROADMAP.md` | C4 — remove section | S | `check-roadmap`, `check-non-goals` |
| `docs/plans/2026-11-14-calibration-gold-set-refresh/*.md` | C4 | S | `check-loop-artifacts` |

## Commit order

Each commit is gated with `npm run check:fast`, which includes
`check-loop-artifacts`. Because that gate reads the working tree, `aar.md` is
seeded in Preconditions with `**Review cap:** 2 passes; used 2` and
`LOOP OPEN`, and finalized at C4; the seed must not claim `LOOP PAUSED`.

1. `fix(calibration): ground gold-set labels and re-derive the curve` — C1
   (`src/calibration.ts`, `scripts/calibrate-confidence.ts`, the fixture, its
   README, `src/calibration.test.ts`). The after-run is captured after the
   fixture is final and before the commit; the Brier literal is written into
   the test from that run. Gate: `npm run check:fast`.
2. `test(source-family): pin the truncated-republication measurement` — C2
   (`src/source-family.test.ts` only; the `0.2775` literal ships in commit 1).
   Gate: `npm run check:fast`.
3. `docs(spec): record the measured excerpt split in §8.2` — C3. Gate:
   `npm run check:fast`.
4. `docs(plans): close the calibration gold-set refresh` — C4, including the
   finalized `aar.md`. Gate: `npm run check:fast`.
5. Final tree: `npm run check` (full, all 22 gates).

## Verification

| Assertion | Before | After |
|---|---|---|
| `npx tsx scripts/calibrate-confidence.ts` runs on the fixture | green (`0.1865`) | green, new `toBeCloseTo` literal |
| Every entry states a claim, a label basis, and a truth source | **red** (no such fields) | green (C1 audit test) |
| Every band has ≥2 entries, and the top band has both outcomes | **red** (`0.3-0.5` has 0; `0.9-1.0` has 2, both correct) | green (C1 audit test; `n0` true and `n1` false guarantee the top band) |
| A 43-word article and its 14-word excerpt split into 2 families | **red** (no assertion of this pair) | green (C2 test) |
| One vs two `web_search` families report `0.2775` / `0.6475` | green (`0.6475` pinned; `0.2775` not) | green (C2 calibration case) |
| The §8.2 sentence carries the C2 literals | **red** (direction only) | green (C3 diff read against C2) |
| `parseGoldSet` rejects missing claim / bad basis / duplicate id / unknown type / wrong rung | **red** (no parser) | green (C1 parser cases) |
| Invalid gold input exits 1 through the script | **red** | green (three `--gold` probes recorded in `aar.md`) |
| All existing tests and gates | green | green |

## Roadmap close condition

The section closes when "labels and the curve are re-derived and the excerpt
case has a recorded measurement". C1 re-derives every label from a documented
claim, records the settling source, corrects the two inconsistent rungs, and
re-runs the curve with all five bands populated and both outcomes in the top
band. C2 pins the excerpt pair's similarity and split plus the confidence
consequence; C3 states the same literals in §8.2. Both limbs are met on that
evidence and the changelog entry says so. The literal reading of "against the
post-adjustment curve" is rejected in D1 as circular and replaced with
documented-claim re-derivation.

## Risks and edge cases

- **A re-derived label or rung changes the Brier score.** Expected. The plan
  pins the final value; the baseline value is recorded so the change is legible.
- **Documented claims need real, stable sources.** Each `truth_sources` URL is
  checked at authoring time; the test never fetches it, so determinism holds. A
  dead URL later breaks auditability, not the gate — the accepted cost of not
  adding a network check to the suite. This is the bulk of C1's authoring work:
  18 claims, one settled source set each.
- **Weights couple the fixture to `config.json`.** The audit test's drift guard
  compares the hardcoded map to `config.json`, so a weight edit that moves a
  row fails the suite rather than silently emptying a band. A deliberate weight
  change requires re-deriving the fixture bands in the same commit.
- **The audit test reads a repository fixture.** The `ROOT` pattern is the one
  `src/retrieval-benchmark.test.ts:13` uses; a moved fixture fails loudly.
- **The excerpt measurement depends on tokenization.** The test asserts the
  pair's literals; a tokenizer change that moves them updates the test and
  §8.2 in the same increment.
- **`check-gate-coverage` clause tags.** The C2 family test stays inside the
  existing `REQ-121` block and adds no tag; the confidence literals live under
  `@implements REQ-026a`/`REQ-123` in `src/calibration.test.ts`. The baseline is
  green with the current tag set, so no new tag is expected; if the gate
  demands one, add it in the same commit.
- **`check-loop-artifacts` reads the working tree.** Hence the seeded
  `aar.md` in Preconditions; do not run the full `check` before the seed
  exists, and do not seed `LOOP PAUSED`.

## Rollback

Revert C4 alone, then the C2+C3 pair, then C1, in that order. C2 alone is not a
revert unit because C3's prose cites its literals. No migration, no persistent
state, no published artifact.

## Evidence

- Plan targets verified to exist: `test-fixtures/calibration/gold.json`,
  `test-fixtures/calibration/README.md`, `scripts/calibrate-confidence.ts`,
  `src/calibration.ts`, `src/calibration.test.ts`, `src/source-family.ts`,
  `src/source-family.test.ts`, `infobroker.md`, `CHANGELOG.md`, `ROADMAP.md`.
- REQ surface: `grep -n "REQ-121\|REQ-123\|REQ-130" infobroker.md` resolves the
  three bodies at `infobroker.md:345,351,352`; none binds the gold-set format
  or the report shape. No spec fingerprint or generated artifact consumes
  §8.2 (`grep -rln fingerprint scripts/ src/` matches only
  `src/kb-handler-lock.test.ts`).
- Registers: the roadmap section has no cross-register row; the review
  worklist carries no calibration row (F-R5-B-3 and F-R5-B-6 are `Resolved`;
  F-R5-B-7 is `Closed-P3`), so removing the section needs no other register
  edit.
- `config.json:339-350` configures all eleven authority keys, including the
  nine types the fixture uses (`academic`, `encyclopedia`, `archive`,
  `structured_fact`, `news`, `web_search`, `semantic`, `synthesis`, `code`), so
  `parseGoldSet`'s key rule accepts every committed source label. A repo-wide grep excluding `node_modules`, `.git`, and `docs/` finds only
  `scripts/calibrate-confidence.ts`, the two fixture READMEs, `CHANGELOG.md`,
  and `ROADMAP.md` referencing the fixture or the tool; `debate-club/`, `docs/`,
  and CI were included in the same grep and show no consumer. The final full
  `check` runs `test-debate-club`, so the Arena covers the change even though
  `check:fast` does not.
- Arity probes run this session: `0.3` + weight-`1.0` type → `0.3000`
  (`0.3-0.5`); `0.7` + `web_search`,`news` → `0.6563`; `0.3` + `web_search` →
  `0.2775`; 43-word/14-word pair → `0.3721`, 2 families; `c09`/`c12` rung
  mismatch confirmed against `gold.json:13,16`.
- Preflight sidecar: `docs/plans/2026-11-14-calibration-gold-set-refresh/plan.evidence.json`,
  generated by `plan-gate preflight`.
