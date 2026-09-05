#!/usr/bin/env bash
# push-pipeline.sh — Full rebuild, audit, and push pipeline: spec read-through,
# server sync, provider auth sync, dead-code scan (project folder + git repo +
# MCP server source), README/refs update, commit, push.
#
# This is the deep-clean — full from-scratch server rebuild against the
# current spec, dead-code audit, and documentation refresh.
#
# Usage:
#   ./scripts/push-pipeline.sh [--dry-run] [--yes] [--no-push] [--resume] [--from=<step>]
#                              [--parallel] [--force-tag] [--force-push]
#                              [--allow-secrets] [--help]
#   --dry-run        Assemble, check, typecheck — skip commit, push, tag.
#   --yes (-y)       Skip confirmation prompt before commit/push.
#   --no-push        Commit but skip push, tag, and mirror sync.
#   --resume         Skip steps already recorded complete in the state journal.
#   --from=<step>    Start at a named step (readthrough|sync|changelog|scan|readme).
#   --parallel       Run independent steps concurrently (scan ∥ readme; auth ∥ readthrough).
#   --force-tag      Overwrite an existing version tag that is not an ancestor.
#   --force-push     Force push with lease (otherwise refuse if diverged).
#   --allow-secrets  Warn but do not block when staged content matches secret patterns.
#   --help (-h)      Show this message.
#
# Recovery guide
#   Undo a push:  git revert <sha> && git push origin $(git branch --show-current)
#   Undo a tag:   git tag -d v<version> && git push origin :refs/tags/v<version>
#   Logs:         $TMPDIR/infobroker/pipeline-logs/  (per-run timestamped)
#   Resume after a mid-pipeline failure: re-run with --resume.

set -euo pipefail

# ── Flag parsing ──
DRY_RUN=false; FORCE=false; RESUME=false; PARALLEL=false
FORCE_TAG=false; FORCE_PUSH=false; ALLOW_SECRETS=false
NO_PUSH=false
START_STEP=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes|-y) FORCE=true ;;
    --resume) RESUME=true ;;
    --parallel) PARALLEL=true ;;
    --force-tag) FORCE_TAG=true ;;
    --force-push) FORCE_PUSH=true ;;
    --allow-secrets) ALLOW_SECRETS=true ;;
    --no-push) NO_PUSH=true ;;
    --from=*) START_STEP="${arg#--from=}" ;;
    --help|-h)
      printf '%s\n' "Usage: ./scripts/push-pipeline.sh [--dry-run] [--yes] [--resume] [--from=<step>]"
      printf '%s\n' "                              [--parallel] [--force-tag] [--force-push] [--allow-secrets]"
      printf '%s\n' ""
      printf '%s\n' "  --dry-run   Spec audit, read-through, sync, checks, scans — skip commit, push, tag."
      printf '%s\n' "  --yes (-y)  Skip confirmation prompt before commit/push."
      printf '%s\n' "  --no-push   Commit but skip push, tag, and mirror sync."
      printf '%s\n' "  --resume    Skip steps already recorded complete."
      printf '%s\n' "  --from=S    Start at step (readthrough|sync|changelog|scan|readme)."
      printf '%s\n' "  --parallel  Run independent steps concurrently."
      printf '%s\n' "  --force-tag Overwrite an existing version tag that is not an ancestor of HEAD."
      printf '%s\n' "  --force-push Force-push with lease if diverged."
      printf '%s\n' "  --allow-secrets  Warn only on secret patterns."
      printf '%s\n' "  --help (-h) Show this message."
      exit 0
      ;;
    *) echo "Unknown flag: $arg"; echo "Usage: ./scripts/push-pipeline.sh [--dry-run] [--yes]"; exit 1 ;;
  esac
done

# ── Source shared helpers ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/pipeline/lib.sh
source "$SCRIPT_DIR/pipeline/lib.sh"

