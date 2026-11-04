#!/usr/bin/env bash
# lib.sh — shared helpers for the Infobroker push pipeline.
# Sourced by push-pipeline.sh; not run directly.

# ── Colors ───────────────────────────────────────────────────────────────────
# Emit color only to a TTY (and honor NO_COLOR) so redirected logs stay clean.
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  NC='\033[0m'
else
  GREEN=''
  YELLOW=''
  RED=''
  NC=''
fi

# ── Logging ──────────────────────────────────────────────────────────────────
# log_line <text...> — append a line to the run log when the pipeline has
# created one. Every info/warn/error line is mirrored here so pipeline.log is
# a complete run log even for deterministic-only runs (a --dry-run or an early
# failure previously left the file empty, because only AI steps wrote to it).
log_line() {
  [[ -n "${PIPELINE_LOG_FILE:-}" ]] && printf '%s\n' "$*" >> "$PIPELINE_LOG_FILE"
  return 0
}

info()  { echo -e "${GREEN}$*${NC}"; log_line "$*"; }
warn()  { echo -e "${YELLOW}$*${NC}"; log_line "WARN: $*"; }
error() { echo -e "${RED}$*${NC}"; log_line "ERROR: $*"; }

die() {
  error "$*"
  log_line "FATAL: $*"
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

# summary_counts <path> → prints "<critical> <high> <info>" when the file
# parses and all three are integers; exits 1 otherwise. Unlike json_from_file,
# a missing or malformed artifact is a hard failure: the read-through gate
# cannot tell "?" from a clean run, so it must not accept it.
summary_counts() {
  node -e '
    const fs = require("fs");
    let j;
    try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch { process.exit(1); }
    const counts = ["critical", "high", "info"].map((k) => j[k]);
    if (!counts.every((v) => Number.isInteger(v))) process.exit(1);
    console.log(counts.join(" "));
  ' "$1" 2>/dev/null
}

# ── Secret scan ──────────────────────────────────────────────────────────────
# scan_staged_for_secrets → one `path:line [secret-pattern]` per match in the
# staged additions. The matched value is NEVER printed: diagnostics and
# pipeline.log must not become a secondary leak. Only added lines are scanned,
# so pre-existing example keys in the tree do not block every run.
# Portable grep -E pattern; no -P dependency.
SECRET_PATTERN='sk-[A-Za-z0-9]{20,}|api[_-]?key[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9]{16,}|password[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']+["'"'"']|INFOBROKER_[A-Z_]+_API_KEY[[:space:]]*=[^[:space:]]+'
scan_staged_for_secrets() {
  git -C "$PROJECT_DIR" diff --cached --unified=0 --no-color --diff-filter=ACMR 2>/dev/null \
    | awk '
        /^\+\+\+ b\// { file = substr($0, 7); next }
        /^@@ / {
          if (match($0, /\+[0-9]+/)) { ln = substr($0, RSTART + 1, RLENGTH - 1) + 0 }
          next
        }
        /^\+/ && !/^\+\+\+/ {
          printf "%s\t%d\t%s\n", file, ln, substr($0, 2)
          ln++
          next
        }
      ' \
    | grep -E "$SECRET_PATTERN" \
    | cut -f1,2 \
    | sed -e 's/\t/:/' -e 's/$/ [secret-pattern]/' \
    || true
}

# pipeline_version <project-dir> — the package version, resolved from the
# project path so the caller's cwd cannot change (or hide) it.
pipeline_version() {
  node -e '
    try { console.log(require(process.argv[1]).version); }
    catch { process.exit(1); }
  ' "$1/package.json" 2>/dev/null || echo "unknown"
}

# ── Staging deny-list ────────────────────────────────────────────────────────
# Paths that must never be committed even under whole-tree staging. The
# .gitignore covers most of these, but a force-add or a local ignore change
# must not bypass the pipeline's own backstop.
STAGE_DENY_RE='^(node_modules/|dist/|knowledge-base/|\.infobroker/|(.*/)?config\.local\.json$|(.*/)?\.env($|\.)|.*\.(sqlite|sqlite-wal|sqlite-shm|key|pem|p12|pfx)$|(.*/)?id_rsa(\.pub)?$|.*vector-store.*\.json$)'

# stage_path_denied <path> — 0 when the staged path is on the deny-list.
stage_path_denied() {
  [[ "$1" =~ $STAGE_DENY_RE ]]
}

