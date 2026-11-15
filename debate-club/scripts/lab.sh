#!/usr/bin/env bash
# lab.sh — debate-club Lab entry point (agentic, live). Runs each persona
# scenario through headless opencode against the configured Infobroker MCP and
# evaluates the transcript mechanically. An evidence-aware critic/rubric pass is
# advisory. Profiles group scenarios onto a generated config layer so a result
# is attributable to the configuration it exercised.
#
# Usage: lab.sh [--only=<id>[,<id>...]] [--from=<id>] [--help]
# Env: DEBATE_MCP_MODE  repo (default, exercise this working tree) | ambient
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
PROFILE_SCRIPT="$SCRIPT_DIR/profile.mjs"
TSX="$REPO/node_modules/.bin/tsx"
RUNS_DIR="${DEBATE_RUNS_DIR:-$HOME/.local/share/infobroker/debate-club-runs}"
KEEP_RUNS="${DEBATE_KEEP_RUNS:-20}"
REQUIRE_REPO_MCP="${DEBATE_REQUIRE_REPO_MCP:-0}"
MCP_MODE="${DEBATE_MCP_MODE:-repo}"
export MCP_MODE

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

if [[ "$MCP_MODE" == "repo" ]]; then
  # The skills assertion runs from the working tree, not from PATH.
  [[ -x "$REPO/node_modules/.bin/tsx" ]] \
    || die "Pre-flight failed: missing $REPO/node_modules/.bin/tsx (run npm install)"
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="$DEBATE/.runs/lab-$TIMESTAMP"
# One run-scoped KB root: a re-run cannot recall an earlier run's store or its
# report:// artifacts.
KB_ROOT="$RUN_DIR/kb"
mkdir -p "$RUN_DIR/scenarios" "$RUN_DIR/profiles"

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

# Group selected scenarios by config profile. Ambient mode has one group: the
# deployment's own configuration, so a profile cannot be attributed to it.
node -e '
  const fs = require("fs");
  const dir = process.argv[1];
  const repo = process.env.MCP_MODE === "repo";
  const ids = JSON.parse(fs.readFileSync(dir + "/order.json", "utf8"));
  const groups = [];
  for (const id of ids) {
    const s = JSON.parse(fs.readFileSync(dir + "/scenarios/" + id + ".json", "utf8"));
    const profile = repo ? (s.profile || "fresh") : "ambient";
    let g = groups.find((x) => x.profile === profile);
    if (!g) { g = { profile, ids: [] }; groups.push(g); }
    g.ids.push(id);
  }
  fs.writeFileSync(dir + "/groups.json", JSON.stringify(groups, null, 2) + "\n");
' "$RUN_DIR"