# ── Cleanup trap ──
cleanup() {
  stop_server
  local child_pids
  child_pids=$(jobs -p 2>/dev/null || true)
  [[ -n "$child_pids" ]] && { kill $child_pids 2>/dev/null; sleep 1; kill -9 $child_pids 2>/dev/null; } || true
}
trap cleanup EXIT SIGINT SIGTERM

PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PIPELINE_LOG_DIR="${TMPDIR:-/tmp}/infobroker/pipeline-logs"
PIPELINE_RUN_DIR="$PIPELINE_LOG_DIR/run-${TIMESTAMP}"
mkdir -p "$PIPELINE_RUN_DIR"

PIPELINE_LOG_FILE="$PIPELINE_RUN_DIR/pipeline.log"
STATE_FILE="$PIPELINE_RUN_DIR/state.json"
PROMPT_DIR="$SCRIPT_DIR/pipeline/prompts"

# Per-step output files
OUT_READTHROUGH="$PIPELINE_RUN_DIR/readthrough.txt"
OUT_SYNC="$PIPELINE_RUN_DIR/sync.txt"
OUT_CHANGELOG="$PIPELINE_RUN_DIR/changelog.txt"
OUT_SCAN="$PIPELINE_RUN_DIR/scan.txt"
OUT_SCAN_GIT="$PIPELINE_RUN_DIR/scan-git.txt"
OUT_README="$PIPELINE_RUN_DIR/readme.txt"

# Default timeout per opencode subprocess (seconds, 0 = no timeout)
OPC_TIMEOUT="${OPC_TIMEOUT:-1800}"
# Model tiering: full model for sync, light model for review-only steps.
PIPELINE_MODEL="${PIPELINE_MODEL:-}"
PIPELINE_LIGHT_MODEL="${PIPELINE_LIGHT_MODEL:-${PIPELINE_MODEL:-}}"
# Dead-code scan directories (space-separated, relative to repo root)
SCAN_DIRS="${SCAN_DIRS:-src scripts skills instructions}"

: > "$PIPELINE_LOG_FILE"

# ── State journal ────────────────────────────────────────────────────────────
state_done() { [[ "$(json_from_file "$STATE_FILE" "$1")" == "true" ]]; }
state_mark() {
  local key="$1"
  node -e 'const fs=require("fs");const p=process.argv[1];let j={};try{j=require(p)}catch{};j[process.argv[2]]=true;fs.writeFileSync(p,JSON.stringify(j,null,2))' \
    "$STATE_FILE" "$key" 2>/dev/null || true
}
# step_skip <key> — true if the step should be skipped (resume journal OR --from).
STEP_ORDER="readthrough sync auth changelog scan readme"
step_skip() {
  [[ "$RESUME" == "true" ]] && state_done "$1" && return 0
  if [[ -n "$START_STEP" ]]; then
    # Skip any step that sorts before START_STEP.
    local before="${STEP_ORDER%%$START_STEP*}"
    [[ "$before" == "$STEP_ORDER" ]] && return 1   # START_STEP not found → skip nothing
    [[ " $before " == *" $1 "* ]] && return 0
  fi
  return 1
}

# scan_findings — sum `findings` across the project scan (scan-project.json)
# and the git scan summary (scan-git.json). Prints "?" if none is parseable.
scan_findings() {
  local total=0 found=false f count
  for f in "$PIPELINE_RUN_DIR"/scan-*.json; do
    [[ -f "$f" ]] || continue
    count=$(json_from_file "$f" findings)
    if [[ "$count" =~ ^[0-9]+$ ]]; then
      total=$((total + count))
      found=true
    fi
  done
  if $found; then echo "$total"; else echo "?"; fi
}

# ── pre-flight checks ────────────────────────────────────────────────────────
FAILED_PRECHECKS=""
for tool in opencode node npx; do
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
echo ""

# ── step 1: spec audit ──────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 1: Spec audit"
info "═══════════════════════════════════════════════"
echo ""

set +e
npx markdownlint infobroker.md >/dev/null 2>&1
SPECLINT_RC=$?
set -e
[[ $SPECLINT_RC -ne 0 ]] && warn "infobroker.md lint warnings (non-blocking)"
echo ""

