#!/usr/bin/env npx tsx
// provider-smoke.ts — gate (network): live result yield for the four keyless
// web-search providers.
//
// Role: gate (network). Fails only when every keyless provider yields zero,
// which is the "general web search is dead" condition. It is deliberately not
// part of `npm run check`: it needs network access, and provider availability
// varies by host. A single blocked provider is reported, not failed.
//
// Exit codes: 0 = at least one provider yielded results; 1 = every provider
// yielded zero or failed; 2 = fatal/usage error.

import { loadConfig, getConfig } from "../src/config.js";
import { configureAllProviders } from "../src/rate-limiter.js";
import { resolveProvider } from "../src/providers/index.js";
import { handleHelp, parseFlag, rejectUnknown } from "./lib/args.js";

const USAGE = `provider-smoke — live keyless-provider yield

Usage:
  provider-smoke [--json] [--help]

Options:
  --json  Print the report as JSON
  --help  Show this help (exit 0)

Exit codes: 0 = at least one provider yielded results; 1 = all yielded zero;
2 = fatal or usage error.
`;

const SLUGS = ["duckduckgo", "marginalia", "mojeek", "wiby"] as const;
const QUERY = "opencode ai coding agent";

interface Row {
  provider: string;
  status: "ok" | "zero" | "error";
  results: number;
  ms: number;
  error?: string;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, new Set(["--json"]));

  loadConfig();
  configureAllProviders(getConfig());

  const rows: Row[] = [];
  for (const slug of SLUGS) {
    const provider = resolveProvider(slug);
    const start = Date.now();
    if (!provider) {
      rows.push({ provider: slug, status: "error", results: 0, ms: 0, error: "not registered" });
      continue;
    }
    try {
      const results = await provider.search(QUERY, { max_results: 3 });
      rows.push({
        provider: slug,
        status: results.length > 0 ? "ok" : "zero",
        results: results.length,
        ms: Date.now() - start,
      });
    } catch (error) {
      rows.push({
        provider: slug,
        status: "error",
        results: 0,
        ms: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (parseFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify({ query: QUERY, rows, at: new Date().toISOString() }, null, 2)}\n`);
  } else {
    process.stdout.write(`provider-smoke — query: ${QUERY}\n`);
    for (const row of rows) {
      const detail = row.error ? `  (${row.error.slice(0, 80)})` : "";
      process.stdout.write(
        `${row.provider.padEnd(12)} ${row.status.padEnd(6)} results=${String(row.results).padEnd(3)} ${row.ms}ms${detail}\n`
      );
    }
  }

  const anyYield = rows.some((row) => row.results > 0);
  return anyYield ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`provider-smoke failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
