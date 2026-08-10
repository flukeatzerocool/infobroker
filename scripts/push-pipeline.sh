#!/usr/bin/env bash
# push-pipeline.sh — Full rebuild, audit, and push pipeline: spec read-through,
# server sync, provider auth sync, dead-data scan, README/refs update, commit,
# push.
#
# This is the deep-clean — full from-scratch server rebuild against the
# current spec, dead-data audit, and documentation refresh.
#
# Usage:
#   ./scripts/push-pipeline.sh [--dry-run] [--yes] [--help]
#   --dry-run    Assemble, check, typecheck — skip commit, push, tag.
#   --yes (-y)   Skip confirmation prompt before commit/push.
#   --help (-h)  Show this message.

# ── Flag parsing ──

DRY_RUN=false
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes|-y) FORCE=true ;;
    --help|-h)
      echo "Usage: ./scripts/push-pipeline.sh [--dry-run] [--yes]"
      echo ""
      echo "  --dry-run   Spec audit, read-through, sync, checks, scans — skip commit, push, tag."
      echo "  --yes (-y)  Skip confirmation prompt before commit/push."
      echo "  --help (-h) Show this message."
      echo ""
      echo "Steps: spec audit → read-through → server sync → provider auth sync →"
      echo "       typecheck → dead-data scan → README update → commit → push → tag"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg"
      echo "Usage: ./scripts/push-pipeline.sh [--dry-run] [--yes]"
      exit 1
      ;;
  esac
done

set -euo pipefail

# Kill child opencode processes on script exit (prevent orphan zombies)
cleanup_children() {
  local child_pids
  child_pids=$(jobs -p 2>/dev/null || true)
  [[ -n "$child_pids" ]] && { kill $child_pids 2>/dev/null; sleep 1; kill -9 $child_pids 2>/dev/null; } || true
}
trap cleanup_children EXIT SIGINT SIGTERM

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PIPELINE_LOG_DIR="${TMPDIR:-/tmp}/infobroker/pipeline-logs"
WRAP_LOG="$PIPELINE_LOG_DIR/wrapup-${TIMESTAMP}-log.txt"
WRAP_READTHROUGH_OUT="$PIPELINE_LOG_DIR/wrapup-readthrough-${TIMESTAMP}-output.txt"
WRAP_SYNC_OUT="$PIPELINE_LOG_DIR/wrapup-sync-${TIMESTAMP}-output.txt"
WRAP_SCAN_OUT="$PIPELINE_LOG_DIR/wrapup-scan-${TIMESTAMP}-output.txt"
WRAP_README_OUT="$PIPELINE_LOG_DIR/wrapup-readme-${TIMESTAMP}-output.txt"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

mkdir -p "$PIPELINE_LOG_DIR"

# Default timeout per opencode subprocess (seconds, 0 = no timeout)
OPC_TIMEOUT="${OPC_TIMEOUT:-1800}"

# ── shared: run_opencode ───────────────────────────────────────────────────
# Usage: run_opencode <session-title> <out-file> ["$PROMPT_VAR"] [--retry]
# Runs opencode with a configurable timeout. With --retry, retries once on failure.
# Sets global OPC_RC with the exit code.
run_opencode() {
  local session_title="$1"
  local out_file="$2"
  local prompt="$3"
  local retry=false
  if [[ "${4:-}" == "--retry" ]]; then
    retry=true
  fi

  local timeout_cmd=("opencode")
  if [[ "${OPC_TIMEOUT:-1800}" -gt 0 ]] && command -v timeout >/dev/null 2>&1; then
    timeout_cmd=("timeout" "$OPC_TIMEOUT" "opencode")
  fi

  set +e
  "${timeout_cmd[@]}" run \
    --agent build \
    --auto \
    --title "$session_title" \
    --dir "$PROJECT_DIR" \
    "$prompt" \
    > "$out_file" 2>> "$WRAP_LOG"
  OPC_RC=$?
  set -e

  if [[ $OPC_RC -ne 0 ]] && $retry; then
    echo -e "${YELLOW}Session '${session_title}' failed (exit ${OPC_RC}) — retrying once...${NC}"
    set +e
    "${timeout_cmd[@]}" run \
      --agent build \
      --auto \
      --title "${session_title}-retry" \
      --dir "$PROJECT_DIR" \
      "$prompt" \
      > "${out_file}.retry" 2>> "$WRAP_LOG"
    OPC_RC=$?
    if [[ $OPC_RC -eq 0 ]]; then
      mv "${out_file}.retry" "$out_file"
    fi
    set -e
  fi
}

