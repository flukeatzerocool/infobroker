#!/usr/bin/env bash
# test-research.sh — Run the research-scenario suite: every workflow shape
# exercised through realistic, non-leading user utterances against the live
# Infobroker MCP, evaluated on routing tokens, required sections, tool usage,
# and advisory citation integrity. One-off validation tool; see
# test-fixtures/research/manifest.json for the scenarios.
#
# Usage:
#   ./scripts/test-research.sh [--only=<id>[,<id>...]] [--from=<id>] [--mcp=repo|ambient] [--help]
#   --only=<ids>   Run only the named scenario ids (comma-separated).
#   --from=<id>    Skip scenarios before <id> (in manifest order).
#   --mcp=repo     Exercise this working tree (run-local layer, isolated KB).
#   --mcp=ambient  Exercise the configured deployment (default).
#   --help (-h)    Show this message.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$PROJECT_DIR/test-fixtures/research/manifest.json"
EVALUATOR="$SCRIPT_DIR/test-research/evaluate-research.mjs"

# shellcheck source=scripts/lib/opencode-utils.sh
source "$SCRIPT_DIR/lib/opencode-utils.sh"

ONLY=""; FROM=""; MCP_MODE="ambient"
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
    --from=*) FROM="${arg#--from=}" ;;
    --mcp=repo) MCP_MODE="repo" ;;
    --mcp=ambient) MCP_MODE="ambient" ;;
    --help|-h)
      printf '%s\n' "Usage: ./scripts/test-research.sh [--only=<id>[,<id>...]] [--from=<id>] [--mcp=repo|ambient]"
      exit 0 ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

require_tools opencode node
if [[ "$MCP_MODE" == "repo" ]]; then
  # The assertion module runs from the working tree, not from PATH.
  [[ -x "$PROJECT_DIR/node_modules/.bin/tsx" ]] \
    || die "Pre-flight failed: missing $PROJECT_DIR/node_modules/.bin/tsx (run npm install)"
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="${TMPDIR:-/tmp}/infobroker/research-tests/run-${TIMESTAMP}"
mkdir -p "$RUN_DIR"
RESULTS_FILE="$RUN_DIR/results.json"
TIMINGS_FILE="$RUN_DIR/timings.json"
TIMINGS_NDJSON="$RUN_DIR/timings.ndjson"
: > "$TIMINGS_NDJSON"

now_ms() { date +%s%3N; }
SUITE_START_MS=$(now_ms)
SERVER_START_MS=0

# record_timing <id> <status> <label> <turn-ms-csv> <evaluate-ms> <citation-ms> <total-ms>
record_timing() {
  node -e '
    const [id, status, label, turns, evaluateMs, citationMs, totalMs] = process.argv.slice(1);
    const turn_ms = turns.split(",").filter(Boolean).map(Number);
    process.stdout.write(JSON.stringify({
      id, status, label,
      turn_ms,
      evaluate_ms: Number(evaluateMs),
      citation_ms: Number(citationMs),
      total_ms: Number(totalMs),
    }) + "\n");
  ' "$1" "$2" "$3" "$4" "$5" "$6" "$7" >> "$TIMINGS_NDJSON"
}

# Load and filter the manifest.
export ONLY FROM
node -e '
  const fs=require("fs");
  const only=(process.env.ONLY||"").split(",").filter(Boolean);
  const from=process.env.FROM||"";
  let j=require(process.argv[1]);
  let skip = from ? true : false;
  const out=[];
  for(const s of j){
    if(from && s.id===from) skip=false;
    if(skip) continue;
    if(only.length && !only.includes(s.id)) continue;
    out.push(s);
  }
  fs.mkdirSync(process.argv[2],{recursive:true});
  for(const s of out){
    fs.writeFileSync(process.argv[2]+"/"+s.id+".json", JSON.stringify(s,null,2));
  }
  console.log(JSON.stringify(out.map(s=>s.id)));
' "$MANIFEST" "$RUN_DIR/scenarios" > "$RUN_DIR/order.json"
SCENARIO_IDS=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).join(" "))' "$RUN_DIR/order.json")

if [[ -z "$(node -e 'const fs=require("fs");const p=process.argv[1];console.log(fs.existsSync(p)?fs.readdirSync(p).filter(f=>f.endsWith(".json")).length:0)' "$RUN_DIR/scenarios")" ]]; then
  die "No scenarios selected (check --only/--from)."
fi

