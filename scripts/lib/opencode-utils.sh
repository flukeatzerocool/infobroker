#!/usr/bin/env bash
# opencode-utils.sh — shared helpers for the agentic test harnesses
# (test-skills.sh, test-research.sh, debate-club/scripts/lab.sh). Sourced, not
# run directly.
#
# opencode v2 removed `run --attach` (the client flag is now the global
# `--server`) and made the serve API password-protected: `serve` mints a random
# password unless OPENCODE_PASSWORD is set before it starts, and every client
# must present that same value. These helpers set the password once and publish
# the URL; callers pass `--server "$SERVER_URL"`.

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

# ── Password ─────────────────────────────────────────────────────────────────
# opencode_gen_password — set and export OPENCODE_PASSWORD unless the caller
# already chose one. Must run before `opencode serve` starts: the server adopts
# the variable's value instead of minting a random password that clients would
# then have to scrape out of the serve log.
opencode_gen_password() {
  if [[ -z "${OPENCODE_PASSWORD:-}" ]]; then
    OPENCODE_PASSWORD=$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')
    export OPENCODE_PASSWORD
  fi
}

# ── opencode serve ───────────────────────────────────────────────────────────
# find_free_port — ask the kernel for an unused port; fall back to the
# configured default when node is unavailable.
find_free_port() {
  node -e 'const net=require("net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})' 2>/dev/null \
    || echo "${PIPELINE_PORT:-4096}"
}

# ensure_opencode_serve_at <run_dir> <log_name> <port> [<cwd>] — start a fresh,
# self-owned server in <cwd> (default: $PWD) and wait for it to answer. Sets
# SERVER_URL, OPC_SERVE_PID, and started=true.
#
# Reuse is opt-in. A v2 server answers an unauthenticated curl, so "it responds"
# does not mean "we can talk to it"; reusing one would hand the harness a server
# whose password we do not hold. Only OPENCODE_REUSE_SERVE=1 with a caller-set
# OPENCODE_PASSWORD reuses an instance we can actually authenticate against;
# everything else starts a server whose password we chose.
ensure_opencode_serve_at() {
  local run_dir="$1" log_name="${2:-opencode-serve.log}" port="${3:-}" cwd="${4:-$PWD}"
  [[ -n "$port" ]] || port=$(find_free_port)
  opencode_gen_password
  SERVER_URL="http://127.0.0.1:${port}"
  started=false
  if [[ "${OPENCODE_REUSE_SERVE:-0}" == "1" ]] \
      && curl -s --max-time 2 -o /dev/null "$SERVER_URL" 2>/dev/null; then
    info "Reusing existing opencode serve at $SERVER_URL (OPENCODE_REUSE_SERVE=1)"
    return 0
  fi
  info "Starting opencode serve on port $port (cwd: $cwd)..."
  ( cd "$cwd" && opencode serve --port "$port" ) > "$run_dir/$log_name" 2>&1 &
  OPC_SERVE_PID=$!
  local i=0
  until curl -s --max-time 2 -o /dev/null "$SERVER_URL" 2>/dev/null; do
    i=$((i + 1))
    [[ $i -gt 60 ]] && die "opencode serve did not come up (see $run_dir/$log_name)"
    sleep 1
  done
  started=true
}

# ensure_opencode_serve <run_dir> <log_name> — free port, current directory.
ensure_opencode_serve() {
  ensure_opencode_serve_at "$1" "${2:-opencode-serve.log}" "" "$PWD"
}

# cleanup_serve — tear down the backend only if this script started it.
cleanup_serve() {
  if [[ "${started:-false}" == "true" && -n "${OPC_SERVE_PID:-}" ]]; then
    kill "$OPC_SERVE_PID" 2>/dev/null || true
  fi
}
