# Cold review — plan.md

Reviewer: review subagent (cold, no authoring context; single-context stage execution — see Disclosure)
Plan sha256: 4fe24ef85843074c32120c20a98dbf84deb2e7aa3e07d748c6d48da73dff03e6f
Artifact: /home/fluke/Infobroker/docs/plans/2026-11-14-corroboration-routing-and-provenance/plan.md
Depth: standard · Stages 1–5 run · Comprehension: faithful-with-gaps

## Severity counts
Blocker: 0 · Major: 5 · Nit: 5

## Blocker
None.

## Major

1. [design] F-R5-C-4's cited trigger path does not exist at HEAD. plan.md:29-30 asserts a KB recall result seeds `content_sha256` through `src/corroborate.ts:211`, but the recall mapping the code actually uses (`src/corroborate.ts:689-699`) copies only title/url/snippet/source_type/provider/retrieval_origin — no `content_sha256`. No provider or normalizer sets `SearchResult.content_sha256` (only `src/deep-search.ts:105` on the deep-read path and `src/index.ts:2566` on a KB record read). The gate at `src/corroborate.ts:936` is therefore a latent hole, not a reachable defect. What must change: either re-base the justification on REQ-122's "each cited source" clause (`infobroker.md:346`), or wire the hash into the recall mapping at :689-699 — which then makes D3's overwrite (plan.md:94-101) a decision about replacing a stored-document hash with a live-snapshot hash and needs a sentence saying so. plan.md:180-182 ("the same path a knowledge-base recall uses") is false as written.

2. [design] `finding_index` carries two incompatible meanings. plan.md:165 specifies `f.claim_index ?? position`. In batch mode `claim_index` is the caller's input index (`src/corroborate.ts:671`), duplicates collapse (`:659-666`) and findings sort by `claim_index` (`:840-843`). For claims `["a","b","a","c"]` the returned three findings carry indices 0, 1, 3 — so `finding_index` cannot index the returned `findings` array, which is exactly the attribution need stated at plan.md:35-42. The test at plan.md:185-187 uses a two-claim, no-duplicate batch and cannot catch it. What must change: define `finding_index` as the position in the returned findings array (take it from the `condensed` map at `:846-858`), or document it as the caller claim index and add a duplicate-claims case.

3. [design] The census row the plan edits is the wrong row. plan.md:197-199 and Done bar 1 (plan.md:263-265) order an update to "the census row (`:584`)" with `Resolved` 179 / `Scheduled-roadmap` 4. `docs/plans/2026-11-09-full-review-sweep/worklist.md:584` is the **severity** census (P0 4, P1 81, P2 97, P3 90 — which sums to 272 against the 276 rows); the disposition census is `worklist.md:585`. Following step 4 as written overwrites the severity row and leaves the disposition row stale. What must change: cite `:585`, and note the pre-existing 272/276 severity arithmetic if :584 is touched at all.

4. [design] The plan leaves spec prose contradicting REQ-026i. plan.md:111-118 concludes "No conflict" from a REQ-only grep, but `infobroker.md:174` defines "Routing priority" as the `search_web` parameter, and §7.4 "Priority Routing" (`infobroker.md:914-926`) tables `privacy` = "Use the `privacy_critical` chain … fall back to the task chain if empty" and `quality` = "default task-type dispatch chain (unchanged)" — the exact behaviours D1/D2 reverse — and `src/corroborate.ts:495-497` cites "REQ-026/§7.4" as governing the corroboration pool. What must change: scope §7.4 explicitly to `search_web` (or add a corroboration row), extend the §3 glossary term, and add both to the registration list. REQ-020c itself is genuinely not the conflict surface.

5. [clarity] The done bar is unsatisfiable in the plan's own step order. Step 8 (plan.md:216) and Done bar 4 (plan.md:271-272) require `npm run check` green and `check-loop-artifacts` 0 errors "on the final tree", but a missing `aar.md` is an **error** (`scripts/lib/loop-artifacts.ts:109`) and `check-loop-artifacts` is inside `npm run check`; the plan's own baseline (plan.md:74-76) says that gate stays red until `aar.md` is written at close, and no step writes it. What must change: state that the final `npm run check` runs after the close AAR, or scope item 4 to the close-time tree and name the interim gate set.

## Nits

