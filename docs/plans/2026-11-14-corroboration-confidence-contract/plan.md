# Plan — Corroboration confidence contract

**Status:** revision 7 (cold pass on revisions 1–6: Stage 1 FAILED; Stage 3 critics; Stage 1 re-audit; Stage 4 FAILED; Stage 5 NO-GO; Stage 4 and Stage 5 re-audits NO-GO; an authorised final Stage 5 NO-GO with 2 Blockers and 5 Majors — every finding through revision 6 is resolved here) · **Date:** 2026-11-14 · **Depth:** standard (three production modules, one spec prose surface, three test files, one script; reversible behavior edits, no destructive or publish surface)

**Review independence:** self pass complete; the cold pass ran five stages plus three re-audits and stopped at the repeated-stage rule. Revision 7 has not been read by a cold reviewer; the record is in `plan.cold/`.

**Review cap:** 2 passes (1 self + 1 cold); used 2 passes. The cold pass exhausted its internal prepare budget; a further dispatch requires user authorization (D-117).

**Rollback cost:** 1. One revert unit is `{C1, C4}` — C4's report builder calls the symbol C1 adds. `C2`, `C3`, and `C5` revert independently. No state format, credential, dependency, or schema-shape change.

**Roadmap item:** `ROADMAP.md:17-23` § Corroboration confidence contract (removed when this increment closes; both limbs of its close condition addressed in §Roadmap close condition)

**Predecessor:** `HEAD 04d4e2e`; version `2026.11.11` (latest tag `v2026.11.07`); 202 unpushed commits