# ── git identity guard ───────────────────────────────────────────────────────
require_git_identity() {
  local name email
  name=$(git -C "$PROJECT_DIR" config user.name 2>/dev/null || true)
  email=$(git -C "$PROJECT_DIR" config user.email 2>/dev/null || true)
  [[ -n "$name" && -n "$email" ]] || die "git user.name/user.email not configured — set them before committing."
}

# ── Run journal helpers ──────────────────────────────────────────────────────
# latest_run_dir <log-root> <repo> <branch> → newest run-* directory whose
# state.json records the same repo and branch. This is what makes --resume
# work across processes: without it the journal lives in a fresh timestamped
# directory and is unreachable on the next invocation.
latest_run_dir() {
  local root="$1" repo="$2" branch="$3" d
  [[ -d "$root" ]] || return 1
  while IFS= read -r d; do
    [[ -f "$d/state.json" ]] || continue
    [[ "$(json_from_file "$d/state.json" repo)" == "$repo" ]] || continue
    [[ "$(json_from_file "$d/state.json" branch)" == "$branch" ]] || continue
    printf '%s\n' "$d"
    return 0
  done < <(find "$root" -maxdepth 1 -type d -name 'run-*' 2>/dev/null | sort -r)
  return 1
}

# prune_runs <log-root> <keep> — delete older run-* directories beyond <keep>.
# Only directories directly under the log root matching run-* are touched.
prune_runs() {
  local root="$1" keep="${2:-10}" d i=0
  [[ -d "$root" ]] || return 0
  while IFS= read -r d; do
    i=$((i + 1))
    (( i <= keep )) && continue
    [[ -d "$d" && "$d" == "$root"/run-* ]] || continue
    rm -rf -- "$d"
  done < <(find "$root" -maxdepth 1 -type d -name 'run-*' 2>/dev/null | sort -r)
}

# state_init <state-file> <repo> <branch> <head> — initialize the journal.
state_init() {
  local path="$1" repo="$2" branch="$3" head="$4"
  node -e '
    const fs = require("fs");
    const [p, repo, branch, head] = process.argv.slice(1);
    fs.writeFileSync(p, JSON.stringify({ repo, branch, head }, null, 2));
  ' "$path" "$repo" "$branch" "$head" 2>/dev/null || true
}

# ── Findings parsing ─────────────────────────────────────────────────────────
# findings_count <path> → prints the finding count when the summary parses and
# `findings` is an integer or an array; exits 1 otherwise. A malformed AI
# summary must fail the step rather than silently degrade to "?".
findings_count() {
  node -e '
    const fs = require("fs");
    let j;
    try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch { process.exit(1); }
    const f = j.findings;
    if (Number.isInteger(f)) { console.log(f); process.exit(0); }
    if (Array.isArray(f)) { console.log(f.length); process.exit(0); }
    process.exit(1);
  ' "$1" 2>/dev/null
}

# ── Step-range selection ─────────────────────────────────────────────────────
# step_should_run <order> <step> <start> <end> → 0 when <step> is inside the
# requested range, 1 when it should be skipped. Pure: depends only on its
# arguments, so it is unit-testable without running the pipeline.
step_should_run() {
  local order="$1" step="$2" start="$3" end="$4" before upto
  if [[ -n "$start" ]]; then
    before="${order%%"$start"*}"
    if [[ "$before" != "$order" && " $before " == *" $step "* ]]; then
      return 1
    fi
  fi
  if [[ -n "$end" ]]; then
    upto="${order%%"$end"*}"
    if [[ "$upto" != "$order" ]]; then
      if [[ " $upto " == *" $step "* || "$step" == "$end" ]]; then
        return 0
      fi
      return 1
    fi
  fi
  return 0
}

# should_skip_step <state-file> <resume-active> <step> <order> <start> <end>
# 0 when a resumed run already recorded <step> done, or <step> is outside the
# requested range. <resume-active> must be the resolved run-journal state, so
# --run-id/PIPELINE_RUN_DIR resume the same way --resume does.
should_skip_step() {
  local state_file="$1" resume_active="$2" step="$3" order="$4" start="$5" end="$6"
  if [[ "$resume_active" == "true" ]] \
      && [[ "$(json_from_file "$state_file" "$step")" == "true" ]]; then
    return 0
  fi
  ! step_should_run "$order" "$step" "$start" "$end"
}

# ── opencode session helpers ─────────────────────────────────────────────────
# opencode runs are attached to one persistent `opencode serve` instance and
# driven through a single continued session, so spec/code context is loaded
# once and reused across steps (instead of cold-starting each step).

# find_free_port — ask the OS for an unused TCP port (node is a pre-flight
# requirement). Falls back to PIPELINE_PORT or 4096 if node cannot be queried.
find_free_port() {
  node -e 'const net=require("net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})' 2>/dev/null \
    || echo "${PIPELINE_PORT:-4096}"
}

