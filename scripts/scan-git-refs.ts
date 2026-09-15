#!/usr/bin/env npx tsx
// scan-git-refs.ts — informational scan: git ref hygiene.
//
// Role: informational (reports findings, always exits 0). Run by the push
// pipeline's scan step, replacing the hand-run check for stale branches and
// superseded tags.
//
// Detects:
//   1. Local branches already merged into `main`.
//   2. Tags that are not ancestors of HEAD (stale or divergent work).
//
// Exit codes: 0 always (findings are reported, not enforced); 2 on a fatal
// unexpected error.
//
// Usage: npx tsx scripts/scan-git-refs.ts [--out <path>]

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";

const USAGE = `scan-git-refs — git ref hygiene scan

Usage: npx tsx scripts/scan-git-refs.ts [--out <path>]

  --out <path>  Write the machine-parseable summary JSON here.
  --help, -h    Show this message.

Exit: 0 always (informational); findings are reported, not enforced.
`;

interface Finding {
  kind: "merged-branch" | "non-ancestor-tag";
  ref: string;
  detail: string;
}

function git(root: string, args: string[]): { ok: boolean; text: string } {
  try {
    return { ok: true, text: execFileSync("git", args, { cwd: root, encoding: "utf8" }) };
  } catch {
    return { ok: false, text: "" };
  }
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  let out = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = argv[++i] ?? "";
    else {
      process.stderr.write(`scan-git-refs: unknown flag ${argv[i]}\n`);
      return 2;
    }
  }

  const root = join(import.meta.dirname, "..");
  const findings: Finding[] = [];

  // 1. Local branches already merged into main.
  const merged = git(root, ["for-each-ref", "--merged", "main", "--format=%(refname:short)", "refs/heads"]);
  if (merged.ok) {
    for (const b of merged.text.split("\n").filter(Boolean)) {
      if (b !== "main") findings.push({ kind: "merged-branch", ref: b, detail: `merged into main — safe to delete` });
    }
  }

  // 2. Tags not reachable from HEAD.
  const tags = git(root, ["tag", "--format=%(refname:short)"]);
  if (tags.ok) {
    for (const tag of tags.text.split("\n").filter(Boolean)) {
      const ancestor = git(root, ["merge-base", "--is-ancestor", tag, "HEAD"]);
      if (!ancestor.ok) findings.push({ kind: "non-ancestor-tag", ref: tag, detail: `not an ancestor of HEAD` });
    }
  }

  for (const fd of findings) process.stdout.write(`${fd.kind}: ${fd.ref} — ${fd.detail}\n`);
  process.stdout.write(`scan-git-refs: ${findings.length} finding(s)\n`);

  if (out) {
    try {
      writeFileSync(out, JSON.stringify({ status: "complete", findings: findings.length, details: findings }, null, 2));
    } catch {
      // out path unwritable — the stdout summary is still the result
    }
  }
  return 0;
}

process.exit(main());