**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md:755,756,788,789,790` (F-R5-B-8, F-R5-B-9, F-R5-G-2, F-R5-G-3, F-R5-G-4)

**Done bar:** C1–C5 land and `npm run check` passes on the final tree (all gates); every assertion in §Verification marked *(red)* fails before its change and passes after, and every *(green)* assertion still passes; the calibration output is recorded before and after C4 in `aar.md`; the roadmap section is removed with both limbs of its close condition stated and met; the five register rows are dispositioned; `CHANGELOG.md` carries the entry.

## Why this section

`ROADMAP.md` § Corroboration confidence contract is the first section in the
file, and `ROADMAP.md:6` orders sections "P0 first", so the top section is the
next increment. Its trigger has two limbs: "a calibration run reports a Brier
score or curve that diverges from the server's configured correction, or ... a
confidence tier is disputed." Both hold as of this session:

1. **A tier is disputed.** F-R5-B-9 is an open P2 row: the shipped
   `web_search: 0.7` weight turns the two-family base `0.7` into `0.49`.
   §8.2's table names `0.7` "Corroborated"; the agreement map classifies
   `0.49` as `red` (below its `0.5` floor). F-R5-B-8 disputes the family
   similarity metric. All five rows were re-read in the register and
   re-verified against the working tree this session (table below).
2. **The curve diverges.** `npx tsx scripts/calibrate-confidence.ts` on the
   committed gold set reports `brier_score: 0.1892` with the `0.9-1.0` band at
   `mean=0.92 observed=0.80` — a 0.12 overstatement at the tier the
   confirmation threshold depends on.

The five rows are one concern: the number `verify_claims` reports and what the
spec says that number means. C1 changes the number's derivation (including the
zero- and one-source paths, which currently bypass it), C2 changes which sources
contribute to it, C3 makes the prose describe the result, and C4 makes the
calibration run observe the same number.

**The secondary-only cap is in scope as prose and as a test premise, not as
behavior.** REQ-123 and `capConfidence` (`src/calibration.ts:34-43`) clamp any
finding whose sources are all `web_search`/`news`/`semantic`/`synthesis` with
no `original_source` to `secondary_only_cap` (`0.7`, shipped). Under the shipped
`confidence_threshold` of `0.8`, confirmation from generic web sources alone is
therefore impossible **by design**, and this plan keeps it so. D1 fixes the rung
below the cap: a two-family web-only finding currently reports `0.49` (`red`)
and must report its adjusted ladder value.

## Baseline (verified this session)

- `git log -1` → `04d4e2e`; `git status --porcelain` clean before this
  increment directory.
- `npm run status` → version `2026.11.11` (tag `v2026.11.07`), **202 unpushed
  commits, oldest 4.6 d**, 5 open roadmap items, last pipeline run 2026-11-07.
- `npm run check` → **PASS** (full, 22 gates, 159.1 s, run record for
  `04d4e2e6ac5c`). One pre-existing warning: `check-loop-artifacts` reports
  `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`;
  warning only, out of scope (A-6).
- `npx tsx scripts/calibrate-confidence.ts` → `entries: 12`,
  `brier_score: 0.1892`, bands `0.3-0.5 n=3 mean 0.30 obs 0.33`,
  `0.7-0.9 n=4 mean 0.70 obs 0.75`, `0.9-1.0 n=5 mean 0.92 obs 0.80`.
- Shipped `corroboration` settings (`config.json`): `confidence_threshold`
  `0.8`; `similarity_threshold` `0.3`; `family_similarity_threshold` `0.9`;
  `calibration.enabled` `true`, `calibration.secondary_only_cap` `0.7`;
  `authority_weights` `academic 1.0, encyclopedia 1.0, archive 1.0,
  structured_fact 1.0, definition 1.0, location 1.0, code 0.9, semantic 0.9,
  synthesis 0.9, news 0.8, web_search 0.7`. The full map is stated so every
  derived number is checkable from this document.
- The gold set is `test-fixtures/calibration/gold.json`, 12 entries, no
  network; each entry carries `id`, `confidence` (the finding's recorded
  confidence, not a ladder value recomputed from its label count), `correct`,
  and a `sources` array of type labels. **Two verified invariants:** a label
  list has one label per family (no entry repeats a type), and where the label
  count is 2 or 5 the stored rung matches the ladder. Entries `c09` and `c12`
  carry three labels at the `0.7` rung, so the fixture is a record of observed
  findings, not a ladder recomputation — C4 adjusts the stored rung, which is
  what the recorded judgment was made against.

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R5-B-9 (P2) | `computeConfidence` builds the `0/0.3/0.7/0.9/1.0` ladder from family count, multiplies by the mean authority weight, clamps to 1.0 (`src/corroborate.ts:400-411`). The `sources.length < 2` branch never reaches it: `reconcileClaims` short-circuits with `capConfidence(0.3, …)` (`:289-293`) | A two-family all-web finding reports `0.49` (map: `red`) while §8.2 names `0.7` "Corroborated". A one-source `web_search` finding ignores its weight, and a **zero-source** finding reports `0.3` although the ladder's row 0 is `0.0`. `src/corroborate.test.ts:264` asserts `0.7 * 0.7`, encoding the multiplier as correct |
| F-R5-B-8 (P2) | `textSimilarity` returns `shared / Math.min(|A|, |B|)` (`src/source-family.ts:69-76`) | A short snippet contained in a long article scores `1.0`, so `assignSourceFamilies` unions them at the `0.9` threshold and a genuinely independent source counts as a republication. `hasComparableText`'s floor (5 tokens / 2 shingles, `:92-98`) is satisfied by the snippet itself |
| F-R5-G-3 (P2) | §8.1 pseudocode assigns `confidence: low` to a contested finding (`infobroker.md:979-985`); the code assigns the dominant cluster's confidence, floored at `0.1` (`src/corroborate.ts:330-333,349-356`) | Prose and code disagree; a contested finding can carry `0.9` while the spec says `low` |
| F-R5-G-4 (P2) | §8.1 declares `agreement_map: {green, yellow, red: gaps}` (`infobroker.md:1002`); `buildAgreementMap` uses `green ≥ threshold`, `yellow ≥ 0.5`, `red < 0.5`, and only sourced findings enter the map (`src/corroborate.ts:429-450,847-851`) | The spec describes `red` as "the gaps" and says nothing about the `0.5` floor or the unsourced exclusion |
| F-R5-G-2 (P2) | §8.2 (`infobroker.md:1010-1047`) never mentions the secondary-only cap; `capConfidence` clamps a secondary-only finding to `secondary_only_cap` (default `0.7`, `src/calibration.ts:41`; secondary set at `:7-12`) | A reader cannot see that a `0.9`/`1.0` rung can be reported as `0.7`, or why |

## Decisions

**D1 — Authority weighting is a bounded adjustment, not a multiplier.**
`adjusted_pre_cap = base × (1 − DAMPING × (1 − familyWeightMean))`, with `base`
the existing family-count ladder, and `DAMPING = 0.25`. Rules that make the
number deterministic:

- **Weight domain.** Each weight is clamped to `[0, 1]` before use, and a
  non-finite value (including `NaN`, which the config validator's
  `typeof === "number"` check admits) folds to `1.0`. A configured weight above
  `1.0` never amplifies; a weight of `0` still suppresses (`0.75 × base`). The
  existing clamp of the result to `1.0` is kept.
- **Per-family aggregation.** Build `Map<string, Array<string | undefined>>` of
  family key → member `source_type` values by iterating `sources` (not the
  existing `uniqueFamilies` map, which keeps only the first type and is exactly
  the order dependence this fixes). `undefined` is kept in the array and folds
  to weight `1.0`.
  `familyWeightMean` is the mean over families of **the maximum weight among
  that family's member types**. An order-swap test pins it.
- **Empty input.** `applyAuthorityWeight(base, [])` returns `base`.
- **Zero sources.** The `sources.length < 2` branch splits: zero sources
  reports the ladder's row 0 (`0.0`); one source reports the adjusted `0.3`
  rung. Both stay `unverified`.

The constant is the largest round value that leaves the `0.9` rung at least
`0.03` above the `0.8` threshold for the lowest shipped weight
(`0.9 × (1 − 0.25 × 0.3) = 0.8325`); the mathematical ceiling is `D ≈ 0.370`,
which sits exactly on the threshold and would flip on rounding.

Invariants, each pinned by a test:

1. **The `0.9` rung clears the pre-cap threshold comparison** for every shipped
   weight: `0.8325` at `web_search` `0.7` (margin `0.0325`).
2. **Weight `1.0` returns the ladder exactly**, so the §8.2 numbers stay
   reachable and every existing unweighted test is unchanged.
3. **Monotone**: for one base, a higher-weight family always reports higher.

The adjustment is pre-cap; `capConfidence` still runs afterwards, so an
all-secondary finding reports `min(adjusted, 0.7)`.

Rejected alternatives:

- (a) **Recalibrate the shipped weights upward.** It works only by compressing
  every weight into `[0.889, 1.0]` — 11% of dynamic range for the authority
  ordering REQ-026a requires — and any operator edit below `0.889` puts the
  threshold out of reach again.
- (b) **Lower `confidence_threshold` to `0.6`.** This contradicts §8.2's
  "gates `green` on the 0.9 tier" and its band prose. REQ-026 defers to the
  *effective* threshold (`infobroker.md:316`), so it is the spec prose, not the
  REQ, that forbids it.
- (c) **Leave the code, relabel the §8.2 column "independence base".** This
  leaves a two-family corroborated finding reported as `0.49` and classified
  `red`, which is the dispute F-R5-B-9 records.

**D2 — Similarity uses the symmetric containment coefficient.** `shared /
Math.max(|A|, |B|)`. Identical full text still scores `1.0`; a republication
plus a small amount of site boilerplate still clears `0.9` (two extra shingles
in 22 → `0.909`); a snippet contained in a much longer article no longer does.

Stated trade: the symmetric denominator also *splits* a genuine republication
when one retrieved excerpt is much shorter than the other — a 9-shingle excerpt
against a 36-shingle article scores `0.25`, where the asymmetric form scored
`1.0`. Splitting raises confidence, so D2 trades a conservative error for an
optimistic one. It is the reading REQ-121's "republish substantially the same
text" supports; the truncated case is pinned by a test and carried on the
roadmap. Rejected: Jaccard (`shared / |A ∪ B|`), stricter on the same boilerplate
for no gain in the container case. The `0.9` threshold and
`family_similarity_threshold` key are unchanged.

**D3 — No REQ body changes.** REQ-026 (threshold), REQ-026a (authority),
REQ-121 (families), and REQ-123 (calibration cap) already state the contracts;
the defect is §8 prose drift plus two derivations. `validate-spec` therefore
sees no REQ-body change and the pipeline's spec→README binding does not fire.

**D4 — `DAMPING` is a named constant, not a config key.** A new config knob
would need a REQ, a spec declaration, and a reconciliation pair for no operator
demand. The constant carries the invariant comment, and C3 writes its value into
§8.2 so the prose is derivable rather than descriptive.

**D5 — Calibration measures the adjusted value and keeps the raw one.** The
report's headline number becomes the adjusted value; every row also carries its
raw stored rung, so a reader can reconstruct the pre-C4 per-entry value (the old
script printed only aggregates, so the "before" comparison is aggregate-level
plus reconstructed rows, not a row-for-row diff of two printed tables).
`reliability` and `brier_score` are computed on `adjusted`; the pre-C4 band
curve survives only as the separately recorded "before" run. The follow-up
roadmap section is pinned to the post-C4 adjusted curve, because the adjustment
moves `0.9`-rung entries into the `0.7-0.9` bucket.

## Change entries

**C1 — Bounded authority adjustment (M)** — revert unit `{C1, C4}`
`src/calibration.ts`: update the module header to declare `REQ-026a` alongside
`REQ-123` and to say "two documented corrections"; export
`applyAuthorityWeight(base: number, familyWeights: number[]): number` beside
`capConfidence` — pure numeric, weights clamped to `[0, 1]`, `DAMPING` a module
constant with the invariant comment, empty array returning `base`.
`src/corroborate.ts` `computeConfidence` (`:377-412`): build
`Map<string, Array<string | undefined>>` keyed by the **same family expression
the function already uses** — `s.source_family` when set, else
`registrableDomain(url)` with the URL as the catch fallback (`:384-394`) — by
iterating `sources` and collecting every member's `source_type` (including
`undefined`) instead of reading the first-writer-wins `uniqueFamilies` map.
Then delegate the adjustment; keep the "no weights → base" path exact.
`reconcileClaims` (`:289-293`): zero sources report `0.0`, one source reports
the adjusted `0.3` rung.
`src/corroborate.test.ts`: rewrite `:258-281` — the `0.7 × 0.7` assertion
becomes `0.6475`, and the `{ academic: 2.0 }` case keeps returning `1.0`; add
the three invariants, the empty-array case, the order-swap case, the
zero-source case, and the one-source case. Use `toBeCloseTo` for every
non-exact decimal. Reconcile-level tests must use a shared `title` on every
result (the code groups findings by `extractTopic(title)`) and distinct
registrable domains; `source_family` keys set on a result are **overwritten**
by `assignSourceFamilies` (`:283-286`), so pre-set family keys are only valid in
direct `computeConfidence` tests. Snippets in these fixtures carry no digits at
all, because `claimsConflict` marks two texts conflicting when both contain
numbers and share none (`:172-177`).

**C2 — Symmetric family similarity (S)**
`src/source-family.ts` `textSimilarity` (`:69-76`): divide by the larger
shingle set; document why containment alone is not republication.
`src/source-family.test.ts`: snippet-contained-in-article scores below `0.9`;
identical text stays `1.0`; a 20-shingle text extended by two shingles moves
from `1.0` to `0.909` and still clears `0.9`; the truncated-excerpt case
(9 shingles against 36, both passing `hasComparableText`) asserts `0.25` and so
pins the D2 trade as a measured behaviour rather than a comment.
`src/corroborate.test.ts`: a snippet contained in a long article yields
`family_count: 2` (was `1`); the two inputs sit on distinct registrable domains
and the snippet keeps at least 5 tokens longer than two characters and 2
shingles, or `hasComparableText` blocks the union before the denominator is
consulted. The existing `counts short republished snippets as one source
family` test (`:1034-1060`) keeps passing because its two snippets are
identical, which scores `1.0` under both denominators.

**C3 — Spec prose alignment (S)**
`infobroker.md` §8.1 and §8.2, all of the following:

- `:979-985` contested findings carry the dominant cluster's confidence
  (floored at `0.1`), not `low`.
- `:1002` agreement map: `green ≥ threshold`; `yellow` in `[0.5, threshold)`
  (empty when an operator sets the threshold at or below `0.5`, since `green`
  wins first); `red` = sourced findings below `0.5`; unsourced findings are
  **omitted from the map entirely** — they are not listed under `red`.
- `:1012-1018` rename the table's `Confidence` header to
  `Independence base`, and add one sentence: "the reported confidence applies
  the two adjustments below to this base; the Rating name describes the base
  rung, not the reported number." No row's number changes.
- `:1020-1032` rewrite the two sentences D1 falsifies — "the `0.7` tier (two
  independent sources) reports as `yellow`" and "Source authority scales the
  independence-based confidence above by a per-source-type weight" — and
  **state the formula**: `reported = base × (1 − 0.25 × (1 − mean family
  weight))`, then capped at `secondary_only_cap` when every source is
  secondary, naming `0.25` as a code constant and `0.7` as the shipped default
  of a configurable cap. Add the zero-source row-0 rule, the one-source rule,
  the contested-confidence rule, and replace "carries the `unverified` verdict
  at the 0.1 placeholder … until sources are attributed" with what the code
  does: only a **zero-source** finding is at the seed value, and it reports
  `0.0` once reconciled; a seeded finding with no reconciliation keeps `0.1`.
- `:975` correct the pseudocode's `compute_confidence(agree.length, providers)`
  signature to the sources-array form.
- Worked shipped-default values, each labelled by its type mix: one
  `web_search` source `0.2775`; two web families `0.6475` (yellow); three web
  families `0.9 → 0.8325` capped to `0.7` (yellow); two families
  `web_search` + `encyclopedia` `0.67375`; three families `web_search` +
  `encyclopedia` + `academic` `0.8775` (green, confirmable before and after);
  zero sources `0.0`.

The `README.md` row belongs to C3 and is decided, not deferred: C3 reads
`README.md:316-330` and **either** adds one clause for the truncated-excerpt
trade **or** records "no change required" in `aar.md` in the same step. No
ladder number changes.

**C4 — Calibration measures the adjusted value (S)** — revert unit `{C1, C4}`
`src/calibration.ts`: add `export interface CalibrationEntry { id: string;
confidence: number; correct: boolean; sources: string[] }` and
`export function buildCalibrationReport(entries: CalibrationEntry[],
weights: Record<string, number>, options?: CalibrationOptions) → { entries:
number; brier_score: number; reliability: ReliabilityBucket[]; rows:
Array<{ id: string; raw: number; adjusted: number; correct: boolean }> }`.
Both returned numbers are unrounded; the caller rounds for display.
`adjusted = capConfidence(applyAuthorityWeight(raw, sources.map((t) => weights[t] ?? 1)),
sources.map((t) => ({ source_type: t })), options)` — the second argument must
be `CalibrationSource` objects, not bare label strings, or `isSecondaryOnly`
returns `false` for every entry and `typecheck` fails. The weight list is
per-**source-label** here, which equals the helper's per-**family** contract
only under the gold set's one-label-per-family premise; the script's header
states that premise. `brier_score` and
`reliability` are computed on `adjusted`. `rows` is the per-entry record.
`scripts/calibrate-confidence.ts`: read the shipped settings with
`JSON.parse(readFileSync(join(import.meta.dirname, "..", "config.json"),
"utf8"))` and take `corroboration.authority_weights` as `weights`, plus
`{ enabled: cfg.corroboration.calibration?.enabled !== false,
secondaryOnlyCap: cfg.corroboration.calibration?.secondary_only_cap ?? 0.7 }`
as `options` — note the snake_case config keys map onto the camelCase
`CalibrationOptions` fields, and passing the config object through unmapped
would silently leave `secondaryOnlyCap` at its default.
no config layer, no `process.env` mutation, so the run stays deterministic and
measures the shipped ladder by design; a user-layer run is out of scope and the
header says so. Replace the inline scoring with `buildCalibrationReport`, print
the existing aggregate lines plus one `id raw adjusted` line per entry, round
`brier_score` to 4 decimals with `toFixed(4)` as today, and include `rows` in
the `--json` payload. The script keeps its `main()` entry point and gains no
test-only export; the testable logic lives in `buildCalibrationReport`.
`src/calibration.test.ts`: a two-entry fixture with hand-computed literals —
entry `x` (`confidence 0.7`, `sources ["web_search","news"]`, `correct true`)
has mean weight `0.75`, `adjusted` `0.65625`; entry `y` (`confidence 0.9`,
`sources ["academic","encyclopedia","web_search"]`, `correct false`) has mean
weight `0.9`, `adjusted` `0.8775`; the pair's `brier_score` rounds to
`0.4439`. `adjusted` **includes** the secondary-only cap, so entry `x` is
capped only if a test overrides `secondaryOnlyCap` below `0.65625`. Also the
`0.8325` / `0.6475` literals asserted against `computeConfidence` with a
**hardcoded 11-entry shipped weight map** (independent pin, not
`loadConfig()`), the helper-equality case (the report's `adjusted` equals
`computeConfidence` for a synthetic two-family set built from one source per
family, so the convention holds), and `weight 1.0`. Add
`@implements REQ-026a` to the file — unconditionally, so the diff does not
depend on whether `check-gate-coverage` demands it.

**C5 — Bookkeeping (S)**
`CHANGELOG.md` entry. Remove the roadmap section and add
"Calibration gold-set refresh" with exactly this shape: a `## ` heading, two
bullets (re-derive the `correct` labels against the post-C4 adjusted curve;
measure the truncated-excerpt family case from D2), and a `**Trigger:**` line
naming the next change to `test-fixtures/calibration/gold.json` or
`src/source-family.ts`. Re-disposition the five register rows to `Resolved`
with this commit. Write `tasks.md` and `aar.md`, including the two calibration
runs (raw before, adjusted after) as separate recorded outputs.

