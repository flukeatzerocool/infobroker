#!/usr/bin/env npx tsx
// audit-session-logs.ts — informational: summarize Infobroker tool behavior from
// an opencode session database (calls, errors, empty results, duplicates, deep
// pages, stringified inputs, truncation workarounds, latency).
//
// Usage: npx tsx scripts/audit-session-logs.ts [--db <path>] [--days <n>] [--tool <slug>] [--help]
//
// Exit codes: 0 = report produced (even with findings); 1 = database unreadable;
//             2 = fatal (bad args, unsupported Node).
// Never writes to the database.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HELP = `Usage: npx tsx scripts/audit-session-logs.ts [options]

Summarize Infobroker tool calls in an opencode session database.

Options:
  --db <path>     Path to opencode.db (default: ~/.local/share/opencode/opencode.db)
  --days <n>      Only include calls from the last n days (default: 45)
  --tool <slug>   Filter to one tool name (e.g. infobroker_search_web)
  --help, -h      Show this message
`;

function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(HELP);
  process.exit(0);
}

let dbPath = join(homedir(), ".local/share/opencode/opencode.db");
let days = 45;
let toolFilter: string | undefined;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--db") {
    const value = args[++i];
    if (!value) {
      process.stderr.write("--db requires a path\n");
      process.exit(2);
    }
    dbPath = expandHome(value);
  } else if (arg === "--days") {
    const value = Number(args[++i]);
    if (!Number.isFinite(value) || value <= 0) {
      process.stderr.write("--days requires a positive number\n");
      process.exit(2);
    }
    days = value;
  } else if (arg === "--tool") {
    const value = args[++i];
    if (!value) {
      process.stderr.write("--tool requires a name\n");
      process.exit(2);
    }
    toolFilter = value;
  } else {
    process.stderr.write(`Unknown flag: ${arg}\n`);
    process.exit(2);
  }
}

if (!existsSync(dbPath)) {
  process.stderr.write(`Database not found: ${dbPath}\n`);
  process.exit(1);
}

interface ToolPart {
  session_id: string;
  time_created: number;
  tool: string;
  input: Record<string, unknown> | null;
  output: string;
  status: string;
  start?: number;
  end?: number;
}

let DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
  close: () => void;
};
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  process.stderr.write("node:sqlite is unavailable; Node 24+ is required\n");
  process.exit(2);
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const maxRow = db.prepare("SELECT MAX(time_created) AS t FROM part").all()[0] as { t: number | null };
const maxTime = maxRow?.t ?? Date.now();
const cutoff = maxTime - days * 86_400_000;

const rows = db.prepare(
  `SELECT session_id, time_created, json_extract(data, '$.tool') AS tool, data
   FROM part
   WHERE json_extract(data, '$.type') = 'tool'
     AND json_extract(data, '$.tool') LIKE 'infobroker%'
     AND time_created >= ?`,
).all(cutoff) as Array<{ session_id: string; time_created: number; tool: string; data: string }>;

const truncRows = db.prepare(
  `SELECT COUNT(*) AS n FROM part
   WHERE json_extract(data, '$.tool') = 'bash'
     AND json_extract(data, '$.state.input.command') LIKE '%/tmp/infobroker/trunc%'
     AND time_created >= ?`,
).all(cutoff) as Array<{ n: number }>;
db.close();

const parts: ToolPart[] = [];
for (const row of rows) {
  if (toolFilter && row.tool !== toolFilter) continue;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    continue;
  }
  const state = (data.state ?? {}) as Record<string, unknown>;
  const time = (state.time ?? {}) as Record<string, unknown>;
  parts.push({
    session_id: row.session_id,
    time_created: row.time_created,
    tool: row.tool,
    input: (state.input ?? null) as Record<string, unknown> | null,
    output: typeof state.output === "string" ? state.output : "",
    status: typeof state.status === "string" ? state.status : "unknown",
    start: typeof time.start === "number" ? time.start : undefined,
    end: typeof time.end === "number" ? time.end : undefined,
  });
}

function isStringifiedArray(value: unknown): boolean {
  return typeof value === "string" && value.trim().startsWith("[") && value.trim().endsWith("]");
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const byTool: Record<string, number> = {};
const latencies: Record<string, number[]> = {};
let errors = 0;
let empty = 0;
let noResults = 0;
let stringified = 0;
let deepCalls = 0;
let deepZeroPages = 0;
let truncated = 0;
const duplicateGroups = new Map<string, number>();

for (const part of parts) {
  byTool[part.tool] = (byTool[part.tool] ?? 0) + 1;
  if (part.output.startsWith("[ERROR]")) errors++;
  if (part.tool.includes("search_web")) {
    if (part.output.includes('"results": []')) empty++;
    if (part.output.includes('"no_results": true')) noResults++;
    if (part.input && isStringifiedArray(part.input.query)) stringified++;
    if (part.input?.deep === true) {
      deepCalls++;
      const match = part.output.match(/"pages_read":\s*(\d+)/);
      if (match && Number(match[1]) === 0) deepZeroPages++;
    }
    const key = `${part.session_id}:${JSON.stringify(part.input?.query ?? "")}`;
    duplicateGroups.set(key, (duplicateGroups.get(key) ?? 0) + 1);
  }
  if (part.tool.includes("fetch_page")) {
    if (part.input && isStringifiedArray(part.input.url)) stringified++;
    if (part.output.includes('"output_path"')) truncated++;
    const key = `${part.session_id}:${JSON.stringify(part.input?.url ?? "")}`;
    duplicateGroups.set(key, (duplicateGroups.get(key) ?? 0) + 1);
  }
  if (part.start && part.end) {
    (latencies[part.tool] ??= []).push((part.end - part.start) / 1000);
  }
}

const duplicateExtra = [...duplicateGroups.values()]
  .filter((count) => count > 1)
  .reduce((sum, count) => sum + count - 1, 0);

const report = {
  database: dbPath,
  window_days: days,
  max_time: new Date(maxTime).toISOString(),
  calls: parts.length,
  sessions: new Set(parts.map((p) => p.session_id)).size,
  by_tool: byTool,
  errors,
  empty_search_results: empty,
  no_results_meta: noResults,
  stringified_array_inputs: stringified,
  duplicate_extra_calls: duplicateExtra,
  deep_calls: deepCalls,
  deep_zero_pages: deepZeroPages,
  truncated_fetch_outputs: truncated,
  truncation_file_bash_calls: truncRows[0]?.n ?? 0,
  latency_seconds: Object.fromEntries(
    Object.entries(latencies).map(([tool, values]) => [tool, {
      median: Number(percentile(values, 0.5).toFixed(2)),
      p90: Number(percentile(values, 0.9).toFixed(2)),
      max: Number(Math.max(...values).toFixed(2)),
    }]),
  ),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(0);