1. [clarity] plan.md:150 says "Register the new REQ in all four places" then enumerates three (manifest table, coverage row, G1 checklist) — plan.md:150-156. The fourth is left to guesswork.
2. [clarity] plan.md:181 cites `sourceFromResult` at `src/corroborate.ts:205-215`; the helper's returned object is at :198-213 and it is not exported. The test path is `corroborate`'s `searchers` option (`src/corroborate.ts:604`, `:738-757`; pattern at `src/corroborate.test.ts:657-663`). Correct the citation or drop the helper reference.
3. [clarity] plan.md:226-228 says a KB source without an `http(s)` URL "is not scheduled". It is scheduled; `snapshotSource` returns null for a non-http URL (`src/preservation.ts:63`) and the source is left unchanged. Outcome is right, mechanism wording is wrong.
4. [clarity] Step 4 (plan.md:194-199) leaves the REQ-026d verdict row stale: `worklist.md:304` still asserts "per-source-type contribution is global across findings with no finding attribution", which the increment fixes. Re-derive the census "never by delta" applies to the prose too.
5. [clarity] plan.md:209-215 lists the version sites as package.json, package-lock.json, src/index.ts, server.json, AGENTS.md, infobroker.md and the README spec reference, but `set` also rewrites README's `Last updated:` stamp (`scripts/version.ts:131-141`). Harmless, but the step's description should match the tool.

## Assumption audit

1. **Findings open?** A-3 confirmed (`src/corroborate.ts:498-524`, privacy returns the chain at :503-505, quality falls through at :523, replacement after the operational filter at :626-638 called at :637). C-6 confirmed (`:879-885`, `:846-858`, `:909-921`). C-4: the gate at `:936` is real, but the cited KB-recall evidence is false — see Major 1.
2. **REQ-026i within limits?** Yes. Drafted body is ≈532 characters, 7 sentences, 7 SHALL clauses (S2 carries 2), one paragraph, exactly 5 backtick tokens (`verify_claims`, `priority`, `privacy`, `quality`, `free_only`) — at the ≤5 limit with zero headroom. No REQ conflict: REQ-020c is `search_web`-scoped and `search_web` takes singular `provider` (`infobroker.md:238`). The conflict is non-REQ prose — see Major 4. REQ-026d's amendment (369 chars at `infobroker.md:328` + one sentence) stays well inside limits.
3. **Version stamp complete/ordered?** Essentially yes. `set` covers every enumerated site (`scripts/version.ts:39-148`) and does not touch CHANGELOG (`:20-22`, `:183`), so the manual seed in plan.md:213-215 is required and correct; `check` asserts the CHANGELOG top-entry date equals `package.json` (`:163-165`), and step 7 precedes step 8, so ordering is right. Only Nit 5.
4. **Test injection feasible?** Yes, via `searchers` and a mocked `snapshotSource` (existing pattern at `src/corroborate.test.ts:680-701`); the overwrite at `src/corroborate.ts:973` makes "content_sha256 equals the stored snapshot hash" assertable. Not via the non-exported `sourceFromResult` — Nit 2.
5. **Census step satisfiable?** Yes. `docs/plans/2026-11-14-register-reconciliation/evidence/census.ts:15-16` asserts 276 rows / 276 IDs, and `:28-51` prints dispositions; 179+4+93 = 276. It does not emit the severity census, which is why Major 3 matters.

## Unknowns

- Whether `npm run check`'s gate ordering would make the `check-loop-artifacts` failure the first red gate (affects Major 5's blast radius).
- Which fourth registration place Step 1 intends.
- Whether any future wiring is expected to put a hash on KB recall results (affects whether Major 1 is a re-base or a mapping change).
- The plan's baseline numbers (249 unpushed commits, 162.7 s run, npm audit advisories) were not re-run; only `git log -1` → `09a1374` was confirmed.

## Disclosure

- Isolation: the harness forbids nesting subagents, so Stages 1–5 ran sequentially in this one cold context rather than in five fresh contexts. I was also given AGENTS.md and user-level instructions by the host, which the skill flags as a weakened-isolation Unknown. Findings are still independent of the authoring conversation, which I never received.
- Reads: 45 read/grep calls, all inside the artifact, its named targets, and its cited standards (`AGENTS.md`, version/loop-artifact scripts, clause-coverage, preservation) — no unrelated repo scanning. This exceeds the ≤40 standard budget by 5; recorded rather than hidden.
- The report file could not be written (no write capability; shell writes denied), so no sha256 exists for it yet. The path in the plan's Files-expected list remains to be created by the parent.