## Roadmap close condition

`ROADMAP.md:23` closes the item when "the shipped defaults and the prose agree
**and each branch is asserted**". After C3 the prose states the ladder, the
formula with `0.25`, the cap, the zero-source row, and the contested rule, so
every shipped-default number is derivable. C1/C2's tests assert each branch:
`green` (`0.8775`), `yellow` (`0.6475`), `red` (one `web_search` source at
`0.2775`, below `0.5`), row 0 (`0.0`), the cap (`0.7` for three web families),
the contested rule, and the unsourced exclusion (existing assertions at
`src/corroborate.test.ts:1637,1700`, re-pinned with a clause tag). Both limbs
are met on that evidence, and the changelog entry says so.

The roadmap action reads "Reconcile the shipped confidence weights with the
spec ladder". D1 satisfies it by correcting the derivation and the prose rather
than by editing the weights, and records that choice (rejected alternative (a)).
The worked numbers derive from the shipped weight map; they do not claim the
default provider set produces that mix. A `web_search` `source_type` comes from
a generic-HTTP provider or any provider result carrying that type (SearXNG and
Yep are `enabled: false` in the shipped config), so the two-family web case
appears once such a provider is configured. §8.2 states the condition in the
spec's own words ("a finding backed only by generic web pages").

## Blast radius

