# 06 — Targeted diff re-review (revision 2)

**Verdict:** `independent-review passed.`
**Reviewed artifact:** `plan.md` sha256 `9edb8c4319ca902da1b95f140ef3848985a4f4971be14a63e2325cb394ebe47e`
**Prior cold report:** `plan.cold/report.md` (NO-GO: 1 Blocker, 2 Majors, 6 Minors)
**Stages:** 5/5 (stage 4 re-triggered over the whole revised artifact; stages 1–3 not re-run, by design)
**Reads:** 8/10

## (a) Prior-finding resolution

| # | Prior finding | Status | Revision-2 evidence |
|---|---|---|---|
| 1 | **Blocker** — done bar demanded a quota guard mutation no step performed; `src/quota.ts` undeclared | **Resolved** | T6(c) mutates the uid compare at `src/quota.ts:41-46`; the mutation-only note declares `src/quota.ts` as a target; the sidecar lists it; done bar (1) asks only that each T6 guard mutation fails the test it covers. Mutation is sound: forcing the compare to `false` suppresses the throw, so the seeded file is read and `.daily.used === 0` fails. |
| 2 | **Major** — commit 1 authored last | **Resolved** | Phase 1 is now T2 → commit 1, before T3; the commit series matches the step order; `tasks.md` agrees. |
| 3 | **Major** — "asserts both halves" overstated | **Resolved** | §Why scopes the claim to key-pool write + both stores' read; the quota write refusal is "not separately asserted" and named a residual in the AAR, the worklist sentence, and done bar (5). |
| 4 | Minor — "the two new read-refusal tests" | **Resolved** | The rollback line names only the key-pool read test; the unit is commits 2–3. |
| 5 | Minor — citation drift | **Resolved** | `src/key-pool.ts:38-39`, `src/kb.ts:1226-1235`, `:1228`, `:1329-1344` (verified or carried from the prior verified list). |
| 6 | Minor — quota seed `daily` only | **Resolved** | Both counters required, future `resetAt`, `src/quota.ts:78` cited. |
| 7 | Minor — no `mkdtemp`/`finally` | **Resolved** | Fixture shape stated. |
| 8 | Minor — T18 post-`check` delta | **Resolved by explicit acceptance** | Docs-only delta; T19 `check:fast` covers the committed tree. |
| 9 | Minor — third copy / TOCTOU | **Resolved by explicit acceptance** | Alternative D3, the verbatim-message note, and the edge case. |
| nits | anchors / uid saturation / TOCTOU / test-count wording / rollback scale / Predecessor | **Resolved** except Predecessor | `§Design` sections now titled and cited distinctly; `(uid + 1) >>> 0`; rollback scale defined; test-count wording consistent. Predecessor nit: **open** — it still conflated version, tag, HEAD, and counts; fixed in amendment 2b (split line). |

## (b) New findings in the changed lines

- **None at Blocker or Major.**
- **Nit** — `src/quota.ts` spans cited as `:33-45`/`:22-27`; actual `:36-47`/`:20-28`. Harmless (the mutation target `:41-46` is exact); corrected in amendment 2b.
- **Nit** — commit 2's prose said "the two tests" while its range includes the quota test; corrected in amendment 2b.
- **Deferred [Major] [design]** (unchanged text, so not counted against the revision) — T9 mutates `src/kb.ts` but `src/kb.ts` was absent from the Blast radius and the sidecar target list, while the plan institutionalised exactly that declaration for `src/quota.ts`. T9 also lacked T6's `git status` confirmation. **Resolved by amendment 2b**: `src/kb.ts` is now named in the mutation-only paragraph, the §Evidence target list, T9's `git status` confirmation, and the preflight target list.

## (c) Verdict

`independent-review passed.`

## (d) Stages and reads

Stages `5/5` (stage 4 re-triggered); reads `8/10`. Unknowns: stage isolation is
partial by construction (prior findings were supplied and `AGENTS.md` is
injected); `src/kb.ts` line numbers and the `checkQuota().daily.used` shape
rest on the prior report's verified section. The Predecessor nit was left
unaddressed in revision 2 and is fixed in the amendment, not re-litigated.
