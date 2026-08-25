import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { detectClauseRequirements, clauseTagsFromPayload, evaluateClauseCoverage } from "../src/clause-coverage.js";
import { writeProviderAuth, readConfig } from "./lib/provider-auth.js";

// @implements REQ-055

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPEC = join(ROOT, "infobroker.md");
const SRC = join(ROOT, "src");

// Derive registered tool slugs (sans `infobroker_` prefix) from the live
// registration calls in src/index.ts — the spec §D must document every
// registered tool, so the tool list is never hardcoded here.
function deriveToolSlugs(): string[] {
  const indexPath = join(SRC, "index.ts");
  if (!existsSync(indexPath)) return [];
  const text = readFileSync(indexPath, "utf-8");
  const slugs = new Set<string>();
  const re = /registerTool\(\s*"infobroker_([a-z0-9_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    slugs.add(m[1]);
  }
  return [...slugs].sort();
}

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
const metaReqs = new Set(["REQ-055", "REQ-077", "REQ-078", "REQ-080"]);

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

// --- REQ ID format check ---

// A REQ token in §4 whose numeric part is not exactly three digits
// (e.g. `REQ-0731`, `REQ-09`) is invisible to the canonical parser and
// indicates a malformed or truncated identifier. Flag every occurrence.
{
  const malformedRe = /\bREQ-(\d+)([a-z]+)?\b/g;
  let mm: RegExpExecArray | null;
  while ((mm = malformedRe.exec(body)) !== null) {
    if (mm[1].length !== 3) {
      error(`Malformed REQ ID "REQ-${mm[1]}${mm[2] ?? ""}" — REQ numbers must be exactly three digits`);
    }
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

  if (prose.length === 0) {
    error(`${reqTag}: REQ body is empty — violates Appendix B mechanical limit`);
  }

  if (prose.length > 0 && /^[a-z]/.test(prose)) {
    error(`${reqTag}: REQ body begins with a lowercase letter — likely a truncated lead clause`);
  }

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

// --- Clause-coverage gate (normative multi-branch definitions) ---
//
// A REQ whose body defines a status/outcome with "or"-joined branches, or a
// "when...declares" conditional, shipped in the past with only one branch
// implemented or the condition never triggered (REQ-013's degraded "or"
// definition; REQ-003's "when ... declares ... aggregated or resold"). The
// bare `@implements REQ-NNN` citation satisfied the whole REQ while a branch
// was dead. This gate requires such REQs to carry a named clause tag per
// branch in a test file (`// @implements REQ-NNN <branch-slug>`), so each
// branch must be consciously declared and tested before the change can pass.

// Collect clause tags from test files (recursively under src/): `REQ-NNN
// <slug>` pairs beyond the bare REQ ID.
const clauseTagsByReq = new Map<string, Set<string>>();
{
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".test.ts")) {
        const text = readFileSync(full, "utf-8");
        const re = /@implements\s+(.+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          for (const [req, tags] of clauseTagsFromPayload(m[1])) {
            if (!clauseTagsByReq.has(req)) clauseTagsByReq.set(req, new Set());
            for (const t of tags) clauseTagsByReq.get(req)!.add(t);
          }
        }
      }
    }
  };
  walk(join(ROOT, "src"));
}

for (const rb of reqBodies) {
  if (artifactReqs.has(rb.id) || metaReqs.has(rb.id)) continue;
  const prose = rb.body.trim();
  if (prose.length === 0) continue;

  const req = detectClauseRequirements(prose);
  const taggedCount = clauseTagsByReq.get(rb.id)?.size ?? 0;
  const violation = evaluateClauseCoverage(rb.id, req, taggedCount);

  if (violation?.kind === "or-branches") {
    error(
      `${rb.id}: defines "or"-joined normative branches but tests tag fewer than 2 clause tags (found: ${[...(clauseTagsByReq.get(rb.id) ?? [])].join(", ") || "none"}) — add an inline clause tag per branch, e.g. \`// @implements ${rb.id} <branch-slug>\``
    );
  } else if (violation?.kind === "conditional") {
    error(
      `${rb.id}: contains a "when ... declares" conditional but no test tags a clause for it (found: none) — add an inline clause tag exercising the conditional, e.g. \`// @implements ${rb.id} <branch-slug>\``
    );
  }
}

