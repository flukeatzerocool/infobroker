# Review Register

Findings and follow-through items from the after-action review loop. Each
entry carries a terminal disposition: `Resolved`, `Scheduled-roadmap`,
`Closed-P3`, or `Deferred-by-user`. The AAR references this file; it does not
restate it. `ROADMAP.md` is the tracking surface for scheduled work.

## Resolved

Findings fixed and verified in-session.

- **Security audit findings SEC-1..SEC-9 (2026.09.14)** — full-stack audit
  (spec traceability, implementation controls, adversarial runtime probing,
  supply chain). Fixed and verified by D-054. SEC-1 (P0, SSRF bypass for
  `0.0.0.0` and IPv4-mapped IPv6) reproduced against a loopback server before
  the fix and blocked after; SEC-2 (key-pool state dir `755`, no validation)
  now `0700` with structural/numeric reset; SEC-3 (`sealReportBytes` plaintext
  fallback under enabled encryption) now refuses and the enabling invariant
  locks on any start; SEC-4 (audit-log newline injection) now one line per
  event; SEC-5 (publish path skipped the dependency gate) now runs
  `npm run check` and pins actions by SHA; SEC-6 (content-policy whitespace /
  zero-width bypass) now normalized; SEC-7 (error sanitizer left credentials)
  now redacts; SEC-8 (`hono`/`@vitest/mocker` advisories) updated to patched
  versions; SEC-9 (hook discipline) now `bash` + `set -euo pipefail`. Verified
  by `npm run check` green (345 tests, 0 vulnerabilities) and the four PoCs
  (`/tmp/opencode/{ssrf,audit,policy,state}-poc.mts`) now fail closed.
- **Spec-review baseline SR-1..SR-10 (2026.09.06)** — OWASP security and
  spec-quality findings from the 8-dimension baseline. Resolved by D-047:
  SR-1/SR-8 → REQ-096/097/098/099/100/101/102 (§4.11, §E); SR-2 → terminology
  additions; SR-3 → SR-004/§5.2 provider lists refreshed; SR-4 → REQ-011/012
  merge, REQ-004/033 re-pointed at §10.1; SR-5/SR-6 → REQ-021/026c/026d/§7.3
  prose tightened; SR-7 → DNS-resolved SSRF validation + G1 item; SR-9/SR-10 →
  documented (forward references are structural; REQ-089/092 duplication is
  intentional per D-042). Verified by `npm run check` green and
  `validate-spec`'s new §E mapping gate.
- **AGENTS.md provider-backend table stale** — missing the six zero-config
  providers added in the competitive batch, and a stale `v2026.08.10` header.
  Resolved: rows and version stamp updated; a `validate-spec` gate now
  reconciles the table against `config.json` and the stamp against
  package.json.
- **`provider-map.md` dispatch tables stale** — missing the `financial` row,
  stale `academic`/`news` chains, six providers absent. Resolved: the file is
  now generated from `config.json`; a `validate-spec` staleness gate fails on
  drift.
- **Spec §1.6 block-reservation paragraph stale** — sub-REQ ranges omitted
  `020f`, `021d`–`021e`, `031a`, `088`–`092`, `095`. Resolved: ranges
  corrected; a `validate-spec` gate reconciles the paragraph against the
  §9.5 manifest.

## Scheduled-roadmap

Findings scheduled on `ROADMAP.md` for a future increment.

## Closed-P3

Informational findings recorded with no action.

## Deferred-by-user

Findings the user explicitly declined to act on.
