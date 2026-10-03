#!/usr/bin/env bash
# lab.sh — debate-club Lab entry point (agentic, live). Runs each persona
# scenario through headless opencode against the configured Infobroker MCP and
# evaluates the transcript mechanically. An evidence-aware critic/rubric pass is
# advisory. Records run provenance, persists runs to a durable directory, and
# fails when feedback is incomplete — so a missing critic cannot vanish silently.
#
# Usage: lab.sh [--only=<id>[,<id>...]] [--from=<id>] [--help]
# Env: DEBATE_MCP_MODE  repo (default, exercise this working tree) | ambient
#      DEBATE_LAB_PORT  repo-scoped serve port (default 4097)
#      DEBATE_RUNS_DIR   durable retention root (default ~/.local/share/infobroker/debate-club-runs)
#      DEBATE_KEEP_RUNS  retained run count (default 20)
#      DEBATE_REQUIRE_REPO_MCP=1  fail when the MCP target is not this repo
#      DEBATE_ALLOW_INCOMPLETE=1  accept a run with missing critic/coverage
# Exit: 0 all selected scenarios passed with complete feedback (or opencode
#        absent → skip); 1 a scenario failed or feedback is incomplete; 2 usage.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBATE="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO="$(cd "$DEBATE/.." && pwd)"
MANIFEST="$DEBATE/lab-scenarios.json"
EVALUATOR="$SCRIPT_DIR/evaluate-lab.mjs"
RUNS_DIR="${DEBATE_RUNS_DIR:-$HOME/.local/share/infobroker/debate-club-runs}"
KEEP_RUNS="${DEBATE_KEEP_RUNS:-20}"
REQUIRE_REPO_MCP="${DEBATE_REQUIRE_REPO_MCP:-0}"

# shellcheck source=scripts/lib/opencode-utils.sh
source "$REPO/scripts/lib/opencode-utils.sh"

ONLY=""; FROM=""
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
    --from=*) FROM="${arg#--from=}" ;;
    --help|-h)
      printf '%s\n' "Usage: lab.sh [--only=<id>[,<id>...]] [--from=<id>]"
      exit 0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if ! command -v opencode >/dev/null 2>&1; then
  warn "opencode not found — skipping live Lab (informational)."
  exit 0
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="$DEBATE/.runs/lab-$TIMESTAMP"
mkdir -p "$RUN_DIR/scenarios"

export ONLY FROM
node -e '
  const fs = require("fs");
  const only = (process.env.ONLY || "").split(",").filter(Boolean);
  const from = process.env.FROM || "";
  const all = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  let skip = Boolean(from);
  const out = [];
  for (const s of all) {
    if (from && s.id === from) skip = false;
    if (skip) continue;
    if (only.length && !only.includes(s.id)) continue;
    out.push(s);
  }
  for (const s of out) fs.writeFileSync(`${process.argv[2]}/${s.id}.json`, JSON.stringify(s, null, 2));
  process.stdout.write(JSON.stringify(out.map((s) => s.id)));
' "$MANIFEST" "$RUN_DIR/scenarios" > "$RUN_DIR/order.json"

IDS=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).join(" "))' "$RUN_DIR/order.json")
if [[ -z "$IDS" ]]; then die "No scenarios selected (check --only/--from)."; fi

# MCP target: by default the Lab runs against THIS repo's working tree via a
# dedicated opencode serve whose project config overrides the `infobroker` MCP
# server. DEBATE_MCP_MODE=ambient reverts to the configured deployment.
MCP_MODE="${DEBATE_MCP_MODE:-repo}"
MCP_PROBE_DIR="$PWD"
if [[ "$MCP_MODE" == "repo" ]]; then
  MCP_PROJECT="$RUN_DIR/mcp-project"
  mkdir -p "$MCP_PROJECT"
  node -e '
    const fs = require("fs");
    const path = require("path");
    const [repo, out] = process.argv.slice(1);
    const cfg = {
      "$schema": "https://opencode.ai/config.json",
      mcp: {
        infobroker: {
          type: "local",
          command: [path.join(repo, "node_modules", ".bin", "tsx"), path.join(repo, "src", "index.ts")],
          environment: {
            INFOBROKER_CONFIG: path.join(repo, "config.json"),
            INFOBROKER_CONFIG_LOCAL: process.env.HOME + "/.config/infobroker/config.local.json",
          },
        },
      },
    };
    fs.writeFileSync(path.join(out, "opencode.json"), JSON.stringify(cfg, null, 2) + "\n");
  ' "$REPO" "$MCP_PROJECT"
  MCP_PROBE_DIR="$MCP_PROJECT"
  LAB_PORT="${DEBATE_LAB_PORT:-4097}"
  SERVER_URL="http://localhost:$LAB_PORT"
  started=false
  if curl -s -o /dev/null "$SERVER_URL" 2>/dev/null; then
    warn "Reusing an existing opencode serve at $SERVER_URL (repo-scoped target not guaranteed)."
  else
    info "Starting repo-scoped opencode serve on port $LAB_PORT..."
    ( cd "$MCP_PROJECT" && opencode serve --port "$LAB_PORT" ) > "$RUN_DIR/opencode-serve.log" 2>&1 &
    OPC_SERVE_PID=$!
    i=0
    until curl -s -o /dev/null "$SERVER_URL" 2>/dev/null; do
      i=$((i + 1))
      [[ $i -gt 60 ]] && die "repo-scoped opencode serve did not come up (see $RUN_DIR/opencode-serve.log)"
      sleep 1
    done
    started=true
  fi
