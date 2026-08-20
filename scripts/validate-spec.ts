import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

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
const reqPattern = /\*\*REQ-(\d{3}[a-z]?)\b[^*]*\*\*/g;
const allReqs = new Set<string>();
let match: RegExpExecArray | null;
while ((match = reqPattern.exec(specText)) !== null) {
  allReqs.add(`REQ-${match[1]}`);
}

// Client-artifact REQs verified by file presence, not source citations
const artifactReqs = new Set(["REQ-050", "REQ-051", "REQ-052", "REQ-053", "REQ-054"]);

// Meta-REQs that describe the spec process itself
const metaReqs = new Set(["REQ-055", "REQ-077"]);

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
      const citeMatch = text.match(/\/\/\s*@implements\s+((?:REQ-\d{3}[a-z]?\s*)+)/);
      if (!citeMatch) {
        filesWithoutCitation.push(rel);
      } else {
        const cited = citeMatch[1].match(/REQ-\d{3}[a-z]?/g) || [];
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

// Split on REQ headers, capturing each REQ ID alongside its body.
const reqBodyRe = /\*\*REQ-(\d{3}[a-z]?)\b[^*]*\*\*\n?/g;
const reqBodies: { id: string; body: string }[] = [];
{
  let m: RegExpExecArray | null;
  let lastEnd = 0;
  while ((m = reqBodyRe.exec(body)) !== null) {
    if (reqBodies.length > 0) {
      reqBodies[reqBodies.length - 1].body = body.slice(lastEnd, m.index);
    }
    reqBodies.push({ id: `REQ-${m[1]}`, body: "" });
    lastEnd = m.index + m[0].length;
  }
  if (reqBodies.length > 0) {
    reqBodies[reqBodies.length - 1].body = body.slice(lastEnd);
  }
}

function bodyOf(i: number): string {
  return reqBodies[i].body;
}
function tagOf(i: number): string {
  return reqBodies[i].id;
}

// Exempt from the backtick-token limit: tool-signature REQs (declare a
// parameter contract) and the output/error contract REQs (§4.1), which
// enumerate the response envelope or error taxonomy by design.
const outputContractReqs = new Set(["REQ-001", "REQ-002"]);
function tokenExempt(id: string, bodyText: string): boolean {
  if (bodyText.includes("Parameters:")) return true;
  if (outputContractReqs.has(id)) return true;
  return false;
}

// a) parameter type annotations
const typePattern = /\bz\.(string|number|boolean|enum|array|object)\(\)|:\s*(string|number|boolean)\b/g;
for (let i = 0; i < reqBodies.length; i++) {
  if (typePattern.test(bodyOf(i))) {
    warn(`${tagOf(i)}: REQ body contains parameter type annotation — violates SR-011(a)`);
  }
}

// b) "Default:" clauses — only flag standalone clauses, not inline parameter descriptions
for (let i = 0; i < reqBodies.length; i++) {
  // Match "Default:" at start of line or after a sentence break, indicating a standalone clause
  if (/(?:^|\.\s+)Default:\s/i.test(bodyOf(i)) || /\bDefault:\s+\d/.test(bodyOf(i))) {
    warn(`${tagOf(i)}: REQ body contains standalone "Default:" clause — violates SR-011(d)`);
  }
}

// c) enumerated catalogues (>5 backtick tokens), with tool-signature exemption
for (let i = 0; i < reqBodies.length; i++) {
  if (tokenExempt(tagOf(i), bodyOf(i))) continue;
  const tokens = bodyOf(i).match(/`[^`]+`/g) || [];
  if (tokens.length > 5) {
    error(`${tagOf(i)}: REQ body enumerates ${tokens.length} backtick-delimited tokens (>5) — violates Appendix B mechanical limits`);
  }
}

function reqNum(i: number): number {
  return i + 1;
}

// d) duplicate lifecycle descriptions
const lifecyclePattern = /(?:survive[sd]?\s+(?:restart|process\s+restart|connection|cross-connection)|persist[sd]?\s+(?:across|through|between)\s+(?:restart|session))/gi;
const lifecycleReqs: string[] = [];
for (let i = 0; i < reqBodies.length; i++) {
  if (lifecyclePattern.test(bodyOf(i))) {
    lifecycleReqs.push(tagOf(i));
    lifecyclePattern.lastIndex = 0;
  }
}
if (lifecycleReqs.length > 2) {
  warn(`Duplicate lifecycle descriptions across REQs: ${lifecycleReqs.join(", ")} — violates SR-011(c)`);
}

// e) mechanical limits (gate-blocking errors)
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

for (let i = 0; i < reqBodies.length; i++) {
  const reqTag = tagOf(i);
  const bodyText = bodyOf(i).trim();
  const checkTailIdx = bodyText.indexOf("_Check:");
  const prose = (checkTailIdx >= 0 ? bodyText.slice(0, checkTailIdx) : bodyText).trim();

  if (prose.length > 800) {
    error(`${reqTag}: REQ body is ${prose.length} characters (>800) — violates Appendix B mechanical limit`);
  }

  const sentences = splitSentences(prose);
  if (sentences.length > 8) {
    error(`${reqTag}: REQ body has ${sentences.length} sentences (>8) — violates Appendix B mechanical limit`);
  }

  const shallCount = (prose.match(/\bSHALL\b/g) || []).length;
  if (shallCount > 8) {
    error(`${reqTag}: REQ body has ${shallCount} SHALL clauses (>8) — violates Appendix B mechanical limit`);
  }

  // More than one paragraph = blank line within the prose
  if (/\n\s*\n/.test(prose)) {
    error(`${reqTag}: REQ body spans more than one paragraph — violates Appendix B mechanical limit`);
  }

  // Tables, bullets, numbered steps within the single prose block
  const proseLines = prose.split("\n");
  for (const line of proseLines) {
    if (/^\s*\|/.test(line)) {
      error(`${reqTag}: REQ body contains a markdown table — violates Appendix B mechanical limit`);
    }
    if (/^\s*[-*]\s+/.test(line)) {
      error(`${reqTag}: REQ body contains a bullet list — violates Appendix B mechanical limit`);
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      error(`${reqTag}: REQ body contains a numbered list — violates Appendix B mechanical limit`);
    }
  }

  // Missing _Check: citation
  if (!/_Check:/i.test(bodyText) && !/\*Check:/i.test(bodyText)) {
    error(`${reqTag}: REQ body missing _Check: gate citation`);
  }
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

// --- Spec hash staleness check ---

function checkSpecHashStale(): void {
  const decisionsPath = join(ROOT, "DECISIONS.md");
  if (!existsSync(decisionsPath)) return;

  const decisions = readFileSync(decisionsPath, "utf-8");
  const storedHash = decisions.match(/\*\*Spec hash:\*\*\s*`([a-f0-9]+)`/)?.[1];
  if (!storedHash) {
    warn("Spec hash missing from DECISIONS.md — run 'npm run hash'");
    return;
  }

  const specPath = join(ROOT, "infobroker.md");
  if (!existsSync(specPath)) return;

  const currentHash = createHash("sha256").update(readFileSync(specPath)).digest("hex");
  if (currentHash !== storedHash) {
    warn(`Spec hash is stale (stored: ${storedHash.slice(0, 8)}..., current: ${currentHash.slice(0, 8)}...) — run 'npm run hash'`);
  }
}

checkSpecHashStale();

// --- REQ manifest verification ---

function checkManifest(): void {
  const manifestIdx = specText.indexOf("## 9.5 REQ Manifest");
  if (manifestIdx === -1) {
    error("REQ manifest (§9.5) not found");
    return;
  }
  const nextHeading = specText.slice(manifestIdx + 1).search(/^##\s/m);
  const manifestSection = nextHeading === -1
    ? specText.slice(manifestIdx)
    : specText.slice(manifestIdx, manifestIdx + 1 + nextHeading);

  const manifestReqs = new Set<string>();
  const rowRe = /^\|\s*(REQ-\d{3}[a-z]?)\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(manifestSection)) !== null) {
    manifestReqs.add(m[1]);
  }

  for (const req of allReqs) {
    if (!manifestReqs.has(req)) {
      error(`${req}: in §4 body but missing from REQ manifest (§9.5)`);
    }
  }
  for (const req of manifestReqs) {
    if (!allReqs.has(req)) {
      error(`${req}: in REQ manifest (§9.5) but missing from §4 body`);
    }
  }
}

checkManifest();

// --- Client artifact content verification ---

function checkArtifactContent(): void {
  const prefPath = join(ROOT, "instructions", "search-preferences.md");
  const skillPath = join(ROOT, "skills", "infobroker", "SKILL.md");

  if (existsSync(prefPath)) {
    const content = readFileSync(prefPath, "utf-8");
    if (!/\bkb_search\b/.test(content)) {
      warn("instructions/search-preferences.md: missing kb_search routing instruction");
    }
  }

  if (existsSync(skillPath)) {
    const content = readFileSync(skillPath, "utf-8");
    if (!/(?:RECALL|knowledge base search)/i.test(content)) {
      warn("skills/infobroker/SKILL.md: missing knowledge base search phase in pipelines");
    }
  }
}

checkArtifactContent();

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
