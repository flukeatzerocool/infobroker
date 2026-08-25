#!/usr/bin/env bash
# opencode-utils.sh — shared helpers for the agentic test harnesses
# (test-skills.sh, test-research.sh). Sourced, not run directly.

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}$*${NC}"; }
warn()  { echo -e "${YELLOW}$*${NC}"; }
error() { echo -e "${RED}$*${NC}"; }
die()   { error "$*"; exit 1; }

# ── Pre-flight ───────────────────────────────────────────────────────────────
# require_tools <tool...> — die if any tool is missing.
require_tools() {
  local missing="" t
  for t in "$@"; do
    command -v "$t" >/dev/null 2>&1 || missing="$missing $t"
  done
  [[ -z "$missing" ]] || die "Pre-flight failed: missing:$missing"
}

# ── opencode serve ───────────────────────────────────────────────────────────
# ensure_opencode_serve <run_dir> <log_name> [port] — reuse a running instance
# at :<port> or bootstrap one; sets SERVER_URL, OPC_SERVE_PID, started=true
# (only when this script started it). Echoes the URL.
ensure_opencode_serve() {
  local run_dir="$1" log_name="${2:-opencode-serve.log}" port="${3:-${PIPELINE_PORT:-4096}}"
  SERVER_URL="http://localhost:${port}"
  started=false
  if curl -s -o /dev/null "$SERVER_URL" 2>/dev/null; then
    info "Reusing existing opencode serve at $SERVER_URL"
  else
    info "Starting opencode serve on port $port..."
    opencode serve --port "$port" > "$run_dir/$log_name" 2>&1 &
    OPC_SERVE_PID=$!
    local i=0
    until curl -s -o /dev/null "$SERVER_URL" 2>/dev/null; do
      i=$((i+1))
      [[ $i -gt 60 ]] && die "opencode serve did not come up (see $run_dir/$log_name)"
      sleep 1
    done
    started=true
  fi
}

# cleanup_serve — tear down the backend only if this script started it.
cleanup_serve() {
  if [[ "$started" == "true" && -n "${OPC_SERVE_PID:-}" ]]; then
    kill "$OPC_SERVE_PID" 2>/dev/null || true
  fi
}