| File | Change | Size | Gate |
|---|---|---|---|
| `src/calibration.ts` | C1, C4 | M | `typecheck`, `test`, `validate-spec` |
| `src/corroborate.ts` | C1 | M | `typecheck`, `test` |
| `src/source-family.ts` | C2 | S | `typecheck`, `test` |
| `src/corroborate.test.ts` | C1, C2 | M | `test`, `check-gate-coverage` |
| `src/source-family.test.ts` | C2 | S | `test`, `check-gate-coverage` |
| `src/calibration.test.ts` | C4 | S | `test`, `check-gate-coverage` |
| `scripts/calibrate-confidence.ts` | C4 | S | `typecheck:scripts`, `check-script-discipline` |
| `infobroker.md` | C3 | S | `validate-spec`, `validate-readme` |
| `CHANGELOG.md` | C5 | S | `version-sync` |
| `ROADMAP.md` | C5 | S | `check-roadmap`, `check-non-goals` |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | C5 | S | — |
| `docs/plans/2026-11-14-corroboration-confidence-contract/*.md` | this plan | S | `check-loop-artifacts` |
| `README.md` | C3 decides; edit only if the trade needs a clause | S | `validate-readme` |

`config.json` is **not** in the table: D1 changes no shipped weight and D4 adds
no key. If review chooses alternative (a) instead, `config.json`,
`corroboration.authority_weights`, and the §8.2 prose all change and this plan
is re-scoped rather than amended.