# ── shared: run_dead_data_scan ─────────────────────────────────────────────
# Usage: run_dead_data_scan --dir <subdir> --label <display-name> --out <log-path> --session-title <title>
# Launches a read-only audit for dead/outdated data in the given directory.
# Returns findings count in the global variable SCAN_FINDINGS_COUNT.
run_dead_data_scan() {
  local dir="" label="" out="" session_title=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dir) dir="$2"; shift 2 ;;
      --label) label="$2"; shift 2 ;;
      --out) out="$2"; shift 2 ;;
      --session-title) session_title="$2"; shift 2 ;;
      *) echo -e "${RED}run_dead_data_scan: unknown arg $1${NC}"; return 1 ;;
    esac
  done

  local SCAN_PROMPT="Scan the ${dir}/ directory for dead and outdated data. This is a
read-only audit — do NOT modify any files.

Checklist:
1. REQ citations in source code — grep for REQ-\d+ patterns. Each REQ number
   must exist in infobroker.md. Report any that don't.
2. Deprecated or renamed terms — grep for any stale references to removed
   REQs, tools, or providers no longer configured.
3. Hardcoded counts — check if provider count, tool count, REQ count, or
   other numeric constants in source code match spec_health output or
   current infobroker.md.
4. Stale file paths — check import paths, config references, and README
   paths exist on disk.
5. Dangling cross-references in DECISIONS.md — verify every cited REQ and
   spec section reference resolves in infobroker.md.
6. Provider references — check config.json provider entries against
   src/providers/ files. Report providers in source with no config entry
   and vice versa.

For each finding, report: file:line, what's dead/outdated, and the suggested
fix.

End with '${label} SCAN COMPLETE. N findings.' (N is the count — N=0 means
clean, no dead data found)."

  run_opencode "$session_title" "$out" "$SCAN_PROMPT" --retry
  local rc=$OPC_RC

  if [[ $rc -ne 0 ]]; then
    echo -e "${RED}${label} scan FAILED. Check $out.${NC}"
    exit 1
  fi

  SCAN_FINDINGS_COUNT=$(grep -oP '\d+ findings' "$out" 2>/dev/null | grep -oP '\d+' || echo "?")
  echo ""
  echo -e "${GREEN}${label} scan: DONE — ${SCAN_FINDINGS_COUNT} finding(s)${NC}"
  echo ""
}

# ── pre-flight checks ──────────────────────────────────────────────────────
FAILED_PRECHECKS=""

if ! command -v opencode >/dev/null 2>&1; then
  echo -e "${RED}opencode not found in PATH — required for AI-driven build sessions${NC}"
  FAILED_PRECHECKS="opencode"
fi

if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}node not found in PATH${NC}"
  FAILED_PRECHECKS="$FAILED_PRECHECKS node"
else
  NODE_VERSION=$(node -v 2>/dev/null | grep -oP '\d+' | head -1 || echo "0")
  if [[ "$NODE_VERSION" -lt 20 ]]; then
    echo -e "${RED}node 20+ required, found $(node -v)${NC}"
    FAILED_PRECHECKS="$FAILED_PRECHECKS node-version"
  fi
fi

