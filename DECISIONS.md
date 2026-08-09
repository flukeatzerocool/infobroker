# DECISIONS.md — Infobroker Implementation Decisions

## Active Decisions

### D-001: Response Envelope Format
The REQ-001 contract specifies JSON with `[OK]`/`[ERROR]` prefix.
Tools return `[OK] JSON_BODY` or `[ERROR] JSON_BODY` text content through
MCP's `{content: [{type: "text", text: ...}]}` format. The JSON body
follows the `ToolOkResponse` / `ToolErrorResponse` shapes.

### D-002: Provider Search Architecture
All providers export standalone functions (`search`, `health`). They are
wired in a switch statement in `index.ts` rather than using a dynamic
plugin registry. This was chosen for type safety and simplicity. Adding
a new provider requires: (1) implementing the search and health functions,
(2) exporting from `providers/index.ts`, (3) importing and adding the
case to the switch in `index.ts`.

### D-003: Scraped Provider Rate Limits
Marginalia and Mojeek use conservative rate limits (0.2 req/sec = 5s
interval) because their rate limits are undocumented. DuckDuckGo uses
3s minimum as documented.

### D-004: Convergence Algorithm Simplification
The convergence loop executes sequentially (not truly parallel) because
per-provider rate limiting requires sequential throttle checks. The
algorithm groups claims by normalized topic name, computes confidence
from unique domain count, and iterates up to max_iterations.

### D-005: Keyed Provider Auth Handling
Keyed providers (Brave, Exa, Tavily) are configured in config.json with
`enabled: false` by default. Users must set the corresponding
`INFOBROKER_<NAME>_API_KEY` env var and toggle `enabled: true`.
Health checks report `inactive` when keys are missing. The startup health
check logs `inactive (no_api_key)` for keyed providers without keys.

### D-006: Client-artifact REQ Exemptions
REQs 050-054 (client artifacts) are verified by file presence, not
source citations, per the validate-spec exemption. These files are
generated/maintained manually: `instructions/search-preferences.md`,
`skills/infobroker/SKILL.md`, `skills/infobroker/references/*.md`,
`vendor/opencode-skills/*/SKILL.md`, and `README.md`.

### D-010: Spec-First REQ Waivers (2026.08.08 Spec Engineering)

REQ-035 (Request Timeout), REQ-036 (Latency Tracking Window), and
REQ-037 (Config Validation) were authored during the 2026.08.08
spec-engineering pass as forward-looking requirements. These REQs define
contracts for behavior not yet implemented — they will produce
validate-spec warnings (no @implements citation) until the corresponding
implementation is added in a subsequent build cycle. These warnings are
intentional and serve as implementation reminders.

### D-007: No Explicit Provider Plugin Interface
Each provider exports standalone functions matching the same signature
convention (`search`, `fetchPage`, `health`) rather than implementing
a TypeScript `Provider` interface. The interface type exists in `types.ts`
for documentation but is not used for enforcement at runtime. This avoids
the need for a dynamic registry while keeping the structure consistent.

### D-008: Retry Strategy
HTTP errors with status 429 or 503 are retried with exponential backoff
(1s, 2s, 4s). Providers throw `RetryableError` with the HTTP status code.
Non-retryable errors (4xx auth, 5xx server errors) fail immediately and
trigger fallback chain advancement.

### D-009: Quota Tracking Granularity
Quota counters track daily and monthly usage. Reset occurs at midnight
UTC for daily, month boundary for monthly. The 80% warning threshold
and 100% exhaustion are computed per-provider. Counters without explicit
limits (Infinity) never trigger warnings.

### D-011: KB REQ Forward-Looking Waivers (2026.08.09 Spec Engineering)

REQ-060 through REQ-067 (Knowledge Base) were authored during the
2026.08.09 spec-engineering pass as forward-looking requirements. These
REQs define contracts for a local RAG knowledge base — a new subsystem
not yet implemented. They will produce validate-spec warnings (no
@implements citation) until the corresponding implementation is added
in a subsequent build cycle. These warnings are intentional and serve
as implementation reminders.