# Start the persistent backend. Sets PIPELINE_SERVER_URL.
ensure_server() {
  if [[ -n "${PIPELINE_SERVER_URL:-}" ]]; then return 0; fi
  local port="${PIPELINE_PORT:-$(find_free_port)}"
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

# ── Timing ───────────────────────────────────────────────────────────────────
# record_timing <dir> <key> <seconds> — write one step's duration as its own
# file. Per-key files keep concurrent steps (the two AI scans) from clobbering
# each other's read-modify-write of a shared map.
record_timing() {
  local dir="$1" key="$2" secs="$3"
  mkdir -p "$dir" 2>/dev/null || true
  printf '%s\n' "$secs" > "$dir/$key" 2>/dev/null || true
}
# print_timings <dir> — emit "<label>: <secs>" (sorted) and a total.
print_timings() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  node -e 'const fs=require("fs"),p=process.argv[1];let t=0;for(const f of fs.readdirSync(p).sort()){const v=Number(fs.readFileSync(p+"/"+f,"utf8").trim());if(!Number.isFinite(v))continue;t+=v;console.log("    "+f+": "+v)}console.log("    total: "+t)' \
    "$dir" 2>/dev/null || true
}
# time_it <label> <command...> — run a command, record its wall time, return its
# exit code unchanged (so callers keep `set -e` semantics).
time_it() {
  local label="$1"; shift
  local start end rc saved
  start=$(date +%s)
  saved=$(trap -p ERR 2>/dev/null || true)
  trap - ERR
  set +e
  "$@"
  rc=$?
  set -e
  [[ -n "$saved" ]] && eval "$saved"
  end=$(date +%s)
  record_timing "${PIPELINE_RUN_DIR:-/tmp}/timings" "$label" "$((end - start))"
  return $rc
}

# run_gate <label> <log> <command...> — run a gate, capture its output to <log>,
# print a short tail on failure, and return the command's exit code unchanged.
run_gate() {
  local label="$1" log="$2"; shift 2
  local rc saved
  saved=$(trap -p ERR 2>/dev/null || true)
  trap - ERR
  set +e
  "$@" > "$log" 2>&1
  rc=$?
  set -e
  [[ -n "$saved" ]] && eval "$saved"
  if [[ $rc -ne 0 ]]; then
    warn "${label} FAILED (exit ${rc}) — last lines of ${log}:"
    tail -30 "$log" 2>/dev/null || true
  fi
  return $rc
}

# run_pipeline_step <prompt-file> <out-file> [--model <m>] [--agent <a>] [--retry]
# Runs one step in the shared session. On retry, forks a fresh session.
# Records the step's wall time (key = prompt basename without .prompt.md/.md).
run_pipeline_step() {
  local prompt_file="$1" out_file="$2"
  local model="${PIPELINE_MODEL:-}" agent="${PIPELINE_AGENT:-build}" retry=false
  shift 2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --model) model="$2"; shift 2 ;;
      --agent) agent="$2"; shift 2 ;;
      --retry) retry=true; shift ;;
      *) die "run_pipeline_step: unknown option '$1'" ;;
    esac
  done

  local prompt
  prompt=$(<"$prompt_file")

  # Fail loudly instead of tripping `set -u` on an unbound variable: a caller
  # that reaches this point before ensure_server/ensure_session has a bug.
  if [[ -z "${PIPELINE_SERVER_URL:-}" || -z "${PIPELINE_SESSION_ID:-}" ]]; then
    die "run_pipeline_step: pipeline backend not initialized (call ensure_server and ensure_session first)."
  fi

  local timeout_cmd=(opencode)
  if [[ "${OPC_TIMEOUT:-1800}" -gt 0 ]] && command -v timeout >/dev/null 2>&1; then
    timeout_cmd=(timeout "$OPC_TIMEOUT" opencode)
  fi

  local args=()
  args+=(run --attach "$PIPELINE_SERVER_URL" --session "$PIPELINE_SESSION_ID" --agent "$agent" --auto)
  [[ -n "$model" ]] && args+=(--model "$model")

  local start end
  start=$(date +%s)
  local saved
  saved=$(trap -p ERR 2>/dev/null || true)
  trap - ERR
  set +e
  "${timeout_cmd[@]}" "${args[@]}" "$prompt" > "$out_file" 2>> "$PIPELINE_LOG_FILE"
  OPC_RC=$?
  set -e
  [[ -n "$saved" ]] && eval "$saved"

  if [[ $OPC_RC -ne 0 ]] && $retry; then
    warn "Session step '${prompt_file}' failed (exit ${OPC_RC}) — retrying once in a forked session..."
    # Fork: use a fresh continuation to avoid a poisoned conversation state.
    local retry_args=(run --attach "$PIPELINE_SERVER_URL" --session "$PIPELINE_SESSION_ID" --fork --agent "$agent" --auto)
    [[ -n "$model" ]] && retry_args+=(--model "$model")
    saved=$(trap -p ERR 2>/dev/null || true)
    trap - ERR
    set +e
    "${timeout_cmd[@]}" "${retry_args[@]}" "$prompt" > "${out_file}.retry" 2>> "$PIPELINE_LOG_FILE"
    OPC_RC=$?
    if [[ $OPC_RC -eq 0 ]]; then mv "${out_file}.retry" "$out_file"; fi
    set -e
    [[ -n "$saved" ]] && eval "$saved"
  fi

  end=$(date +%s)
  local label="${prompt_file##*/}"; label="${label%.prompt.md}"; label="${label%.md}"
  record_timing "${PIPELINE_RUN_DIR:-/tmp}/timings" "$label" "$((end - start))"
}

