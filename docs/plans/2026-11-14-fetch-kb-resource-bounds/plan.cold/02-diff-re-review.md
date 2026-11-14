# Diff re-review — plan revision 2

**Reviewer:** cold subagent, no authoring context · **Plan sha256:** `ea84dc211aaacfe6291810ffa4337543e07ed851d1ec2b3ce5db89d45255ca0d` · **HEAD:** `1ad3ee2`
**Verdict:** `independent-review FAILED.` — 2 Major remain, plus 1 Minor and 2 Nits

A unified diff was not available (revision 1 was never written to disk), so the
reviewer verified dispositions against the current artifact and the cited source
rather than reviewing a diff.

## Verified dispositions (no action)

C1 (subject to N2), C2, M1, M2, M4, M5, m8, n1–n4.

## Open / newly introduced

- **[Major] M3 partially resolved** — the AAR now precedes the gate whose result it must report, and the plan says both. `LOOP PAUSED` requires gates green, so the order had to be one way.
- **[Major] N2** — the C1 fix can hand `computeFreshnessScore` an undefined tier: a config with a `tiers` object and no `default_tier` passes validation, and a custom tier set omitting `"stable"` would make `tiers[tier]` undefined and throw at `src/kb.ts:327`. REQ-066's new sentence also presupposes a configured default.
- **[Minor]** The B test config replaced the file's existing `fetch` block; dropping `cache` would let KB reads answer crawl hops and zero `stub.requests`.
- **[Nit]** Stub citations drifted: 404 branch is `src/lib/stub-provider.ts:105-106`, counter `:114-116`, `page()` helper `src/fetch-page-extraction.test.ts:109-114`.
- **[Nit]** Baseline `SHALL` counts off by one: REQ-066 has 6, not 5; REQ-074's proposed delta was inconsistent with its start.

## Fact checks requested

- Stub and hermetic config: confirmed 404 on unknown paths, `/page/N` 200, `requests` counter, `fetch` overrides merged.
- REQ-021 reproduces exactly at 797 chars / 3 sentences / 4 `SHALL`; REQ-066 at 592 / 7 / 7.
- REQ-074 bodies were not read (budget); the ~686 figure stood unverified.
