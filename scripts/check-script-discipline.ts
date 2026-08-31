#!/usr/bin/env npx tsx
// check-script-discipline.ts — gate: enforce script-discipline conventions across
// `scripts/` (shebang + header, exit-code contract, `import.meta.dirname`, no
// empty catch). Wired into `npm run check`.
//
// Exit codes: 0 = all scripts conform; 1 = violations found.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS_DIR = import.meta.dirname;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".opencode"]);

// Forbidden path-resolution patterns, assembled from fragments so this gate
// does not flag its own detector strings.
const FORBIDDEN = ["fileURLTo" + "Path", "new URL(" + "import.meta.url)"];

interface Violation {
  file: string;
  line: number;
  message: string;
}

const violations: Violation[] = [];

function collect(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP_DIRS.has(entry)) continue;
    const st = statSync(full);
    if (st.isDirectory()) collect(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
  }
}

const files: string[] = [];
collect(SCRIPTS_DIR, files);

for (const file of files) {
  const rel = file.slice(SCRIPTS_DIR.length + 1);
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  const isLib = rel.startsWith("lib/");

  if (!isLib && !content.startsWith("#!")) {
    violations.push({ file: rel, line: 1, message: "missing shebang `#!/usr/bin/env npx tsx`" });
  }

  let firstReal = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "" || t.startsWith("#!")) continue;
    firstReal = i + 1;
    break;
  }
  if (firstReal === -1) {
    violations.push({ file: rel, line: 1, message: "empty file" });
  } else if (!/^(\/\/|\/\*|\/\*\*)/.test(lines[firstReal - 1].trim())) {
    violations.push({ file: rel, line: firstReal, message: "first real line is not a header comment" });
  }

  for (const pattern of FORBIDDEN) {
    const idx = content.indexOf(pattern);
    if (idx !== -1) {
      const lineNo = content.slice(0, idx).split("\n").length;
      violations.push({ file: rel, line: lineNo, message: `uses \`${pattern}\` — use \`import.meta.dirname\` instead` });
    }
  }

  const emptyCatchRe = /catch\s*\{\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = emptyCatchRe.exec(content)) !== null) {
    const lineNo = content.slice(0, m.index).split("\n").length;
    violations.push({ file: rel, line: lineNo, message: "empty catch block without a comment explaining why the error is safely ignored" });
  }

  const exitRe = /process\.exit\(\s*(\d+)\s*\)/g;
  while ((m = exitRe.exec(content)) !== null) {
    const code = Number(m[1]);
    if (code !== 0 && code !== 1 && code !== 2) {
      const lineNo = content.slice(0, m.index).split("\n").length;
      violations.push({ file: rel, line: lineNo, message: `process.exit(${code}) — exit codes must be 0 (pass), 1 (failure), or 2 (fatal)` });
    }
  }
}

if (violations.length > 0) {
  console.log(`\ncheck-script-discipline — ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}: ${v.message}`);
  }
  console.log("");
  process.exit(1);
}

console.log(`\ncheck-script-discipline — ${files.length} script(s) conform.\n`);
