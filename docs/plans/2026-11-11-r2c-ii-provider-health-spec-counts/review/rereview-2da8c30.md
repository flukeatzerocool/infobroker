# Diff re-review — R2c-ii plan, revision 2

**Reviewer:** review subagent (cold diff re-review; no authoring context)
**Plan sha256 (dispatched):** `2da8c301fdccd8aea80efe88465b5d93af6ff66d4fadb40978d1043c0997d549`
**Mode:** diff re-review only. No new-lens sweep; unchanged sections were not
re-read or re-litigated.
**Reads:** 9 of 10.

Recorded by the parent session because the reviewer ran read-only.

Scope note: the reviewer adjudicated only the regions the § Review dispositions
table points at, plus the target-file lines those regions assert. Project
instructions (AGENTS.md, user-level general.md/search-preferences.md) were
injected into that context; recorded per the skill's isolation clause.

## Adjudication of prior findings

| # | Status | Settling text / evidence |
|---|---|---|
| **B1** stub disabled in shipped config | **RESOLVED** | P5 states the URL variable alone "proves nothing" and requires an isolated config copy with `searxng.enabled = true`; Phase 0 step 3 repeats it; C-7 makes it normative; DB-1 evidence uses the hermetic config. |
| **B2** failing stub search falls through to live chain | **RESOLVED** | C-7 pins every dispatch chain to `["searxng"]` and disables every other provider, so `getDispatchChain` can yield exactly one candidate and the hedge has no second one. The failure leg is HTTP 404, and `isRetryable` retries only 429 or 500-599 (`src/retry.ts:62-71`), so no backoff loop either. |
| **M1** `native_fetch` flips inactive→active | **REFUTED** (correctly) | Independently confirmed in code: `providerUsable` (`src/config.ts:1127-1134`) returns true for an enabled provider with no `url_env` and credential class `none`; `src/index.ts:1518` sets `status = "active"` directly, and the probe block at `:1522` is skipped because `resolveProvider` yields nothing — today's row is `active`, `auth_ok: true`, no probe. DB-1 pins that row. |
| **M2** `exhausted` precedence + `inactive_reason` | **RESOLVED as stated** — the fix introduced N1 | Precedence is explicit; `exhausted` is enumerated on the field. |
| **m1** test-file count | **RESOLVED** | "Tests (6 files, 4 of them new)" matches the enumerated six. |
| **m2** unpinned N in DB-3 | **RESOLVED** | Phase A = two `list` + one `spec` → 2; phase B = +1 stub-backed `search_web` → 3; self-exclusion stated. |
| **m3** throw anchor / retry class | **RESOLVED** | The throw is `src/providers/searxng.ts:24`; 404 is non-retryable; 5xx/429/timeouts named as the retried class. |
| **m4** `ProviderAssessment.operational` | **RESOLVED** | Field dropped; one representation per D-5. |
| **m5** duplicated truth table | **RESOLVED** | `isOperational` lives beside `providerUsable`'s table and `providerUsable` delegates; behavior-preserving. |
| **Nit** worklist path | **RESOLVED** | Full path in DB-6 and Phase 3. |
| **Nit** CHANGELOG placeholder | **RESOLVED** | The named heading matches `CHANGELOG.md:3` byte for byte. |
| **Nit** debate-club anchor | **RESOLVED** | `:422-429` for the status set, `:389-421` for spec counts. |

## New findings in changed text

**N1 — [Blocker] [clarity] — the `inactive_reason` presence contract contradicts
itself inside the done bar.** DB-8 said the field is "present on every
non-active report including `exhausted`", while DB-1 requires "a case proving an
enabled but unreachable provider stays `inactive` **without** a reason". An
unreachable enabled provider is a non-active report with no reason, so DB-1's
required assertion violated DB-8's required contract. The same over-broad
reading also demands a reason on the `degraded` leg of DB-4, where no reason
value is defined. C-6 was compatible ("appears **only on** a non-active
report"); only DB-8's "every" overstated. **Must change:** narrow DB-8 (and the
disposition row) to "present on every report that has a stated cause —
`disabled` or `exhausted` — and absent when the cause is the probe result
itself."

**N2 — [Nit] [clarity] — status line still said revision 1.** Set it to
revision 2 before stamping.

**N3 — [Nit] [clarity] — production file count drifted in the commit series.**
Blast radius says seven; Phase 4 step 1 said six.

**N4 — [Nit] [clarity] — "probe eligibility has one source" was slightly
over-claimed.** `native_fetch` is operational and has no probe target, so the
probe is skipped by the registered-target term, not by `isOperational`. Say
"eligibility = `isOperational` and a registered probe target".

## Unknowns

- The revision's spawned `native_fetch` probe was not re-run (read-only
  dispatch); the code path was substituted and confirms the claimed row.
- Whether `wikipedia` is enabled in the shipped config was not re-read.
- Whether the opt-in, cached update check fires on a spawned server start; if it
  does, C-7's "no external request" claim is narrower than stated. Default-off
  per AGENTS.md, so recorded as an Unknown, not a finding.
- Appendix B measurements were not recomputed; untouched by this revision.

## Outcome

All five findings in the changed text (N1–N4) were fixed in revision 2a and
re-audited at the clarity stage only, per the skill's clarity-blocker rule; see
`clarify-2a.md` in this directory.

independent-review FAILED. plan.md — 1 blocker
