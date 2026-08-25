#!/usr/bin/env bash
# test-skills.sh — Run every Infobroker skill through a live, headless
# opencode session against the real Infobroker MCP, then evaluate each run
# against the skill's output contract (grep-able completion tokens).
#
# Scope: this is a CONTRACT-EMISSION check. Each skill is invoked BY NAME and
# told to end with its completion token, so a passing run proves the skill's
# instructions produce the documented token when loaded — not that the skill
# is reached or behaves correctly in natural researcher use. For end-to-end
# routing and deliverable-quality coverage, see `npm run test-research`.
#
# Usage:
#   ./scripts/test-skills.sh [--only=<skill>] [--from=<skill>] [--resume] [--grade]
#                            [--model <m>] [--retry] [--help]
#   --only=<skill>  Run only the named skill (skip everything else).
#   --from=<skill>  Start at a named skill.
#   --resume        Skip skills already recorded PASS in the state journal.
#   --grade         Run a second LLM rubric pass per skill (soft, non-gating).
#   --model <m>     Model to use for the agentic runs (default: config default).
#   --retry         Re-run a skill once in a forked session on failure.
#   --help (-h)     Show this message.
#
# The Infobroker MCP and skills must already be wired into opencode (they are
# globally in this project via ~/.config/opencode/opencode.json).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_DIR="$PROJECT_DIR/test-fixtures/skills"
INPUTS_DIR="$MANIFEST_DIR/inputs"
EVALUATOR="$SCRIPT_DIR/test-skills/evaluate.mjs"

# shellcheck source=scripts/lib/opencode-utils.sh
source "$SCRIPT_DIR/lib/opencode-utils.sh"

# ── Flag parsing ──
FROM_SKILL=""; ONLY_SKILL=""; RESUME=false; GRADE=false; MODEL="${SKILL_TEST_MODEL:-}"; RETRY=false
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY_SKILL="${arg#--only=}" ;;
    --from=*) FROM_SKILL="${arg#--from=}" ;;
    --resume) RESUME=true ;;
    --grade) GRADE=true ;;
    --retry) RETRY=true ;;
    --model=*) MODEL="${arg#--model=}" ;;
    --model) error "--model requires a value: --model=<m>"; exit 1 ;;
    --help|-h)
      printf '%s\n' "Usage: ./scripts/test-skills.sh [--only=<skill>] [--from=<skill>] [--resume] [--grade] [--model <m>] [--retry]"
      exit 0 ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# ── Pre-flight ──
require_tools opencode node npx

warn "Running gate checks (npm run check)..."
if ! npm run check >/dev/null 2>&1; then
  echo ""
  error "Gate checks FAILED. Run 'npm run check' locally to see errors."
  exit 1
fi
info "Gate checks: PASSED"
echo ""

# ── Run directory ──
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="${TMPDIR:-/tmp}/infobroker/skill-tests/run-${TIMESTAMP}"
mkdir -p "$RUN_DIR"
STATE_FILE="$RUN_DIR/state.json"
RESULTS_FILE="$RUN_DIR/results.json"

state_done() { node -e 'const fs=require("fs");try{const j=require(process.argv[1]);console.log(j[process.argv[2]]===true?"1":"0")}catch{console.log("0")}' "$STATE_FILE" "$1" 2>/dev/null; }