# ── Start backend ──
if [[ "$MCP_MODE" == "repo" ]]; then
  # Repo-scoped: point the MCP at this working tree with a run-local layer, so
  # neither the operator's config.local.json nor a populated KB can change the
  # result. The KB root is run-scoped: a re-run cannot recall an earlier run's
  # store or its report:// artifacts.
  TSX="$PROJECT_DIR/node_modules/.bin/tsx"
  MCP_PROJECT="$RUN_DIR/mcp-project"
  KB_ROOT="$RUN_DIR/kb"
  mkdir -p "$MCP_PROJECT"
  "$TSX" "$SCRIPT_DIR/lib/repo-mode.ts" isolate-kb "$KB_ROOT" "$RUN_DIR/config.local.json" "$RUN_DIR/config.local.json" \
    || die "Repo mode failed: could not build the run-local config layer"
  "$TSX" "$SCRIPT_DIR/lib/repo-mode.ts" project "$PROJECT_DIR" "$RUN_DIR/config.local.json" "$MCP_PROJECT/opencode.json" \
    || die "Repo mode failed: could not write the project MCP config"
  server_start_t0=$(now_ms)
  ensure_opencode_serve_at "$RUN_DIR" "opencode-serve.log" "" "$MCP_PROJECT"
  SERVER_START_MS=$(( $(now_ms) - server_start_t0 ))
  ( cd "$MCP_PROJECT" && opencode debug config ) > "$RUN_DIR/debug-config.json" 2>> "$RUN_DIR/openruns.log" \
    || die "opencode debug config failed in $MCP_PROJECT (see $RUN_DIR/openruns.log)"
  skills_detail=$("$PROJECT_DIR/node_modules/.bin/tsx" "$SCRIPT_DIR/test-research/assert-skills.ts" \
    "$RUN_DIR/debug-config.json" "$MCP_PROJECT/opencode.json" "$PROJECT_DIR/skills") \
    || die "Repo mode refused: the run project does not load this tree's skills (see $RUN_DIR/debug-config.json)"
  info "$skills_detail"
  {
    printf 'repo:%s\n' "$MCP_PROJECT"
    printf 'skills:%s\n' "$PROJECT_DIR/skills"
    "$TSX" "$SCRIPT_DIR/lib/repo-mode.ts" paths "$KB_ROOT"
  } > "$RUN_DIR/mcp-target.txt"
else
  server_start_t0=$(now_ms)
  ensure_opencode_serve "$RUN_DIR" "opencode-serve.log"
  SERVER_START_MS=$(( $(now_ms) - server_start_t0 ))
  ( cd "$PWD" && opencode mcp list ) > "$RUN_DIR/mcp-target.txt" 2>&1 || true
fi

cleanup() { cleanup_serve; }
trap cleanup EXIT SIGINT SIGTERM

run_turn() {
  local id="$1" titlearg="$2" workdir="$3" promptfile="$4" outfile="$5" session="$6"
  local args=(run --server "$SERVER_URL" --agent build --auto --format json)
  local cmd=(opencode)
  local opc_timeout="${OPC_TIMEOUT:-1800}"
  [[ "$opc_timeout" -gt 0 ]] && command -v timeout >/dev/null 2>&1 && cmd=(timeout "$opc_timeout" opencode)
  local prompt
  prompt="The following request is from your user. Fulfill it as a capable research assistant would, using your research tools and skills, and deliver a complete, well-sourced answer.

$(cat "$promptfile")"
  # A scenario may name skills the harness should load (manifest `invoke`). The
  # line is appended after the request and labelled as harness-owned, so the
  # user utterance itself stays non-leading (D-134).
  if [[ -n "${INVOKE_HINT:-}" ]]; then
    prompt="$prompt

$INVOKE_HINT"
  fi
  if [[ -n "$session" ]]; then
    "${cmd[@]}" "${args[@]}" --session "$session" "$prompt" > "$outfile" 2>> "$RUN_DIR/openruns.log"
  else
    "${cmd[@]}" "${args[@]}" --title "$titlearg" "$prompt" > "$outfile" 2>> "$RUN_DIR/openruns.log"
  fi
}

RESULTS_TMP="$RUN_DIR/results.ndjson"
: > "$RESULTS_TMP"

