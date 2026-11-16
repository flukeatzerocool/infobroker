# `original_source` producers

`original_source` is the provider-declared origin of a result. Until REQ-020k it
had no documented contract, and three independent paths populated it, so no
consumer could assume it names a document. This file is the inventory; the rule
itself lives in `src/origin-identity.ts` and the test that keeps this list honest
is `src/origin-identity.test.ts` (a source file mentioning the identifier must be
a registered producer, declaration, or reference — the inventory cannot rot
silently).

## Producers

| File | Kind | Value |
|---|---|---|
| `src/normalizer.ts` | extract | `original_source \| origin \| source` from the raw provider item |
| `src/providers/generic-http.ts` | extract | the configured `field_map` key for `original_source` |
| `src/providers/yep.ts` | extract | `item.source.url \| .site \| .name` |
| `src/dedup.ts` | merge | a collapsed duplicate's value, carried onto the representative |
| `src/corroborate.ts` | merge | copied into a corroboration source record |

`extract` sites fabricate a value; `merge` sites carry an existing one forward.
Only an `extract` site can make a claim about a document, and none of them
promises one: `normalizer` takes whatever `source` holds, `field_map` takes what
the operator maps, and `yep` prefers a URL but falls back to a site or name.

## Declarations

`src/types.ts` (three declarations), `src/deep-search.ts` (a local result shape),
`src/calibration.ts` (a source shape plus a read that treats a present origin as
primary).

## References

`src/verbosity.ts` (a comment naming the field REQ-001 requires in non-compact
output) and `src/origin-identity.ts` (the rule and this inventory).

## Roadmap trigger verdict

The roadmap item asked whether `original_source` carries a document-identifying
URL for at least one enabled provider. It does: `src/providers/yep.ts` sets
`item.source.url` first, which is a document URL whenever the provider returns
one. The other paths are configuration- or provider-dependent, which is exactly
why identity is derived (`originIdentity`) rather than trusted: a site root
returns null, a feed suffix is stripped, and a query string is ignored, so a
publisher value cannot group distinct documents. The condition for origin
grouping in reconciliation is met.