if ! command -v npx >/dev/null 2>&1; then
  echo -e "${RED}npx not found in PATH${NC}"
  FAILED_PRECHECKS="$FAILED_PRECHECKS npx"
fi

if ! npm ls --depth=0 >/dev/null 2>&1; then
  echo -e "${RED}npm dependencies missing — run 'npm install' first${NC}"
  FAILED_PRECHECKS="$FAILED_PRECHECKS npm-deps"
fi

if [[ -n "$FAILED_PRECHECKS" ]]; then
  echo ""
  echo -e "${RED}Pre-flight checks FAILED:$FAILED_PRECHECKS${NC}"
  exit 1
fi

echo -e "${GREEN}Pre-flight checks: PASSED${NC}"
echo ""

# ── clean working tree ──────────────────────────────────────────────────────

if ! git -C "$PROJECT_DIR" diff --exit-code --quiet 2>/dev/null; then
  echo -e "${RED}Working tree has unstaged changes. Commit or stash before running.${NC}"
  git -C "$PROJECT_DIR" status --short
  exit 1
fi

if ! git -C "$PROJECT_DIR" diff --cached --exit-code --quiet 2>/dev/null; then
  echo -e "${RED}Working tree has staged changes. Commit or unstage before running.${NC}"
  git -C "$PROJECT_DIR" status --short
  exit 1
fi

echo -e "${GREEN}Working tree: clean${NC}"
echo ""

# ── step 1: spec audit ─────────────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 1/9: Spec audit${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

# run full check suite
echo -e "${YELLOW}Running spec checks (typecheck + validate-spec + validate-readme)...${NC}"
if ! npm run check 2>/dev/null; then
  echo ""
  echo -e "${RED}Spec audit FAILED. Run 'npm run check' locally to see errors.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}Spec audit: PASSED${NC}"
echo ""

# ── step 2: full spec read-through (style conformance) ──────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 2/9: Full spec read-through — style conformance${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

READTHROUGH_PROMPT="Read infobroker.md end to end. Load and apply the
proofreading skill in spec mode. Verify every REQ body conforms to
SR-011: states *what* not *how*, no parameter types, no Default: clauses,
no enumerated catalogs, no algorithm descriptions. Flag any violation with the
REQ number, the offending text, and the rule violated.

The spec mode activates automatically when the document contains **REQ- blocks.
Run all 7 spec-mode checks (REQ block hygiene, manifest completeness, test ID
consistency, tool name consistency, authoring conventions, term definition
hygiene, golden transcript coverage). Report findings with severity tiers
(critical / warning / info).

Auto-fix findings where safe: typo corrections, missing punctuation, whitespace
normalization. Do NOT auto-fix: REQ body rewrites, structural changes, test ID
assignments, or anything that changes semantic meaning.

End with a machine-parseable summary line:
'READTHROUGH N critical; M high; K info.'

Gate: halt on critical > 0. Warn on high > 0. Info is advisory."

echo -e "${YELLOW}Launching read-through session...${NC}"
mkdir -p "$PIPELINE_LOG_DIR"
run_opencode "spec-wrapup-readthrough" "$WRAP_READTHROUGH_OUT" "$READTHROUGH_PROMPT" --retry
READTHROUGH_RC=$OPC_RC

if [[ $READTHROUGH_RC -ne 0 ]]; then
  echo -e "${RED}Read-through FAILED. Check $WRAP_READTHROUGH_OUT.${NC}"
  exit 1
fi

# Parse severity tiers from machine-parseable summary
critical=$(grep -oP 'READTHROUGH \d+ critical' "$WRAP_READTHROUGH_OUT" 2>/dev/null | grep -oP '\d+' || echo "?")
high=$(grep -oP '\d+ high' "$WRAP_READTHROUGH_OUT" 2>/dev/null | grep -oP '\d+' || echo "?")
info=$(grep -oP '\d+ info' "$WRAP_READTHROUGH_OUT" 2>/dev/null | grep -oP '\d+' || echo "?")