# Record a scenario whose turn did not complete. Full shape matters: the
# verdict table and results.json consumer dereference every field below, and
# one timed-out scenario must not stop the scenarios after it.
record_failure() {
  local id="$1" sc="$2" reason="$3" rc="$4" timeout_s="$5"
  node -e '
    const s = require(process.argv[1]);
    const [reason, rc, timeoutS] = process.argv.slice(2);
    const rec = {
      id: s.id, label: s.label, shape: s.shape, mode: s.mode,
      invoked: s.invoke ?? [], skills_loaded: [],
      status: "fail", reason, rc: Number(rc), timeout_s: Number(timeoutS),
      missing: [], absentFound: [], missingSections: [], audit: {},
      auditFails: [reason], urlsFound: 0, citations: [],
    };
    process.stdout.write(JSON.stringify(rec) + "\n");
  ' "$sc" "$reason" "$rc" "$timeout_s" >> "$RESULTS_TMP"
}

for id in $SCENARIO_IDS; do
  sc="$RUN_DIR/scenarios/$id.json"
  workdir="$RUN_DIR/$id"
  mkdir -p "$workdir"
  info "════ Running $id ════"
  scenario_start=$(now_ms)
  turn_ms_csv=""
  eval_ms=0
  citation_ms=0
  INVOKE_HINT=""

  utterance=$(node -e 'console.log(require(process.argv[1]).utterance)' "$sc")
  fu_count=$(node -e 'console.log((require(process.argv[1]).followups||[]).length)' "$sc")
  invoke_ids=$(node -e 'const s=require(process.argv[1]);process.stdout.write((s.invoke||[]).join(","))' "$sc")
  if [[ -n "$invoke_ids" ]]; then
    INVOKE_HINT="Harness instruction: load these skills in order and follow their contract: \`${invoke_ids//,/\`, \`}\`."
    info "  invoking: $invoke_ids"
  fi

  # Base turn. A non-zero exit is captured, not fatal: `timeout` returns 124,
  # and under `set -e` an uncaught exit would end the whole suite, losing every
  # scenario after it.
  printf '%s\n' "$utterance" > "$workdir/prompt.md"
  base_out="$workdir/turn0.txt"
  timeout_s="${OPC_TIMEOUT:-1800}"
  turn_t0=$(now_ms)
  if run_turn "$id" "research-$id" "$workdir" "$workdir/prompt.md" "$base_out" ""; then
    rc=0
  else
    rc=$?
  fi
  turn_ms_csv="$(( $(now_ms) - turn_t0 ))"
  if [[ "$rc" -ne 0 ]]; then
    reason="timeout"; [[ "$rc" -eq 124 ]] || reason="turn-failed"
    record_failure "$id" "$sc" "$reason" "$rc" "$timeout_s"
    record_timing "$id" "fail" "$(node -e 'console.log(require(process.argv[1]).label)' "$sc")" \
      "$turn_ms_csv" 0 0 "$(( $(now_ms) - scenario_start ))"
    info "  $id: $reason (exit $rc) — recorded, continuing"
    continue
  fi
  # Read the session id without a `grep … | head -1` pipeline: under
  # `set -o pipefail` a grep that keeps writing after `head` exits takes
  # SIGPIPE, the pipeline returns 141, and `set -e` ends the run silently —
  # which is exactly how the first two batch attempts died after one turn.
  session_id=$(node -e '
    const fs = require("fs");
    const text = fs.readFileSync(process.argv[1], "utf8");
    const match = text.match(/"sessionID":"(ses_[^"]+)"/);
    if (match) process.stdout.write(match[1]);
  ' "$base_out")

  # Follow-up turns continue the session.
  followup_failed=0
  if [[ "$fu_count" -gt 0 && -n "$session_id" ]]; then
    i=0
    while IFS= read -r fu; do
      i=$((i+1))
      printf '%s\n' "$fu" > "$workdir/followup$i.md"
      turn_t0=$(now_ms)
      if run_turn "$id" "research-$id" "$workdir" "$workdir/followup$i.md" "$workdir/turn$i.txt" "$session_id" </dev/null; then
        rc=0
      else
        rc=$?
      fi
      turn_ms_csv="${turn_ms_csv:+$turn_ms_csv,}$(( $(now_ms) - turn_t0 ))"
      if [[ "$rc" -ne 0 ]]; then
        reason="timeout"; [[ "$rc" -eq 124 ]] || reason="turn-failed"
        record_failure "$id" "$sc" "$reason" "$rc" "$timeout_s"
        record_timing "$id" "fail" "$(node -e 'console.log(require(process.argv[1]).label)' "$sc")" \
          "$turn_ms_csv" 0 0 "$(( $(now_ms) - scenario_start ))"
        info "  $id: follow-up $i $reason (exit $rc) — recorded, continuing"
        followup_failed=1
        break
      fi
    done < <(node -e 'const j=require(process.argv[1]);(j.followups||[]).forEach(f=>console.log(f))' "$sc")
  fi
  [[ "$followup_failed" -eq 1 ]] && continue

  # Combine transcripts for evaluation.
  combined="$workdir/combined.txt"
  : > "$combined"
  for f in "$workdir"/turn*.txt; do
    [[ -e "$f" ]] && cat "$f" >> "$combined"
  done

  eval_t0=$(now_ms)
  eval_json=$(node "$EVALUATOR" "$sc" "$combined" "$workdir")
  eval_ms=$(( $(now_ms) - eval_t0 ))
  printf '%s\n' "$eval_json" >> "$RESULTS_TMP"
  eval_status=$(node -e 'try{process.stdout.write(JSON.parse(process.argv[1]).status||"fail")}catch{process.stdout.write("fail")}' "$eval_json")
  eval_label=$(node -e 'try{process.stdout.write(JSON.parse(process.argv[1]).label||"")}catch{process.stdout.write(process.argv[2])}' "$eval_json" "$id")
  citation_ms=$(node -e 'try{process.stdout.write(String(JSON.parse(process.argv[1]).citation_ms??0))}catch{process.stdout.write("0")}' "$eval_json")
  if [[ "$eval_status" == "pass" ]]; then mark=PASS; else mark=FAIL; fi
  scenario_ms=$(( $(now_ms) - scenario_start ))
  record_timing "$id" "$eval_status" "$eval_label" "$turn_ms_csv" "$eval_ms" "$citation_ms" "$scenario_ms"
  info "  $mark  $id  $eval_label ($(( scenario_ms / 1000 ))s)"
