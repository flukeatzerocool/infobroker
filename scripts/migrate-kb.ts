#!/usr/bin/env npx tsx
// migrate-kb.ts — entry point: run the one-time legacy JSON -> SQLite knowledge
// base migration on demand (REQ-108, REQ-085). The server also migrates
// automatically on first open; this script is for low-memory hosts and manual
// recovery. It never deletes the legacy store before the database commits.
//
// Exit codes: 0 = no migration needed, migrated, or corrupt-store recovery;
//             1 = locked or migration error; 2 = fatal (bad config/args).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { migrateLegacyJson } from "../src/kb-migrate.js";
import { LEGACY_JSON_STORE, LIVE_SQLITE_STORE } from "../src/kb-store.js";

const args = process.argv.slice(2);

function help(): void {
  console.log(`Usage: npx tsx scripts/migrate-kb.ts [--dry-run] [--help]

Migrates the legacy vector-store.json knowledge base to vector-store.sqlite.
The JSON file is preserved as vector-store.json.migrated-<timestamp>.

Options:
  --dry-run  Report what would happen without writing anything.
  --help     Show this message.
`);
}

if (args.includes("--help") || args.includes("-h")) {
  help();
  process.exit(0);
}
const known = new Set(["--dry-run", "--help", "-h"]);
const unknown = args.find((a) => !known.has(a));
if (unknown) {
  console.error(`Unknown flag: ${unknown}`);
  help();
  process.exit(2);
}
const dryRun = args.includes("--dry-run");

function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

try {
  const config = loadConfig();
  if (!config.kb) {
    console.error("No kb configuration found.");
    process.exit(1);
  }
  const storagePath = expandHome(config.kb.storage_path);
  const jsonPath = join(storagePath, LEGACY_JSON_STORE);
  const dbPath = join(storagePath, LIVE_SQLITE_STORE);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          status: existsSync(dbPath) ? "none" : existsSync(jsonPath) ? "would-migrate" : "none",
          storage_path: storagePath,
          legacy_store: existsSync(jsonPath),
          sqlite_store: existsSync(dbPath),
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const result = migrateLegacyJson({
    storagePath,
    encryptionEnabled: config.kb.encryption?.enabled ?? false,
    ...(config.kb.encryption?.key_file ? { keyFile: config.kb.encryption.key_file } : {}),
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "locked" || result.status === "error" ? 1 : 0);
} catch (e) {
  console.error(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}