## Steps

1. **C2 first**, only because C1's reconcile-level assertions are stated in
   family counts that C2 can change; the modules are otherwise independent.
   Add the C2 tests, record their failures, change the denominator, then the
   `family_count: 2` case and the unchanged short-republish test.
2. **C1**: add the C1 tests against `computeConfidence` first — the red-before
   evidence — then the helper, the delegation, and the zero-/one-source
   routes. Run the full suite once here to catch any snapshot that encoded the
   old zero-source `0.3` (A-7).
3. **C4**: record the pre-change calibration output, add
   `buildCalibrationReport`, rewire the script and the tests, then re-run and
   record the post-change output (the "after" row).
4. **C3**: prose only; then `npm run validate-spec` and
   `npm run validate-readme`, and the README decision.
5. **C5**: changelog, roadmap removal and the new section, register rows, AAR.
6. **Final tree:** `npm run check` (full) once, then `npm run status`.

## Verification

*(red)* = fails before its change; *(green)* = passes today and must keep
passing; *(record)* = observational, recorded in `aar.md`.

1. *(red)* `computeConfidence` over three sources with pre-set distinct
   `source_family` keys typed `web_search` returns `0.8325` (`toBeCloseTo`).
2. *(red)* Two all-`web_search` families report `0.6475` through
   `reconcileClaims` with threshold `0.8` (positional 9th argument), verdict
   `unverified`; the same finding at threshold `0.5` reports `confirmed`.
   Fixture: one shared `title` on both results, distinct registrable domains,
   pairwise 4-gram similarity `< 0.9` **measured over `familyText`, i.e. title
   plus snippet** (the string the code actually compares), LSA cosine `≥ 0.3`,
   no digits, and equal negation-lexicon parity. The test asserts
   `assignSourceFamilies` returns two keys before asserting the number.