else
  ensure_opencode_serve "$RUN_DIR" "opencode-serve.log"
fi
cleanup() { cleanup_serve; }
trap cleanup EXIT SIGINT SIGTERM

# Record which MCP target the Lab actually exposes, so a run's feedback is
# interpretable — repo mode points at this working tree, ambient mode at the
# configured deployment.
( cd "$MCP_PROBE_DIR" && opencode mcp list ) > "$RUN_DIR/mcp-target.txt" 2>&1 || true
info "Lab MCP target(s) recorded in $RUN_DIR/mcp-target.txt"

# Provenance: a run is self-describing — repo version/HEAD and the MCP target
# path it actually exercised (so stale-deployment feedback is detectable).
node -e '
  const fs = require("fs");
  const path = require("path");
  const [runDir, repo] = process.argv.slice(1);
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
  let head = "";
  try { head = require("child_process").execSync("git rev-parse HEAD", { cwd: repo, encoding: "utf8" }).trim(); } catch {}
  const target = fs.existsSync(path.join(runDir, "mcp-target.txt")) ? fs.readFileSync(path.join(runDir, "mcp-target.txt"), "utf8") : "";
  const m = target.match(/\/(?:[\w.-]+\/)+src\/index\.ts/);
  const targetPath = m ? m[0] : null;
  const meta = {
    run_id: "lab:" + path.basename(runDir),
    created_at: new Date().toISOString(),
    repo_version: pkg.version,
    repo_head: head,
    mcp_target_path: targetPath,
    mcp_target_is_repo: targetPath ? targetPath.startsWith(repo + "/") : false,
  };
  fs.writeFileSync(path.join(runDir, "run-meta.json"), JSON.stringify(meta, null, 2) + "\n");
  process.stdout.write(String(meta.mcp_target_is_repo));
' "$RUN_DIR" "$REPO" > "$RUN_DIR/.target-match" 2>> "$RUN_DIR/openruns.log" || true
TARGET_IS_REPO=$(cat "$RUN_DIR/.target-match" 2>/dev/null || echo false)
if [[ "$TARGET_IS_REPO" != "true" ]]; then
  warn "Lab MCP target is not this repo (see run-meta.json) — this run validates the configured deployment, not the working tree."
  if [[ "$REQUIRE_REPO_MCP" == "1" ]]; then
    error "DEBATE_REQUIRE_REPO_MCP=1 and the MCP target is not this repo — refusing to record invalid feedback."
    exit 1
  fi
fi

