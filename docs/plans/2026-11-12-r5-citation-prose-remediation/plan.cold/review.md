Reviewer: review (independent-review cold pass)
Plan sha256: d01e8bc6a75b3762f9f54902b241f5aa13a6c7983a234379c1cc32a9f4343e19
Passes: 1 (revision 1, FAILED) then diff re-review (revision 2, passed)

# Cold review — R5 citation and prose remediation (revision 1)

Revision-1 artifact sha256: 2477edd906353e600d145705df531ac1e629e230150b6b15ecce047ad51d816e

Verdict: independent-review FAILED. 1 Blocker, 3 Major, 4 Minor.
Stages: 4/5 (Stage 4 not triggered; no author edits during the pass).
Comprehension: faithful-with-gaps (the document never mentions the global
compact shaper, so a reader cannot locate where compact shaping happens).

## Blocker

B1 [design] Handler-local meta helper is stripped by compactEnvelope.
src/index.ts:1823-1835 -> src/structured-output.ts:91-92 ->
src/verbosity.ts:24,54-62. plan.md:35-43, 51-55, 143-145.
Effect: plan.md:59-67 tests stay red; done bar plan.md:3-5 unreachable;
blast radius plan.md:98-107 and CHANGELOG step plan.md:84-87 incomplete.

## Major

M1 [design] test provider lacks url; setup falls back to
http://127.0.0.1:1 (src/dispatch-orchestration.test.ts:111; idiom :143-149;
endpoint src/lib/stub-provider.ts:217). plan.md:60-64.
M2 [design] census edit at worklist.md:585 corrupts a dated snapshot already
lagging F-R5-A-1 (worklist.md:740) and contradicts plan.md:92-94's own rule
for worklist.md:588.
M3 [design] verdict rows worklist.md:314, :324 left stale with superseded
line refs; precedent worklist.md:382,384. plan.md:89-94, 9-10.

## Minor

N1 plan.md:75 -> paragraph is infobroker.md:1030-1032.
N2 no get_citations call helper in dispatch-orchestration.test.ts (only
search(), :101-105); plan.md:59-64 should name it.
N3 dead guard src/index.ts:2708 after the change; plan.md:43 silent.
N4 plan.md:139-142 probe names no harness; not evidence for M1's path.

## Confirmed accurate

src/index.ts:2684-2701/2708; infobroker.md:1030-1032 vs REQ-121 :342-343,
src/corroborate.ts:377-400, src/source-family.ts:100-118, config.json:337;
REQ-027a :358 unconditional; family_count src/corroborate.ts:287; stub
mode "empty" src/lib/stub-provider.ts:15,84; ROADMAP.md:17-22;
CHANGELOG/package.json 2026.11.11.

## Unknowns

1 gates not run (validate-spec, check-tdqs, check-intent-citations).
2 Arena citations scenario shape not read.
3 probe harness unknown (sidecar not read).
4 register-wide Resolved count not enumerated.
5 project instructions injected; Stages 3 and 5 shared one context.

---

# Diff re-review — revision 2 (sha256 d01e8bc6a75b3762f9f54902b241f5aa13a6c7983a234379c1cc32a9f4343e19)

Verdict: independent-review passed.
Stages: 1 (artifact identity + evidence), 2 (change-to-code verification of
added lines), 3 (prior-finding closure). Stage 4 not triggered. Reads 10/10.

Prior findings B1, M1, M2, M3, N1, N2, N3, N4: all Resolved, each verified
against the code (B1: src/verbosity.ts:24,27-33,47-63;
src/structured-output.ts:62-67,91-92,97-117; src/index.ts:1823-1842,
2684-2699,2708).

New findings: three clarity Nits, none blocking (the §8.2 sentence could name
the minimum-substance floor on text comparison; the `requiredMetaKeys`
parameter position is the implementer's choice; the verdict-predicate
correction targets are stated elsewhere in the plan).

Deferred: none. Unknowns: register-row line numbers not re-enumerated; the M1
census rationale rests on the prior pass; the gates were not run.

independent-review passed.