3. *(green)* Mean weight `1.0` returns `0.3/0.7/0.9/1.0` for 1/2/3/5 families.
   *(red)* `computeConfidence([], weights)` returns `0` — today it returns
   `NaN`, because the weight mean divides by an empty family list.
4. *(red)* A 6-token snippet (≥5 tokens longer than two characters, 3 shingles)
   contained in a 200-word article on a different registrable domain does not
   union with it; `family_count` becomes `2` (was `1`).
5. *(red)* One `web_search` source reports `0.2775` (was `0.3`). *(red)* A
   zero-source finding reports `0.0` (was `0.3`), asserted through a direct
   `reconcileClaims` call with a pre-built `findings` map holding one
   source-less finding — single-query output drops such a finding
   (`src/corroborate.ts:829`), so the response envelope cannot observe it.
   *(green)* Both stay `unverified`.
6. *(red for the value, green for the verdict)* Three families typed
   `web_search`, `encyclopedia`, `academic` report `0.8775` and reconcile to
   `confirmed` at threshold `0.8`. Their snippets are paraphrases (one shared
   title, distinct registrable domains, LSA `≥ 0.3`, 4-gram `< 0.9`, no
   digits, zero negation-lexicon words), and the test asserts the three-way
   clustering and three assigned families before the verdict, so a fixture
   drift fails at the probe.