// --- Generated auth reference staleness check ---


function checkGeneratedAuthStale(): void {
  const authPath = join(ROOT, "skills", "infobroker", "references", "provider-auth.md");
  if (!existsSync(authPath)) {
    error(`Generated auth reference missing: ${authPath} — run 'npm run generate-auth'`);
    return;
  }
  // Regenerate in-process (no subprocess spawn), then diff against the committed
  // file to detect drift.
  writeProviderAuth(readConfig());
  try {
    execSync(`git diff --exit-code -- "${authPath}"`, { cwd: ROOT, stdio: "pipe" });
  } catch {
    error(`Generated auth reference is stale — run 'npm run generate-auth' and commit the result`);
  }
}

checkGeneratedAuthStale();

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

// --- Feature taxonomy exhaustive coverage check ---

function checkFeatureTaxonomy(): void {
  const taxIdx = specText.indexOf("## §D Appendix: Feature Taxonomy");
  if (taxIdx === -1) {
    error("Feature taxonomy appendix (§D) not found");
    return;
  }
  const appendix = specText.slice(taxIdx);

  const toolSlugs = deriveToolSlugs();
  for (const tool of toolSlugs) {
    if (!new RegExp(`\`${tool}\``).test(appendix)) {
      error(`Feature taxonomy (§D) is missing tool \`${tool}\``);
    }
  }

  for (const req of allReqs) {
    if (!new RegExp(`\\b${req}\\b`).test(appendix)) {
      error(`Feature taxonomy (§D) is missing ${req}`);
    }
  }
}

checkFeatureTaxonomy();

// --- Client artifact content verification ---

function checkArtifactContent(): void {
  const prefPath = join(ROOT, "instructions", "search-preferences.md");
  const skillPath = join(ROOT, "skills", "infobroker", "SKILL.md");

  if (existsSync(prefPath)) {
    const content = readFileSync(prefPath, "utf-8");
    if (!/\bkb\b|\bknowledge base\b/i.test(content)) {
      warn("instructions/search-preferences.md: missing knowledge base routing instruction");
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

// --- Tool default consistency (REQ-080) ---

// A) No divergent numeric fallback on a config lookup: REQ-080 requires that a
// value the configuration supplies is read from the configuration without a
// substitute literal in source.
const toolLayerFiles = ["index.ts", "corroborate.ts", "config.ts", "kb.ts"];
for (const f of toolLayerFiles) {
  const filePath = join(SRC, f);
  if (!existsSync(filePath)) continue;
  const text = readFileSync(filePath, "utf-8");
  const re = /config\.[A-Za-z0-9_.()]+\s*\?\?\s*[0-9]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    error(`${f}: numeric fallback on a config lookup (${m[0].trim()}) — violates REQ-080`);
  }
}

// B) The max_results default declared in the spec SHALL match the zod schema
// default for web_search and kb (REQ-020, REQ-060a).
const indexText = readFileSync(join(SRC, "index.ts"), "utf-8");
function schemaDefault(slug: string, param: string, max: number): string | undefined {
  const toolRe = new RegExp(`registerTool\\(\\s*"infobroker_${slug}"[\\s\\S]*?${param}:\\s*z\\.number\\(\\)\\.min\\(1\\)\\.max\\(${max}\\)\\.optional\\(\\)\\.default\\((\\d+)\\)`);
  return toolRe.exec(indexText)?.[1];
}
function requireDefault(re: RegExp, label: string, schema: string | undefined): void {
  const declared = re.exec(specText)?.[1];
  if (declared === undefined) {
    warn(`${label}: no default declared in spec`);
    return;
  }
  if (schema === undefined) {
    error(`${label}: schema default not found — REQ-080 check unable to reconcile`);
    return;
  }
  if (schema !== declared) {
    error(`${label}: schema default ${schema} diverges from spec-declared default ${declared} — violates REQ-080`);
  }
}
requireDefault(/`max_results`\s+\(default\s+(\d+)\s*,/ , "REQ-020 web_search max_results", schemaDefault("web_search", "max_results", 30));
requireDefault(/maximum-results count\s+\(default\s+(\d+)\s*,/, "REQ-060a kb max_results", schemaDefault("kb", "max_results", 50));

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
