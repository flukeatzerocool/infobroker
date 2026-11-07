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

# pipeline_stub_active — true only for the hermetic harness (scripts/test-push-pipeline.ts).
#
# The harness drives this pipeline against a disposable repository, so the
# project toolchain (npm run check, generate-auth, the scan scripts) cannot run
# there. A stub needs two keys: the explicit flag and a test root that resolves
# to this pipeline's own PROJECT_DIR. A routine release sets neither, so a
# leaked flag alone cannot skip a real gate.
pipeline_stub_active() {
  [[ "${INFOBROKER_PIPELINE_STUB:-}" == "1" ]] || return 1
  [[ -n "${INFOBROKER_PIPELINE_TEST_ROOT:-}" ]] || return 1
  local want got
  want=$(cd "$INFOBROKER_PIPELINE_TEST_ROOT" 2>/dev/null && pwd -P) || return 1
  got=$(cd "$PROJECT_DIR" 2>/dev/null && pwd -P) || return 1
  [[ "$want" == "$got" ]]
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

# stage_denylist <newline-separated paths> — print the paths that match the
# deny-list. Empty output means the staged set is clean. Extracted from the
# driver so the policy can be tested without staging a real tree.
stage_denylist() {
  local path
  while IFS= read -r path; do
    if [[ -n "$path" && "$path" =~ $STAGE_DENY_RE ]]; then
      printf '%s\n' "$path"
    fi
  done <<<"$1"
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
# `started_at` is what makes wall time reportable later: the sum of step
# timings excludes gates, pushes, and idle time between steps.
state_init() {
  local path="$1" repo="$2" branch="$3" head="$4"
  node -e '
    const fs = require("fs");
    const [p, repo, branch, head] = process.argv.slice(1);
    fs.writeFileSync(p, JSON.stringify({ repo, branch, head, started_at: new Date().toISOString() }, null, 2));
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

# dispositions_valid <path> → 0 when the file is a JSON array of
# {id: string, disposition: "fixed"|"rejected"} entries. A repair pass that
# writes prose instead must not silently seed the re-review with nothing.
dispositions_valid() {
  node -e '
    const fs = require("fs");
    let j;
    try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch { process.exit(1); }
    const ok = Array.isArray(j) && j.length > 0 && j.every(
      (e) => e && typeof e.id === "string" && (e.disposition === "fixed" || e.disposition === "rejected"),
    );
    process.exit(ok ? 0 : 1);
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
# opencode runs connect to one persistent `opencode serve` instance and
# driven through a single continued session, so spec/code context is loaded
# once and reused across steps (instead of cold-starting each step).

# find_free_port — ask the OS for an unused TCP port (node is a pre-flight
# requirement). A fixed PIPELINE_PORT is honoured when set; otherwise a failed
# probe is fatal rather than silently borrowing a port that may be in use.
find_free_port() {
  if [[ -n "${PIPELINE_PORT:-}" ]]; then printf '%s\n' "$PIPELINE_PORT"; return 0; fi
  local attempt port
  for attempt in 1 2 3; do
    port=$(node -e 'const net=require("net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})' 2>/dev/null || true)
    if [[ -n "$port" ]]; then printf '%s\n' "$port"; return 0; fi
  done
  return 1
}

# Start the persistent backend. Sets PIPELINE_SERVER_URL.
#
# opencode v2 serves a password-protected API: `opencode serve` generates a
# random password unless OPENCODE_PASSWORD is already set, and clients must
# present it via the same variable. Setting it ourselves keeps the backend
# deterministic and avoids scraping the generated secret out of the log.
ensure_server() {
  if [[ -n "${PIPELINE_SERVER_URL:-}" ]]; then return 0; fi
  local port="${PIPELINE_PORT:-}"
  if [[ -z "$port" ]]; then
    port=$(find_free_port) || die "Could not find a free port for opencode serve (set PIPELINE_PORT)."
  fi
  if [[ -z "${OPENCODE_PASSWORD:-}" ]]; then
    OPENCODE_PASSWORD=$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')
    export OPENCODE_PASSWORD
  fi
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
    opencode run --server "$server" --title "$title" --agent build --auto --format json \
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
# each other. A repeated key (a resumed run, or a repair pass) is kept rather
# than overwritten: the aborted run's numbers are the evidence for how the time
# went, so they get a #N suffix instead of being lost.
record_timing() {
  local dir="$1" key="$2" secs="$3" candidate="$2" n=1
  mkdir -p "$dir" 2>/dev/null || true
  while [[ -f "$dir/$candidate" ]]; do
    n=$((n + 1))
    candidate="${key}#${n}"
  done
  printf '%s\n' "$secs" > "$dir/$candidate" 2>/dev/null || true
}
# print_timings <dir> — emit "<label>: <secs>" (sorted) and a total. The total
# is the sum of recorded steps, not wall time: concurrent lanes double-count and
# gate/commit/push time is recorded separately as gate-*/phase keys.
print_timings() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  node -e 'const fs=require("fs"),p=process.argv[1];let t=0;for(const f of fs.readdirSync(p).sort()){const v=Number(fs.readFileSync(p+"/"+f,"utf8").trim());if(!Number.isFinite(v))continue;t+=v;console.log("    "+f+": "+v)}console.log("    sum of steps (not wall time): "+t)' \
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
# Its wall time is recorded as gate-<label> so the run summary accounts for
# time the AI-step timings cannot see.
run_gate() {
  local label="$1" log="$2"; shift 2
  local rc saved start end
  if pipeline_stub_active; then
    printf 'STUB %s\n' "$label" > "$log"
    return 0
  fi
  start=$(date +%s)
  saved=$(trap -p ERR 2>/dev/null || true)
  trap - ERR
  set +e
  "$@" > "$log" 2>&1
  rc=$?
  set -e
  [[ -n "$saved" ]] && eval "$saved"
  end=$(date +%s)
  record_timing "${PIPELINE_RUN_DIR:-/tmp}/timings" "gate-$(printf '%s' "$label" | tr ' /' '--')" "$((end - start))"
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
    timeout_cmd=(timeout "${OPC_TIMEOUT:-1800}" opencode)
  fi

  local args=()
  args+=(run --server "$PIPELINE_SERVER_URL" --session "$PIPELINE_SESSION_ID" --agent "$agent" --auto)
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
    local retry_args=(run --server "$PIPELINE_SERVER_URL" --session "$PIPELINE_SESSION_ID" --fork --agent "$agent" --auto)
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

# ── Release tagging ──────────────────────────────────────────────────────────
# tag_release <version> <policy-cli>
# A published tag is immutable: the remote is probed before any local tag is
# created or moved, and a failed probe is fatal (an unknown remote must never
# be treated as "not published"). The only move permitted is the retry of an
# interrupted publish: the tag is local-only, an ancestor of HEAD, and carries
# the version being released.
tag_release() {
  local version="$1" policy="$2"
  local tag="v${version}" exists=0 remote_exists=0 tag_version="-" ancestor=0
  local decision action reason tagged remote_tags
  git -C "$PROJECT_DIR" rev-parse -q --verify "refs/tags/${tag}" >/dev/null 2>&1 && exists=1
  if [[ "$exists" == "1" ]]; then
    tag_version=$(git -C "$PROJECT_DIR" show "${tag}:package.json" 2>/dev/null \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).version))}catch{process.stdout.write("-")}})' \
      || printf '%s' "-")
    git -C "$PROJECT_DIR" merge-base --is-ancestor "$tag" HEAD 2>/dev/null && ancestor=1
  fi
  if ! remote_tags=$(git -C "$PROJECT_DIR" ls-remote --tags origin "refs/tags/${tag}" 2>/dev/null); then
    die "Cannot verify remote tag ${tag}: git ls-remote origin failed. Retry with network access."
  fi
  [[ -n "$remote_tags" ]] && remote_exists=1
  decision=$(npx tsx "$policy" tag-action \
    --current "$version" --exists "$exists" --remote-exists "$remote_exists" \
    --tag-version "$tag_version" --ancestor "$ancestor") \
    || die "release-policy tag-action FAILED."
  action="${decision%%|*}"
  reason="${decision#*|}"
  case "$action" in
    create)
      git -C "$PROJECT_DIR" tag "$tag"
      ;;
    move)
      warn "Tag ${tag} — ${reason}."
      git -C "$PROJECT_DIR" tag -f "$tag"
      ;;
    refuse)
      die "Tag ${tag}: ${reason}."
      ;;
    *)
      die "release-policy returned an unknown tag action '${action}'."
      ;;
  esac
  tagged=$(git -C "$PROJECT_DIR" show "${tag}:package.json" 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).version))}catch{process.stdout.write("-")}})' \
    || printf '%s' "-")
  [[ "$tagged" == "$version" ]] \
    || die "Tag ${tag} points at package.json version '${tagged}', expected '${version}'."
}