: > "$RUN_DIR/results.ndjson"
for id in $IDS; do
  sc="$RUN_DIR/scenarios/$id.json"
  work="$RUN_DIR/$id"
  mkdir -p "$work"
  info "════ Running lab scenario $id ════"
  node -e 'console.log(require(process.argv[1]).utterance)' "$sc" > "$work/prompt.md"
  opencode run --attach "$SERVER_URL" --agent build --auto --format json \
    "$(cat "$work/prompt.md")" > "$work/turn0.txt" 2>> "$RUN_DIR/openruns.log" || true
  node -e 'import(process.argv[1]).then(m=>{const fs=require("fs");const t=m.extractAssistantText(fs.readFileSync(process.argv[2],"utf8"));fs.writeFileSync(process.argv[3],t.trim().slice(-4000))})' \
    "$REPO/scripts/lib/event-stream.mjs" "$work/turn0.txt" "$work/final.txt" 2>> "$RUN_DIR/openruns.log" || true

  # Advisory, evidence-aware critic pass (critic.md) over the final answer, with
  # the scenario rubric and a bounded tool-call digest so UNSOURCED means
  # "uncited", not "the critic could not see the evidence".
  node -e 'import(process.argv[1]).then(m=>{const fs=require("fs");process.stdout.write(m.extractToolEvidence(fs.readFileSync(process.argv[2],"utf8")))})' \
    "$REPO/scripts/lib/event-stream.mjs" "$work/turn0.txt" > "$work/evidence.txt" 2>> "$RUN_DIR/openruns.log" || true
  node -e 'const s=require(process.argv[1]);process.stdout.write((s.rubric||[]).map(r=>"- "+r).join("\n"))' \
    "$sc" > "$work/rubric.md" 2>> "$RUN_DIR/openruns.log" || true
  {
    cat "$SCRIPT_DIR/critic.md"
    printf '\n\n--- SCENARIO RUBRIC ---\n\n%s\n' "$(cat "$work/rubric.md")"
    printf '\n--- TOOL EVIDENCE (ordered tool calls, truncated) ---\n\n%s\n' "$(cat "$work/evidence.txt")"
    printf '\n--- FINAL ANSWER ---\n\n%s\n' "$(cat "$work/final.txt")"
  } > "$work/critic-input.md"
  : > "$work/critic.err"
  if ! opencode run --attach "$SERVER_URL" --agent plan --auto \
        "$(cat "$work/critic-input.md")" \
        > "$work/critic.txt" 2>> "$RUN_DIR/openruns.log"; then
    echo "critic command exited non-zero" >> "$work/critic.err"
  fi

  node "$EVALUATOR" "$sc" "$work/turn0.txt" "$work" >> "$RUN_DIR/results.ndjson"
done

node -e '
  const fs = require("fs");
  const lines = fs.readFileSync(process.argv[1], "utf8").trim().split("\n").filter(Boolean);
  const out = {};
  let pass = 0, fail = 0;
  for (const l of lines) { let o; try { o = JSON.parse(l); } catch { continue; } out[o.id] = o; if (o.status === "pass") pass++; else fail++; }
  fs.writeFileSync(process.argv[2], JSON.stringify({ summary: { pass, fail, total: pass + fail }, scenarios: out }, null, 2) + "\n");
' "$RUN_DIR/results.ndjson" "$RUN_DIR/results.json"

# Roll the Lab results into report/recommend so the feedback loop covers the
# agentic plane too (report.mjs rolls up results.json when telemetry is absent).
node "$SCRIPT_DIR/report.mjs" "$RUN_DIR"
node "$SCRIPT_DIR/recommend.mjs" "$RUN_DIR"

# Durable retention (B2): copy the run outside the repo tree so a `git clean
# -fdx` or an ephemeral `.runs/` cannot lose it; keep the newest N.
mkdir -p "$RUNS_DIR"
dest="$RUNS_DIR/$(basename "$RUN_DIR")"
rm -rf "$dest"
cp -a "$RUN_DIR" "$dest"
ls -1dt "$RUNS_DIR"/lab-* 2>/dev/null | tail -n +"$((KEEP_RUNS + 1))" | while read -r old; do rm -rf "$old"; done
info "Run retained at $dest (keeping last $KEEP_RUNS)."

# Feedback completeness (B4): every scenario must carry an ok critic and at
# least one Infobroker tool, else the run's feedback is incomplete.
incomplete=$(node -e '
  const r = require(process.argv[1]);
  const bad = [];
  for (const [id, s] of Object.entries(r.scenarios)) {
    if (s.critic_status !== "ok") bad.push(id + ":critic=" + s.critic_status);
    else if (!(s.tools || []).length) bad.push(id + ":no-tool-coverage");
  }
  process.stdout.write(bad.join(", "));
' "$RUN_DIR/results.json")
if [[ -n "$incomplete" ]]; then
  if [[ "${DEBATE_ALLOW_INCOMPLETE:-0}" == "1" ]]; then
    warn "Incomplete Lab feedback (accepted via DEBATE_ALLOW_INCOMPLETE=1): $incomplete"
  else
    error "Incomplete Lab feedback: $incomplete"
    error "A run without a parsed critic verdict or tool coverage is not interpretable. Set DEBATE_ALLOW_INCOMPLETE=1 to accept it anyway."
    exit 1
  fi
fi

fails=$(node -e 'console.log(require(process.argv[1]).summary.fail || 0)' "$RUN_DIR/results.json")
if [[ "$fails" != "0" ]]; then
  error "FAILED: ${fails} lab scenario(s). Results: $RUN_DIR"
  exit 1
fi
info "All lab scenarios passed. Results: $RUN_DIR (retained at $dest)"
