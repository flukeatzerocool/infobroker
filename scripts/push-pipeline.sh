#!/usr/bin/env bash
# push-pipeline.sh — Full rebuild, audit, and push pipeline: spec read-through,
# server sync, provider auth sync, dead-code scan (project folder + git repo +
# MCP server source), README/refs update, commit, push.
#
# Role: entry point — orchestrates the release pipeline. Exit 0 on success
# (including "committed locally, not pushed"), 1 on a gate failure or when
# human approval is required (`die`), 2 on fatal/unexpected errors.
#
# This is the deep-clean — full from-scratch server rebuild against the
# current spec, dead-code audit, and documentation refresh.
#
# Usage:
#   ./scripts/push-pipeline.sh [--dry-run] [--yes] [--no-push] [--no-commit]
#                              [--resume] [--run-id=<id>]
#                              [--from=<step>] [--to=<step>]
#                              [--scan-ai] [--force-tag]
#                              [--force-push] [--allow-secrets] [--help]
#   --dry-run        Non-mutating: spec audit + deterministic scans only; no AI
#                    steps, no commit, no run-log pruning. The working tree
#                    stays clean; run logs still land under TMPDIR.
#   --yes (-y)       Approve the final push without prompting (unattended/CI).
#   --no-push        Commit but skip push, tag, and mirror sync.
#   --no-commit      Run all steps (including AI edits) but stop before staging;
#                    leaves the working tree dirty for inspection.
#   --resume         Continue the newest recorded run for this repo/branch.
#                    Permitted to start from the dirty tree an interrupted run
#                    left behind; HEAD and branch must still match.
#   --run-id=<id>    Attach this invocation to a specific run directory.
#   --from=<step>    Start at a named step (readthrough|sync|auth|changelog|scan|readme).
#   --to=<step>      Stop after a named step (inclusive). Bounded ranges never
#                    commit or push — they are testing runs.
#   --parallel       Deprecated no-op (auth now runs sequentially before
#                    read-through to avoid a working-tree race).
#   --scan-ai        Also run the AI scan prompts (default: deterministic scan only).
#   --force-tag      Overwrite an existing version tag that is not an ancestor.
#   --force-push     Force push with lease (otherwise refuse if diverged).
#   --allow-secrets  Warn but do not block when staged content matches secret patterns.
#   --help (-h)      Show this message.
#
# Model tiering: review-only steps (read-through, changelog, scan, README) run
# under $PIPELINE_LIGHT_AGENT (default: pipeline-fast, a non-thinking agent);
# the server sync keeps the full build agent.
#
# Recovery guide
#   Undo a push:  git revert <sha> && git push origin $(git branch --show-current)
#   Undo a tag:   git tag -d v<version> && git push origin :refs/tags/v<version>
#   Logs:         $TMPDIR/infobroker/pipeline-logs/  (per-run timestamped)
#   Resume after a mid-pipeline failure: re-run with --resume.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/pipeline/lib.sh
source "$SCRIPT_DIR/pipeline/lib.sh"

# ── Usage ──
usage() {
  cat <<'EOF'
Usage: ./scripts/push-pipeline.sh [--dry-run] [--yes] [--no-push] [--no-commit]
                                  [--resume] [--run-id=<id>]
                                  [--from=<step>] [--to=<step>]
                                  [--scan-ai] [--force-tag] [--force-push]
                                  [--allow-secrets] [--help]

  --dry-run        Non-mutating: spec audit + deterministic scans only; no AI
                   steps, no commit, no run-log pruning. Working tree stays
                   clean; run logs still land under TMPDIR.
  --yes (-y)       Approve the final push without prompting (unattended/CI).
  --no-push        Commit but skip push, tag, and mirror sync.
  --no-commit      Run all steps (including AI edits) but stop before staging.
  --resume         Continue the newest recorded run for this repo/branch.
  --run-id=<id>    Attach this invocation to a specific run directory.
  --from=S         Start at step (readthrough|sync|auth|changelog|scan|readme).
  --to=S           Stop after step (inclusive); bounded ranges never commit/push.
  --parallel       Deprecated no-op (auth runs before read-through).
  --scan-ai        Also run the AI scan prompts (default: deterministic only).
  --force-tag      Overwrite an existing version tag that is not an ancestor of HEAD.
  --force-push     Force-push with lease if diverged.
  --allow-secrets  Warn only on secret patterns.
  --help (-h)      Show this message.
EOF
}

# ── Flag parsing ──
DRY_RUN=false; FORCE=false; RESUME=false; PARALLEL=false
FORCE_TAG=false; FORCE_PUSH=false; ALLOW_SECRETS=false
NO_PUSH=false; SCAN_AI=false; NO_COMMIT=false
START_STEP=""; END_STEP=""; RUN_ID=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes|-y) FORCE=true ;;
    --resume) RESUME=true ;;
    --run-id=*) RUN_ID="${arg#--run-id=}" ;;
    --parallel) PARALLEL=true ;;
    --scan-ai) SCAN_AI=true ;;
    --force-tag) FORCE_TAG=true ;;
    --force-push) FORCE_PUSH=true ;;
    --allow-secrets) ALLOW_SECRETS=true ;;
    --no-push) NO_PUSH=true ;;
    --no-commit) NO_COMMIT=true ;;
    --from=*) START_STEP="${arg#--from=}" ;;
    --to=*) END_STEP="${arg#--to=}" ;;
    --help|-h) usage; exit 0 ;;
    *)
      printf 'Unknown flag: %s\n\n' "$arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if $PARALLEL; then
  warn "--parallel is deprecated: generate-auth now runs sequentially before read-through."
fi

# ── Paths, branch, run directory ──
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PROJECT_DIR")"
BRANCH="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'detached')"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PIPELINE_LOG_DIR="${TMPDIR:-/tmp}/infobroker/pipeline-logs"

# Bounded ranges are testing runs: never commit or push a partial pipeline.
if [[ -n "$START_STEP" || -n "$END_STEP" ]]; then
  if ! $NO_COMMIT || ! $NO_PUSH; then
    info "Bounded range: forcing --no-commit and --no-push (testing mode)."
  fi
  NO_COMMIT=true
  NO_PUSH=true
fi

RESUMED=false
if [[ -n "$RUN_ID" ]]; then
  PIPELINE_RUN_DIR="$PIPELINE_LOG_DIR/run-$RUN_ID"
  [[ -f "$PIPELINE_RUN_DIR/state.json" ]] && RESUMED=true
elif [[ -n "${PIPELINE_RUN_DIR:-}" ]]; then
  [[ -f "$PIPELINE_RUN_DIR/state.json" ]] && RESUMED=true
elif $RESUME; then
  PIPELINE_RUN_DIR="$(latest_run_dir "$PIPELINE_LOG_DIR" "$REPO_ROOT" "$BRANCH" || true)"
  [[ -n "$PIPELINE_RUN_DIR" ]] || die "No resumable run for $REPO_ROOT on $BRANCH under $PIPELINE_LOG_DIR."
  RESUMED=true