# derive_release_tag <version> — the tag name for a release version. One
# definition so the shippable probe, the tag command and the refspec cannot
# disagree about the tag's spelling.
derive_release_tag() {
  printf 'v%s\n' "$1"
}

# ── Review scope ─────────────────────────────────────────────────────────────
# The read-through reviews the change set every run, then one spec shard as a
# drift pass. Shards are defined by section anchors, not line numbers, so they
# survive spec growth. The cursor is the newest "(review SN/K)" marker in a
# pipeline commit subject; "(deep review)" resets the rotation to S1.
REVIEW_SHARD_IDS=(S1 S2 S3 S4 S5 S6)
REVIEW_SHARD_SECTIONS=(
  "§1-§3 (mission, failure modes, standing rules)"
  "§4.1-§4.5 (contracts, config, core tools, resilience, state)"
  "§4.6-§4.11 (providers, artifacts, integrity, knowledge base, deploy, security)"
  "§5-§8 (build, runtime, dispatch, corroboration)"
  "§9-§10 (verification, artifacts and handoff)"
  "§A-§E (appendices)"
)

# review_shard_count — the number of shards.
review_shard_count() {
  printf '%s\n' "${#REVIEW_SHARD_IDS[@]}"
}

# next_review_shard <last-id> — the shard to review next. An empty or unknown
# id starts at the first shard; the last shard wraps to the first.
next_review_shard() {
  local last="$1" i
  if [[ -n "$last" ]]; then
    for i in "${!REVIEW_SHARD_IDS[@]}"; do
      if [[ "${REVIEW_SHARD_IDS[$i]}" == "$last" ]]; then
        printf '%s\n' "${REVIEW_SHARD_IDS[$(( (i + 1) % ${#REVIEW_SHARD_IDS[@]} ))]}"
        return 0
      fi
    done
  fi
  printf '%s\n' "${REVIEW_SHARD_IDS[0]}"
}

