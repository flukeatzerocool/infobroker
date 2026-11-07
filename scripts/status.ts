#!/usr/bin/env npx tsx
// status.ts — informational: report the release state a session needs before
// it closes: how much work is unpushed, how old the oldest unpushed commit is,
// when the pipeline last ran, and whether the roadmap still holds scheduled
// work. Keeping this visible is what makes a 24-hour push cadence routine
// rather than a resolution.
//
// Role: informational (reports; always exits 0).
// Exit codes: 0 = report printed, including when a source is unavailable.
//
// Usage: npx tsx scripts/status.ts [--help]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";

const USAGE = `Usage: npx tsx scripts/status.ts

Prints unpushed commit count, oldest unpushed age, last pipeline run, open
roadmap items, and the package version against the latest tag.

  --help   Show this message.
`;

handleHelp(process.argv, USAGE);
const unknown = process.argv.slice(2);
if (unknown.length > 0) {
  console.error(`Unknown flag: ${unknown[0]}`);
  console.error(USAGE);
  process.exit(1);
}

const ROOT = join(import.meta.dirname, "..");

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function safe(label: string, fn: () => string): string {
  try {
    return fn();
  } catch {
    // Informational only: a missing remote or unreadable file must not turn
    // the status report into a failing gate.
    return `unavailable (${label})`;
  }
}

function humanAge(epochSeconds: number): string {
  const hours = (Date.now() / 1000 - epochSeconds) / 3600;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

const upstream = safe("upstream", () => git(["rev-parse", "--abbrev-ref", "@{u}"]));
const unpushed = safe("unpushed", () => git(["rev-list", "--count", "@{u}..HEAD"]));
const oldest = safe("oldest unpushed", () => {
  const line = git(["log", "--reverse", "--format=%ct", "@{u}..HEAD"]).split("\n")[0];
  return line ? humanAge(Number(line)) : "none";
});
const lastPipeline = safe("last pipeline run", () => {
  const line = git(["log", "-1", "--format=%cs", "--grep=^Push pipeline "]);
  return line || "never";
});
const version = safe("package version", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    version: string;
  };
  return pkg.version;
});
const latestTag = safe("latest tag", () => git(["describe", "--tags", "--abbrev=0"]) || "none");
const roadmapItems = safe("roadmap", () => {
  const path = join(ROOT, "ROADMAP.md");
  if (!existsSync(path)) return "0";
  const body = readFileSync(path, "utf8");
  const sections = body.match(/^## .+$/gm) ?? [];
  return String(sections.filter((line) => line !== "## Non-goals").length);
});

console.log("Release status");
console.log(`  upstream:          ${upstream}`);
console.log(`  unpushed commits:  ${unpushed}`);
console.log(`  oldest unpushed:   ${oldest}`);
console.log(`  last pipeline run: ${lastPipeline}`);
console.log(`  version:           ${version} (latest tag ${latestTag})`);
console.log(`  open roadmap:      ${roadmapItems} item(s)`);

if (unpushed !== "unavailable (unpushed)" && Number(unpushed) > 0) {
  console.log("");
  console.log("  Run `npm run prep`, review and commit, then `npm run release`.");
}