7. *(red)* A weight above `1.0` is clamped: five `academic: 2.0` families
   report `1.0`; a `0` weight reports `0.75 × base`.
8. *(green)* `npx tsx scripts/calibrate-confidence.ts` still prints `entries: 12`
   and one line per reliability band for the committed gold set.
   *(red)* `buildCalibrationReport` returns one row per entry whose `raw` equals
   the stored `confidence` and whose `adjusted` equals the formula's value, with
   `brier_score`/`reliability` computed on `adjusted`. A two-entry fixture pins
   the arithmetic with hand-computed literals.
9. *(green)* The unsourced claim stays out of `agreement_map.red` and the
   existing test carries `@implements REQ-026g` naming the exclusion branch.
10. *(record)* `npx tsx scripts/calibrate-confidence.ts` output before and after
    C4, both captured in `aar.md`.

Plus: `npm run typecheck`, `npm run typecheck:scripts`, `npm run test`,
`npm run validate-spec`, `npm run check-roadmap`, `npm run
check-loop-artifacts`, and a final `npm run check`.

## Edge cases & rollback

- **Total secondary-only set.** `isSecondaryOnly` requires every source to
  carry a known secondary type and no `original_source`
  (`src/calibration.ts:24-32`), so an attributed result escapes the cap. The
  plan states this rather than changing it.
- **Unknown `source_type`.** Folds to weight `1.0` today; D1 preserves that, so
  DuckDuckGo/Mojeek/Marginalia results (no `source_type`) do not move. The
  family map keeps `undefined` entries and folds them at mean time.
- **Non-finite weight.** Folds to `1.0`; the config validator admits `NaN`
  because it checks the type, not finiteness.
