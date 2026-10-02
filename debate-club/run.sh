#!/usr/bin/env bash
# run.sh — debate-club entry point.
#
#   ./run.sh arena            Run the deterministic offline contract suite.
#   ./run.sh record <out.ndjson>  Capture live responses (then normalize).
#   ./run.sh normalize <in.ndjson> <out.json>  NDJSON capture -> replay fixtures.
#   ./run.sh report [run_dir]  Roll up telemetry into a summary report.
#   ./run.sh recommend [run_dir]  Rule-based recommendations from the report.
#   ./run.sh lab [flags]      Run the agentic persona Lab (live opencode).
#   ./run.sh --help
#
# Exit codes: 0 pass, 1 failure, 2 fatal/usage error.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEBATE="$SCRIPT_DIR"

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
}

cmd="${1:-arena}"
shift || true

case "$cmd" in
  arena)
    cd "$REPO_ROOT"
    npx vitest -c debate-club/vitest.config.ts run "$@"
    ;;
  record)
    out="${1:-$DEBATE/.runs/capture-$(date +%Y%m%d-%H%M%S).ndjson}"
    mkdir -p "$(dirname "$out")"
    echo "Recording live responses to $out (hits real providers; respect rate limits)."
    node "$DEBATE/scripts/record-driver.mjs" "$out"
    ;;
  normalize)
    [[ -n "${1:-}" && -n "${2:-}" ]] || { echo "usage: run.sh normalize <in.ndjson> <out.json>"; exit 2; }
    node "$DEBATE/scripts/normalize.mjs" "$1" "$2"
    ;;
  report)
    node "$DEBATE/scripts/report.mjs" "${1:-$DEBATE/.runs/latest}"
    ;;
  recommend)
    node "$DEBATE/scripts/recommend.mjs" "${1:-$DEBATE/.runs/latest}"
    ;;
  lab)
    bash "$DEBATE/scripts/lab.sh" "$@"
    ;;
  --help|-h|help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 2
    ;;
esac