done

# Assemble results.json.
node -e '
  const fs=require("fs");
  const lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean);
  const out={};
  for(const l of lines){ let o; try{o=JSON.parse(l)}catch{continue}; out[o.id]=o; }
  fs.writeFileSync(process.argv[2], JSON.stringify(out,null,2));
' "$RESULTS_TMP" "$RESULTS_FILE"

# Assemble timings.json — diagnostics only; nothing gates on these values.
node -e '
  const fs=require("fs");
  const lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean);
  const out={server_start_ms:Number(process.argv[2]), suite_ms:Number(process.argv[3]), scenarios:{}};
  for(const l of lines){ let o; try{o=JSON.parse(l)}catch{continue}; out.scenarios[o.id]=o; }
  fs.writeFileSync(process.argv[4], JSON.stringify(out,null,2)+"\n");
' "$TIMINGS_NDJSON" "$SERVER_START_MS" "$(( $(now_ms) - SUITE_START_MS ))" "$TIMINGS_FILE"

# ── Verdict table ──
echo ""
info "═══════════════════════════════════════════════"
info "Research-scenario results"
info "═══════════════════════════════════════════════"
node -e '
  const r=require(process.argv[1]);
  const ids=Object.keys(r);
  let pass=0;
  for(const id of ids){
    const o=r[id];
    const mark=o.status==="pass"?"PASS":"FAIL";
    if(o.status==="pass")pass++;
    let detail="";
    if(o.status==="fail"){
      const bits=[];
      if(o.reason==="timeout") bits.push(`timeout after ${o.timeout_s}s`);
      else if(o.reason) bits.push(`turn failed (exit ${o.rc})`);
      bits.push(...(o.missing||[]).map(t=>"missing token: "+t), ...(o.absentFound||[]).map(t=>"unexpected token: "+t), ...(o.missingSections||[]).map(s=>"missing section: "+s), ...(o.auditFails||[]).map(k=>"audit fail: "+k));
      detail=" — "+bits.join("; ");
    }
    console.log(`  ${mark.padEnd(5)} ${o.id.padEnd(4)} ${o.label}${detail}`);
  }
  console.log(`\n  ${pass}/${ids.length} scenarios passed`);
  console.log("  Results + transcripts: " + process.argv[1].replace(/results\.json$/, ""));
' "$RESULTS_FILE"
info "  Timings: $TIMINGS_FILE"

fails=$(node -e 'const r=require(process.argv[1]);console.log(Object.values(r).filter(o=>o.status==="fail").length)' "$RESULTS_FILE")
if [[ "$fails" != "0" ]]; then
  echo ""
  error "FAILED: ${fails} scenario(s)."
  exit 1
fi
info "All scenarios passed."