if [[ "$critical" != "0" && "$critical" != "?" ]]; then
  echo -e "${RED}Read-through BLOCKED: ${critical} critical finding(s).${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}Read-through: DONE — ${critical}c / ${high}h / ${info}i${NC}"
if [[ "$high" != "0" && "$high" != "?" ]]; then
  echo -e "${YELLOW}Warning: ${high} high-severity finding(s) — review before commit.${NC}"
fi
echo ""

# Deterministic gate: if read-through auto-fixed infobroker.md, re-verify spec checks
if git -C "$PROJECT_DIR" diff --name-only | grep -q 'infobroker.md'; then
  echo -e "${YELLOW}infobroker.md modified by read-through — re-verifying spec checks...${NC}"
  if ! npm run check 2>/dev/null; then
    echo -e "${RED}Spec checks FAILED after read-through auto-fix. Aborting.${NC}"
    exit 1
  fi
  echo -e "${GREEN}Post-read-through spec checks: PASSED${NC}"
fi
echo ""

# ── step 3: server sync ────────────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 3/9: Server sync against spec${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

SYNC_PROMPT="Sync the Infobroker MCP server implementation against the current
specification (infobroker.md). Audit the source code in src/ for any
implementation gaps between the spec and the code.

1. Read infobroker.md and understand the full REQ surface.
2. Audit src/ — compare each source file against the REQs it implements.
   Produce a gap disposition table:
   | REQ | Gap | Disposition | Reason |
   |-----|-----|-------------|--------|
   Auto-confirm all dispositions — this is a trusted automated pipeline.
