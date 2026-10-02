#!/usr/bin/env node
// normalize.mjs — build tool: convert a raw NDJSON capture into a replay
// fixture index (host/method/path_regex/status/headers/body). Deterministic:
// entries are sorted and volatile headers/timestamps are dropped.
//
// Exit codes: 0 = wrote fixtures; 2 = usage error.

import { readFileSync, writeFileSync } from "node:fs";

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error("usage: normalize.mjs <in.ndjson> <out.json>");
  process.exit(2);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const lines = readFileSync(inPath, "utf8").split("\n").filter(Boolean);
const byKey = new Map();
for (const line of lines) {
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    continue; // skip malformed capture lines
  }
  let u;
  try {
    u = new URL(rec.url);
  } catch {
    continue; // skip non-absolute URLs
  }
  const headers = {};
  for (const h of ["content-type"]) {
    if (rec.headers && rec.headers[h]) headers[h] = rec.headers[h];
  }
  const method = (rec.method || "GET").toUpperCase();
  const key = `${u.hostname}|${method}|${u.pathname}`;
  byKey.set(key, {
    host: u.hostname,
    method,
    path_regex: `^${escapeRegex(u.pathname)}`,
    status: rec.status ?? 200,
    headers,
    body: rec.body ?? "",
  });
}

const entries = [...byKey.values()].sort((a, b) =>
  (a.host + a.path_regex).localeCompare(b.host + b.path_regex)
);
const fixtureHosts = [...new Set(entries.map((e) => e.host))].sort();
writeFileSync(outPath, JSON.stringify({ fixtureHosts, entries }, null, 2) + "\n");
console.log(`normalize: ${entries.length} fixture(s) from ${lines.length} capture(s) -> ${outPath}`);
