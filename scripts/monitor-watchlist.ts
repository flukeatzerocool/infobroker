#!/usr/bin/env npx tsx
// monitor-watchlist.ts — entry point: run due watchlist topics through the
// local MCP server and write a per-topic delta record (REQ-125). Scheduling is
// external (cron/CI); this process exits after its bounded run.
//
// Role: entry point. Exit codes: 0 = run completed (including no due topics);
// 1 = invalid input; 2 = fatal.

// @implements REQ-125

import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { handleHelp } from "./lib/args.js";
import { parseWatchlist } from "../src/lib/watchlist.js";
import { runWatchlist } from "../src/lib/watchlist-run.js";

export { parseVerifyEnvelope, type RunRecord } from "../src/lib/watchlist-run.js";

const USAGE = `monitor-watchlist — run due watchlist topics through Infobroker (REQ-125)

Usage:
  monitor-watchlist --watchlist <file> --out <dir> [--dry-run] [--json] [--help]

Options:
  --watchlist <path>  Watchlist JSON ({topics:[{id,query,interval_hours,last_run?}]}).
  --out <dir>         Directory for run records (created if absent).
  --dry-run           List due topics without spawning the server or writing files.
  --json              Emit the summary as JSON.
  --help, -h          Show this help (exit 0).

A completed run advances each attempted topic's last_run in the watchlist file so
the next invocation selects the topics that are due. Scheduling stays external.

Exit codes: 0 = run completed; 1 = invalid input; 2 = fatal.
`;

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
    const now = new Date();
    const probe = await runWatchlist({
      watchlist,
      watchlistPath,
      outDir,
      dryRun: true,
      callTool: async () => "",
      now,
    });

    if (dryRun) {
      if (json) console.log(JSON.stringify({ due: probe.due, ran: [] }, null, 2));
      else for (const id of probe.due) console.log(id);
      return;
    }
    if (probe.due.length === 0) {
      if (json) console.log(JSON.stringify({ due: [], ran: [] }, null, 2));
      return;
    }

    const client = new Client({ name: "infobroker-monitor", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.platform === "win32" ? "npx.cmd" : "npx",
      args: ["tsx", "src/index.ts"],
      cwd: process.cwd(),
    });
    await client.connect(transport);

    try {
      const result = await runWatchlist({
        watchlist,
        watchlistPath,
        outDir,
        callTool: async (query) => {
          const response = await client.callTool({ name: "infobroker_verify_claims", arguments: { query } });
          return Array.isArray(response.content)
            ? response.content.map((item) => ("text" in item && typeof item.text === "string" ? item.text : "")).join("")
            : "";
        },
        now,
      });
      if (json) console.log(JSON.stringify({ due: result.due, ran: result.ran }, null, 2));
      else for (const id of result.ran) console.log(id);
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
}