warn "Running spec checks (typecheck + validate-spec + validate-readme + test)..."
if ! npm run check 2>/dev/null; then
  echo ""
  error "Spec audit FAILED. Run 'npm run check' locally to see errors."
  exit 1
fi
echo ""
info "Spec audit: PASSED"
echo ""

# ── start persistent backend ────────────────────────────────────────────────
# All AI steps run against one `opencode serve` instance in a shared session.
ensure_server
ensure_session
info "Driving AI steps through shared session '${PIPELINE_SESSION_ID}'"
echo ""

# ── step 2: full spec read-through ──────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 2: Full spec read-through — style conformance"
info "═══════════════════════════════════════════════"
echo ""

if step_skip readthrough; then
  info "Read-through: SKIPPED (state journal)"
else
  # Substitute the summary-json path into the prompt.
  sed "s|<SUMMARY_JSON>|$PIPELINE_RUN_DIR/readthrough.json|g" "$PROMPT_DIR/readthrough.md" > "$PIPELINE_RUN_DIR/readthrough.prompt.md"

  # generate-auth is independent of read-through; run concurrently if --parallel.
  if $PARALLEL; then
    npm run generate-auth >/dev/null 2>&1 &
    GEN_AUTH_PID=$!
  fi

  warn "Launching read-through session..."
  run_pipeline_step "$PIPELINE_RUN_DIR/readthrough.prompt.md" "$OUT_READTHROUGH" --model "$PIPELINE_LIGHT_MODEL" --retry
  READTHROUGH_RC=$OPC_RC
  [[ $READTHROUGH_RC -ne 0 ]] && die "Read-through FAILED. Check $OUT_READTHROUGH."

  critical=$(json_from_file "$PIPELINE_RUN_DIR/readthrough.json" critical)
  high=$(json_from_file "$PIPELINE_RUN_DIR/readthrough.json" high)
  infoc=$(json_from_file "$PIPELINE_RUN_DIR/readthrough.json" info)

  if [[ "$critical" != "0" && "$critical" != "?" ]]; then
    error "Read-through BLOCKED: ${critical} critical finding(s)."
    exit 1
  fi

  echo ""
  info "Read-through: DONE — ${critical}c / ${high}h / ${infoc}i"
  [[ "$high" != "0" && "$high" != "?" ]] && warn "Warning: ${high} high-severity finding(s)."
  echo ""

  if git -C "$PROJECT_DIR" diff --name-only | grep -q 'infobroker.md'; then
    warn "infobroker.md modified by read-through — re-verifying spec checks..."
    npm run check >/dev/null 2>&1 || die "Spec checks FAILED after read-through auto-fix."
    info "Post-read-through spec checks: PASSED"
  fi
  state_mark readthrough

  if [[ -n "${GEN_AUTH_PID:-}" ]]; then
    wait "$GEN_AUTH_PID" || true
    unset GEN_AUTH_PID
  fi
fi
echo ""

# ── step 3: server sync ─────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 3: Server sync against spec"
info "═══════════════════════════════════════════════"
echo ""

if step_skip sync; then
  info "Server sync: SKIPPED (state journal)"
else
  warn "Launching server sync session..."
  run_pipeline_step "$PROMPT_DIR/sync.md" "$OUT_SYNC" --model "$PIPELINE_MODEL" --retry
  SYNC_RC=$OPC_RC
  [[ $SYNC_RC -ne 0 ]] && die "Server sync FAILED. Check $OUT_SYNC."

  # Post-sync gates: tests + version consistency + typecheck, on what we're about to ship.
  warn "Post-sync gates (test + version-sync + typecheck)..."
  npm test >/dev/null 2>&1 || die "Post-sync tests FAILED."
  npm run version-sync >/dev/null 2>&1 || die "Version sync FAILED after version-bump."
  npm run typecheck >/dev/null 2>&1 || die "Typecheck FAILED after sync."
  info "Post-sync gates: PASSED"

  echo ""
  info "Server sync: DONE"
  state_mark sync
