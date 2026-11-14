// Evidence probe for the register-reconciliation increment.
// Read-only measurement of the clause-tag binding rule (D5): how many
// (REQ, slug) pairs bind to a test title, and what the unbound ones look like.
// Run: npx tsx docs/plans/2026-11-14-register-reconciliation/evidence/bind-rate.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { bindClauseTags } from "../../../../src/clause-coverage.js";

const ROOT = join(import.meta.dirname, "../../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

let pairs = 0;
let bound = 0;
const unbound: Array<{ file: string; line: number; req: string; slug: string; scope: string; title: string }> = [];
for (const file of walk(join(ROOT, "src"))) {
  const text = readFileSync(file, "utf-8");
  for (const tag of bindClauseTags(text)) {
    pairs++;
    if (tag.bound) bound++;
    else unbound.push({ file: relative(ROOT, file), line: tag.line, req: tag.req, slug: tag.slug, scope: tag.scope, title: tag.title.slice(0, 60) });
  }
}

console.log(`pairs: ${pairs}, bound: ${bound}, unbound: ${unbound.length}`);
console.log(`unbound rate: ${((unbound.length / pairs) * 100).toFixed(1)}%`);
for (const u of unbound) console.log(`${u.file}:${u.line} ${u.req} ${u.slug} [${u.scope}] "${u.title}"`);
void statSync;
