#!/usr/bin/env npx tsx
// benchmark-kb-store.ts — informational: measure knowledge-base search latency
// on the SQLite backend (REQ-060a, REQ-108). Copies the source store into a
// temp directory and never opens the production store for write.
//
// Exit codes: 0 = report printed; 1 = setup/read/init error; 2 = fatal
// (bad arguments or unexpected error).

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { initKb, kbSearch, flushKbWrites, getKbLockError } from "../src/kb.js";
import { LEGACY_JSON_STORE } from "../src/kb-store.js";
import type { KbConfig } from "../src/types.js";

const USAGE = `benchmark-kb-store — knowledge-base search latency benchmark (REQ-060a, REQ-108)

Usage:
  npx tsx scripts/benchmark-kb-store.ts [options]

Options:
  --store <dir>        Source knowledge-base directory. Finds ${LEGACY_JSON_STORE},
                       else the newest ${LEGACY_JSON_STORE}.migrated-* archive.
  --seed <file>        Explicit legacy JSON store to use as the corpus seed.
  --queries <file>     JSON file with { queries: [{ query: "..." }, ...] }.
                       Default: test-fixtures/retrieval/queries.json
  --iterations <n>     Searches per query after one warmup (default 20).
  --no-encrypt         Measure plaintext only (default measures both).
  --json               Print the full report as JSON.
  --help, -h           Show this message (exit 0).

The JSON seed is migrated into a temp SQLite store so the measured chunk set
matches the source corpus. Encrypted runs use a temporary key under the
benchmark directory. Nothing in the source store is modified.

Exit codes: 0 = report printed; 1 = setup/read/init error; 2 = fatal.
`;

interface QueryFixture {
  queries?: Array<{ query?: unknown }>;
}

interface QueryResult {
  query: string;
  results: number;
  mean_ms: number;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
  signature: string;
}

interface RunResult {
  encryption: "plaintext" | "encrypted";
  queries: QueryResult[];
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(USAGE);
  process.exit(0);
}

function fatal(message: string): never {
  console.error(`benchmark-kb-store: ${message}`);
  process.exit(2);
}

function fail(message: string): never {
  console.error(`benchmark-kb-store: ${message}`);
  process.exit(1);
}

function takeValue(flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fatal(`${flag} requires a value`);
  return value;
}

const known = new Set([
  "--store",
  "--seed",
  "--queries",
  "--iterations",
  "--no-encrypt",
  "--json",
  "--help",
  "-h",
]);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!known.has(arg)) fatal(`unknown flag: ${arg}`);
  if (["--store", "--seed", "--queries", "--iterations"].includes(arg)) i++;
}

const repoRoot = join(import.meta.dirname, "..");
const iterationsRaw = takeValue("--iterations") ?? "20";
const iterations = Number(iterationsRaw);
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1000) {
  fatal(`--iterations must be an integer in 1..1000 (got "${iterationsRaw}")`);
}
const encrypt = !argv.includes("--no-encrypt");
const asJson = argv.includes("--json");

const queriesPath = takeValue("--queries") ?? join(repoRoot, "test-fixtures", "retrieval", "queries.json");
let queries: string[];
try {
  const fixture = JSON.parse(readFileSync(queriesPath, "utf-8")) as QueryFixture;
  queries = (fixture.queries ?? [])
    .map((q) => (typeof q.query === "string" ? q.query : ""))
    .filter((q) => q.length > 0);
} catch (error) {
  fail(`cannot read ${queriesPath}: ${error instanceof Error ? error.message : String(error)}`);
}
if (queries.length === 0) fail(`no queries found in ${queriesPath}`);

