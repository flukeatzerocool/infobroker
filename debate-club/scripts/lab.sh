#!/usr/bin/env bash
# lab.sh — debate-club Lab entry point (agentic, live). Runs each persona
# scenario through headless opencode against the live Infobroker MCP and
# evaluates the transcript mechanically. A critic/rubric pass is advisory.
#
# Usage: lab.sh [--only=<id>[,<id>...]] [--from=<id>] [--help]
# Exit: 0 all selected scenarios passed (or opencode absent → skip);
#       1 a scenario failed; 2 usage error.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBATE="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO="$(cd "$DEBATE/.." && pwd)"
MANIFEST="$DEBATE/lab-scenarios.json"
EVALUATOR="$SCRIPT_DIR/evaluate-lab.mjs"

# shellcheck source=scripts/lib/opencode-utils.sh
source "$REPO/scripts/lib/opencode-utils.sh"

ONLY=""; FROM=""
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
    --from=*) FROM="${arg#--from=}" ;;
    --help|-h)
      printf '%s\n' "Usage: lab.sh [--only=<id>[,<id>...]] [--from=<id>]"
      exit 0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if ! command -v opencode >/dev/null 2>&1; then
  warn "opencode not found — skipping live Lab (informational)."
  exit 0
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="$DEBATE/.runs/lab-$TIMESTAMP"
mkdir -p "$RUN_DIR/scenarios"

export ONLY FROM
node -e '
  const fs = require("fs");
  const only = (process.env.ONLY || "").split(",").filter(Boolean);
  const from = process.env.FROM || "";
  const all = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  let skip = Boolean(from);
  const out = [];
  for (const s of all) {
    if (from && s.id === from) skip = false;
    if (skip) continue;
    if (only.length && !only.includes(s.id)) continue;
    out.push(s);
  }
  for (const s of out) fs.writeFileSync(`${process.argv[2]}/${s.id}.json`, JSON.stringify(s, null, 2));
  process.stdout.write(JSON.stringify(out.map((s) => s.id)));
' "$MANIFEST" "$RUN_DIR/scenarios" > "$RUN_DIR/order.json"

IDS=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).join(" "))' "$RUN_DIR/order.json")
if [[ -z "$IDS" ]]; then die "No scenarios selected (check --only/--from)."; fi

ensure_opencode_serve "$RUN_DIR" "opencode-serve.log"
cleanup() { cleanup_serve; }
trap cleanup EXIT SIGINT SIGTERM

: > "$RUN_DIR/results.ndjson"
for id in $IDS; do
  sc="$RUN_DIR/scenarios/$id.json"
  work="$RUN_DIR/$id"
  mkdir -p "$work"
  info "════ Running lab scenario $id ════"
  node -e 'console.log(require(process.argv[1]).utterance)' "$sc" > "$work/prompt.md"
  opencode run --attach "$SERVER_URL" --agent build --auto --format json \
    "$(cat "$work/prompt.md")" > "$work/turn0.txt" 2>> "$RUN_DIR/openruns.log" || true
  node "$EVALUATOR" "$sc" "$work/turn0.txt" "$work" >> "$RUN_DIR/results.ndjson"
done

node -e '
  const fs = require("fs");
  const lines = fs.readFileSync(process.argv[1], "utf8").trim().split("\n").filter(Boolean);
  const out = {};
  let pass = 0, fail = 0;
  for (const l of lines) { let o; try { o = JSON.parse(l); } catch { continue; } out[o.id] = o; if (o.status === "pass") pass++; else fail++; }
  fs.writeFileSync(process.argv[2], JSON.stringify({ summary: { pass, fail, total: pass + fail }, scenarios: out }, null, 2));
' "$RUN_DIR/results.ndjson" "$RUN_DIR/results.json"

fails=$(node -e 'console.log(require(process.argv[1]).summary.fail || 0)' "$RUN_DIR/results.json")
if [[ "$fails" != "0" ]]; then
  error "FAILED: ${fails} lab scenario(s). Results: $RUN_DIR"
  exit 1
fi
info "All lab scenarios passed. Results: $RUN_DIR"