fi
echo ""

# ── step 4: provider auth sync ──────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Step 4: Provider auth sync"
info "═══════════════════════════════════════════════"
echo ""

if ! step_skip auth; then
  warn "Generating provider-auth.md from config.json..."
  npm run generate-auth >/dev/null 2>&1 || die "generate-auth FAILED."
  info "generate-auth: OK"

  if git -C "$PROJECT_DIR" diff --quiet skills/infobroker/references/provider-auth.md 2>/dev/null; then
    info "Provider-auth.md: no drift from config.json"
  else
    warn "Provider-auth.md regenerated — will be included in commit."
  fi
  state_mark auth
else
  info "Provider auth sync: SKIPPED (state journal)"
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

if step_skip changelog; then
  info "Changelog update: SKIPPED (state journal)"
else
  warn "Launching changelog update session..."
  run_pipeline_step "$PROMPT_DIR/changelog.md" "$OUT_CHANGELOG" --model "$PIPELINE_LIGHT_MODEL" --retry
  CHANGELOG_RC=$OPC_RC
  [[ $CHANGELOG_RC -ne 0 ]] && die "Changelog update FAILED. Check $OUT_CHANGELOG."

  if grep -q "CHANGELOG UPDATED." "$OUT_CHANGELOG" 2>/dev/null; then
    info "Changelog update: ADDED"
  else
    info "Changelog update: NO CHANGE"
    if [[ -n "$CHANGELOG_DIRTY" ]]; then
      die "Spec or server changed but changelog reported no update (spec provenance requires a CHANGELOG entry — REQ changes)."
    fi
  fi
  state_mark changelog
fi
echo ""

# ── steps 6 (scan) and 7 (readme) — parallelizable ──────────────────────────
if $PARALLEL; then
  # Run the scan in a FORKED session so it does not collide with the README
  # step, which continues the main session. Each writes disjoint files.
  info "Running scan and README update in parallel..."
  (
    # The scan runs in its own session so it does not collide with the README
    # step, which continues the main session. Ensure it bootstraps a fresh
    # session under a distinct title rather than deriving from the resolved
    # ses_ id of the main session.
    unset PIPELINE_SESSION_ID
    PIPELINE_SESSION_TITLE="${PIPELINE_SESSION_TITLE:-push-pipeline}-scan"
    ensure_session
    sed -e "s|<SCAN_DIRS>|$SCAN_DIRS|g" -e "s|<LABEL>|INFOBROKER|g" -e "s|<SUMMARY_JSON>|$PIPELINE_RUN_DIR/scan-project.json|g" \
      "$PROMPT_DIR/scan.md" > "$PIPELINE_RUN_DIR/scan.prompt.md"
    run_pipeline_step "$PIPELINE_RUN_DIR/scan.prompt.md" "$OUT_SCAN" --model "$PIPELINE_LIGHT_MODEL" --retry
    [[ $OPC_RC -ne 0 ]] && exit 1
    sed -e "s|<LABEL>|INFOBROKER|g" -e "s|<GIT_SUMMARY_JSON>|$PIPELINE_RUN_DIR/scan-git.json|g" \
      "$PROMPT_DIR/scan-git.md" > "$PIPELINE_RUN_DIR/scan-git.prompt.md"
    run_pipeline_step "$PIPELINE_RUN_DIR/scan-git.prompt.md" "$OUT_SCAN_GIT" --model "$PIPELINE_LIGHT_MODEL" --retry
    [[ $OPC_RC -ne 0 ]] && exit 1
  ) &
  SCAN_PID=$!
  run_pipeline_step "$PROMPT_DIR/readme.md" "$OUT_README" --model "$PIPELINE_LIGHT_MODEL" --retry
  README_RC=$OPC_RC
  wait "$SCAN_PID"; SCAN_RC=$?
  [[ $SCAN_RC -ne 0 ]] && die "Dead-code scan FAILED. Check $OUT_SCAN / $OUT_SCAN_GIT."
  [[ $README_RC -ne 0 ]] && die "README update FAILED. Check $OUT_README."
  state_mark scan
  state_mark readme