# review_shard_sections <id> — the human-readable section range for a shard.
review_shard_sections() {
  local id="$1" i
  for i in "${!REVIEW_SHARD_IDS[@]}"; do
    if [[ "${REVIEW_SHARD_IDS[$i]}" == "$id" ]]; then
      printf '%s\n' "${REVIEW_SHARD_SECTIONS[$i]}"
      return 0
    fi
  done
  printf '%s\n' "${REVIEW_SHARD_SECTIONS[0]}"
}

# last_review_shard <newline-separated commit subjects> — the shard named by
# the newest pipeline subject carrying a "(review SN/K)" marker, or empty when
# none exists. Stops at the first match so the caller can pass git log output
# newest-first. A "(deep review)" subject intentionally yields empty, which
# restarts the rotation.
last_review_shard() {
  local line input="${1:-}"
  while IFS= read -r line; do
    case "$line" in
      "Push pipeline "*)
        # The newest pipeline run decides the cursor. A marked subject names the
        # shard it reviewed; an unmarked or deep subject resets to the first.
        if [[ "$line" =~ \(review\ (S[0-9]+)/[0-9]+\) ]]; then
          printf '%s\n' "${BASH_REMATCH[1]}"
        else
          printf '\n'
        fi
        return 0
        ;;
    esac
  done <<<"$input"
  printf '\n'
}

# Creates, moves, or refuses the tag v<version>; see the header at the top of
# this section. Requires PROJECT_DIR.

