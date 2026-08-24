#!/usr/bin/env bash
# lib.sh — shared helpers for the Infobroker push pipeline.
# Sourced by push-pipeline.sh; not run directly.

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ── Logging ──────────────────────────────────────────────────────────────────
info()  { echo -e "${GREEN}$*${NC}"; }
warn()  { echo -e "${YELLOW}$*${NC}"; }
error() { echo -e "${RED}$*${NC}"; }

die() {
  error "$*"
  exit 1
}

# ── JSON helpers (node is a pre-flight requirement) ─────────────────────────
# json_from_file <path> <key>   → prints the value of <key> from a JSON file,
#                                 or "?" if missing/unparseable.
json_from_file() {
  local path="$1" key="$2"
  node -e 'try{const j=require(process.argv[1]);const k=process.argv[2];console.log(j[k] ?? "?")}catch{console.log("?")}' \
    "$path" "$key" 2>/dev/null || echo "?"
}

# ── Secret scan ──────────────────────────────────────────────────────────────
# scan_staged_for_secrets → lists matched staged lines; returns 0 if any.
# Portable grep -E pattern; no -P dependency.
scan_staged_for_secrets() {
  git -C "$PROJECT_DIR" diff --staged --unified=0 | grep -E \
    '^\+(.*(sk-[A-Za-z0-9]{20,}|api[_-]?key[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9]{16,}|password[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']+["'"'"']|INFOBROKER_[A-Z_]+_API_KEY[[:space:]]*=[^[:space:]]+))' \
    | grep -v '^+++' || true
}

# ── git identity guard ───────────────────────────────────────────────────────
require_git_identity() {
  local name email
  name=$(git -C "$PROJECT_DIR" config user.name 2>/dev/null || true)
  email=$(git -C "$PROJECT_DIR" config user.email 2>/dev/null || true)
  [[ -n "$name" && -n "$email" ]] || die "git user.name/user.email not configured — set them before committing."
}

# ── opencode session helpers ─────────────────────────────────────────────────
# opencode runs are attached to one persistent `opencode serve` instance and
# driven through a single continued session, so spec/code context is loaded
# once and reused across steps (instead of cold-starting each step).

# Start the persistent backend. Sets PIPELINE_SERVER_URL.
ensure_server() {
  if [[ -n "${PIPELINE_SERVER_URL:-}" ]]; then return 0; fi
  local port="${PIPELINE_PORT:-4096}"
  # Find a free port, then start `opencode serve` headless.
  info "Starting opencode serve on port ${port}..."
  opencode serve --port "$port" > "$PIPELINE_LOG_DIR/opencode-serve.log" 2>&1 &
  OPC_SERVE_PID=$!
  PIPELINE_SERVER_URL="http://localhost:${port}"

  # Wait for the server to come up.
  local i=0
  until curl -s -o /dev/null "$PIPELINE_SERVER_URL" 2>/dev/null; do
    i=$((i+1))
    if [[ $i -gt 60 ]]; then die "opencode serve did not come up within 60s (see $PIPELINE_LOG_DIR/opencode-serve.log)."; fi
    sleep 1
  done
  info "opencode serve ready at ${PIPELINE_SERVER_URL}"
}

# Resolve the shared session id. Uses a stable identifier so all steps in one
# run share a single conversation.
#
# opencode distinguishes two operations: `--title` CREATES a session (the id
# is only known afterward), while `--session <id>` CONTINUES an existing
# session by its `ses_...` id. There is no flag that creates a session and
# names its id in advance, so the first step must (a) create the session via
# `--title`, (b) capture the resulting `sessionID` from the JSON event stream,
# and then (c) later steps continue it via `--session <id>`.
#
# PIPELINE_SESSION_ID starts as a title; ensure_session promotes it to a real
# id (or leaves it alone if a caller/the resume path already supplied one).
ensure_session() {
  local title="${PIPELINE_SESSION_TITLE:-push-pipeline}"
  PIPELINE_SESSION_TITLE="$title"

  # Already resolved (resume / caller-provided): leave as-is.
  if [[ "${PIPELINE_SESSION_ID:-}" == ses_* ]]; then
    return 0
  fi

  # Bootstrap: create the session and capture its id via a minimal probe turn.
  local server="${PIPELINE_SERVER_URL:-http://localhost:${PIPELINE_PORT:-4096}}"
  local probe
  probe=$(
    opencode run --attach "$server" --title "$title" --agent build --auto --format json \
      "Session bootstrap only — reply with the single word: ack" \
      2>>"$PIPELINE_LOG_FILE" \
    | grep -oE '"sessionID":"ses_[^"]+"' | head -1 \
    | sed -E 's/.*"sessionID":"(ses_[^"]+)"/\1/'
  )
  if [[ -n "$probe" ]]; then
    PIPELINE_SESSION_ID="$probe"
    info "Shared session resolved: $PIPELINE_SESSION_ID"
  else
    die "Failed to resolve shared session id for title '$title' (opencode serve may be down)"
  fi
}

# run_pipeline_step <prompt-file> <out-file> [--model <m>] [--retry]
# Runs one step in the shared session. On retry, forks a fresh session.
run_pipeline_step() {
  local prompt_file="$1" out_file="$2"
  local model="${PIPELINE_MODEL:-}" retry=false
  shift 2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --model) model="$2"; shift 2 ;;
      --retry) retry=true; shift ;;
      *) shift ;;
    esac
  done

  local prompt
  prompt=$(<"$prompt_file")

  local timeout_cmd=(opencode)
  if [[ "${OPC_TIMEOUT:-1800}" -gt 0 ]] && command -v timeout >/dev/null 2>&1; then
    timeout_cmd=(timeout "$OPC_TIMEOUT" opencode)
  fi

  local args=()
  args+=(run --attach "$PIPELINE_SERVER_URL" --session "$PIPELINE_SESSION_ID" --agent build --auto)
  [[ -n "$model" ]] && args+=(--model "$model")

  set +e
  "${timeout_cmd[@]}" "${args[@]}" "$prompt" > "$out_file" 2>> "$PIPELINE_LOG_FILE"
  OPC_RC=$?
  set -e

  if [[ $OPC_RC -ne 0 ]] && $retry; then
    warn "Session step '${prompt_file}' failed (exit ${OPC_RC}) — retrying once in a forked session..."
    # Fork: use a fresh continuation to avoid a poisoned conversation state.
    local retry_args=(run --attach "$PIPELINE_SERVER_URL" --session "$PIPELINE_SESSION_ID" --fork --agent build --auto)
    [[ -n "$model" ]] && retry_args+=(--model "$model")
    set +e
    "${timeout_cmd[@]}" "${retry_args[@]}" "$prompt" > "${out_file}.retry" 2>> "$PIPELINE_LOG_FILE"
    OPC_RC=$?
    if [[ $OPC_RC -eq 0 ]]; then mv "${out_file}.retry" "$out_file"; fi
    set -e
  fi
}

# stop_server — tear down the persistent backend.
stop_server() {
  if [[ -n "${OPC_SERVE_PID:-}" ]]; then
    kill "$OPC_SERVE_PID" 2>/dev/null || true
    unset OPC_SERVE_PID
  fi
}
