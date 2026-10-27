#!/usr/bin/env npx tsx
// monitor-watchlist.ts — entry point: run due watchlist topics through the
// local MCP server and write a per-topic delta record (REQ-125). Scheduling is
// external (cron/CI); this process exits after its bounded run.
//
// Exit codes: 0 = run completed (including no due topics); 1 = invalid input;
// 2 = fatal.

// @implements REQ-125

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { handleHelp } from "./lib/args.js";
import { parseWatchlist, dueTopics, diffClaims } from "../src/lib/watchlist.js";

const USAGE = `monitor-watchlist — run due watchlist topics through Infobroker (REQ-125)

Usage:
  monitor-watchlist --watchlist <file> --out <dir> [--dry-run] [--json] [--help]

Options:
  --watchlist <path>  Watchlist JSON ({topics:[{id,query,interval_hours,last_run?}]}).
  --out <dir>         Directory for run records (created if absent).
  --dry-run           List due topics without spawning the server.
  --json              Emit the summary as JSON.
  --help, -h          Show this help (exit 0).

Exit codes: 0 = run completed; 1 = invalid input; 2 = fatal.
`;

interface RunRecord {
  topic: string;
  ran_at: string;
  status: "ok" | "error";
  claims: string[];
  delta: { new: string[]; changed: string[]; removed: string[] };
  error?: string;
}

function parseEnvelope(text: string): { findings?: Array<{ claim?: string; topic?: string }> } | null {
  try {
    const body = text.startsWith("[OK] ") ? text.slice(5) : text;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function previousClaims(path: string): string[] {
  if (!existsSync(path)) return [];
  try {
    const prior = JSON.parse(readFileSync(path, "utf-8")) as { claims?: string[] };
    return Array.isArray(prior.claims) ? prior.claims : [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  handleHelp(process.argv.slice(2), USAGE);
  const argv = process.argv.slice(2);
  let watchlistPath: string | undefined;
  let outDir: string | undefined;
  let dryRun = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--watchlist") watchlistPath = argv[++i];
    else if (arg.startsWith("--watchlist=")) watchlistPath = arg.slice("--watchlist=".length);
    else if (arg === "--out") outDir = argv[++i];
    else if (arg.startsWith("--out=")) outDir = arg.slice("--out=".length);
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--json") json = true;
    else {
      console.error(`unknown flag: ${arg}`);
      console.error(USAGE);
      process.exit(2);
    }
  }
  if (!watchlistPath || !outDir) {
    console.error("--watchlist and --out are required");
    console.error(USAGE);
    process.exit(1);
  }
  if (!existsSync(watchlistPath)) {
    console.error(`watchlist not found: ${watchlistPath}`);
    process.exit(1);
  }

  try {
    const watchlist = parseWatchlist(JSON.parse(readFileSync(watchlistPath, "utf-8")));
    const due = dueTopics(watchlist).filter((topic) => topic.due);
    if (dryRun || due.length === 0) {
      const summary = { due: due.map((topic) => topic.id), ran: [] as string[] };
      if (json) console.log(JSON.stringify(summary, null, 2));
      else for (const topic of due) console.log(topic.id);
      return;
    }

    mkdirSync(outDir, { recursive: true });
    const client = new Client({ name: "infobroker-monitor", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.platform === "win32" ? "npx.cmd" : "npx",
      args: ["tsx", "src/index.ts"],
      cwd: process.cwd(),
    });
    await client.connect(transport);

    const ran: string[] = [];
    for (const topic of due) {
      const recordPath = join(outDir, `${topic.id}.json`);
      const previous = previousClaims(recordPath);
      const record: RunRecord = {
        topic: topic.id,
        ran_at: new Date().toISOString(),
        status: "ok",
        claims: [],
        delta: { new: [], changed: [], removed: [] },
      };
      try {
        const result = await client.callTool({
          name: "infobroker_verify_claims",
          arguments: { query: topic.query },
        });
        const text = Array.isArray(result.content)
          ? result.content.map((item) => ("text" in item && typeof item.text === "string" ? item.text : "")).join("")
          : "";
        const payload = parseEnvelope(text);
        record.claims = (payload?.findings ?? [])
          .map((finding) => finding.claim ?? finding.topic ?? "")
          .filter(Boolean);
        record.delta = diffClaims(previous, record.claims);
      } catch (error) {
        record.status = "error";
        record.error = error instanceof Error ? error.message : String(error);
      }
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
      ran.push(topic.id);
    }
    await client.close();
    if (json) console.log(JSON.stringify({ due: due.map((t) => t.id), ran }, null, 2));
    else for (const id of ran) console.log(id);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
