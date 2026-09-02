// version.ts — shared version helpers: today's CalVer date, semver
// normalization, and root-package read.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const __dirname = import.meta.dirname;
export const ROOT = join(__dirname, "..", "..");

export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${dd}`;
}

// package.json uses a calendar-date spelling ("2026.08.23"); server.json follows
// semver (leading zeros disallowed). normalizeSemver derives the semver form by
// stripping leading zeros from each numeric segment. Idempotent.
export function normalizeSemver(v: string): string {
  return v.split(".").map((seg) => String(Number(seg))).join(".");
}

export function readRootPackage(): { version: string } {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
}