else
  PIPELINE_RUN_DIR="$PIPELINE_LOG_DIR/run-${TIMESTAMP}"
fi
mkdir -p "$PIPELINE_RUN_DIR"
PIPELINE_LOG_FILE="$PIPELINE_RUN_DIR/pipeline.log"
STATE_FILE="$PIPELINE_RUN_DIR/state.json"

if $RESUMED; then
  [[ "$(json_from_file "$STATE_FILE" repo)" == "$REPO_ROOT" ]] \
    || die "Cannot resume: run directory belongs to a different repo ($(json_from_file "$STATE_FILE" repo))."
  [[ "$(json_from_file "$STATE_FILE" branch)" == "$BRANCH" ]] \
    || die "Cannot resume: run was started on branch '$(json_from_file "$STATE_FILE" branch)', now on '$BRANCH'."
  [[ "$(json_from_file "$STATE_FILE" head)" == "$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || true)" ]] \
    || die "Cannot resume: HEAD moved since the run started."
else
  state_init "$STATE_FILE" "$REPO_ROOT" "$BRANCH" "$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || true)"
fi

# ── Traps ──
cleanup() {
  stop_server
  local child_pids
  child_pids=$(jobs -p 2>/dev/null || true)
  [[ -n "$child_pids" ]] && { kill $child_pids 2>/dev/null; sleep 1; kill -9 $child_pids 2>/dev/null; } || true
}
on_err() {
  local rc=$?
  error "Unexpected failure (exit ${rc}) at line ${BASH_LINENO[0]} — see $PIPELINE_LOG_FILE"
  log_line "FATAL(unexpected): exit ${rc} at line ${BASH_LINENO[0]}"
  exit 2
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM
trap on_err ERR

PROMPT_DIR="$SCRIPT_DIR/pipeline/prompts"

# Per-step output files
OUT_READTHROUGH="$PIPELINE_RUN_DIR/readthrough.txt"
OUT_SYNC="$PIPELINE_RUN_DIR/sync.txt"
OUT_CHANGELOG="$PIPELINE_RUN_DIR/changelog.txt"
OUT_SCAN="$PIPELINE_RUN_DIR/scan.txt"
OUT_SCAN_GIT="$PIPELINE_RUN_DIR/scan-git.txt"
OUT_README="$PIPELINE_RUN_DIR/readme.txt"
OUT_FIX="$PIPELINE_RUN_DIR/fix.txt"

# Default timeout per opencode subprocess (seconds, 0 = no timeout)
OPC_TIMEOUT="${OPC_TIMEOUT:-1800}"
# Model tiering: full model for sync, light model for review-only steps.
PIPELINE_MODEL="${PIPELINE_MODEL:-}"
PIPELINE_LIGHT_MODEL="${PIPELINE_LIGHT_MODEL:-${PIPELINE_MODEL:-}}"
# Non-thinking agent for review-only steps (read-through, changelog, scan, README).
PIPELINE_LIGHT_AGENT="${PIPELINE_LIGHT_AGENT:-pipeline-fast}"
# Dead-code scan directories (space-separated, relative to repo root)
SCAN_DIRS="${SCAN_DIRS:-src scripts skills instructions}"
# Display-only snapshot, taken before any step runs. The sync step bumps the
# version mid-run, so this value must never decide a release action; the tag
# and push blocks re-derive RELEASE_VERSION after the commit.
VERSION=$(pipeline_version "$PROJECT_DIR")
# Bounded auto-repair budget per failure class. Exhaustion is a human call.
PIPELINE_FIX_ATTEMPTS="${PIPELINE_FIX_ATTEMPTS:-2}"
declare -A STEP_STATUS=()
declare -A REPAIR_ATTEMPTS=()
status_set() { STEP_STATUS["$1"]="$2"; }
# Declared before any readiness report so the --no-commit exit path is safe
# under `set -u`; set true only after a commit actually lands.
COMMITTED=false

if ! $RESUMED; then
  : > "$PIPELINE_LOG_FILE"
fi
log_line "===== Infobroker push pipeline — $(date +%Y-%m-%dT%H:%M:%S%z) ====="
if $RESUMED; then
  log_line "run dir: $PIPELINE_RUN_DIR (resumed)"
else
  log_line "run dir: $PIPELINE_RUN_DIR"
fi
log_line "args: ${*:-<none>}"
log_line "branch: $BRANCH  head: $(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || true)"
mkdir -p "$PIPELINE_RUN_DIR/timings"

# ── State journal ────────────────────────────────────────────────────────────
# --run-id and a caller-supplied PIPELINE_RUN_DIR resume from the journal just
# like --resume; RESUMED is the resolved fact, RESUME only selects the dir.
state_mark() {
  local key="$1"
  node -e '
    const fs = require("fs");
    const [p, key] = process.argv.slice(1);
    let j = {};
    try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch { j = {}; }
    j[key] = true;
    fs.writeFileSync(p, JSON.stringify(j, null, 2));
  ' "$STATE_FILE" "$key" 2>/dev/null || true
}
# step_skip <key> — true if the step should be skipped (resume journal OR --from/--to).
STEP_ORDER="readthrough sync auth changelog scan readme"
# Reject unknown --from/--to steps up front (before pre-flight, so a typo has
# no side effects) — an unrecognized step would otherwise silently skip nothing
# and run the whole pipeline.
validate_step() {
  [[ -z "$1" ]] && return 0
  [[ " $STEP_ORDER " == *" $1 "* ]] || die "Unknown step '$1' (valid: $STEP_ORDER)."
}
validate_step "$START_STEP"
validate_step "$END_STEP"
if [[ -n "$START_STEP" && -n "$END_STEP" ]]; then
  BEFORE_START="${STEP_ORDER%%$START_STEP*}"
  [[ " $BEFORE_START " == *" $END_STEP "* ]] && die "--from=$START_STEP is after --to=$END_STEP."
fi
step_skip() {
  should_skip_step "$STATE_FILE" "$RESUMED" "$1" "$STEP_ORDER" "$START_STEP" "$END_STEP"
}

# scan_findings — sum findings across every scan summary. Prints "?" when no
# summary parses (a missing/invalid AI summary is handled as a hard failure at
# its call site, not silently folded into the total).
scan_findings() {
  local total=0 found=false f count
  for f in "$PIPELINE_RUN_DIR"/scan-*.json; do
    [[ -f "$f" ]] || continue
    if count=$(findings_count "$f"); then
      total=$((total + count))
      found=true
    fi
  done
  if $found; then echo "$total"; else echo "?"; fi
}

# print_readiness_report — the pre-push proof: what ran, what was repaired,
# what changed, and what is still advisory. Every claim comes from recorded
# state, never from an assumption that a step ran.
print_readiness_report() {
  local step sha stat
  sha=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "none")
  stat="no commit from this run"
  if $COMMITTED; then
    stat=$(git -C "$PROJECT_DIR" diff --shortstat HEAD~1..HEAD 2>/dev/null || true)
    [[ -z "$stat" ]] && stat="no file changes in HEAD"
  fi
  info "═══════════════════════════════════════════════"
  info "Readiness report"
  info "═══════════════════════════════════════════════"
  printf '  Branch:        %s\n' "$BRANCH"
  printf '  Version:       %s\n' "${RELEASE_VERSION:-$VERSION}"
  printf '  HEAD:          %s (%s)\n' "$sha" "$stat"
  for step in $STEP_ORDER; do
    printf '  %-13s %s\n' "$step:" "${STEP_STATUS[$step]:-not run}"
  done
  if ((${#REPAIR_ATTEMPTS[@]} > 0)); then
    local label
    for label in "${!REPAIR_ATTEMPTS[@]}"; do
      (( ${REPAIR_ATTEMPTS[$label]:-0} > 0 )) || continue
      printf '  repaired:      %s (%s attempt(s))\n' "$label" "${REPAIR_ATTEMPTS[$label]}"
    done
  fi
  printf '  Scan findings: %s\n' "${SCAN_FINDINGS:-?}"
  printf '  Fixtures:      %s stale\n' "${FIXTURE_STALE:-?}"
  printf '  Run dir:       %s\n' "$PIPELINE_RUN_DIR"
  echo ""
}

# ── pre-flight checks ────────────────────────────────────────────────────────
FAILED_PRECHECKS=""
required_tools=(node npm git npx)
# opencode/curl are only needed when AI steps can run.
$DRY_RUN || required_tools+=(opencode curl)
for tool in "${required_tools[@]}"; do
  command -v "$tool" >/dev/null 2>&1 || FAILED_PRECHECKS="$FAILED_PRECHECKS $tool"
done
if [[ -n "$FAILED_PRECHECKS" ]]; then
  die "Pre-flight failed: missing tools:$FAILED_PRECHECKS"
fi

NODE_VERSION=$(node -v 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo 0)
[[ "$NODE_VERSION" -ge 20 ]] || die "node 20+ required, found $(node -v)"

npm ls --depth=0 >/dev/null 2>&1 || die "npm dependencies missing — run 'npm install' first."

info "Pre-flight checks: PASSED"
echo ""

# ── clean working tree ──────────────────────────────────────────────────────
if $RESUMED; then
  # A failed run leaves its edits behind by design; resuming must accept them.
  # Snapshot the inherited diff for audit, then let the remaining gates judge it.
  { git -C "$PROJECT_DIR" status --short; git -C "$PROJECT_DIR" diff; } \
    > "$PIPELINE_RUN_DIR/resume-dirty.txt" 2>/dev/null || true
  warn "Resume: accepting the interrupted run's working tree (snapshot: resume-dirty.txt)."
else
  git -C "$PROJECT_DIR" diff --exit-code --quiet 2>/dev/null || {
    error "Working tree has unstaged changes. Commit or stash before running."
    git -C "$PROJECT_DIR" status --short
    exit 1
  }
  git -C "$PROJECT_DIR" diff --cached --exit-code --quiet 2>/dev/null || {
    error "Working tree has staged changes. Commit or unstage before running."
    git -C "$PROJECT_DIR" status --short
    exit 1
  }
  info "Working tree: clean"
fi
# A dry run must not delete prior run logs; it may still write its own.
if ! $DRY_RUN && ! $RESUMED; then
  prune_runs "$PIPELINE_LOG_DIR" "${PIPELINE_KEEP_RUNS:-10}"
fi
echo ""

# ── start persistent backend ────────────────────────────────────────────────
# All AI steps run against one `opencode serve` instance in a shared session.
# The backend starts before step 1 because the spec-audit gate has a repair
# path: if the first `npm run check` fails, repair_loop drives an AI turn, and
# run_pipeline_step needs PIPELINE_SERVER_URL/PIPELINE_SESSION_ID bound.
# A dry run performs no AI steps, so it starts no backend.
if $DRY_RUN; then
  info "Dry run: skipping the opencode backend and all AI steps."
  echo ""
else
  ensure_server
  ensure_session
  info "Driving AI steps through shared session '${PIPELINE_SESSION_ID}'"
  echo ""
fi

# ── step 1: spec audit ──────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 1: Spec audit"
info "═══════════════════════════════════════════════"
echo ""

SAVED_ERR_TRAP=$(trap -p ERR 2>/dev/null || true)
trap - ERR
set +e
npm run lint:md >/dev/null 2>&1
SPECLINT_RC=$?
set -e
[[ -n "$SAVED_ERR_TRAP" ]] && eval "$SAVED_ERR_TRAP"
[[ $SPECLINT_RC -ne 0 ]] && warn "infobroker.md lint warnings (non-blocking)"
echo ""

warn "Running spec checks (typecheck + validate-spec + validate-readme + test)..."
if ! run_gate "Spec audit" "$PIPELINE_RUN_DIR/check.txt" npm run check; then
  if grep -qiE 'ENOTFOUND|ECONNREFUSED|EAI_AGAIN|network|registry|npm (ERR!)' "$PIPELINE_RUN_DIR/check.txt" 2>/dev/null; then
    die "Spec audit FAILED for an environmental reason (network/registry) — not auto-repairing. See $PIPELINE_RUN_DIR/check.txt."
  fi
  warn "Spec audit failed — attempting bounded repair..."
  # A dry run is non-mutating and has no backend; never launch an AI repair.
  if $DRY_RUN; then
    die "Spec audit FAILED (dry run: no repair). See $PIPELINE_RUN_DIR/check.txt."
  fi
  repair_loop "Spec audit" "npm run check" "$PROMPT_DIR/fix-gate.md" \
    "$PIPELINE_FIX_ATTEMPTS" "$PIPELINE_RUN_DIR/check.txt" "$PIPELINE_RUN_DIR/check-fix.txt" \
    || die "Spec audit FAILED after ${PIPELINE_FIX_ATTEMPTS} repair attempt(s)."
fi
status_set audit "passed"
echo ""
info "Spec audit: PASSED"
echo ""

# ── step 2: full spec read-through ──────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 2: Full spec read-through — style conformance"
info "═══════════════════════════════════════════════"
echo ""

# run_fast_spec_gates <label> <log> — the subset of `npm run check` that can
# catch spec/README/source drift after an AI edit, without re-running the full
# slow suite twice. The full gate still runs at the start and after sync.
run_fast_spec_gates() {
  local label="$1" log="$2"
  run_gate "$label" "$log" bash -c \
    'npm run typecheck && npm run validate-spec && npm run validate-readme && npm run check-script-discipline' \
    || return 1
}

# run_readthrough_pass <prompt-file> — one read-through turn plus its summary
# gate. Sets RT_CRITICAL/RT_HIGH/RT_INFO on success; dies on a failed turn, a
# missing/malformed/incomplete summary, or a summary that contradicts the
# closing token. A step can exit 0 without writing the artifact (observed
# 2026-10-22), so "?" is not an acceptable substitute for the counts.
run_readthrough_pass() {
  local prompt_file="$1"
  run_pipeline_step "$prompt_file" "$OUT_READTHROUGH" --agent "$PIPELINE_LIGHT_AGENT" --model "$PIPELINE_LIGHT_MODEL" --retry
  local rc=$OPC_RC
  [[ $rc -ne 0 ]] && die "Read-through FAILED. Check $OUT_READTHROUGH."

  local summary="$PIPELINE_RUN_DIR/readthrough.json" counts token_line tok
  if ! counts=$(summary_counts "$summary"); then
    error "Read-through wrote no parseable summary to ${summary}."
    error "The critical-finding gate cannot run without it — failing the step."
    exit 1
  fi
  read -r RT_CRITICAL RT_HIGH RT_INFO <<<"$counts"
  if [[ "$(json_from_file "$summary" status)" != "complete" ]]; then
    error "Read-through summary status is not 'complete' (${summary})."
    exit 1
  fi

  token_line=$(grep -oE 'READTHROUGH [0-9]+ critical; [0-9]+ high; [0-9]+ info' "$OUT_READTHROUGH" 2>/dev/null | tail -1 || true)
  if [[ -n "$token_line" ]]; then
    read -r tok <<<"$(sed -E 's/READTHROUGH ([0-9]+) critical; ([0-9]+) high; ([0-9]+) info/\1 \2 \3/' <<<"$token_line")"
    if [[ "$tok" != "$RT_CRITICAL $RT_HIGH $RT_INFO" ]]; then
      die "Read-through summary disagrees with its closing token (json ${RT_CRITICAL}/${RT_HIGH}/${RT_INFO}, token ${tok})."
    fi
  fi

  if (( RT_CRITICAL > 0 )); then
    error "Read-through BLOCKED: ${RT_CRITICAL} critical finding(s)."
    exit 1
  fi
}

if $DRY_RUN || step_skip readthrough; then
  info "Read-through: SKIPPED (dry run / state journal)"
  status_set readthrough "skipped"
else
  # Substitute the summary-json path into the prompt.
  sed "s|<SUMMARY_JSON>|$PIPELINE_RUN_DIR/readthrough.json|g" "$PROMPT_DIR/readthrough.md" > "$PIPELINE_RUN_DIR/readthrough.prompt.md"

  # generate-auth mutates a tracked file; run it deterministically before the
  # AI steps instead of racing an AI edit on the same working tree.
  if ! step_skip auth; then
    warn "Generating provider-auth.md from config.json (before read-through)..."
    npm run generate-auth >/dev/null 2>&1 || die "generate-auth FAILED."
  fi

  warn "Launching read-through session..."
  run_readthrough_pass "$PIPELINE_RUN_DIR/readthrough.prompt.md"
  echo ""
  info "Read-through: DONE — ${RT_CRITICAL}c / ${RT_HIGH}h / ${RT_INFO}i"

  # High findings are divergences the deterministic gates cannot see. Give
  # them a bounded repair loop under the full model, re-reviewing after each
  # attempt; if high findings survive the budget, stop for human attention.
  RT_ATTEMPT=0
  while (( RT_HIGH > 0 )); do
    if (( RT_ATTEMPT >= PIPELINE_FIX_ATTEMPTS )); then
      die "Read-through still reports ${RT_HIGH} high-severity finding(s) after ${RT_ATTEMPT} repair attempt(s) — refusing to push. See $OUT_READTHROUGH and $OUT_FIX."
    fi
    RT_ATTEMPT=$((RT_ATTEMPT + 1))
    warn "Read-through: ${RT_HIGH} high-severity finding(s) — repair attempt ${RT_ATTEMPT}/${PIPELINE_FIX_ATTEMPTS}."
    rt_first="$PIPELINE_RUN_DIR/readthrough.attempt-${RT_ATTEMPT}.txt"
    rt_json="$PIPELINE_RUN_DIR/readthrough.attempt-${RT_ATTEMPT}.json"
    cp "$OUT_READTHROUGH" "$rt_first"
    cp "$PIPELINE_RUN_DIR/readthrough.json" "$rt_json"
    sed -e "s|<READTHROUGH_TXT>|$rt_first|g" \
        -e "s|<READTHROUGH_JSON>|$rt_json|g" \
        -e "s|<FIX_TXT>|$OUT_FIX|g" \
        "$PROMPT_DIR/fix-high.md" > "$PIPELINE_RUN_DIR/fix-high.prompt.md"
    run_pipeline_step "$PIPELINE_RUN_DIR/fix-high.prompt.md" "$OUT_FIX" --model "$PIPELINE_MODEL" --retry
    FIX_RC=$OPC_RC
    [[ $FIX_RC -ne 0 ]] && die "High-finding repair FAILED. Check $OUT_FIX."
    run_fast_spec_gates "Post-repair spec checks" "$PIPELINE_RUN_DIR/check-post-fix-${RT_ATTEMPT}.txt" \
      || die "Spec checks FAILED after high-finding repair."

    # Re-review with the repair dispositions in view: the reviewer must
    # re-verify a rejected finding, not silently repeat it.
    {
      cat "$PIPELINE_RUN_DIR/readthrough.prompt.md"
      printf '\n\nA prior repair pass recorded dispositions for the previous high findings at %s. Re-verify any high finding it rejected against the tree; do not repeat a rejected finding without new evidence.\n' "$OUT_FIX"
    } > "$PIPELINE_RUN_DIR/readthrough.rereview.prompt.md"
    warn "Re-reviewing after repair..."
    run_readthrough_pass "$PIPELINE_RUN_DIR/readthrough.rereview.prompt.md"
  done
  if (( RT_ATTEMPT > 0 )); then
    REPAIR_ATTEMPTS["Read-through"]="$RT_ATTEMPT"
    info "Read-through: repair cleared the high findings."
  fi
  echo ""

  if ! git -C "$PROJECT_DIR" diff --quiet -- infobroker.md src/ config.json package.json scripts/ skills/ 2>/dev/null \
      || [[ -n "$(git -C "$PROJECT_DIR" ls-files --others --exclude-standard -- src/ scripts/ skills/ 2>/dev/null)" ]]; then
    warn "Read-through changed gate-relevant files — re-verifying spec checks..."
    run_fast_spec_gates "Post-read-through spec checks" "$PIPELINE_RUN_DIR/check-post-readthrough.txt" \
      || die "Spec checks FAILED after read-through auto-fix."
    info "Post-read-through spec checks: PASSED"
  fi
  state_mark readthrough
  status_set readthrough "passed"
fi
echo ""

# ── step 3: server sync ─────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 3: Server sync against spec"
info "═══════════════════════════════════════════════"
echo ""

if $DRY_RUN || step_skip sync; then
  info "Server sync: SKIPPED (dry run / state journal)"
  status_set sync "skipped"
else
  warn "Launching server sync session..."
  sed "s|<READTHROUGH_JSON>|$PIPELINE_RUN_DIR/readthrough.json|g" "$PROMPT_DIR/sync.md" > "$PIPELINE_RUN_DIR/sync.prompt.md"
  run_pipeline_step "$PIPELINE_RUN_DIR/sync.prompt.md" "$OUT_SYNC" --model "$PIPELINE_MODEL" --retry
  SYNC_RC=$OPC_RC
  [[ $SYNC_RC -ne 0 ]] && die "Server sync FAILED. Check $OUT_SYNC."

  # Post-sync gates: tests + version consistency + typecheck, on what we're
  # about to ship. A failure gets the bounded repair loop, then human attention.
  warn "Post-sync gates (test + version-sync + typecheck)..."
  repair_loop "Post-sync gates" \
    "npm test && npm run version-sync && npm run typecheck" \
    "$PROMPT_DIR/fix-gate.md" "$PIPELINE_FIX_ATTEMPTS" \
    "$PIPELINE_RUN_DIR/post-sync-gate.txt" "$PIPELINE_RUN_DIR/post-sync-fix.txt" \
    || die "Post-sync gates FAILED after ${PIPELINE_FIX_ATTEMPTS} repair attempt(s) (see $PIPELINE_RUN_DIR/post-sync-gate.txt)."
  info "Post-sync gates: PASSED"

  echo ""
  info "Server sync: DONE"
  state_mark sync
  status_set sync "passed"
fi
echo ""

# ── step 4: provider auth sync ──────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 4: Provider auth sync"
info "═══════════════════════════════════════════════"
echo ""

if $DRY_RUN || step_skip auth; then
  info "Provider auth sync: SKIPPED (dry run / state journal)"
  status_set auth "skipped"
else
  warn "Generating provider-auth.md from config.json..."
  npm run generate-auth >/dev/null 2>&1 || die "generate-auth FAILED."
  info "generate-auth: OK"

  if git -C "$PROJECT_DIR" diff --quiet skills/infobroker/references/provider-auth.md 2>/dev/null; then
    info "Provider-auth.md: no drift from config.json"
  else
    warn "Provider-auth.md regenerated — will be included in commit."
  fi
  state_mark auth
  status_set auth "passed"
fi
echo ""

# ── step 5: changelog ────────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 5: Changelog update"
info "═══════════════════════════════════════════════"
echo ""

# Did the spec or server actually change semantically? Whitespace-only edits
# (e.g. the read-through step's blank-line normalization) do NOT count — the
# changelog step correctly skips them, so the guard must ignore them too.
# A change is "semantic" when any added/removed line carries non-whitespace
# content. `git diff --unified=0` yields just the changed lines; strip the
# +/- markers and test for any non-space char. Blank-line-only or intra-line
# whitespace edits produce no match. Untracked files are always semantic.
# diff_content <paths...> — emit only added/removed lines (markers stripped).
diff_content() {
  git -C "$PROJECT_DIR" diff --unified=0 -- "$@" 2>/dev/null \
    | grep -E '^[+-]' \
    | grep -vE '^[+]{3}|^---' \
    | sed -E 's/^[+-]//'
}
# whitespace_only_diff — true when the diff carries no non-whitespace content.
whitespace_only_diff() {
  ! diff_content "$@" | grep -q '[^[:space:]]'
}
# version-only_diff — true when the diff's only non-blank content is version
# literals. `npm run version-bump` re-stamps the CalVer version to today across
# package.json, package-lock.json, server.json, and the `version:` literal in
# src/index.ts. A run where nothing else changed must NOT require a CHANGELOG
# entry: there is no REQ or behavior change. Return true when no line outside
# the version literals carries non-whitespace content.
version_only_diff() {
  local line
  while IFS= read -r line; do
    # JSON version line (top-level or nested): "version": "2026.08.24".
    [[ "$line" =~ ^[[:space:]]*\"version\"[[:space:]]*:[[:space:]]*\"[^\"]*\"[[:space:]]*,?[[:space:]]*$ ]] && continue
    # The McpServer version literal in index.ts:   version: "2026.08.24",
    [[ "$line" =~ ^[[:space:]]*version:[[:space:]]*\"[^\"]*\"[[:space:]]*,?[[:space:]]*$ ]] && continue
    # Any remaining non-whitespace content is a real change.
    if [[ "$line" =~ [^[:space:]] ]]; then
      return 1
    fi
  done < <(diff_content "$@")
  return 0
}
# spec_req_change — true when the infobroker.md diff touches a REQ body. C.10
# "Provenance" requires a CHANGELOG entry only when a REQ is modified; a
# narrative edit (§1–§3, §5–§8 prose, block-reservation summaries, appendix
# tables) is not a REQ change and must NOT demand a CHANGELOG entry. A REQ body
# is a `**REQ-### — Title**` header and its immediately-following paragraph
# (single paragraph, occasionally with a blank line after the header). Detect
# a REQ-body edit by scanning the diff with enough context that a body edit is
# always adjacent to its header.
spec_req_change() {
  # A letter-case-only diff (e.g. the read-through step title-casing a REQ
  # heading to match its siblings) is cosmetic, not a REQ modification: the
  # contract text is unchanged, so C.10 provenance requires no CHANGELOG
  # entry. Compare HEAD against the working tree with case normalized; an
  # empty result means nothing substantive changed.
  if diff \
      <(git -C "$PROJECT_DIR" show "HEAD:infobroker.md" 2>/dev/null | tr '[:upper:]' '[:lower:]') \
      <(tr '[:upper:]' '[:lower:]' < "$PROJECT_DIR/infobroker.md") \
      >/dev/null 2>&1; then
    return 1
  fi
  git -C "$PROJECT_DIR" diff --unified=4 -- infobroker.md 2>/dev/null \
    | awk '
      /^@@/ { body_left = 0; next }
      /^(\+\+\+|---)/ { next }
      {
        marker = substr($0, 1, 1)
        body = substr($0, 2)
        # A changed line that is itself a REQ header → REQ change.
        if ((marker == "+" || marker == "-") && body ~ /\*\*REQ-/) { print "REQ"; exit }
        # A REQ body is the paragraph immediately after its header, possibly
        # with one intervening blank line. body_left counts the buffer.
        if ((marker == "+" || marker == "-") && body_left > 0 && body ~ /[^[:space:]]/) { print "REQ"; exit }
        # Any REQ header (context or changed) arms the body buffer.
        if (body ~ /\*\*REQ-/) { body_left = 2; next }
        # A blank line consumes one slot; a non-blank non-header line ends the
        # buffer (the body paragraph has ended and this is narrative).
        if (body_left > 0) {
          if (body ~ /[^[:space:]]/) { body_left = 0 }
          else { body_left-- }
        }
      }' \
    | grep -q 'REQ'
}
CHANGELOG_DIRTY=""
# Behavior changes under src/ are always semantic (unless version-only).
if ! whitespace_only_diff src/; then
  if ! version_only_diff src/; then
    CHANGELOG_DIRTY=1
  fi
fi
# infobroker.md is semantic only when a REQ body changed.
if [[ -z "$CHANGELOG_DIRTY" ]] && spec_req_change; then
  CHANGELOG_DIRTY=1
fi
# Untracked files are always semantic.
if [[ -z "$CHANGELOG_DIRTY" ]] && [[ -n "$(git -C "$PROJECT_DIR" ls-files --others --exclude-standard -- infobroker.md src/ 2>/dev/null)" ]]; then
  CHANGELOG_DIRTY=1
fi

if $DRY_RUN || step_skip changelog; then
  info "Changelog update: SKIPPED (dry run / state journal)"
  status_set changelog "skipped"
else
  warn "Launching changelog update session..."
  run_pipeline_step "$PROMPT_DIR/changelog.md" "$OUT_CHANGELOG" --agent "$PIPELINE_LIGHT_AGENT" --model "$PIPELINE_LIGHT_MODEL" --retry
  CHANGELOG_RC=$OPC_RC
  [[ $CHANGELOG_RC -ne 0 ]] && die "Changelog update FAILED. Check $OUT_CHANGELOG."

  CH_ATTEMPT=0
  while ! grep -q "CHANGELOG UPDATED." "$OUT_CHANGELOG" 2>/dev/null; do
    if [[ -z "$CHANGELOG_DIRTY" ]]; then
      info "Changelog update: NO CHANGE (nothing semantic)"
      break
    fi
    if (( CH_ATTEMPT >= PIPELINE_FIX_ATTEMPTS )); then
      die "Spec or server changed but the changelog reported no update after ${CH_ATTEMPT} repair attempt(s) (spec provenance requires a CHANGELOG entry)."
    fi
    CH_ATTEMPT=$((CH_ATTEMPT + 1))
    warn "Changelog: semantic change detected but no entry — repair attempt ${CH_ATTEMPT}/${PIPELINE_FIX_ATTEMPTS}."
    {
      cat "$PROMPT_DIR/changelog.md"
      printf '\n\nThe pipeline detected a semantic change this run (REQ or src behavior). Add the entry now; do not report CHANGELOG NO CHANGE.\n'
    } > "$PIPELINE_RUN_DIR/changelog.retry.prompt.md"
    run_pipeline_step "$PIPELINE_RUN_DIR/changelog.retry.prompt.md" "$OUT_CHANGELOG" \
      --agent "$PIPELINE_LIGHT_AGENT" --model "$PIPELINE_LIGHT_MODEL" --retry
    [[ $OPC_RC -ne 0 ]] && die "Changelog repair attempt FAILED. Check $OUT_CHANGELOG."
  done
  if grep -q "CHANGELOG UPDATED." "$OUT_CHANGELOG" 2>/dev/null; then
    info "Changelog update: ADDED"
    (( CH_ATTEMPT > 0 )) && REPAIR_ATTEMPTS["Changelog"]="$CH_ATTEMPT"
  fi
  state_mark changelog
  status_set changelog "passed"
fi
echo ""

# ── scan helpers ─────────────────────────────────────────────────────────────
# run_scan_deterministic — reference + git-ref hygiene scripts (fast, no model).
run_scan_deterministic() {
  time_it "scan-refs" npx tsx scripts/scan-refs.ts --out "$PIPELINE_RUN_DIR/scan-refs.json" \
    || warn "scan-refs failed (exit $?) — findings may be incomplete."
  time_it "scan-git-refs" npx tsx scripts/scan-git-refs.ts --out "$PIPELINE_RUN_DIR/scan-git-refs.json" \
    || warn "scan-git-refs failed (exit $?) — findings may be incomplete."
  # Informational: surface fixtures past the documented refresh cadence (§9.2).
  npm run check-fixtures > "$PIPELINE_RUN_DIR/fixture-freshness.txt" 2>&1 \
    || warn "fixture-freshness check failed — see $PIPELINE_RUN_DIR/fixture-freshness.txt."
}
# run_scan_ai_one <prompt.md> <out.txt> <title-suffix> — one AI scan in its own
# forked session, so it neither collides with the main transcript nor inherits
# the prior steps' context.
run_scan_ai_one() {
  (
    unset PIPELINE_SESSION_ID
    PIPELINE_SESSION_TITLE="${PIPELINE_SESSION_TITLE:-push-pipeline}-$3"
    ensure_session
    run_pipeline_step "$1" "$2" --agent "$PIPELINE_LIGHT_AGENT" --model "$PIPELINE_LIGHT_MODEL" --retry
    exit "$OPC_RC"
  )
}

# ── step 6: scan ─────────────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 6: Reference + git hygiene scan"
info "═══════════════════════════════════════════════"
echo ""
if step_skip scan; then
  info "Scan: SKIPPED (state journal / --from / --to)"
  status_set scan "skipped"
else
  warn "Running deterministic scan (scan-refs + scan-git-refs)..."
  run_scan_deterministic
  DET_FINDINGS=$(scan_findings)
  info "Deterministic scan: ${DET_FINDINGS} finding(s)"
  [[ "$DET_FINDINGS" == "?" ]] && warn "Deterministic scan produced no parseable summary — a scan script may have failed."
  if $SCAN_AI && $DRY_RUN; then
    warn "Ignoring --scan-ai under --dry-run (deterministic scan only)."
  fi
  if $SCAN_AI && ! $DRY_RUN; then
    warn "AI scan enabled (--scan-ai) — running scan and scan-git concurrently in forked sessions..."
    sed -e "s|<SCAN_DIRS>|$SCAN_DIRS|g" -e "s|<LABEL>|INFOBROKER|g" -e "s|<SUMMARY_JSON>|$PIPELINE_RUN_DIR/scan-project.json|g" \
      "$PROMPT_DIR/scan.md" > "$PIPELINE_RUN_DIR/scan.prompt.md"
    sed -e "s|<LABEL>|INFOBROKER|g" -e "s|<GIT_SUMMARY_JSON>|$PIPELINE_RUN_DIR/scan-git.json|g" \
      "$PROMPT_DIR/scan-git.md" > "$PIPELINE_RUN_DIR/scan-git.prompt.md"
    run_scan_ai_one "$PIPELINE_RUN_DIR/scan.prompt.md" "$OUT_SCAN" "scan" &
    SCAN_PID=$!
    run_scan_ai_one "$PIPELINE_RUN_DIR/scan-git.prompt.md" "$OUT_SCAN_GIT" "scan-git" &
    SCAN_GIT_PID=$!
    wait "$SCAN_PID" || die "AI scan FAILED. Check $OUT_SCAN."
    wait "$SCAN_GIT_PID" || die "AI scan-git FAILED. Check $OUT_SCAN_GIT."
    local sfile
    for sfile in scan-project.json scan-git.json; do
      if ! findings_count "$PIPELINE_RUN_DIR/$sfile" >/dev/null \
          || [[ "$(json_from_file "$PIPELINE_RUN_DIR/$sfile" status)" != "complete" ]]; then
        die "AI scan summary missing, malformed, or incomplete: $sfile"
      fi
    done
    info "AI scan: $(scan_findings) total finding(s)"
  fi
  state_mark scan
  status_set scan "passed"
fi
echo ""

# ── step 7: README update ────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 7: Update README.md and skill references"
info "═══════════════════════════════════════════════"
echo ""
if $DRY_RUN || step_skip readme; then
  info "README update: SKIPPED (dry run / state journal / --from / --to)"
  status_set readme "skipped"
else
  warn "Launching README update session..."
  run_pipeline_step "$PROMPT_DIR/readme.md" "$OUT_README" --agent "$PIPELINE_LIGHT_AGENT" --model "$PIPELINE_LIGHT_MODEL" --retry
  README_RC=$OPC_RC
  [[ $README_RC -ne 0 ]] && die "README update FAILED. Check $OUT_README."
  state_mark readme
  status_set readme "passed"
fi

SCAN_FINDINGS=$(scan_findings)
FIXTURE_STALE=$(grep -oE '[0-9]+ stale fixture' "$PIPELINE_RUN_DIR/fixture-freshness.txt" 2>/dev/null | grep -oE '^[0-9]+' | head -1 || true)
[[ -z "$FIXTURE_STALE" ]] && FIXTURE_STALE="?"

# README-sync guard: a REQ-body change this run alters what the server does,
# so the README must reflect it (AGENTS.md README governance). A REQ change
# that leaves README.md untouched means the README step skipped its job.
if spec_req_change; then
  if whitespace_only_diff README.md; then
    die "Spec REQ changed but README.md was not updated — README must reflect spec changes."
  fi
fi

# validate-readme as a post-session shell gate
warn "Validating README..."
repair_loop "README validation" "npm run validate-readme" "$PROMPT_DIR/fix-gate.md" \
  "$PIPELINE_FIX_ATTEMPTS" "$PIPELINE_RUN_DIR/validate-readme.txt" "$PIPELINE_RUN_DIR/readme-fix.txt" \
  || die "README validation FAILED after ${PIPELINE_FIX_ATTEMPTS} repair attempt(s) (see $PIPELINE_RUN_DIR/validate-readme.txt)."
info "README validation: PASSED"
echo ""

info "README + references update: DONE"
echo ""

# ── Dry-run / no-commit exits ────────────────────────────────────────────────
if $DRY_RUN; then
  print_readiness_report
  warn "[DRY RUN] Non-mutating checks passed. Working tree left clean."
  exit 0
fi
if $NO_COMMIT; then
  print_readiness_report
  warn "[NO COMMIT] All steps passed. Working tree left dirty for inspection:"
  git -C "$PROJECT_DIR" status --short || true
  echo ""
  warn "Reset with: git -C \"$PROJECT_DIR\" checkout -- . && git -C \"$PROJECT_DIR\" clean -fd"
  exit 0
fi

# ── stage ───────────────────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Stage changes"
info "═══════════════════════════════════════════════"
echo ""

# Stage the whole tree (including new files, deletions, and tracked paths the
# old hardcoded allowlist silently omitted: test-fixtures/, DECISIONS.md,
# ROADMAP.md, bin/, .githooks/, and others), then prove nothing is left over.
git -C "$PROJECT_DIR" add -A -- .

# Deny-list: artifacts that must never be committed even if a bad .gitignore
# or a force-add tries to include them.
STAGED_FILES=$(git -C "$PROJECT_DIR" diff --cached --name-only 2>/dev/null || true)
if [[ -n "$STAGED_FILES" ]] && grep -qE "$STAGE_DENY_RE" <<<"$STAGED_FILES"; then
  error "Denied artifact staged — refusing to commit:"
  grep -E "$STAGE_DENY_RE" <<<"$STAGED_FILES" | head -20
  exit 1
fi

# Nothing may remain unstaged/untracked after the add; a leftover means the
# commit would silently under-ship the run. A fully staged entry has its index
# status letter followed by a space (`M  path`); an unstaged, untracked, or
# conflicted entry carries a non-space second column (` M`, `??`, `UU`), so
# filter the staged lines out rather than treating them as leftovers.
LEFTOVERS=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | grep -vE '^[A-Z] ' || true)
if [[ -n "$LEFTOVERS" ]]; then
  error "Staging incomplete — these paths would not be committed:"
  printf '%s\n' "$LEFTOVERS"
  exit 1
fi

# Secret scan over staged content. Matches are reported as path:line only;
# the value is never printed or logged.
SECRETS=$(scan_staged_for_secrets)
if [[ -n "$SECRETS" ]]; then
  if $ALLOW_SECRETS; then
    warn "Secret-pattern match found (allowed):"; printf '%s\n' "$SECRETS" | head -20
  else
    error "Secret-pattern match in staged content — refusing to commit (use --allow-secrets to override)."
    printf '%s\n' "$SECRETS" | head -20
    exit 1
  fi
fi

[[ "$SCAN_FINDINGS" != "0" && "$SCAN_FINDINGS" != "?" ]] && warn "Dead-code scan: ${SCAN_FINDINGS} finding(s) — review before commit."

# ── commit ──────────────────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Commit all changes"
info "═══════════════════════════════════════════════"
echo ""

require_git_identity
COMMIT_DATE=$(date +%Y-%m-%d)

COMMIT_SUMMARY=""
grep -q "SYNC COMPLETE" "$OUT_SYNC" 2>/dev/null && COMMIT_SUMMARY="${COMMIT_SUMMARY}Server synced to spec. "
grep -q "CHANGELOG UPDATED." "$OUT_CHANGELOG" 2>/dev/null && COMMIT_SUMMARY="${COMMIT_SUMMARY}Changelog updated. "
[[ -n "$SCAN_FINDINGS" && "$SCAN_FINDINGS" != "?" ]] && COMMIT_SUMMARY="${COMMIT_SUMMARY}Dead-code scan: ${SCAN_FINDINGS} findings. "
COMMIT_SUMMARY="${COMMIT_SUMMARY}Spec audited, README and references refreshed."

if git -C "$PROJECT_DIR" diff --staged --quiet 2>/dev/null; then
  warn "No changes to commit."
else
  echo ""
  warn "Changes about to be committed:"
  git -C "$PROJECT_DIR" diff --staged --stat
  echo ""
  warn "Committing changes..."
  git -C "$PROJECT_DIR" commit -m "Push pipeline ${COMMIT_DATE}

${COMMIT_SUMMARY}"
  COMMITTED=true
  info "Commit: DONE"
fi
echo ""

# Release identity is re-derived here, after the sync step has had its chance
# to bump the version. A startup snapshot can be stale by minutes and a stale
# version tags the wrong code (2026-11-04: v2026.10.28 was moved onto a
# 2026.11.04 commit).
RELEASE_VERSION=$(pipeline_version "$PROJECT_DIR")
if [[ "$RELEASE_VERSION" != "$VERSION" ]]; then
  info "Version changed during this run: ${VERSION} → ${RELEASE_VERSION}"
fi
[[ "$RELEASE_VERSION" == "unknown" ]] && die "Cannot read the release version from package.json."

# ── readiness report + push approval ────────────────────────────────────────
# The commit is local and reversible. Publication happens only after the
# report below and an explicit approval (or --yes).
print_readiness_report

git -C "$PROJECT_DIR" fetch origin >/dev/null 2>&1 || true
AHEAD=$(git -C "$PROJECT_DIR" rev-list --count @{u}..HEAD 2>/dev/null || echo 1)
SHIPPABLE=false
if $COMMITTED; then SHIPPABLE=true; fi
[[ "${AHEAD:-0}" -gt 0 ]] && SHIPPABLE=true
# A moved local tag also needs publishing.
if ! git -C "$PROJECT_DIR" tag -l "v${RELEASE_VERSION}" | grep -q "v${RELEASE_VERSION}"; then SHIPPABLE=true; fi

INTERACTIVE=false
[[ -t 0 ]] && INTERACTIVE=true

if ! ACTION=$(push_action "$NO_PUSH" "$FORCE" "$INTERACTIVE" "$SHIPPABLE"); then
  die "Push approval required: re-run with --yes (or --no-push to stop after the local commit)."
fi
case "$ACTION" in
  skip)
    warn "No-push mode: push, tag, and mirror sync skipped (commit is local only)."
    exit 0
    ;;
  nothing)
    info "Nothing to ship — no new commit, nothing ahead of upstream, tag present."
    exit 0
    ;;
  prompt)
    read -r -p "Push ${BRANCH}, tag v${RELEASE_VERSION}, and sync the mirror? (y/N) " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      warn "Push declined — the local commit is kept. Re-run with --yes to publish."
      exit 0
    fi
    ;;
  auto)
    warn "Push pre-approved (--yes)."
    ;;
esac
echo ""

# ── push ────────────────────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Push to origin"
info "═══════════════════════════════════════════════"
echo ""

# Fetch and check divergence before pushing.
git -C "$PROJECT_DIR" fetch origin >/dev/null 2>&1 || warn "fetch origin failed — proceeding with local state."
UPSTREAM=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)
if [[ -n "$UPSTREAM" ]]; then
  BEHIND=$(git -C "$PROJECT_DIR" rev-list --count HEAD..@{u} 2>/dev/null || echo 0)
  AHEAD=$(git -C "$PROJECT_DIR" rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
  if [[ "$BEHIND" -gt 0 ]]; then
    if $FORCE_PUSH; then
      warn "Local is behind remote by ${BEHIND} commit(s) — force-pushing with lease."
      git -C "$PROJECT_DIR" push --force-with-lease origin "$BRANCH"
    else
      die "Local is behind remote by ${BEHIND} commit(s). Pull/rebase first, or use --force-push."
    fi
  else
    warn "Pushing ${BRANCH}..."
    git -C "$PROJECT_DIR" push origin "$BRANCH"
  fi
else
  warn "Pushing ${BRANCH}..."
  git -C "$PROJECT_DIR" push origin "$BRANCH"
fi
info "Push: DONE"

# Tag the release. The tag name follows the version on disk *now*, not the
# startup snapshot. When the tag already exists for this same version and is an
# ancestor, it is stale rather than conflicting — multiple commits can share one
# CalVer version (no bump on a whitespace-only or non-behavior run) — so it is
# moved. A tag carrying a different version is never relabelled.
warn "Tagging v${RELEASE_VERSION}..."
TAG_MOVED=false
tag_release "$RELEASE_VERSION" "$($FORCE_TAG && echo 1 || echo 0)" "$SCRIPT_DIR/lib/release-policy.ts"
if $TAG_MOVED; then
  git -C "$PROJECT_DIR" push origin "v${RELEASE_VERSION}" --force
else
  git -C "$PROJECT_DIR" push origin "v${RELEASE_VERSION}"
fi
info "Tag v${RELEASE_VERSION}: DONE"
echo ""

# ── Mirror sync: push the canonical origin (git.gay) to the GitHub mirror ──
info "═══════════════════════════════════════════════"
info "Mirror sync (github)"
info "═══════════════════════════════════════════════"
if git -C "$PROJECT_DIR" config --get remote.github.url >/dev/null 2>&1; then
  git -C "$PROJECT_DIR" push github "$BRANCH" || warn "Mirror push (${BRANCH}) FAILED — GitHub mirror is behind origin."
  if $TAG_MOVED; then
    git -C "$PROJECT_DIR" push github "v${RELEASE_VERSION}" --force || warn "Mirror tag push FAILED."
  else
    git -C "$PROJECT_DIR" push github "v${RELEASE_VERSION}" || warn "Mirror tag push FAILED."
  fi
  info "Mirror sync: DONE"
else
  warn "No 'github' remote configured — skipping mirror sync (run 'git remote add github <url>')."
fi
echo ""

# ── npm + MCP Registry publish ─────────────────────────────────────────────
# Publishing is delegated to the GitHub mirror's CI (.github/workflows/publish.yml)
# via npm Trusted Publishing (OIDC) + mcp-publisher github-oidc. npm no longer
# allows local 2FA-bypass publishing, so the local pipeline only mirrors to
# GitHub; the mirror's workflow performs the version-gated publish.
info "npm + MCP Registry publish: handled by the GitHub mirror CI (OIDC)."

git -C "$PROJECT_DIR" ls-remote origin HEAD >/dev/null 2>&1
info "Remote check: OK"
echo ""

# ── post-run cleanliness report ─────────────────────────────────────────────
LEFTOVERS=$(git -C "$PROJECT_DIR" status --short || true)
echo ""
if [[ -n "$LEFTOVERS" ]]; then
  warn "Working tree after push (untracked/leftover files):"
  echo "$LEFTOVERS"
  echo ""
fi

# ── done ────────────────────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Infobroker push pipeline — COMPLETE"
info "═══════════════════════════════════════════════"
echo ""
for step in $STEP_ORDER; do
  printf '  %-13s %s\n' "$step:" "${STEP_STATUS[$step]:-not run}"
done
printf '  %-13s %s\n' "scan:" "${SCAN_FINDINGS} finding(s)"
printf '  %-13s %s stale\n' "fixtures:" "$FIXTURE_STALE"
[[ "$FIXTURE_STALE" != "0" && "$FIXTURE_STALE" != "?" ]] && warn "  ${FIXTURE_STALE} fixture(s) past the refresh cadence (see $PIPELINE_RUN_DIR/fixture-freshness.txt)."
if [[ -d "$PIPELINE_RUN_DIR/timings" ]]; then
  echo "  Step timings (seconds):"
  print_timings "$PIPELINE_RUN_DIR/timings"
fi
echo "  Pushed to origin/${BRANCH} — v${RELEASE_VERSION}"
echo "  Logs: $PIPELINE_RUN_DIR"
echo ""
info "Done."