# ── Discover manifests ──
MANIFESTS=()
for f in "$MANIFEST_DIR"/*.json; do
  [[ -e "$f" ]] || continue
  MANIFESTS+=("$f")
done
# Sort so --from works predictably.
IFS=$'\n' MANIFESTS=($(printf '%s\n' "${MANIFESTS[@]}" | sort)); unset IFS

# ── Start backend ──
ensure_opencode_serve "$RUN_DIR" "opencode-serve.log"

cleanup() { cleanup_serve; }
trap cleanup EXIT SIGINT SIGTERM

# ── Build prompt + run ──
run_skill() {
  local manifest="$1" workdir="$2" prompt_file="$3" out_file="$4"
  local args=(run --attach "$SERVER_URL" --title "skill-test" --agent build --auto --format json)
  [[ -n "$MODEL" ]] && args+=(--model "$MODEL")
  local cmd=(opencode)
  local opc_timeout="${OPC_TIMEOUT:-1800}"
  [[ "$opc_timeout" -gt 0 ]] && command -v timeout >/dev/null 2>&1 && cmd=(timeout "$opc_timeout" opencode)
  ( cd "$workdir" && "${cmd[@]}" "${args[@]}" "$(cat "$prompt_file")" > "$out_file" 2>> "$RUN_DIR/openruns.log" )
}

# ── Iterate skills ──
printf '%s\n' "" | cat > "$RESULTS_FILE.tmp"
SUMMARY=""

SKILLS_RUN=0
for manifest in "${MANIFESTS[@]}"; do
  skill=$(node -e 'console.log(require(process.argv[1]).skill)' "$manifest")
  [[ "$skill" == "undefined" || -z "$skill" ]] && die "Manifest missing 'skill': $manifest"

  # --only filtering: skip any skill other than the named one.
  if [[ -n "$ONLY_SKILL" ]] && [[ "$skill" != "$ONLY_SKILL" ]]; then
    continue
  fi

  # --from filtering: skip skills that sort before FROM_SKILL.
  if [[ -n "$FROM_SKILL" ]] && [[ "$skill" < "$FROM_SKILL" ]]; then
    warn "Skip $skill (before --from=$FROM_SKILL)"
    continue
  fi

  if $RESUME && [[ "$(state_done "$skill")" == "1" ]]; then
    warn "Skip $skill (already PASS in state journal)"
    continue
  fi

  # Prepare working dir with inputs.
  workdir="$RUN_DIR/$skill"
  mkdir -p "$workdir"
  while IFS= read -r inp; do
    [[ -z "$inp" ]] && continue
    src="$INPUTS_DIR/$inp"
    if [[ -e "$src" ]]; then cp "$src" "$workdir/input.txt"; fi
  done < <(node -e 'const j=require(process.argv[1]);(j.inputs||[]).forEach(i=>console.log(i))' "$manifest")

  # opencode resolves its working directory to the repo root regardless of the
  # subshell cwd, so substitute the absolute input path into the prompt.
  prompt_file="$workdir/prompt.md"
  node -e 'const j=require(process.argv[1]);console.log(j.prompt)' "$manifest" \
    | sed "s|\./input\.txt|$workdir/input.txt|g" > "$prompt_file"

  info "════ Testing $skill ════"
  SKILLS_RUN=$((SKILLS_RUN + 1))
  out_file="$workdir/run.txt"
  run_skill "$manifest" "$workdir" "$prompt_file" "$out_file"
  RC=$?
  if [[ $RC -ne 0 ]] && $RETRY; then
    warn "  $skill run failed (exit $RC) — retrying once..."
    run_skill "$manifest" "$workdir" "$prompt_file" "$workdir/run.retry.txt"
    RC=$?
    [[ $RC -eq 0 ]] && mv "$workdir/run.retry.txt" "$out_file"
  fi

  if [[ $RC -ne 0 ]]; then
    error "  $skill: run exited $RC — SKIPPED evaluation"
    continue
  fi

  # Evaluate tokens + optional rubric.
  grade_flag=""
  $GRADE && grade_flag="--grade"
  node "$EVALUATOR" "$manifest" "$out_file" "$skill" $grade_flag >> "$RESULTS_FILE.tmp"
done

# --only guard: no manifest matched the requested skill.
if [[ -n "$ONLY_SKILL" ]] && [[ "$SKILLS_RUN" -eq 0 ]]; then
  die "No skill selected (check --only=$ONLY_SKILL)."
fi

# ── Assemble results ──
node -e '
  const fs=require("fs");
  const lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean);
  const out={skills:{},summary:{}};
  let pass=0,fail=0,skip=0;
  for(const l of lines){
    let o; try{o=JSON.parse(l)}catch{continue}
    out.skills[o.skill]=o;
    if(o.status==="pass")pass++;
    else if(o.status==="fail")fail++;
    else skip++;
  }
  out.summary={pass,fail,total:pass+fail};
  fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2));
' "$RESULTS_FILE.tmp" "$RESULTS_FILE"
rm -f "$RESULTS_FILE.tmp"

# ── Human summary ──
echo ""
info "═══════════════════════════════════════════════"
info "Skill test results"
info "═══════════════════════════════════════════════"
node -e '
  const r=require(process.argv[1]);
  for(const [s,o] of Object.entries(r.skills)){
    const mark=o.status==="pass"?"PASS":"FAIL";
    const bits=[];
    if(o.missing?.length) bits.push("missing: "+o.missing.join(", "));
    if(o.outOfOrder?.length) bits.push("out of order: "+o.outOfOrder.join(", "));
    console.log(`  ${mark.padEnd(5)} ${s}${bits.length?" — "+bits.join("; "):""}`)
  }
  const sm=r.summary;
  console.log(`\n  ${sm.pass}/${sm.total} passed`);
  console.log(`  Results: ${process.argv[2]}`);
' "$RESULTS_FILE" "$RESULTS_FILE"

# ── Exit code ──
fails=$(node -e 'console.log(require(process.argv[1]).summary.fail||0)' "$RESULTS_FILE")
if [[ "$fails" != "0" ]]; then
  echo ""
  error "FAILED: ${fails} skill(s) did not emit their completion tokens."
  exit 1
fi
info "All skills emitted their completion tokens (contract-emission check)."