else
  info "═══════════════════════════════════════════════"
  info "Step 6: Dead-code scan (project folder + git repo + MCP server source)"
  info "═══════════════════════════════════════════════"
  echo ""
  if step_skip scan; then
    info "Dead-code scan: SKIPPED (state journal)"
  else
    sed -e "s|<SCAN_DIRS>|$SCAN_DIRS|g" -e "s|<LABEL>|INFOBROKER|g" -e "s|<SUMMARY_JSON>|$PIPELINE_RUN_DIR/scan-project.json|g" \
      "$PROMPT_DIR/scan.md" > "$PIPELINE_RUN_DIR/scan.prompt.md"
    run_pipeline_step "$PIPELINE_RUN_DIR/scan.prompt.md" "$OUT_SCAN" --model "$PIPELINE_LIGHT_MODEL" --retry
    [[ $OPC_RC -ne 0 ]] && die "Dead-code scan FAILED. Check $OUT_SCAN."
    sed -e "s|<LABEL>|INFOBROKER|g" -e "s|<GIT_SUMMARY_JSON>|$PIPELINE_RUN_DIR/scan-git.json|g" \
      "$PROMPT_DIR/scan-git.md" > "$PIPELINE_RUN_DIR/scan-git.prompt.md"
    run_pipeline_step "$PIPELINE_RUN_DIR/scan-git.prompt.md" "$OUT_SCAN_GIT" --model "$PIPELINE_LIGHT_MODEL" --retry
    [[ $OPC_RC -ne 0 ]] && die "Dead-code scan FAILED. Check $OUT_SCAN_GIT."
    echo ""
    info "Dead-code scan: DONE — $(scan_findings) finding(s)"
    state_mark scan
  fi
  echo ""

  info "═══════════════════════════════════════════════"
  info "Step 7: Update README.md and skill references"
  info "═══════════════════════════════════════════════"
  echo ""
  if step_skip readme; then
    info "README update: SKIPPED (state journal)"
  else
    warn "Launching README update session..."
    run_pipeline_step "$PROMPT_DIR/readme.md" "$OUT_README" --model "$PIPELINE_LIGHT_MODEL" --retry
    README_RC=$OPC_RC
    [[ $README_RC -ne 0 ]] && die "README update FAILED. Check $OUT_README."
    state_mark readme
  fi
fi

SCAN_FINDINGS=$(scan_findings)

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
npm run validate-readme >/dev/null 2>&1 || die "README validation FAILED."
info "README validation: PASSED"
echo ""

info "README + references update: DONE"
echo ""

# ── Dry-run exit ─────────────────────────────────────────────────────────────
if $DRY_RUN; then
  echo ""
  warn "[DRY RUN] All checks passed. Would commit and push."
  exit 0
fi

# ── stage ───────────────────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "Stage changes"
info "═══════════════════════════════════════════════"
echo ""

# Pre-commit guard: node_modules must not appear.
git -C "$PROJECT_DIR" diff --name-only | grep -q '^node_modules/' && die "node_modules in diff — aborting commit."

# Stage explicit root files (skip missing without error).
for f in infobroker.md README.md CHANGELOG.md AGENTS.md package.json package-lock.json tsconfig.json config.json server.json; do
  [[ -f "$f" ]] && git -C "$PROJECT_DIR" add "$f"
done
# Stage everything under these directories — INCLUDING new untracked files,
# so a sync that adds a source file actually ships it.
git -C "$PROJECT_DIR" add instructions/ src/ skills/ scripts/

