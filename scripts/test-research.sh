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
#   --mcp=repo     Exercise this working tree (run-local empty config layer).
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
  # Repo-scoped: point the MCP at this working tree with a run-local empty
  # user layer, so the operator's config.local.json cannot change the result.
  MCP_PROJECT="$RUN_DIR/mcp-project"
  mkdir -p "$MCP_PROJECT"
  printf '{}\n' > "$RUN_DIR/config.local.json"
  node -e '
    const fs = require("fs");
    const path = require("path");
    const [repo, out, layer] = process.argv.slice(1);
    const cfg = {
      "$schema": "https://opencode.ai/config.json",
      // The MCP override alone is not enough: the client also supplies skills,
      // and the ambient list points wherever Infobroker was installed.
      // Declaring the working-tree skills is what makes a repo-mode run prove
      // this checkout, not an installed copy.
      skills: [path.join(repo, "skills")],
      mcp: {
        infobroker: {
          type: "local",
          command: [path.join(repo, "node_modules", ".bin", "tsx"), path.join(repo, "src", "index.ts")],
          environment: {
            INFOBROKER_CONFIG: path.join(repo, "config.json"),
            INFOBROKER_CONFIG_LOCAL: layer,
          },
        },
      },
    };
    fs.writeFileSync(path.join(out, "opencode.json"), JSON.stringify(cfg, null, 2) + "\n");
  ' "$PROJECT_DIR" "$MCP_PROJECT" "$RUN_DIR/config.local.json"
  ensure_opencode_serve_at "$RUN_DIR" "opencode-serve.log" "" "$MCP_PROJECT"
  ( cd "$MCP_PROJECT" && opencode debug config ) > "$RUN_DIR/debug-config.json" 2>> "$RUN_DIR/openruns.log" \
    || die "opencode debug config failed in $MCP_PROJECT (see $RUN_DIR/openruns.log)"
  skills_detail=$("$PROJECT_DIR/node_modules/.bin/tsx" "$SCRIPT_DIR/test-research/assert-skills.ts" \
    "$RUN_DIR/debug-config.json" "$MCP_PROJECT/opencode.json" "$PROJECT_DIR/skills") \
    || die "Repo mode refused: the run project does not load this tree's skills (see $RUN_DIR/debug-config.json)"
  info "$skills_detail"
  printf 'repo:%s\n' "$MCP_PROJECT" > "$RUN_DIR/mcp-target.txt"
  printf 'skills:%s\n' "$PROJECT_DIR/skills" >> "$RUN_DIR/mcp-target.txt"
else
  ensure_opencode_serve "$RUN_DIR" "opencode-serve.log"
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