# stop_server — tear down the persistent backend.
stop_server() {
  if [[ -n "${OPC_SERVE_PID:-}" ]]; then
    kill "$OPC_SERVE_PID" 2>/dev/null || true
    unset OPC_SERVE_PID
  fi
}

# ── Bounded auto-repair ──────────────────────────────────────────────────────
# repair_loop <label> <gate-cmd> <prompt-template> <max> <log> <out>
# Runs a gate; on failure renders the fix-gate prompt with the failure log and
# runs one repair turn under the full model, then re-runs the gate. Returns the
# gate's exit code. Callers must treat a non-zero return as "human attention
# required" and stop. The loop is bounded so a repair can never spiral.
repair_loop() {
  local label="$1" gate_cmd="$2" prompt_template="$3" max="$4" log="$5" out="$6"
  local attempt=0 rc prompt_file=""
  while :; do
    local saved
    saved=$(trap -p ERR 2>/dev/null || true)
    trap - ERR
    set +e
    ( cd "$PROJECT_DIR" && bash -c "$gate_cmd" ) > "$log" 2>&1
    rc=$?
    set -e
    [[ -n "$saved" ]] && eval "$saved"
    if [[ $rc -eq 0 ]]; then
      [[ $attempt -gt 0 ]] && info "$label: PASSED after ${attempt} repair attempt(s)."
      REPAIR_ATTEMPTS["$label"]="$attempt"
      return 0
    fi
    if (( attempt >= max )); then
      REPAIR_ATTEMPTS["$label"]="$attempt"
      error "$label: FAILED after ${attempt} repair attempt(s) — human attention required."
      tail -20 "$log" 2>/dev/null || true
      return "$rc"
    fi
    attempt=$((attempt + 1))
    warn "$label: FAILED (exit ${rc}) — repair attempt ${attempt}/${max}..."
    prompt_file="$PIPELINE_RUN_DIR/repair-$(printf '%s' "$label" | tr ' /' '--')-${attempt}.prompt.md"
    sed -e "s|<LABEL>|$label|g" \
        -e "s|<GATE_CMD>|$gate_cmd|g" \
        -e "s|<FAILURE_LOG>|$log|g" \
        -e "s|<FIX_TXT>|$out|g" \
        -e "s|<ATTEMPT>|$attempt|g" \
        -e "s|<MAX_ATTEMPTS>|$max|g" \
        "$prompt_template" > "$prompt_file"
    run_pipeline_step "$prompt_file" "${out}.attempt-${attempt}" --model "$PIPELINE_MODEL" --retry
    if [[ $OPC_RC -ne 0 ]]; then
      warn "$label: repair turn failed (exit ${OPC_RC}); re-checking the gate."
    fi
  done
}

# push_action <no_push> <yes> <interactive> <shippable> → one of:
#   skip | nothing | auto | prompt | require-tty
# Returns 1 for require-tty so the caller can fail closed.
push_action() {
  local no_push="$1" yes="$2" interactive="$3" shippable="$4"
  if [[ "$no_push" == "true" ]]; then printf 'skip\n'; return 0; fi
  if [[ "$shippable" != "true" ]]; then printf 'nothing\n'; return 0; fi
  if [[ "$yes" == "true" ]]; then printf 'auto\n'; return 0; fi
  if [[ "$interactive" != "true" ]]; then printf 'require-tty\n'; return 1; fi
  printf 'prompt\n'
}