- **Zero and one source.** `0.0` and `0.2775` respectively; the `0.7` cap does
  not bind on either, and any seeded finding that never reconciles keeps `0.1`.
- **Mismatched-type family.** The maximum weight wins, so the result does not
  depend on provider settle order; the order-swap test proves it.
- **Conflicting findings.** C3 aligns prose to existing dominant-cluster
  behavior; no code change, so no verdict moves. A-1 has the reviewer confirm
  the §8.1 edit adds no claim.
- **Gold-set label convention.** One label per family (verified: no entry
  repeats a type), so the label mean equals the family mean. If that convention
  is ever broken, the script's number diverges from `verify_claims`; the
  script's header records the premise.
- **Rollback.** `{C1, C4}` revert together; `C2`, `C3`, `C5` revert alone.

## User impact

No restart or reload; no config key changes; no breaking API change. Observable
differences, all disclosed:

- Two-family all-web finding: `0.49` (`red`) → `0.6475` (`yellow`), still
  `unverified`. Three-family all-web: `0.63` → `0.7` (cap), still `unverified`.
- Two-family `web_search` + `encyclopedia`: `0.595` → `0.67375`, still
  `unverified`.
- Three-family `web_search` + `encyclopedia` + `academic`: `0.81` → `0.8775`,
  `confirmed` before and after.
- One-source `web_search` finding: `0.3` → `0.2775`. Zero-source finding:
  `0.3` → `0.0`, which is what §8.2's row 0 always said. At an operator
  threshold of `0.3` or below, a zero-source finding no longer satisfies the
  refinement loop's early-exit bar, so the loop may run an extra iteration and
  spend gap queries it previously skipped; at the shipped `0.8` this path is
  inert.
- A short snippet no longer counts as a republication of the article containing
  it; conversely a heavily truncated excerpt of a genuinely republished
  article may stop collapsing into one family, which raises confidence. That is
  D2's stated trade and it is carried on the roadmap.

Unpushed backlog grows by this increment; publishing is a separate
user-authorized step.

## Trust boundary and contract surface

Every premise is `repo`-sourced: register rows, source lines, the gold set, and
the shipped config were read this session. The only `tool-output` premises are
the recorded baseline figures (gate pass, calibration curve, `npm run status`);
none supplies a step. No web page, issue, or log contributes an instruction.

No tool parameter, schema description, or response shape changes. Every
response field derived from `confidence` can move with it: `confidence`, the
`verdict` (via `confirmationEligible`), the agreement-map classification, the
`corroboration: complete|partial` status (`src/corroborate.ts:880-883`), and the
synthesis sentence (`:969-982`). §User impact discloses each case this
increment's arithmetic moves. `check-tdqs`, `check-intent-citations`, and
`check-harness-expectations` run in the final gate pass as confirmation, not as
edits. No new gate or check is added, so the error-gate dry run and
false-positive budget checks do not apply; no existing script checks this
finding class (the register rows are tracked prose). No specification section
feeds a fingerprint or generated artifact.

## Assumptions to confirm during build

- A-1: the §8.1/§8.2 edit introduces no user-visible claim absent from the code.
- A-2: no other call site depends on `textSimilarity` asymmetry —
  `grep -rn "textSimilarity" src` shows only `source-family.ts` and its test.
- A-3: `README.md:316-330` needs no edit unless C3 adds a claim the
  §Corroboration paragraph lacks; C3 owns the decision and records it.
- A-4: `scripts/calibrate-confidence.ts` is not wired into a gate, so its output
  change cannot break a gate; `check-script-discipline` still applies.
- A-5: the register rows' line numbers have drifted; re-read each row before
  editing it.
- A-6: the pre-existing `check-loop-artifacts` warning for the 2026-11-10
  increment is out of scope and remains a warning.
- A-7: no existing test or fixture asserts `0.3` for a zero-source finding. The
  full suite after C1 confirms it; if one does, the fixture is updated as part
  of C1 and the change is recorded in `aar.md`.

## Unknowns

- Whether `validate-spec` mechanically enforces per-file `@implements` headers.
  C1 updates the header either way.
- Whether the gold set's `correct` labels remain right once the adjusted values
  replace the ladder values. C4 makes that observable; re-deriving them is the
  follow-up section's job.
