import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// @implements REQ-055

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPEC = join(ROOT, "infobroker.md");
const SRC = join(ROOT, "src");

interface Violation {
  severity: "error" | "warning";
  message: string;
}

const violations: Violation[] = [];

function error(msg: string): void {
  violations.push({ severity: "error", message: msg });
}

function warn(msg: string): void {
  violations.push({ severity: "warning", message: msg });
}

// --- Parse spec for all REQ-NNN in §4 ---

const specText = readFileSync(SPEC, "utf-8");
const reqPattern = /\*\*REQ-(\d{3})\b[^*]*\*\*/g;
const allReqs = new Set<string>();
let match: RegExpExecArray | null;
while ((match = reqPattern.exec(specText)) !== null) {
  allReqs.add(`REQ-${match[1]}`);
}

// Client-artifact REQs verified by file presence, not source citations
const artifactReqs = new Set(["REQ-050", "REQ-051", "REQ-052", "REQ-053", "REQ-054"]);

// Meta-REQs that describe the spec process itself
const metaReqs = new Set(["REQ-055"]);

// --- Collect @implements citations from source files ---

const reqCitedBy = new Map<string, string[]>();
const filesWithoutCitation: string[] = [];

function scanDir(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (entry.name.endsWith(".ts")) {
      const text = readFileSync(full, "utf-8");
      const rel = full.replace(ROOT + "/", "");
      const citeMatch = text.match(/\/\/\s*@implements\s+((?:REQ-\d{3}\s*)+)/);
      if (!citeMatch) {
        filesWithoutCitation.push(rel);
      } else {
        const cited = citeMatch[1].match(/REQ-\d{3}/g) || [];
        for (const r of cited) {
          if (!reqCitedBy.has(r)) reqCitedBy.set(r, []);
          reqCitedBy.get(r)!.push(rel);
        }
      }
    }
  }
}

scanDir(SRC);

// --- Cross-reference ---

for (const req of allReqs) {
  if (artifactReqs.has(req) || metaReqs.has(req)) continue;
  if (!reqCitedBy.has(req)) {
    warn(`REQ ${req}: no @implements citation found in any source file`);
  }
}

for (const f of filesWithoutCitation) {
  error(`${f}: no @implements header comment`);
}

// --- REQ body hygiene ---

// Extract REQ bodies from §4 section (between "## §4 Requirements" and "## §5")
const s4Start = specText.indexOf("## §4 Requirements");
const s5Start = specText.indexOf("## §5 Build Process");
const body = specText.slice(s4Start >= 0 ? s4Start : 0, s5Start >= 0 ? s5Start : specText.length);

const reqBodies = body.split(/\*\*REQ-\d{3}\b[^*]*\*\*/).slice(1);

function reqNumFromIndex(i: number): number {
  return i + 1;
}

function findReq(all: Set<string>, bodyIndex: number): string | undefined {
  const n = bodyIndex + 1;
  for (const r of all) {
    const rn = parseInt(r.slice(4));
    if (rn >= n - 5 && rn <= n + 5) return r;
  }
  return undefined;
}

// a) parameter type annotations
const typePattern = /\bz\.(string|number|boolean|enum|array|object)\(\)|:\s*(string|number|boolean)\b/g;
for (let i = 0; i < reqBodies.length; i++) {
  const reqTag = findReq(allReqs, i) || `REQ-${String(i + 1).padStart(3, "0")}`;
  if (typePattern.test(reqBodies[i])) {
    warn(`${reqTag}: REQ body contains parameter type annotation — violates SR-011(a)`);
  }
}

// b) "Default:" clauses — only flag standalone clauses, not inline parameter descriptions
for (let i = 0; i < reqBodies.length; i++) {
  const actualReq = findReq(allReqs, i);
  const reqTag = actualReq || `REQ-${String(i + 1).padStart(3, "0")}`;
  // Match "Default:" at start of line or after a sentence break, indicating a standalone clause
  if (/(?:^|\.\s+)Default:\s/i.test(reqBodies[i]) || /\bDefault:\s+\d/.test(reqBodies[i])) {
    warn(`${reqTag}: REQ body contains standalone "Default:" clause — violates SR-011(d)`);
  }
}

// c) enumerated catalogues (>5 items)
const cataloguePattern = /`([^`]+(?:,\s*[^`]+){5,})`/g;
for (let i = 0; i < reqBodies.length; i++) {
  const reqTag = findReq(allReqs, i) || `REQ-${String(i + 1).padStart(3, "0")}`;
  if (cataloguePattern.test(reqBodies[i])) {
    warn(`${reqTag}: REQ body may contain enumerated catalogue (>5 items) — violates SR-011`);
  }
}

function reqNum(i: number): number {
  return i + 1;
}

// d) duplicate lifecycle descriptions
const lifecyclePattern = /(?:survive[sd]?\s+(?:restart|process\s+restart|connection|cross-connection)|persist[sd]?\s+(?:across|through|between)\s+(?:restart|session))/gi;
const lifecycleReqs: string[] = [];
for (let i = 0; i < reqBodies.length; i++) {
  if (lifecyclePattern.test(reqBodies[i])) {
    const reqTag = findReq(allReqs, i) || `REQ-${String(i + 1).padStart(3, "0")}`;
    lifecycleReqs.push(reqTag);
    lifecyclePattern.lastIndex = 0;
  }
}
if (lifecycleReqs.length > 2) {
  warn(`Duplicate lifecycle descriptions across REQs: ${lifecycleReqs.join(", ")} — violates SR-011(c)`);
}

// --- Generated auth reference staleness check ---

import { execSync } from "node:child_process";

function checkGeneratedAuthStale(): void {
  const authPath = join(ROOT, "skills", "infobroker", "references", "provider-auth.md");
  if (!existsSync(authPath)) {
    error(`Generated auth reference missing: ${authPath} — run 'npm run generate-auth'`);
    return;
  }
  try {
    execSync("npx tsx scripts/generate-provider-auth.ts", { cwd: ROOT, stdio: "pipe" });
  } catch {
    error("Auth reference generation script failed");
    return;
  }
  // git diff --exit-code detects if the generated file changed
  try {
    execSync(`git diff --exit-code -- "${authPath}"`, { cwd: ROOT, stdio: "pipe" });
  } catch {
    error(`Generated auth reference is stale — run 'npm run generate-auth' and commit the result`);
  }
}

checkGeneratedAuthStale();

// --- Report ---

console.log(`\nvalidate-spec — Infobroker spec-code traceability\n`);
console.log(`${allReqs.size} REQs in spec (${artifactReqs.size} artifact-exempt)`);
console.log(`${reqCitedBy.size} REQs cited in source files`);
console.log(`${filesWithoutCitation.length} source file(s) without @implements`);

const errors = violations.filter((v) => v.severity === "error");
const warnings = violations.filter((v) => v.severity === "warning");

if (errors.length > 0) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  ERROR: ${e.message}`);
}

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  WARNING: ${w.message}`);
}

if (errors.length === 0 && warnings.length === 0) {
  console.log("\nAll checks passed.");
}

process.exit(errors.length > 0 ? 1 : 0);
