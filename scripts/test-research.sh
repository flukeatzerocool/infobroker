#!/usr/bin/env bash
# test-research.sh — Run the research-scenario suite: every workflow shape
# exercised through realistic, non-leading user utterances against the live
# Infobroker MCP, evaluated on routing tokens, required sections, tool usage,
# and advisory citation integrity. One-off validation tool; see
# test-fixtures/research/manifest.json for the scenarios.
#
# Usage:
#   ./scripts/test-research.sh [--only=<id>[,<id>...]] [--from=<id>] [--help]
#   --only=<ids>   Run only the named scenario ids (comma-separated).
#   --from=<id>    Skip scenarios before <id> (in manifest order).
#   --help (-h)    Show this message.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$PROJECT_DIR/test-fixtures/research/manifest.json"
EVALUATOR="$SCRIPT_DIR/test-research/evaluate-research.mjs"

# shellcheck source=scripts/lib/opencode-utils.sh
source "$SCRIPT_DIR/lib/opencode-utils.sh"

ONLY=""; FROM=""
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
    --from=*) FROM="${arg#--from=}" ;;
    --help|-h)
      printf '%s\n' "Usage: ./scripts/test-research.sh [--only=<id>[,<id>...]] [--from=<id>]"
      exit 0 ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

require_tools opencode node

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="${TMPDIR:-/tmp}/infobroker/research-tests/run-${TIMESTAMP}"
mkdir -p "$RUN_DIR"
RESULTS_FILE="$RUN_DIR/results.json"

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
ensure_opencode_serve "$RUN_DIR" "opencode-serve.log"

cleanup() { cleanup_serve; }
trap cleanup EXIT SIGINT SIGTERM

run_turn() {
  local id="$1" titlearg="$2" workdir="$3" promptfile="$4" outfile="$5" session="$6"
  local args=(run --attach "$SERVER_URL" --agent build --auto --format json)
  local cmd=(opencode)
  local opc_timeout="${OPC_TIMEOUT:-1800}"
  [[ "$opc_timeout" -gt 0 ]] && command -v timeout >/dev/null 2>&1 && cmd=(timeout "$opc_timeout" opencode)
  local prompt
  prompt="The following request is from your user. Fulfill it as a capable research assistant would, using your research tools and skills, and deliver a complete, well-sourced answer.

$(cat "$promptfile")"
  if [[ -n "$session" ]]; then
    "${cmd[@]}" "${args[@]}" --session "$session" "$prompt" > "$outfile" 2>> "$RUN_DIR/openruns.log"
  else
    "${cmd[@]}" "${args[@]}" --title "$titlearg" "$prompt" > "$outfile" 2>> "$RUN_DIR/openruns.log"
  fi
}

RESULTS_TMP="$RUN_DIR/results.ndjson"
: > "$RESULTS_TMP"

for id in $SCENARIO_IDS; do
  sc="$RUN_DIR/scenarios/$id.json"
  workdir="$RUN_DIR/$id"
  mkdir -p "$workdir"
  info "════ Running $id ════"

  utterance=$(node -e 'console.log(require(process.argv[1]).utterance)' "$sc")
  fu_count=$(node -e 'console.log((require(process.argv[1]).followups||[]).length)' "$sc")

  # Base turn.
  printf '%s\n' "$utterance" > "$workdir/prompt.md"
  base_out="$workdir/turn0.txt"
  run_turn "$id" "research-$id" "$workdir" "$workdir/prompt.md" "$base_out" ""
  session_id=$(grep -oE '"sessionID":"ses_[^"]+"' "$base_out" | head -1 | sed -E 's/.*(ses_[^"]+)"$/\1/')

  # Follow-up turns continue the session.
  if [[ "$fu_count" -gt 0 && -n "$session_id" ]]; then
    i=0
    while IFS= read -r fu; do
      i=$((i+1))
      printf '%s\n' "$fu" > "$workdir/followup$i.md"
      run_turn "$id" "research-$id" "$workdir" "$workdir/followup$i.md" "$workdir/turn$i.txt" "$session_id" </dev/null
    done < <(node -e 'const j=require(process.argv[1]);(j.followups||[]).forEach(f=>console.log(f))' "$sc")
  fi

  # Combine transcripts for evaluation.
  combined="$workdir/combined.txt"
  : > "$combined"
  for f in "$workdir"/turn*.txt; do
    [[ -e "$f" ]] && cat "$f" >> "$combined"
  done

  node "$EVALUATOR" "$sc" "$combined" "$workdir" >> "$RESULTS_TMP"
done

# Assemble results.json.
node -e '
  const fs=require("fs");
  const lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean);
  const out={};
  for(const l of lines){ let o; try{o=JSON.parse(l)}catch{continue}; out[o.id]=o; }
  fs.writeFileSync(process.argv[2], JSON.stringify(out,null,2));
' "$RESULTS_TMP" "$RESULTS_FILE"

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
      const bits=[...o.missing.map(t=>"missing token: "+t), ...o.absentFound.map(t=>"unexpected token: "+t), ...o.missingSections.map(s=>"missing section: "+s), ...o.auditFails.map(k=>"audit fail: "+k)];
      detail=" — "+bits.join("; ");
    }
    console.log(`  ${mark.padEnd(5)} ${o.id.padEnd(4)} ${o.label}${detail}`);
  }
  console.log(`\n  ${pass}/${ids.length} scenarios passed`);
  console.log("  Results + transcripts: " + process.argv[1].replace(/results\.json$/, ""));
' "$RESULTS_FILE"

fails=$(node -e 'const r=require(process.argv[1]);console.log(Object.values(r).filter(o=>o.status==="fail").length)' "$RESULTS_FILE")
if [[ "$fails" != "0" ]]; then
  echo ""
  error "FAILED: ${fails} scenario(s)."
  exit 1
fi
info "All scenarios passed."