# classify_gate_failure <gate-exit-code> <attempt> <max> → pass | repair | giveup
# Pure decision used by repair_loop. A non-zero gate is repaired until
# <attempt> reaches <max>, then given up — which is what bounds the loop.
# Extracted so the bound is testable without running a gate or an agent.
classify_gate_failure() {
  local rc="$1" attempt="$2" max="$3"
  if [[ "$rc" == "0" ]]; then
    printf 'pass\n'
  elif (( attempt >= max )); then
    printf 'giveup\n'
  else
    printf 'repair\n'
  fi
}

# review_required <porcelain-status-output> → true | false
# The independent code review reads source and configuration only. A docs-only
# change set has nothing for it to review, so it is skipped rather than spending
# a model turn on an empty diff. Matches tracked, untracked, and renamed paths.
review_required() {
  if printf '%s\n' "$1" | grep -qE '(^|[[:space:]])(src/|config\.json)'; then
    printf 'true\n'
  else
    printf 'false\n'
  fi
}

# review_gate_decision <critical> <high> <attempt> <max> → halt | giveup | repair | pass
# Pure decision for the post-sync code-review gate. A critical finding halts:
# repairing a correctness defect without a failing test is a human call. High
# findings are repaired until <attempt> reaches <max>, which bounds the loop.
review_gate_decision() {
  local critical="$1" high="$2" attempt="$3" max="$4"
  if (( critical > 0 )); then
    printf 'halt\n'
  elif (( high > 0 && attempt >= max )); then
    printf 'giveup\n'
  elif (( high > 0 )); then
    printf 'repair\n'
  else
    printf 'pass\n'
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
  local attempt=0 rc prompt_file="" decision=""
  if pipeline_stub_active; then
    printf 'STUB %s\n' "$label" > "$log"
    REPAIR_ATTEMPTS["$label"]=0
    return 0
  fi
  while :; do
    local saved
    saved=$(trap -p ERR 2>/dev/null || true)
    trap - ERR
    set +e
    ( cd "$PROJECT_DIR" && bash -c "$gate_cmd" ) > "$log" 2>&1
    rc=$?
    set -e
    [[ -n "$saved" ]] && eval "$saved"
    decision=$(classify_gate_failure "$rc" "$attempt" "$max")
    # --no-ai has no backend to drive a repair turn, so it fails closed on the
    # first failure instead of looping into "backend not initialized".
    if [[ "$decision" != "pass" ]] && ${NO_AI:-false}; then
      REPAIR_ATTEMPTS["$label"]="$attempt"
      error "$label: FAILED (exit ${rc}) — --no-ai does not repair; human attention required."
      tail -20 "$log" 2>/dev/null || true
      return "$rc"
    fi
    case "$decision" in
      pass)
        if [[ $attempt -gt 0 ]]; then
          info "$label: PASSED after ${attempt} repair attempt(s)."
        fi
        REPAIR_ATTEMPTS["$label"]="$attempt"
        return 0
        ;;
      giveup)
        REPAIR_ATTEMPTS["$label"]="$attempt"
        error "$label: FAILED after ${attempt} repair attempt(s) — human attention required."
        tail -20 "$log" 2>/dev/null || true
        return "$rc"
        ;;
      repair)
        attempt=$((attempt + 1))
        warn "$label: FAILED (exit ${rc}) — repair attempt ${attempt}/${max}..."
        ;;
    esac
    prompt_file="$PIPELINE_RUN_DIR/repair-$(printf '%s' "$label" | tr ' /' '--')-${attempt}.prompt.md"
    sed -e "s|<LABEL>|$label|g" \
        -e "s|<GATE_CMD>|$gate_cmd|g" \
        -e "s|<FAILURE_LOG>|$log|g" \
        -e "s|<FIX_TXT>|$out|g" \
        -e "s|<ATTEMPT>|$attempt|g" \
        -e "s|<MAX_ATTEMPTS>|$max|g" \
        "$prompt_template" > "$prompt_file"
    run_pipeline_step "$prompt_file" "${out}.attempt-${attempt}" \
      --agent "${PIPELINE_REPAIR_AGENT:-build}" --model "$PIPELINE_MODEL" --retry
    if [[ $OPC_RC -ne 0 ]]; then
      warn "$label: repair turn failed (exit ${OPC_RC}); re-checking the gate."
    fi
  done
}

