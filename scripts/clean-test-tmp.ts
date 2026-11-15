#!/usr/bin/env npx tsx
// clean-test-tmp.ts — build tool: reap test-harness roots left in the system
// temp directory by killed or crashed runs. A root is a candidate only when its
// name starts with a prefix from TEMP_PREFIXES (src/lib/test-tmp.ts) and it is
// older than the age bound; `--all` ignores the bound and is meant for a
// moment when no test or gate is running.
//
// Usage: npx tsx scripts/clean-test-tmp.ts [--older-than <minutes>] [--all]
//                                          [--tmpdir <path>] [--dry-run]
//        npm run clean:tmp -- --dry-run --all
// Exit codes: 0 = completed (including nothing to do), 1 = bad argument,
//             2 = fatal (unreadable root).
import { lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { handleHelp, parseFlag, parseValueFlag, rejectUnknown } from "./lib/args.js";
import { TEMP_PREFIXES } from "../src/lib/test-tmp.js";

const USAGE = `Usage: npx tsx scripts/clean-test-tmp.ts [options]

  --older-than <minutes>  Reap roots last modified at least this long ago
                          (default 60; 0 reaps everything regardless of age).
  --all                   Ignore the age bound. Use only when no test or gate
                          is running.
  --tmpdir <path>         Directory to scan (default: the system temp dir).
  --dry-run               Print what would be removed; remove nothing.
  --help                  Show this message.

Exit codes: 0 = completed, 1 = bad argument, 2 = fatal.
`;

const KNOWN = new Set(["--older-than", "--all", "--tmpdir", "--dry-run", "--help", "-h"]);

export interface Entry {
  name: string;
  mtimeMs: number;
}

export interface Selection {
  root: string;
  ageMinutes: number;
  ignoreAge: boolean;
  now: number;
}

/** True when a directory name belongs to the harness namespace. */
export function isHarnessName(name: string): boolean {
  return TEMP_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** True when `path` resolves inside `root`. */
export function isInside(root: string, path: string): boolean {
  const base = resolve(root) + sep;
  return resolve(path).startsWith(base);
}

/**
 * Candidates from one directory listing: harness names only, inside the root,
 * and — unless `ignoreAge` — last modified at least `ageMinutes` ago.
 */
export function selectTempRoots(entries: Entry[], selection: Selection): Entry[] {
  const cutoff = selection.now - selection.ageMinutes * 60_000;
  return entries.filter(
    (entry) =>
      isHarnessName(entry.name) &&
      isInside(selection.root, join(selection.root, entry.name)) &&
      (selection.ignoreAge || entry.mtimeMs <= cutoff),
  );
}

/** Recursive size in bytes; a root that vanishes mid-walk counts what it had. */
export function treeBytes(path: string): number {
  let total = 0;
  let entries: string[];
  try {
    const stat = lstatSync(path);
    if (!stat.isDirectory()) return stat.size;
    entries = readdirSync(path);
  } catch {
    // Racing removal: the bytes are already gone, so zero is the accurate count.
    return 0;
  }
  for (const entry of entries) total += treeBytes(join(path, entry));
  return total;
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, KNOWN, USAGE);

  const ignoreAge = parseFlag(argv, "--all");
  const dryRun = parseFlag(argv, "--dry-run");
  const ageRaw = parseValueFlag(argv, "--older-than");
  const ageMinutes = ageRaw === null ? 60 : Number(ageRaw);
  if (!Number.isInteger(ageMinutes) || ageMinutes < 0) {
    process.stderr.write(`clean-test-tmp: --older-than needs a non-negative integer, got "${ageRaw}"\n`);
    return 1;
  }

  const root = resolve(parseValueFlag(argv, "--tmpdir") ?? tmpdir());
  try {
    if (!lstatSync(root).isDirectory()) throw new Error("not a directory");
    realpathSync(root);
  } catch (error) {
    process.stderr.write(`clean-test-tmp: cannot scan ${root}: ${(error as Error).message}\n`);
    return 2;
  }

  const entries: Entry[] = [];
  for (const name of readdirSync(root)) {
    if (!isHarnessName(name)) continue;
    try {
      const stat = lstatSync(join(root, name));
      if (!stat.isDirectory()) continue;
      entries.push({ name, mtimeMs: stat.mtimeMs });
    } catch {
      // A root can disappear between readdir and stat; it is not a candidate.
      continue;
    }
  }

  const selected = selectTempRoots(entries, {
    root,
    ageMinutes,
    ignoreAge,
    now: Date.now(),
  });

  let bytes = 0;
  for (const entry of selected) {
    const path = join(root, entry.name);
    const size = treeBytes(path);
    if (dryRun) {
      process.stdout.write(`would remove ${path}\n`);
      bytes += size;
      continue;
    }
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      process.stdout.write(`removed ${path}\n`);
      bytes += size;
    } catch (error) {
      process.stderr.write(`clean-test-tmp: could not remove ${path}: ${(error as Error).message}\n`);
    }
  }

  const verb = dryRun ? "would reap" : "reaped";
  process.stdout.write(
    `clean-test-tmp: ${verb} ${selected.length} root(s), ${bytes} bytes; kept ${entries.length - selected.length} of ${entries.length} harness-named root(s) in ${root}\n`,
  );
  return 0;
}

// Run only as an entry point: importing this module (tests) must not exit.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
