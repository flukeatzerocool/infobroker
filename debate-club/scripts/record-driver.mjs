#!/usr/bin/env node
// record-driver.mjs — entry point: spawn the real server in record mode,
// issue a small fixed query set against live providers, and write an NDJSON
// capture consumable by normalize.mjs. Hits the network; keep the query set
// small and respect provider rate limits.
//
// Exit codes: 0 = capture written; 2 = fatal (server failed to start).

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEBATE = join(import.meta.dirname, "..");
const REPO = join(DEBATE, "..");
const out = process.argv[2] || join(DEBATE, ".runs", `capture-${Date.now()}.ndjson`);

const tmp = mkdtempSync(join(tmpdir(), "debate-record-"));
const cfgLocal = join(tmp, "config.local.json");
writeFileSync(
  cfgLocal,
  JSON.stringify(
    {
      output: { verbose: true, audit_log_path: join(tmp, "audit.log") },
      kb: { storage_path: join(tmp, "kb"), auto_index: false },
    },
    null,
    2
  )
);

const child = spawn(
  process.execPath,
  ["--import", "tsx", "--import", join(DEBATE, "scripts", "preload.mjs"), join(REPO, "src", "index.ts")],
  {
    cwd: REPO,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      TMPDIR: tmp,
      DEBATE_CLUB_MODE: "record",
      DEBATE_CLUB_CAPTURE: out,
      INFOBROKER_CONFIG_LOCAL: cfgLocal,
    },
  }
);
child.stderr.on("data", () => {}); // drain server logs

const pending = new Map();
const rl = createInterface({ input: child.stdout });
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (typeof msg.id === "number" && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

let nextId = 1;
const rpc = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    const t = setTimeout(() => reject(new Error(`${method} timeout`)), 30000);
    pending.set(id, (m) => {
      clearTimeout(t);
      resolve(m);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });

const queries = [
  ["infobroker_search_web", { query: "retrieval augmented generation", provider: "wikipedia", max_results: 3 }],
  ["infobroker_search_web", { query: "vector database comparison", provider: "duckduckgo", max_results: 3 }],
  ["infobroker_get_citations", { query: "retrieval augmented generation", max_results: 3 }],
  ["infobroker_fetch_page", { url: "https://example.com/", renderer: "jina", detect_date: false }],
];

try {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "debate-club-recorder", version: "1.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  for (const [name, args] of queries) {
    const r = await rpc("tools/call", { name, arguments: args });
    const text = r.result?.content?.[0]?.text ?? "";
    console.log(`recorded ${name}: ${text.slice(0, 60).replace(/\n/g, " ")}...`);
  }
} catch (e) {
  console.error(`record-driver: fatal: ${e.message}`);
  child.kill();
  process.exit(2);
}
child.kill();
console.log(`capture written: ${out}`);