# should_commit <staged-diff-exit-code> → commit | skip
# git diff --staged --quiet exits 0 when nothing is staged, so a release with
# no staged change must not create an empty commit. Extracted for testing.
should_commit() {
  if [[ "$1" == "0" ]]; then
    printf 'skip\n'
  else
    printf 'commit\n'
  fi
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

# ── Split commit series ──────────────────────────────────────────────────────
# split_commit_series <project_dir> <date> <prev_version> <new_version> \
#                     <snapshot_dir> <stamp_paths_file> <body>
#
# Commits the staged tree as one commit per AGENTS.md concern bucket instead of
# one bulk commit. The version stamps and the new CHANGELOG entry are lifted out
# to a snapshot, the working tree is rewound to <prev_version>, and each earlier
# commit then carries the pre-run version — so the pre-commit `version-sync`
# hook and validate-spec/validate-readme stay green at every commit. The stamps
# and the CHANGELOG entry are restored before the final release commit. Without the rewind, every earlier commit would
# fail the hook and `validate-spec`/`validate-readme`.
#
# Exit: 0 = series committed; 1 = failure (tree restored, no partial series
# left in history); 3 = nothing staged.
split_commit_series() {
  local project_dir="$1" date="$2" prev_version="$3" new_version="$4"
  local snapshot_dir="$5" stamp_paths_file="$6" body="$7"
  local pre_head plan_file paths_file snap_dir rc=0 rewound=false
  pre_head="$(git -C "$project_dir" rev-parse HEAD)"
  plan_file="$snapshot_dir/commit-plan.tsv"
  paths_file="$snapshot_dir/changed-paths.txt"
  snap_dir="$snapshot_dir/stamps"
  # The planner ships with the pipeline, not with the target tree, so resolve it
  # from this file's location.
  local lib_dir policy
  lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  policy="$(cd "$lib_dir/../lib" && pwd)/release-policy.ts"
  local f key subject path

  mkdir -p "$snapshot_dir" || return 1
  git -C "$project_dir" diff --cached --name-only > "$paths_file" || return 1
  if [[ ! -s "$paths_file" ]]; then
    warn "Split commit series: nothing staged."
    return 3
  fi
  # Unstage: the index must hold HEAD so each bucket stages only its own paths.
  # The working tree keeps the full final content.
  git -C "$project_dir" reset -q || return 1

  local version_changed=0
  [[ "$prev_version" != "$new_version" && "$prev_version" != "unknown" ]] && version_changed=1
  if ! npx tsx "$policy" commit-plan --paths-file "$paths_file" --date "$date" --version "$new_version" \
      --version-changed "$version_changed" > "$plan_file"; then
    error "Split commit series: commit-plan FAILED."
    return 1
  fi

  # Rewind every stamp site to the pre-run version (and drop the new CHANGELOG
  # entry) so the intermediate commits are fully consistent trees.
  if [[ "$prev_version" != "$new_version" && "$prev_version" != "unknown" && -s "$stamp_paths_file" ]]; then
    while IFS= read -r f; do
      [[ -n "$f" ]] || continue
      mkdir -p "$snap_dir/$(dirname "$f")"
      cp "$project_dir/$f" "$snap_dir/$f" || { error "Split commit series: could not snapshot $f."; return 1; }
    done < "$stamp_paths_file"
    if ! ( cd "$project_dir" && npx tsx scripts/version.ts set "$prev_version" ) >/dev/null; then
      error "Split commit series: version rewind FAILED."
      while IFS= read -r f; do [[ -n "$f" && -f "$snap_dir/$f" ]] && cp "$snap_dir/$f" "$project_dir/$f"; done < "$stamp_paths_file"
      return 1
    fi
    if ! git -C "$project_dir" checkout HEAD -- CHANGELOG.md 2>/dev/null; then
      error "Split commit series: could not restore the pre-run CHANGELOG.md."
      while IFS= read -r f; do [[ -n "$f" && -f "$snap_dir/$f" ]] && cp "$snap_dir/$f" "$project_dir/$f"; done < "$stamp_paths_file"
      return 1
    fi
    rewound=true
  fi

  # _split_typecheck_commit <project_dir> <scratch_dir> — typecheck one commit's
  # tree in a throwaway worktree. Typechecking the working tree would prove
  # nothing: it already contains every later bucket.
  _split_typecheck_commit() {
    local project_dir="$1" dir="$2" tc_rc=0
    # The harness repo has no project scripts; its typecheck proves nothing
    # about the pipeline control flow under test.
    if pipeline_stub_active; then return 0; fi
    rm -rf "$dir"
    git -C "$project_dir" worktree add -q --detach "$dir" HEAD 2>/dev/null || return 1
    ln -sfn "$project_dir/node_modules" "$dir/node_modules" 2>/dev/null || true
    ( cd "$dir" && npm run typecheck >/dev/null 2>&1 ) || tc_rc=1
    git -C "$project_dir" worktree remove --force "$dir" >/dev/null 2>&1 || true
    return $tc_rc
  }

  # Read the plan into parallel arrays so the buckets can be walked in order.
  local -a p_keys=() p_subjects=() p_paths=()
  while IFS=$'\t' read -r key subject path; do
    [[ -n "$key" ]] || continue
    p_keys+=("$key"); p_subjects+=("$subject"); p_paths+=("$path")
  done < "$plan_file"
  local n=${#p_keys[@]} i=0

  while (( i < n )); do
    local bkey="${p_keys[$i]}" bsubject="${p_subjects[$i]}"
    local -a batch=()
    while (( i < n )) && [[ "${p_keys[$i]}" == "$bkey" ]]; do
      batch+=("${p_paths[$i]}")
      i=$((i + 1))
    done
    # The release bucket is committed last, after the stamps are restored.
    [[ "$bkey" == "release" ]] && continue
    git -C "$project_dir" add -A -- "${batch[@]}" || { rc=1; break; }
    if [[ -z "$(git -C "$project_dir" diff --cached --name-only)" ]]; then
      continue
    fi
    if ! git -C "$project_dir" commit -q -m "$bsubject" -m "$body"; then
      error "Split commit series: ${bkey} commit FAILED."
      rc=1; break
    fi
    if ! _split_typecheck_commit "$project_dir" "$snapshot_dir/verify"; then
      error "Split commit series: typecheck FAILED for the ${bkey} commit."
      rc=1; break
    fi
    info "  committed: ${bsubject}"
  done

  # Restore the final stamps and commit what is left: the stamp hunks plus the
  # new CHANGELOG entry.
  if (( rc == 0 )) && $rewound; then
    while IFS= read -r f; do
      [[ -n "$f" ]] || continue
      cp "$snap_dir/$f" "$project_dir/$f" || { rc=1; break; }
    done < "$stamp_paths_file"
  fi
  if (( rc == 0 )); then
    git -C "$project_dir" add -A -- . || rc=1
  fi
  if (( rc == 0 )) && [[ -n "$(git -C "$project_dir" diff --cached --name-only)" ]]; then
    local rel_subject="Release: ${new_version}" j
    for (( j = 0; j < n; j++ )); do
      if [[ "${p_keys[$j]}" == "release" ]]; then rel_subject="${p_subjects[$j]}"; break; fi
    done
    if git -C "$project_dir" commit -q -m "$rel_subject" -m "$body"; then
      if _split_typecheck_commit "$project_dir" "$snapshot_dir/verify"; then
        info "  committed: ${rel_subject}"
      else
        error "Split commit series: typecheck FAILED for the release commit."
        rc=1
      fi
    else
      error "Split commit series: release commit FAILED."
      rc=1
    fi
  fi

  if (( rc == 0 )) && [[ -n "$(git -C "$project_dir" status --porcelain)" ]]; then
    error "Split commit series: paths left uncommitted after the series."
    rc=1
  fi

  if (( rc != 0 )); then
    # Undo the partial series and restore the final tree: no half-applied
    # history, no lost work.
    git -C "$project_dir" reset -q --soft "$pre_head" 2>/dev/null || true
    if $rewound; then
      while IFS= read -r f; do
        [[ -n "$f" && -f "$snap_dir/$f" ]] && cp "$snap_dir/$f" "$project_dir/$f"
      done < "$stamp_paths_file"
    fi
    git -C "$project_dir" reset -q 2>/dev/null || true
    return 1
  fi
  return 0
}