3. Implement all gaps where disposition is 'implement'. For each batch of
   changes, run \`npm run typecheck\` and fix any type errors before continuing.
4. After all changes, run \`npm run validate-spec\` to confirm REQ coverage
   is intact.
5. Run \`npm run version-bump\` to update the version in package.json and
   src/index.ts to today's date.
6. Smoke test: start the server and call \`infobroker_spec_health\`. Verify:
    - Tool count has not decreased from baseline (13 tools)
   - Provider count matches config.json
   - No confidence scores below 50%
   - \`last_spec_review\` timestamp is current (within 24 hours)
   If any check fails, report the failure before declaring sync complete.

Do NOT commit. End with 'SYNC COMPLETE.' if all steps pass."

echo -e "${YELLOW}Launching server sync session...${NC}"
run_opencode "push-pipeline-sync" "$WRAP_SYNC_OUT" "$SYNC_PROMPT" --retry
SYNC_RC=$OPC_RC

if [[ $SYNC_RC -ne 0 ]]; then
  echo -e "${RED}Server sync FAILED. Check $WRAP_SYNC_OUT.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}Server sync: DONE${NC}"
echo ""

# ── step 4: provider auth sync ─────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 4/9: Provider auth sync${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Generating provider-auth.md from config.json...${NC}"
if ! npm run generate-auth 2>/dev/null; then
  echo -e "${RED}generate-auth FAILED.${NC}"
  exit 1
fi
echo -e "${GREEN}generate-auth: OK${NC}"

if git -C "$PROJECT_DIR" diff --quiet skills/infobroker/references/provider-auth.md 2>/dev/null; then
  echo -e "${GREEN}Provider-auth.md: no drift from config.json${NC}"
else
  echo -e "${YELLOW}Provider-auth.md regenerated — will be included in commit.${NC}"
  git -C "$PROJECT_DIR" diff --stat skills/infobroker/references/provider-auth.md 2>/dev/null
fi
echo ""

# ── step 5: final typecheck gate ───────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 5/9: Final typecheck gate${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

if ! npm run typecheck 2>/dev/null; then
  echo -e "${RED}Typecheck FAILED after sync.${NC}"
  exit 1
fi
echo -e "${GREEN}Typecheck: PASSED${NC}"
echo ""

# ── step 6: dead-data scan on src/ ─────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 6/9: Dead-data scan — src/${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

run_dead_data_scan \
  --dir "src" \
  --label "INFOBROKER" \
  --out "$WRAP_SCAN_OUT" \
  --session-title "push-pipeline-scan"
SCAN_FINDINGS="$SCAN_FINDINGS_COUNT"

# ── step 7: README and references update ───────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 7/9: Update README.md and skill references${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

README_PROMPT="Load and apply the proofreading skill. Read README.md and
infobroker.md. The specification may have changed. Update README.md and skill
reference files to reflect the current state of the project.

First, capture the current state: spec section count, REQ count, gate count,
tool count, provider count, and key features.

1. Check the install/setup instructions in README — are they still correct?
2. Check feature descriptions — cross-reference against any new or modified
   REQs from infobroker.md. Draft feature blurbs following the existing cadence.
3. Check the provider comparison table — update counts, tiers, and any new
   competitive advantages from recent REQ changes.
4. Verify tool names in README match the 13-tool surface: infobroker_web_search,
   infobroker_fetch_page, infobroker_search_suggestions,
   infobroker_choose_provider, infobroker_list_providers,
   infobroker_provider_health, infobroker_converge, infobroker_reload_config,
   infobroker_spec_health, infobroker_kb_search, infobroker_kb_ingest,
   infobroker_kb_stats, infobroker_kb_delete. Update any stale names.
5. Update skills/infobroker/references/provider-auth.md if config.json has
   changed.
6. Update skills/infobroker/references/provider-map.md — verify provider slugs,
   tiers, capabilities, and enabled status match config.json.
7. Update skills/infobroker/references/pipeline-map.md — verify the tool-to-
   provider mappings are still accurate.
8. Update the 'Last updated' line with format: 'Last updated: YYYY-MM-DD.'
   (with period). Match any existing format if already present.

Run \`npm run validate-readme\` after changes and fix any failures.

Do NOT commit. End with 'README UPDATE COMPLETE.'"

echo -e "${YELLOW}Launching README update session...${NC}"
run_opencode "push-pipeline-readme" "$WRAP_README_OUT" "$README_PROMPT" --retry
README_RC=$OPC_RC

if [[ $README_RC -ne 0 ]]; then
  echo -e "${RED}README update FAILED. Check $WRAP_README_OUT.${NC}"
  exit 1
fi

# Validate README as a post-session shell gate
echo -e "${YELLOW}Validating README...${NC}"
if ! npm run validate-readme 2>/dev/null; then
  echo -e "${RED}README validation FAILED.${NC}"
  exit 1
fi
echo -e "${GREEN}README validation: PASSED${NC}"
echo ""

echo ""
echo -e "${GREEN}README + references update: DONE${NC}"
echo ""

# ── Dry-run exit ────────────────────────────────────────────────────────────

if $DRY_RUN; then
  echo ""
  echo -e "${YELLOW}[DRY RUN] All checks passed. Would commit and push.${NC}"
  exit 0
fi

# ── step 8a: pre-commit guard ──────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 8a/9: Pre-commit guard${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

if git -C "$PROJECT_DIR" diff --name-only | grep -q '^node_modules/'; then
  echo -e "${RED}node_modules in diff — aborting commit. Check .gitignore.${NC}"
  exit 1
fi

if [[ "$SCAN_FINDINGS" != "0" && "$SCAN_FINDINGS" != "?" ]]; then
  echo -e "${YELLOW}Warning: Dead-data scan has ${SCAN_FINDINGS} finding(s) — review before commit.${NC}"
fi
echo ""

# ── step 8b: commit ────────────────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 8b/9: Commit all changes${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

# Read version from package.json for the tag (set by version-bump in step 3)
VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")

# Stage explicit root files (skip missing without error)
for f in infobroker.md README.md CHANGELOG.md AGENTS.md \
         package.json tsconfig.json config.json; do
  [[ -f "$f" ]] && git -C "$PROJECT_DIR" add "$f"
done
# Stage only tracked modifications in subdirectories (never untracked files)
git -C "$PROJECT_DIR" add -u instructions/ src/ skills/ scripts/

COMMIT_DATE=$(date +%Y-%m-%d)

# Build dynamic commit message from pipeline evidence
COMMIT_SUMMARY=""
if grep -q "SYNC COMPLETE" "$WRAP_SYNC_OUT" 2>/dev/null; then
  COMMIT_SUMMARY="${COMMIT_SUMMARY}Server synced to spec. "
fi
if grep -q "INFOBROKER SCAN COMPLETE" "$WRAP_SCAN_OUT" 2>/dev/null; then
  COMMIT_SUMMARY="${COMMIT_SUMMARY}Dead-data scan: ${SCAN_FINDINGS} findings. "
fi
COMMIT_SUMMARY="${COMMIT_SUMMARY}Spec audited, README and references refreshed."

if git -C "$PROJECT_DIR" diff --staged --quiet 2>/dev/null; then
  echo -e "${YELLOW}No changes to commit.${NC}"
else
  echo ""
  echo -e "${YELLOW}Changes about to be committed:${NC}"
  git -C "$PROJECT_DIR" diff --staged --stat
  echo ""

  # Confirmation prompt (skip if --yes, refuse in non-TTY)
  if ! $FORCE; then
    if [[ ! -t 0 ]]; then
      echo -e "${RED}Non-interactive terminal detected.${NC}"
      echo -e "${RED}Use --yes to skip the confirmation prompt in CI/unattended runs.${NC}"
      exit 1
    fi
    read -p "Commit, push, and tag? (y/N) " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 0
    fi
  fi
  echo ""

  echo -e "${YELLOW}Committing changes...${NC}"
  git -C "$PROJECT_DIR" commit -m "Push pipeline ${COMMIT_DATE}

${COMMIT_SUMMARY}"
  echo -e "${GREEN}Commit: DONE${NC}"
fi
echo ""

# ── step 9: push ───────────────────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Step 9/9: Push to origin${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Pushing main...${NC}"
git -C "$PROJECT_DIR" push origin main
echo -e "${GREEN}Push: DONE${NC}"

# Tag with version
echo -e "${YELLOW}Tagging v${VERSION}...${NC}"
if git -C "$PROJECT_DIR" tag -l "v${VERSION}" | grep -q "v${VERSION}"; then
  echo -e "${YELLOW}  Tag v${VERSION} already exists and WILL BE OVERWRITTEN.${NC}"
  echo -e "${YELLOW}  Packages that pinned the old tag will see divergence.${NC}"
  echo -e "${YELLOW}  To skip tagging, Ctrl-C now (5s).${NC}"
  sleep 5
  git -C "$PROJECT_DIR" tag -f "v${VERSION}"
else
  git -C "$PROJECT_DIR" tag "v${VERSION}"
fi
git -C "$PROJECT_DIR" push origin "v${VERSION}"
echo -e "${GREEN}Tag v${VERSION}: DONE${NC}"
echo ""

# Post-push verification
echo -e "${YELLOW}Verifying remote...${NC}"
git -C "$PROJECT_DIR" ls-remote origin HEAD >/dev/null 2>&1
echo -e "${GREEN}Remote check: OK${NC}"
echo ""

# ── done ───────────────────────────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Infobroker push pipeline — COMPLETE${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "  Spec audited and read-through complete."
if grep -q "SYNC COMPLETE" "$WRAP_SYNC_OUT" 2>/dev/null; then
  echo "  Server synced to spec."
fi
echo "  Provider auth docs regenerated."
echo "  Dead-data scan: ${SCAN_FINDINGS} finding(s)."
echo "  README and skill references refreshed."
echo "  Pushed to origin — v${VERSION}"
echo ""
echo -e "${GREEN}Done.${NC}"
