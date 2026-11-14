# Diff re-review — plan.md

Reviewer: review subagent (cold; diff re-review protocol)
Plan sha256: 4b9554a5a4b82417ca506a2513385e30926ea6e31e0a1fcdcb82496070771d2d
Artifact: /home/fluke/Infobroker/docs/plans/2026-11-14-corroboration-routing-and-provenance/plan.md
Previous sha256: 4fe24ef85843074c32120c20a98dbf84deb2e7aa3e07d748c6d48da73dff03e6f
Mode: diff re-review, standard depth, current-text-only. Hash above recomputed from the file (`sha256sum`), identical to the dispatch value.

## Severity counts
Prior findings: 10 total (5 Major, 5 Nit) — **RESOLVED 10, STILL-BLOCKING 0**.
New in changed text: Blocker 0 · Major 1 · Nit 2 (non-blocking).

## Prior findings — disposition

| # | Prior severity | Disposition | Evidence in current artifact |
|---|---|---|---|
| 1 | Major [design] F-R5-C-4 false KB-recall trigger | **RESOLVED** | Scope item 2 now states the hole is latent: recall mapping `:689-699` copies no hash, nothing populates `SearchResult.content_sha256` except `src/deep-search.ts:105`, defect re-based on REQ-122 (plan.md:26-40); the out-of-scope sentence for wiring `:689-699` is present (plan.md:39-40); D3 supplies the required precedence sentence for a stored-document hash (plan.md:104-108). The false "same path a knowledge-base recall uses" claim is gone. |
| 2 | Major [design] `finding_index` double meaning | **RESOLVED** | D4 defines it as "the position of the finding in the returned `findings` array", explicitly not `claim_index` (plan.md:113-122); step 2 takes it from the `condensed` map `:846-858` (plan.md:190-194); the duplicate-claims batch `["a","b","a","c"]` with contiguous 0..n-1 assertion appears (plan.md:214-217); edge case restated (plan.md:291-293). |
| 3 | Major [design] census row is the wrong row | **RESOLVED** | Step 4 updates the **disposition** row `:585` and forbids touching the **severity** row `:584`, naming the pre-existing 272/276 tally (plan.md:230-233); Done bar 1 cites `:585` (plan.md:330-331). Verified against the register: `worklist.md:584` is "Severity census", `worklist.md:585` is "Disposition census". |
| 4 | Major [design] §7.4/§3 prose contradicts REQ-026i | **RESOLVED** | New "Contract surfaces checked" names the collision explicitly — §7.4 `infobroker.md:912-926` and glossary `:174` — and scopes both in step 1 (plan.md:131-137, 170-177). Verified: glossary `infobroker.md:174` names only `search_web`; §7.4 heading is `infobroker.md:914`. |
| 5 | Major [clarity] done bar unsatisfiable in step order | **RESOLVED** | Step 8 defers the full suite to "**after** the close AAR is written" with the `check-loop-artifacts` reason (plan.md:251-256); Verification repeats it (plan.md:315-318); Done bar 4 scopes to "the close-time tree ... (after `aar.md` exists)" (plan.md:337-339); Commit series 5 aligns (plan.md:275-277). |
| 1 | Nit [clarity] "all four places", three enumerated | **RESOLVED** | Step 1 now says "on every surface" and enumerates five (manifest, §D taxonomy, §9.2 checklist, §7.4, §3) — no count/enumeration mismatch (plan.md:170-177); Done bar 2 repeats the same five (plan.md:332-334). |
| 2 | Nit [clarity] wrong `sourceFromResult` citation | **RESOLVED** | The helper reference is gone; Scope item 2 and step 3 now cite the `searchers` seam (`:604`, `:738-757`) and the existing test pattern (plan.md:34-36, 208-211). |
| 3 | Nit [clarity] "not scheduled" mechanism wrong | **RESOLVED** | Edge cases now say such a source "is still scheduled" and `snapshotSource` returns null for non-http (`src/preservation.ts:63`), leaving it unchanged (plan.md:287-290). |
| 4 | Nit [clarity] REQ-026d verdict row `:304` stale | **RESOLVED** | Step 4 updates `:304` and quotes the retired claim (plan.md:226-228); Done bar 1 requires the row no longer claim unattributed provenance (plan.md:328-330). |
| 5 | Nit [clarity] version-site list omits README stamp | **RESOLVED** | Step 7 now includes "the README spec reference plus its `Last updated:` stamp" (plan.md:247-248). |

## New finding (changed text only)

### Major [design] — the new Commit series cannot pass its own first gate

**Evidence:** plan.md:260-266 (the Commit series: "each earlier commit passes its own gate before the next is staged"; commit 1 = spec only, gate `npm run validate-spec`) together with plan.md:182 (step 1 verify) and plan.md:218-221 (the `@implements REQ-026i` tags land only in step 3 / commit 2).

`scripts/validate-spec.ts:141` fails a REQ with "no @implements citation found in any source file and no waiver in DECISIONS.md `## Spec Waivers`". REQ-026i is brand new in commit 1 and its citations arrive in commit 2, so `npm run validate-spec` deterministically fails at the commit 1 boundary — the exact boundary the new section says must be green before proceeding. This also contradicts the standing rule in AGENTS.md § Spec Authoring: "Add the tags in the same commit as the REQ change."

**What must change:** either merge commits 1 and 2 (spec + source + tests as one concern — still inside the five-commit cap), or reorder so the REQ body, its clause tags, and the test that carries them are staged together, and make that commit's gate `validate-spec` + `check-gate-coverage`. Do not resolve it with a `## Spec Waivers` entry: Done bar 2 requires REQ-026i to be cited and passing. Adjust step 1's Verify line (plan.md:182) the same way, since it runs `validate-spec` before any tag exists.

## Other observations (Nit, non-blocking — not verdict-bearing)

- [clarity] plan.md:3-5 still read "self review pending" / "cold pass not yet dispatched" although a cold pass has run and this is its diff re-review. Cosmetic; the gate stamps these.
- [clarity] plan.md:351-369 "Files expected" lists `plan.cold/report.md` but not `plan.cold/re-review.md`, which the stamp will record. Add it or state that the cold directory is not a deliverable.

## Deferred (unchanged text — reported, not blocking)

- plan.md:76-79 (Baseline, not in the changed regions) attributes the disposition census to `worklist.md:584`, while step 4 and Done bar 1 correctly cite `:585`; `:584` is the severity row. The baseline figures themselves (176 / 7 / 93) match `worklist.md:585`. Nit-level; a one-line re-cite whenever that line is next touched.

## Unknowns

- I did not re-read `scripts/lib/loop-artifacts.ts:109` (AAR-missing = error) or `src/index.ts:2150`/`:2228`; those rest on the prior report's verified evidence and are unchanged premises the revised text merely conforms to. No changed-text finding depends on them.
- Whether `check-intent-citations` tolerates a new requirement with no new operation (asserted at plan.md:138-140) was not independently executed; prior audit accepted it and no changed-text claim turns on it.
- Isolation: host-injected AGENTS.md and user-level instructions were present; recorded, per the skill, as weakened isolation. Findings are independent of the authoring conversation, which I never received.
- Reads used: 9 read/grep + 1 allowlisted `sha256sum` hash check; no repo-wide scanning outside the artifact and the paths its changed text cites (`worklist.md`, `infobroker.md`, `src/types.ts`, `src/corroborate.ts`, `scripts/*.ts`).

---

independent-review FAILED.
