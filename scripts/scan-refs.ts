#!/usr/bin/env npx tsx
// scan-refs.ts — informational scan: documentation reference hygiene.
//
// Role: informational (reports findings, always exits 0). Run by the push
// pipeline's scan step, replacing the hand-run checks for orphaned reference
// files and broken documented paths.
//
// Detects:
//   1. Orphaned reference files — a `skills/*/references/*.md` not named by
//      any other tracked Markdown file.
//   2. Broken documented paths — a `references/<name>.md` mentioned in a
//      tracked Markdown file whose target does not exist.
//
// Exit codes: 0 always (findings are reported, not enforced); 2 on a fatal
// unexpected error.
//
// Usage: npx tsx scripts/scan-refs.ts [--out <path>]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { handleHelp } from "./lib/args.js";

const USAGE = `scan-refs — documentation reference hygiene scan

Usage: npx tsx scripts/scan-refs.ts [--out <path>]

  --out <path>  Write the machine-parseable summary JSON here.
  --help, -h    Show this message.

Exit: 0 always (informational); findings are reported, not enforced.
`;

interface Finding {
  kind: "orphaned-reference" | "broken-doc-path";
  file: string;
  detail: string;
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  let out = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = argv[++i] ?? "";
    else {
      process.stderr.write(`scan-refs: unknown flag ${argv[i]}\n`);
      return 2;
    }
  }

  const root = join(import.meta.dirname, "..");
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const contents = new Map<string, string>();
  for (const f of mdFiles) {
    try {
      contents.set(f, readFileSync(join(root, f), "utf8"));
    } catch {
      // unreadable tracked file — skip it rather than fail the scan
    }
  }

  const refFiles = files.filter((f) => /^skills\/[^/]+\/references\/[^/]+\.md$/.test(f));
  const refBasenames = new Set(refFiles.map((f) => basename(f)));
  const findings: Finding[] = [];

  // 1. Orphaned reference files.
  for (const ref of refFiles) {
    const name = basename(ref);
    const referenced = [...contents.entries()].some(
      ([f, text]) => f !== ref && text.includes(name)
    );
    if (!referenced) {
      findings.push({ kind: "orphaned-reference", file: ref, detail: `no tracked Markdown file references "${name}"` });
    }
  }

  // 2. Broken documented `references/<name>.md` paths.
  const pathRe = /references\/[A-Za-z0-9._-]+\.md/g;
  for (const [f, text] of contents) {
    for (const m of text.matchAll(pathRe)) {
      const token = m[0];
      const bn = token.split("/").pop() ?? "";
      if (refBasenames.has(bn) || existsSync(join(root, token))) continue;
      findings.push({ kind: "broken-doc-path", file: f, detail: `${token} does not exist` });
    }
  }

  for (const fd of findings) process.stdout.write(`${fd.kind}: ${fd.file} — ${fd.detail}\n`);
  process.stdout.write(`scan-refs: ${findings.length} finding(s)\n`);

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