function findSeed(): string {
  const explicit = takeValue("--seed");
  if (explicit) {
    if (!existsSync(explicit)) fail(`seed not found: ${explicit}`);
    return explicit;
  }
  const storeDir = takeValue("--store");
  if (!storeDir) fatal("provide --store <dir> or --seed <file>");
  if (!existsSync(storeDir)) fail(`store directory not found: ${storeDir}`);
  const direct = join(storeDir, LEGACY_JSON_STORE);
  if (existsSync(direct)) return direct;
  const archives = readdirSync(storeDir)
    .filter((name) => name.startsWith(`${LEGACY_JSON_STORE}.migrated-`))
    .sort();
  if (archives.length === 0) {
    fail(
      `no ${LEGACY_JSON_STORE} or ${LEGACY_JSON_STORE}.migrated-* seed in ${storeDir}; ` +
        `the benchmark migrates a legacy store on first use`
    );
  }
  return join(storeDir, archives[archives.length - 1]!);
}

const seed = findSeed();

function baseConfig(storagePath: string, keyFile?: string): KbConfig {
  const loaded = loadConfig();
  // The config layer resolves defaults before the store sees them; the
  // declared `Config.kb` shape is the pre-resolution input, so the spread is
  // typed as the resolved shape here.
  return {
    ...(loaded.kb as KbConfig),
    storage_path: storagePath,
    auto_index: false,
    maintenance_interval_minutes: 0,
    ...(keyFile ? { encryption: { enabled: true, key_file: keyFile } } : { encryption: { enabled: false } }),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

function signature(results: Array<{ source_url: string; score: number }>): string {
  const text = results
    .slice(0, 5)
    .map((r) => `${r.source_url}:${r.score.toFixed(6)}`)
    .join("|");
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function measure(encryption: "plaintext" | "encrypted", storagePath: string, keyFile?: string): RunResult {
  initKb(baseConfig(storagePath, encryption === "encrypted" ? keyFile : undefined));
  const lock = getKbLockError();
  if (lock) fail(`${encryption} store locked: ${lock.message}`);

  const perQuery: QueryResult[] = [];
  for (const query of queries) {
    // Warmup, then measure. The first search may build backend caches.
    kbSearch(query, 10);
    const samples: number[] = [];
    let lastCount = 0;
    let lastSignature = "";
    for (let i = 0; i < iterations; i++) {
      const started = performance.now();
      const results = kbSearch(query, 10);
      samples.push(performance.now() - started);
      lastCount = results.length;
      lastSignature = signature(results);
    }
    samples.sort((a, b) => a - b);
    perQuery.push({
      query,
      results: lastCount,
      mean_ms: round3(samples.reduce((sum, v) => sum + v, 0) / samples.length),
      p50_ms: round3(percentile(samples, 50)),
      p95_ms: round3(percentile(samples, 95)),
      max_ms: round3(samples[samples.length - 1] ?? 0),
      signature: lastSignature,
    });
  }
  flushKbWrites();
  return { encryption, queries: perQuery };
}

function avg(items: QueryResult[], key: "mean_ms" | "p50_ms"): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item[key], 0) / items.length;
}

const root = mkdtempSync(join(tmpdir(), "infobroker-kb-bench-"));
const results: RunResult[] = [];
try {
  const keyFile = join(root, "bench.key");
  writeFileSync(keyFile, `${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });

  const modes: Array<"plaintext" | "encrypted"> = encrypt ? ["plaintext", "encrypted"] : ["plaintext"];
  for (const encryption of modes) {
    const dir = join(root, `sqlite-${encryption}`);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    copyFileSync(seed, join(dir, LEGACY_JSON_STORE));
    const started = performance.now();
    const result = measure(encryption, dir, keyFile);
    const elapsed = round3(performance.now() - started);
    results.push(result);
    if (!asJson) {
      console.log(
        `sqlite/${encryption}: ${result.queries.length} queries, init+run ${elapsed} ms, ` +
          `mean ${round3(avg(result.queries, "mean_ms"))} ms, p50 ${round3(avg(result.queries, "p50_ms"))} ms`
      );
    }
  }

  const report = { schema_version: 1, seed, iterations, queries: queries.length, results };
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log("");
    for (const result of results) {
      for (const q of result.queries) {
        console.log(
          `${result.encryption.padEnd(9)} ` +
            `p50 ${q.p50_ms.toFixed(2).padStart(8)} ms  p95 ${q.p95_ms.toFixed(2).padStart(8)} ms  ` +
            `n=${String(q.results).padStart(3)}  ${q.query}`
        );
      }
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
