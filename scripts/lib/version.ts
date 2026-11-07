// version.ts — shared version helpers: today's CalVer date and root-package
// read.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const __dirname = import.meta.dirname;
export const ROOT = join(__dirname, "..", "..");

// CalVer is a calendar date. SemVer 2.0.0 forbids leading zeros in numeric
// identifiers, so the date is spelled without padding: 2026.11.7. The clock is
// injectable so tests can pin the format.
export function today(now: Date = new Date()): string {
  return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;
}

export function readRootPackage(): { version: string } {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
}