# Generate the layers and their hashes once, so run-meta is self-describing.
if [[ "$MCP_MODE" == "repo" ]]; then
  node -e '
    const fs = require("fs");
    const path = require("path");
    const [dir, script] = process.argv.slice(1);
    const groups = JSON.parse(fs.readFileSync(dir + "/groups.json", "utf8"));
    for (const g of groups) {
      const { spawnSync } = require("child_process");
      const r = spawnSync(process.execPath, [script, "--print", g.profile], { encoding: "utf8" });
      if (r.status !== 0) { console.error(r.stderr || "profile resolution failed"); process.exit(1); }
      fs.writeFileSync(path.join(dir, "profiles", g.profile + ".json"), r.stdout);
    }
  ' "$RUN_DIR" "$PROFILE_SCRIPT"
  # Pin the run-scoped KB on every profile that keeps one, then hash the
  # isolated bytes: the layer that runs is the layer recorded.
  for profile_file in "$RUN_DIR"/profiles/*.json; do
    "$TSX" "$REPO/scripts/lib/repo-mode.ts" isolate-kb "$KB_ROOT" "$profile_file" "$profile_file" \
      || die "Repo mode failed: could not isolate the KB in $profile_file"
  done
  node -e '
    const fs = require("fs");
    const path = require("path");
    const crypto = require("crypto");
    const dir = process.argv[1];
    const groups = JSON.parse(fs.readFileSync(dir + "/groups.json", "utf8"));
    const out = {};
    for (const g of groups) {
      const bytes = fs.readFileSync(path.join(dir, "profiles", g.profile + ".json"));
      out[g.profile] = {
        layer_sha256: crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12),
        scenarios: g.ids,
      };
    }
    fs.writeFileSync(dir + "/profiles.json", JSON.stringify(out, null, 2) + "\n");
  ' "$RUN_DIR"
else
  node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ ambient: { layer_sha256: null, scenarios: JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")).flatMap((g)=>g.ids) } }, null, 2) + "\n")' "$RUN_DIR/profiles.json" "$RUN_DIR/groups.json"
fi

start_profile_server() {
  local profile="$1"
  if [[ "$MCP_MODE" != "repo" ]]; then
    ensure_opencode_serve "$RUN_DIR" "opencode-serve.log"
    return
  fi
  local project="$RUN_DIR/mcp-project-$profile"
  local layer="$RUN_DIR/profiles/$profile.json"
  mkdir -p "$project"
  # The cwd is what makes the project MCP config authoritative. Each profile
  # group gets its own server so the layer is fixed for the whole group.
  "$TSX" "$REPO/scripts/lib/repo-mode.ts" project "$REPO" "$layer" "$project/opencode.json" \
    || die "Repo mode failed: could not write the project MCP config for $profile"
  ensure_opencode_serve_at "$RUN_DIR" "opencode-serve-$profile.log" "$(find_free_port)" "$project"
  ( cd "$project" && opencode debug config ) > "$RUN_DIR/debug-config-$profile.json" 2>> "$RUN_DIR/openruns.log" \
    || die "opencode debug config failed for profile $profile (see $RUN_DIR/openruns.log)"
  "$REPO/node_modules/.bin/tsx" "$REPO/scripts/test-research/assert-skills.ts" \
    "$RUN_DIR/debug-config-$profile.json" "$project/opencode.json" "$REPO/skills" \
    || die "Repo mode refused: profile $profile does not load this tree's skills (see $RUN_DIR/debug-config-$profile.json)"
  printf 'skills:%s\n' "$REPO/skills" >> "$RUN_DIR/mcp-target.txt"
  node -e '
    const fs = require("fs");
    const [file, want, profile] = process.argv.slice(1);
    let layers = [];
    try { layers = JSON.parse(fs.readFileSync(file, "utf8")); } catch { layers = []; }
    const lines = [];
    for (const layer of Array.isArray(layers) ? layers : []) {
      if (layer.type !== "document" || (layer.path ?? layer.source) !== want) continue;
      for (const [name, server] of Object.entries(layer.info?.mcp?.servers ?? {})) {
        lines.push(`repo:${profile}:${name}: ${(server.command ?? []).join(" ")}`.trimEnd());
      }
    }
    console.log(lines.length ? lines.join("\n") : `repo:${profile}: no project MCP config resolved`);
  ' "$RUN_DIR/debug-config-$profile.json" "$project/opencode.json" "$profile" >> "$RUN_DIR/mcp-target.txt" 2>> "$RUN_DIR/openruns.log" || true
}

cleanup() { cleanup_serve; }
trap cleanup EXIT SIGINT SIGTERM

: > "$RUN_DIR/mcp-target.txt"
if [[ "$MCP_MODE" == "repo" ]]; then
  # The run-scoped store the profile layers pin (profile `constrained` keeps
  # `kb: null` by design and therefore reads none of it).
  "$TSX" "$REPO/scripts/lib/repo-mode.ts" paths "$KB_ROOT" >> "$RUN_DIR/mcp-target.txt"
fi
: > "$RUN_DIR/results.ndjson"

run_scenario() {
  local id="$1" profile="$2"
  local sc="$RUN_DIR/scenarios/$id.json"
  local work="$RUN_DIR/$id"
  mkdir -p "$work"
  info "════ Running lab scenario $id (profile $profile) ════"
  node -e 'console.log(require(process.argv[1]).utterance)' "$sc" > "$work/prompt.md"
  opencode run --server "$SERVER_URL" --agent build --auto --format json \
    "$(cat "$work/prompt.md")" > "$work/turn0.txt" 2>> "$RUN_DIR/openruns.log" </dev/null || true
  node -e 'import(process.argv[1]).then(m=>{const fs=require("fs");const t=m.extractAssistantText(fs.readFileSync(process.argv[2],"utf8"));fs.writeFileSync(process.argv[3],t.trim().slice(-4000))})' \
    "$REPO/scripts/lib/event-stream.mjs" "$work/turn0.txt" "$work/final.txt" 2>> "$RUN_DIR/openruns.log" || true

  # Advisory, evidence-aware critic pass (critic.md) over the final answer, with
  # the scenario rubric, its audience lens, and a bounded tool-call digest so
  # UNSOURCED means "uncited", not "the critic could not see the evidence".
  node -e 'import(process.argv[1]).then(m=>{const fs=require("fs");process.stdout.write(m.extractToolEvidence(fs.readFileSync(process.argv[2],"utf8")))})' \
    "$REPO/scripts/lib/event-stream.mjs" "$work/turn0.txt" > "$work/evidence.txt" 2>> "$RUN_DIR/openruns.log" || true
  node -e 'const s=require(process.argv[1]);process.stdout.write((s.rubric||[]).map(r=>"- "+r).join("\n"))' \
    "$sc" > "$work/rubric.md" 2>> "$RUN_DIR/openruns.log" || true
  node -e 'const s=require(process.argv[1]);process.stdout.write(String(s.rubric_lens||s.persona||"general"))' \
    "$sc" > "$work/lens.txt" 2>> "$RUN_DIR/openruns.log" || true
  {
    cat "$SCRIPT_DIR/critic.md"
    printf '\n\n--- AUDIENCE LENS ---\n\n%s\n' "$(cat "$work/lens.txt")"
    printf '\n--- SCENARIO RUBRIC ---\n\n%s\n' "$(cat "$work/rubric.md")"
    printf '\n--- TOOL EVIDENCE (ordered tool calls, truncated) ---\n\n%s\n' "$(cat "$work/evidence.txt")"
    printf '\n--- FINAL ANSWER ---\n\n%s\n' "$(cat "$work/final.txt")"
  } > "$work/critic-input.md"
  : > "$work/critic.err"
  if ! opencode run --server "$SERVER_URL" --agent plan --auto \
        "$(cat "$work/critic-input.md")" \
        > "$work/critic.txt" 2>> "$RUN_DIR/openruns.log" </dev/null; then
    echo "critic command exited non-zero" >> "$work/critic.err"
  fi

  DEBATE_PROFILE="$profile" node "$EVALUATOR" "$sc" "$work/turn0.txt" "$work" >> "$RUN_DIR/results.ndjson"
}

GROUPS_RAW=$(node -e 'const g=require(process.argv[1]);for(const x of g)console.log(x.profile+" "+x.ids.join(" "))' "$RUN_DIR/groups.json")
while IFS= read -r group; do
  [[ -n "$group" ]] || continue
  read -r GROUP_PROFILE GROUP_IDS <<< "$group"
  start_profile_server "$GROUP_PROFILE"
  for id in $GROUP_IDS; do run_scenario "$id" "$GROUP_PROFILE"; done
  cleanup_serve
  started=false
done <<< "$GROUPS_RAW"

# Provenance: a run is self-describing — repo version/HEAD, the MCP target
# path, and each profile's layer hash so a result is attributable to the
# configuration it exercised.
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
  const profiles = fs.existsSync(path.join(runDir, "profiles.json")) ? JSON.parse(fs.readFileSync(path.join(runDir, "profiles.json"), "utf8")) : {};
  const meta = {
    run_id: "lab:" + path.basename(runDir),
    created_at: new Date().toISOString(),
    repo_version: pkg.version,
    repo_head: head,
    mcp_target_path: targetPath,
    mcp_target_is_repo: targetPath ? targetPath.startsWith(repo + "/") : false,
    profiles,
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
info "Lab MCP target(s) recorded in $RUN_DIR/mcp-target.txt"

# Infrastructure guard: in repo mode the run is only meaningful if the agent
# actually reached this working tree's MCP. A zero-call run means the server
# never loaded (config, startup, or environment) — that is not a scenario
# failure, so say so instead of recording misleading feedback.
if [[ "$MCP_MODE" == "repo" ]]; then
  MCP_CALLS=$(node -e '
    const fs = require("fs");
    const lines = fs.readFileSync(process.argv[1], "utf8").trim().split("\n").filter(Boolean);
    let n = 0;
    for (const l of lines) { let o; try { o = JSON.parse(l); } catch { continue; } n += (o.tools || []).length; }
    process.stdout.write(String(n));
  ' "$RUN_DIR/results.ndjson" 2>/dev/null || echo 0)
  if [[ "${MCP_CALLS:-0}" -eq 0 ]]; then
    error "MCP did not load: no Infobroker tool calls observed in repo mode."
    error "Target recorded in $RUN_DIR/mcp-target.txt; see $RUN_DIR/openruns.log."
    error "This is an infrastructure failure, not a scenario result."
    exit 1
  fi
  info "MCP calls observed: ${MCP_CALLS}"
fi

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