# Secret scan over staged content.
SECRETS=$(scan_staged_for_secrets)
if [[ -n "$SECRETS" ]]; then
  if $ALLOW_SECRETS; then
    warn "Secret-pattern match found (allowed):"; echo "$SECRETS" | head -20
  else
    error "Secret-pattern match in staged content — refusing to commit (use --allow-secrets to override)."
    echo "$SECRETS" | head -20
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
VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
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

  if ! $FORCE; then
    [[ -t 0 ]] || die "Non-interactive terminal — use --yes to skip the confirmation prompt."
    read -r -p "Commit, push, and tag? (y/N) " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
  fi
  echo ""

  warn "Committing changes..."
  git -C "$PROJECT_DIR" commit -m "Push pipeline ${COMMIT_DATE}

${COMMIT_SUMMARY}"
  info "Commit: DONE"
fi
echo ""

# ── push ────────────────────────────────────────────────────────────────────
if $NO_PUSH; then
  warn "No-push mode: skipping push, tag, mirror sync, and remote check (commit is local only)."
else
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
      git -C "$PROJECT_DIR" push --force-with-lease origin main
    else
      die "Local is behind remote by ${BEHIND} commit(s). Pull/rebase first, or use --force-push."
    fi
  else
    warn "Pushing main..."
    git -C "$PROJECT_DIR" push origin main
  fi
else
  warn "Pushing main..."
  git -C "$PROJECT_DIR" push origin main
fi
info "Push: DONE"

# Tag with version. When the tag already exists but points to an earlier
# commit, the tag is stale rather than conflicting: multiple commits can share
# one CalVer version (no version bump on a whitespace-only or non-behavior
# run). The default is to move the stale tag onto the current head; an
# explicit --force-tag is only required when the existing tag points to a
# different, newer line of work.
warn "Tagging v${VERSION}..."
TAG_MOVED=false
if git -C "$PROJECT_DIR" tag -l "v${VERSION}" | grep -q "v${VERSION}"; then
  if $FORCE_TAG || git -C "$PROJECT_DIR" merge-base --is-ancestor "v${VERSION}" HEAD; then
    warn "Tag v${VERSION} exists — moving it onto the current head (packages pinning the old tag will diverge)."
    git -C "$PROJECT_DIR" tag -f "v${VERSION}"
    TAG_MOVED=true
  else
    die "Tag v${VERSION} already exists and is not an ancestor of HEAD. Use --force-tag to overwrite."
  fi
else
  git -C "$PROJECT_DIR" tag "v${VERSION}"
fi
if $TAG_MOVED; then
  git -C "$PROJECT_DIR" push origin "v${VERSION}" --force
else
  git -C "$PROJECT_DIR" push origin "v${VERSION}"
fi
info "Tag v${VERSION}: DONE"
echo ""

# ── Mirror sync: push the canonical origin (git.gay) to the GitHub mirror ──
info "═══════════════════════════════════════════════"
info "Mirror sync (github)"
info "═══════════════════════════════════════════════"
if git -C "$PROJECT_DIR" config --get remote.github.url >/dev/null 2>&1; then
  git -C "$PROJECT_DIR" push github main || warn "Mirror push (main) FAILED — GitHub mirror is behind origin."
  if $TAG_MOVED; then
    git -C "$PROJECT_DIR" push github "v${VERSION}" --force || warn "Mirror tag push FAILED."
  else
    git -C "$PROJECT_DIR" push github "v${VERSION}" || warn "Mirror tag push FAILED."
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
fi

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
echo "  Spec audited and read-through complete."
grep -q "SYNC COMPLETE" "$OUT_SYNC" 2>/dev/null && echo "  Server synced to spec."
echo "  Provider auth docs regenerated."
grep -q "CHANGELOG UPDATED." "$OUT_CHANGELOG" 2>/dev/null && echo "  Changelog updated."
echo "  Dead-code scan: ${SCAN_FINDINGS} finding(s)."
echo "  README and skill references refreshed."
if $NO_PUSH; then
  echo "  Committed locally — push skipped (--no-push)."
else
  echo "  Pushed to origin — v${VERSION}"
fi
echo "  Logs: $PIPELINE_RUN_DIR"
echo ""
info "Done."
