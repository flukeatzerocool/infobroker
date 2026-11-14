#!/usr/bin/env npx tsx
// validate-spec.ts — gate: spec-code traceability, REQ-body hygiene, manifest
// and taxonomy reconciliation, and per-shape skill pipeline tails. Wired into
// `npm run check` (G3).
//
// A REQ with no `@implements` citation is an error unless it is recorded in
// the `## Spec Waivers` section of DECISIONS.md (intentionally unimplemented).
//
// Exit codes: 0 = all checks pass; 1 = errors found.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { detectClauseRequirements, clauseTagsFromPayload, evaluateClauseCoverage, bindClauseTags } from "../src/clause-coverage.js";
import { checkFeatureTaxonomyCoverage } from "../src/lib/feature-taxonomy.js";
import { writeProviderAuth, readConfig } from "./lib/provider-auth.js";
import { writeProviderMap, readConfig as readMapConfig, PROVIDER_EXCLUSIONS } from "./lib/provider-map.js";
import { writeProviderPrivacy, readPrivacyConfig } from "./lib/provider-privacy.js";
import { GATES } from "./lib/gate-manifest.js";
import { checkSecurityModel } from "./lib/security-model.js";
import { reconcile } from "./lib/tool-defaults.js";

// @implements REQ-055

const __dirname = import.meta.dirname;
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
  const re = /(?:server\.registerTool|instrumentTool)\(\s*"infobroker_([a-z0-9_]+)"/g;
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

// Client- and distribution-artifact REQs verified by file presence (skills,
// docs, server.json, build wiring), not by src/ source citations.
const artifactReqs = new Set(["REQ-050", "REQ-051", "REQ-052", "REQ-053", "REQ-054", "REQ-088", "REQ-091", "REQ-101", "REQ-114", "REQ-115", "REQ-116", "REQ-117", "REQ-118", "REQ-119", "REQ-120"]);

// Meta-REQs that describe the spec process itself
const metaReqs = new Set(["REQ-055", "REQ-077", "REQ-078", "REQ-080", "REQ-096"]);

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

// --- Recorded spec waivers (DECISIONS.md `## Spec Waivers` section) ---
//
// A REQ listed in the waiver section is intentionally unimplemented and is
// accepted for traceability without an @implements citation. Any uncited REQ
// not listed here is an error (spec-code drift).

const waivedReqs = new Set<string>();
{
  const decisionsPath = join(ROOT, "DECISIONS.md");
  if (existsSync(decisionsPath)) {
    const decisions = readFileSync(decisionsPath, "utf-8");
    // Anchor on the actual heading at line start; a bare indexOf matches a
    // backticked cross-reference in earlier narrative text and would sweep
    // unrelated REQ IDs from decision bodies into the waiver set.
    const heading = /^## Spec Waivers\s*$/m.exec(decisions);
    if (heading !== null) {
      const rest = decisions.slice(heading.index + heading[0].length);
      const nextSection = rest.search(/^##\s/m);
      const section = nextSection === -1 ? rest : rest.slice(0, nextSection);
      for (const m of section.matchAll(/REQ-\d{3}[a-z]?/g)) waivedReqs.add(m[0]);
    }
  }
}

// --- Cross-reference ---

const waivedUncited: string[] = [];
for (const req of allReqs) {
  if (artifactReqs.has(req) || metaReqs.has(req)) continue;
  if (!reqCitedBy.has(req)) {
    if (waivedReqs.has(req)) {
      waivedUncited.push(req);
    } else {
      error(
        `REQ ${req}: no @implements citation found in any source file and no waiver in DECISIONS.md \`## Spec Waivers\``
      );
    }
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

  // Modal drift (Appendix B proofreading dimension): lowercase "shall",
  // "must", and "should" are plain English, not normative — REQ obligations
  // use SHALL. Reported as a warning, not an error: Appendix B classifies
  // modal drift as advisory ("warnings, not gate failures"). Lowercase "may"
  // is excluded — it is a context-dependent permissive modal with legitimate
  // uses (e.g. "a file may satisfy multiple REQs").
  const modalDrift = [...prose.matchAll(/\b(shall|must|should)\b/g)].map((m) => m[1]);
  if (modalDrift.length > 0) {
    warn(
      `${reqTag}: REQ body uses lowercase modal(s) ${[...new Set(modalDrift)].join(", ")} — REQ obligations use SHALL (Appendix B modal drift)`
    );
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
const unboundClauseTags: Array<{ file: string; line: number; req: string; slug: string }> = [];
let clauseTagPairs = 0;
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
        // D5 binding measurement: report-only. It binds each tag to a test
        // title; measured unbound rate is far above the 10% bar, so the gate
        // reports rather than fails (see the increment's plan).
        for (const binding of bindClauseTags(text)) {
          clauseTagPairs++;
          if (!binding.bound) {
            unboundClauseTags.push({ file: full.slice(ROOT.length + 1), line: binding.line, req: binding.req, slug: binding.slug });
          }
        }
      }
    }
  };
  walk(join(ROOT, "src"));
}

if (clauseTagPairs > 0) {
  const rate = ((unboundClauseTags.length / clauseTagPairs) * 100).toFixed(1);
  console.error(
    `clause-tag binding (report-only): ${unboundClauseTags.length}/${clauseTagPairs} pairs (${rate}%) do not name their branch in a bound test title`
  );
  for (const u of unboundClauseTags.slice(0, 5)) {
    console.error(`  ${u.file}:${u.line} ${u.req} ${u.slug}`);
  }
  if (unboundClauseTags.length > 5) console.error(`  … ${unboundClauseTags.length - 5} more`);
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
      `${rb.id}: defines "or"-joined normative branches but tests tag fewer than ${req.orBranches} clause tags (one per branch, found: ${[...(clauseTagsByReq.get(rb.id) ?? [])].join(", ") || "none"}) — add an inline clause tag per branch, e.g. \`// @implements ${rb.id} <branch-slug>\``
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

// --- Generated provider-map staleness check ---

function checkGeneratedProviderMapStale(): void {
  const mapPath = join(ROOT, "skills", "infobroker", "references", "provider-map.md");
  if (!existsSync(mapPath)) {
    error(`Generated provider-map reference missing: ${mapPath} — run 'npm run generate-provider-map'`);
    return;
  }
  writeProviderMap(readMapConfig());
  try {
    execSync(`git diff --exit-code -- "${mapPath}"`, { cwd: ROOT, stdio: "pipe" });
  } catch {
    error(`Generated provider-map reference is stale — run 'npm run generate-provider-map' and commit the result`);
  }
}

checkGeneratedProviderMapStale();

// --- Generated privacy reference staleness check (REQ-129) ---

function checkGeneratedPrivacyStale(): void {
  const privacyPath = join(ROOT, "skills", "infobroker", "references", "provider-privacy.md");
  if (!existsSync(privacyPath)) {
    error(`Generated privacy reference missing: ${privacyPath} — run 'npm run generate-privacy'`);
    return;
  }
  writeProviderPrivacy(readPrivacyConfig());
  try {
    execSync(`git diff --exit-code -- "${privacyPath}"`, { cwd: ROOT, stdio: "pipe" });
  } catch {
    error(`Generated privacy reference is stale — run 'npm run generate-privacy' and commit the result`);
  }
}

checkGeneratedPrivacyStale();

// --- REQ manifest verification ---

function checkManifest(): Set<string> {
  const manifestIdx = specText.indexOf("## 9.5 REQ Manifest");
  if (manifestIdx === -1) {
    error("REQ manifest (§9.5) not found");
    return new Set<string>();
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
  return manifestReqs;
}

const manifestReqs = checkManifest();

// --- Dangling REQ citation scan ---
//
// Every REQ-\d{3}[a-z]? token anywhere in the spec must resolve to a manifest
// REQ. A citation to a merged/removed REQ (e.g. a §E.2 row that still cited
// REQ-012 after it folded into REQ-011) is a spec defect the gate must catch.
function checkDanglingCitations(manifest: Set<string>): void {
  const tokenRe = /\bREQ-(\d{3}[a-z]?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(specText)) !== null) {
    if (!manifest.has(`REQ-${m[1]}`)) {
      error(`Dangling REQ citation "REQ-${m[1]}" — no such REQ in the §9.5 manifest`);
    }
  }
}
checkDanglingCitations(manifestReqs);

// --- Block-reservation paragraph coverage ---
//
// §1.6 enumerates every REQ ID in block-reservation ranges. Expand those
// ranges and reconcile them bidirectionally against the §9.5 manifest so a
// newly added REQ (or a stale reservation) cannot silently fall out of sync.

function expandReservations(text: string): Set<string> {
  const ids = new Set<string>();
  // Sub-REQ IDs are backtick-wrapped (`` `020a`–`020f` ``), which breaks the
  // range regex across the en dash. Strip backticks first so ranges parse.
  const clean = text.replace(/`/g, "");
  const rangeRe = /\b(\d{3})([a-z])?[–-](\d{3})([a-z])?/g;
  const residual = clean.replace(rangeRe, (_full, start, startSuffix, end, endSuffix) => {
    if (startSuffix || endSuffix) {
      const base = String(start);
      const from = startSuffix ? startSuffix.charCodeAt(0) : "a".charCodeAt(0);
      const to = endSuffix ? endSuffix.charCodeAt(0) : "z".charCodeAt(0);
      for (let c = from; c <= to; c++) ids.add(`${base}${String.fromCharCode(c)}`);
    } else {
      for (let n = Number(start); n <= Number(end); n++) ids.add(String(n).padStart(3, "0"));
    }
    return " ";
  });
  const singleRe = /\b\d{3}[a-z]?\b/g;
  let m: RegExpExecArray | null;
  while ((m = singleRe.exec(residual)) !== null) ids.add(m[0]);
  return ids;
}

function checkReservationParagraph(manifest: Set<string>): void {
  const anchor = "REQ IDs use block reservations";
  const anchorIdx = specText.indexOf(anchor);
  if (anchorIdx === -1) {
    error("Block-reservation paragraph (§1.6) not found");
    return;
  }
  const blankAt = specText.indexOf("\n\n", anchorIdx);
  const paragraph = blankAt === -1 ? specText.slice(anchorIdx) : specText.slice(anchorIdx, blankAt);

  const reserved = expandReservations(paragraph);
  const manifestIds = new Set([...manifest].map((r) => r.replace(/^REQ-/, "")));

  for (const id of manifestIds) {
    if (!reserved.has(id)) {
      error(`${id}: in REQ manifest (§9.5) but missing from the block-reservation paragraph (§1.6) — add it to the reservation list`);
    }
  }
  for (const id of reserved) {
    if (!manifestIds.has(id)) {
      error(`${id}: listed in the block-reservation paragraph (§1.6) but not in the REQ manifest (§9.5) — stale reservation`);
    }
  }
}

checkReservationParagraph(manifestReqs);

// --- Feature taxonomy exhaustive coverage check ---

for (const message of checkFeatureTaxonomyCoverage(
  specText,
  deriveToolSlugs(),
  reqBodies.map((rb) => rb.id),
)) {
  error(message);
}

// --- Client artifact content verification ---

// REQ-026h: the redraft step must preserve modality. The check reads the step's
// own block rather than any mention in the file, so an unrelated section cannot
// satisfy the gate for a redraft step that lost the requirement.
function redraftBlock(text: string, start: RegExp, end: RegExp, lastStart = false): string | null {
  const flags = start.flags.includes("g") ? start.flags : `${start.flags}g`;
  const starts = [...text.matchAll(new RegExp(start.source, flags))];
  if (starts.length === 0) return null;
  const match = lastStart ? starts[starts.length - 1]! : starts[0]!;
  const from = (match.index ?? 0) + match[0].length;
  const endMatch = end.exec(text.slice(from));
  if (!endMatch) return null;
  return text.slice(match.index ?? 0, from + endMatch.index);
}

function sectionBlock(text: string, heading: string): string | null {
  const start = text.indexOf(heading);
  if (start === -1) return null;
  const rest = text.slice(start + heading.length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

function redraftBlocks(text: string, start: RegExp, end: RegExp): string[] {
  const flags = start.flags.includes("g") ? start.flags : `${start.flags}g`;
  const blocks: string[] = [];
  for (const match of text.matchAll(new RegExp(start.source, flags))) {
    const from = (match.index ?? 0) + match[0].length;
    const endMatch = end.exec(text.slice(from));
    if (!endMatch) continue;
    blocks.push(text.slice(match.index ?? 0, from + endMatch.index));
  }
  return blocks;
}

function checkArtifactContent(): void {
  const prefPath = join(ROOT, "instructions", "search-preferences.md");
  const skillPath = join(ROOT, "skills", "infobroker", "SKILL.md");

  // REQ-050: presence and the three content clauses are errors, not warnings.
  // The instruction file is G3's only carrier, so a deleted clause must fail.
  if (!existsSync(prefPath)) {
    error("instructions/search-preferences.md: missing (REQ-050)");
  } else {
    const content = readFileSync(prefPath, "utf-8");
    if (!/\bknowledge base\b/i.test(content) || !/\bbefore\s+external\b/i.test(content)) {
      error("instructions/search-preferences.md: does not direct knowledge-base-first retrieval before external providers (REQ-050)");
    }
    if (!/\bfallback\b/i.test(content)) {
      error("instructions/search-preferences.md: does not treat external providers as the fallback (REQ-050)");
    }
    if (!/manage_kb \(action: search\)/.test(content) || !/stored-content-only/.test(content)) {
      error("instructions/search-preferences.md: does not reserve a direct manage_kb search for stored-content-only answers or inspection (REQ-050)");
    }
  }

  if (!existsSync(skillPath)) {
    error("skills/infobroker/SKILL.md: missing (REQ-051)");
  } else {
    const content = readFileSync(skillPath, "utf-8");
    // REQ-051: each pipeline carries its own knowledge-base retrieval phase
    // before external search.
    for (const heading of ["## Pipeline: Research & Write", "## Pipeline: Fact-Check"]) {
      const block = sectionBlock(content, heading);
      if (block === null) {
        error(`skills/infobroker/SKILL.md: missing '${heading}' (REQ-051)`);
        continue;
      }
      if (!/RECALL[\s\S]{0,200}?(?:KB-first|knowledge base)/i.test(block) || !/manage_kb \(action: search\)/.test(block)) {
        error(`skills/infobroker/SKILL.md: '${heading}' does not carry a knowledge-base retrieval phase before external search (REQ-051)`);
      }
    }
    // REQ-051: escalation is asserted on the imperative sentence inside
    // Phase 0; the routing-table mention cannot satisfy it.
    const phase0 = sectionBlock(content, "## Phase 0: Classify");
    if (phase0 === null || !/Escalate to `analysis-loop` when/.test(phase0)) {
      error("skills/infobroker/SKILL.md: Phase 0 does not escalate high-stakes requests to analysis-loop (REQ-051)");
    }
    // REQ-051: the skill, not each pipeline, owns these obligations.
    for (const [token, label] of [
      ["report-manifest", "the report manifest"],
      ["validate-report", "the report quality gate before delivery"],
    ] as const) {
      if (!content.includes(token)) {
        error(`skills/infobroker/SKILL.md: missing ${label} ('${token}') (REQ-051)`);
      }
    }
    // The completion token must be an imperative emit instruction, not a
    // declarative note — otherwise the agent never writes it. The rule is a
    // G3 client-artifact check (§9.4), not a clause any REQ body states.
    if (!/End your reply with[\s\S]{0,160}token/i.test(content)) {
      error("skills/infobroker/SKILL.md: completion token is not stated as an imperative emit instruction (REQ-051/REQ-052, §9.4)");
    }

    const canonicalOrder = ["RECALL", "SEARCH", "EXTRACT", "VERIFY", "SUMMARIZE", "WRITE", "REDRAFT-CHECK", "VALIDATE", "POLISH", "TRANSLATE", "REVALIDATE", "ARCHIVE", "CITE"];
    let cursor = 0;
    for (const phase of canonicalOrder) {
      const next = content.indexOf(phase, cursor);
      if (next === -1) {
        error(`skills/infobroker/SKILL.md: canonical pipeline is missing or out of order at ${phase} (REQ-120)`);
        break;
      }
      cursor = next + phase.length;
    }
    // REQ-120a: ARCHIVE is required and names the report identity + sources in
    // both the report pipeline and the fact-check pipeline.
    let archiveSteps = 0;
    let verifyReportSteps = 0;
    for (const match of content.matchAll(/^ARCHIVE\s+\(required\)/gm)) {
      const step = content.slice(match.index, match.index + 600);
      if (!step.includes("sources") || !step.includes("meta.report_id") || !step.includes("`receipt`")) {
        error("skills/infobroker/SKILL.md: ARCHIVE step must name sources, meta.report_id, and the receipt (REQ-051/REQ-120a)");
        break;
      }
      if (step.includes("verify_report")) verifyReportSteps++;
      archiveSteps++;
    }
    if (archiveSteps > 0 && verifyReportSteps === 0) {
      error("skills/infobroker/SKILL.md: no ARCHIVE step runs verify_report before reuse (REQ-051)");
    }
    if (archiveSteps === 0) {
      error("skills/infobroker/SKILL.md: no ARCHIVE step found (REQ-120a)");
    }
    const workflowsPath = join(ROOT, "skills", "infobroker", "references", "workflows.md");
    if (!existsSync(workflowsPath)) {
      error("skills/infobroker/references/workflows.md: missing (REQ-120)");
    } else {
      const workflows = readFileSync(workflowsPath, "utf-8");
      for (const phase of ["REDRAFT-CHECK", "VALIDATE", "POLISH", "TRANSLATE", "REVALIDATE", "ARCHIVE"]) {
        if (!workflows.includes(phase)) {
          error(`skills/infobroker/references/workflows.md: missing ${phase} phase (REQ-120)`);
        }
      }
      // REQ-120a: the shared workflow reference carries the same required
      // archive contract (deliverable + sources + report identity).
      if (!/ARCHIVE\*\* \(required\)[\s\S]{0,500}meta\.report_id/.test(workflows)) {
        error("skills/infobroker/references/workflows.md: ARCHIVE is not required or does not name meta.report_id (REQ-120a)");
      }
      // REQ-026g/REQ-026h: the redraft step names the batch call and modality.
      if (!workflows.includes("FACT-CHECK DRAFT")) {
        error("skills/infobroker/references/workflows.md: REDRAFT-CHECK does not name the FACT-CHECK DRAFT step (REQ-026g)");
      }
      const redraft = redraftBlock(workflows, /- \*\*REDRAFT-CHECK\*\*/, /\n- \*\*VALIDATE\*\*/);
      if (!redraft) {
        error("skills/infobroker/references/workflows.md: REDRAFT-CHECK block not found (REQ-026h)");
      } else if (!/modality/i.test(redraft)) {
        error("skills/infobroker/references/workflows.md: REDRAFT-CHECK does not preserve source modality (REQ-026h)");
      }
      // REQ-120: the shared reference carries the same removal-or-unverified
      // rule and the post-translation manifest-language instruction.
      const workflowRedrafts = redraftBlocks(workflows, /- \*\*REDRAFT-CHECK\*\*/, /\n- \*\*VALIDATE\*\*/);
      for (const block of workflowRedrafts) {
        if (!/unverified/i.test(block) || !/remov|delet/i.test(block)) {
          error("skills/infobroker/references/workflows.md: REDRAFT-CHECK does not remove or mark unverified a claim the evidence does not support (REQ-120)");
        }
        if (/soften[^.]{0,40}modality/i.test(block)) {
          error("skills/infobroker/references/workflows.md: REDRAFT-CHECK still instructs softening an unsupported claim to the source's modality (REQ-120)");
        }
      }
      if (!/- \*\*TRANSLATE\*\*[^\n]*\n[^\n]*manifest[^\n]*language/i.test(workflows)) {
        error("skills/infobroker/references/workflows.md: TRANSLATE does not record the output language in the manifest (REQ-120)");
      }
      if (!/- \*\*REVALIDATE\*\*[\s\S]{0,400}--expect-language/.test(workflows)) {
        error("skills/infobroker/references/workflows.md: REVALIDATE does not pass --expect-language after translation (REQ-120)");
      }
      // REQ-120: every shape's own Pipeline paragraph carries the report tail.
      // The checks above only prove the phase names exist somewhere in the
      // file, so a shape could drop its validate/archive steps undetected.
      const REPORT_TAIL = ["WRITE", "REDRAFT-CHECK", "VALIDATE", "POLISH", "TRANSLATE", "REVALIDATE", "ARCHIVE", "CITE"];
      for (const section of workflows.split(/^## /m).slice(1)) {
        const title = section.split("\n", 1)[0]!.trim();
        const pipeline = section.match(/\*\*Pipeline:\*\*([\s\S]*?)(?:\n\n|\n\*\*)/);
        if (!pipeline) continue; // Gated Analysis routes out; shared primitives have no pipeline
        for (const phase of REPORT_TAIL) {
          if (!pipeline[1]!.includes(phase)) {
            error(`skills/infobroker/references/workflows.md: ${title} pipeline is missing ${phase} (REQ-120)`);
          }
        }
      }
    }
    // REQ-120: the pipeline diagram shows the same report tail for every shape.
    const pipelineMap = join(ROOT, "skills", "infobroker", "references", "pipeline-map.md");
    if (existsSync(pipelineMap)) {
      const diagram = readFileSync(pipelineMap, "utf-8");
      if (!/TAIL\[/.test(diagram)) {
        error("skills/infobroker/references/pipeline-map.md: missing the shared report-tail node (REQ-120)");
      }
      // REQ-120: the shared tail carries the canonical order, translation
      // included, so the diagram cannot contradict SKILL.md.
      const tail = diagram.match(/TAIL\["([^"]*)"\]/);
      const tailPhases = ["write", "redraft-check", "validate", "polish", "translate", "revalidate", "archive", "cite"];
      if (tail !== null) {
        const label = tail[1]!.toLowerCase();
        let cursor = 0;
        for (const phase of tailPhases) {
          const at = label.indexOf(phase, cursor);
          if (at === -1) {
            error(`skills/infobroker/references/pipeline-map.md: report-tail node is missing or out of order at ${phase} (REQ-120)`);
            break;
          }
          cursor = at + phase.length;
        }
      }
      // REQ-120: an inline shape chain that reaches the archive names
      // translation and revalidation first. Single-phase nodes (e.g.
      // "archive + cite") are not chains and are excluded by the arrow test.
      for (const match of diagram.matchAll(/"([^"]*→[^"]*archive[^"]*)"/g)) {
        const chain = match[1]!.toLowerCase();
        const archiveAt = chain.indexOf("archive");
        const translateAt = chain.indexOf("translate");
        const revalidateAt = chain.indexOf("revalidate");
        if (translateAt === -1 || revalidateAt === -1 || translateAt > archiveAt || revalidateAt > archiveAt) {
          error("skills/infobroker/references/pipeline-map.md: a shape chain reaches archive without translate and revalidate first (REQ-120)");
          break;
        }
      }
      const tailLinks = (diagram.match(/-->\s*TAIL\b/g) ?? []).length;
      if (tailLinks < 6) {
        error(`skills/infobroker/references/pipeline-map.md: ${tailLinks} shape(s) link to the report tail, expected 6 (REQ-120)`);
      }
    }
    // REQ-026g/REQ-026h: the orchestrator's redraft step calls the batch tool
    // and preserves modality rather than re-checking prose alone.
    if (!/verify_claims \(claims:/.test(content)) {
      error("skills/infobroker/SKILL.md: REDRAFT-CHECK does not call verify_claims with a claims list (REQ-026g)");
    }
    const redraftSkill = redraftBlock(content, /^REDRAFT-CHECK/m, /^VALIDATE/m, true);
    if (!redraftSkill) {
      error("skills/infobroker/SKILL.md: REDRAFT-CHECK block not found (REQ-026h)");
    } else if (!/modality/i.test(redraftSkill)) {
      error("skills/infobroker/SKILL.md: REDRAFT-CHECK does not preserve source modality (REQ-026h)");
    }
    // REQ-120: unsupported drafted claims are removed or marked unverified —
    // never rescued by attribution or softening. Both SKILL.md pipelines carry
    // a REDRAFT-CHECK block, and the shared reference carries one more.
    const skillRedrafts = redraftBlocks(content, /^REDRAFT-CHECK/m, /^VALIDATE/m);
    if (skillRedrafts.length < 2) {
      error(`skills/infobroker/SKILL.md: expected two REDRAFT-CHECK blocks, found ${skillRedrafts.length} (REQ-120)`);
    }
    for (const block of skillRedrafts) {
      if (!/unverified/i.test(block) || !/remov|delet/i.test(block)) {
        error("skills/infobroker/SKILL.md: REDRAFT-CHECK does not remove or mark unverified a claim the evidence does not support (REQ-120)");
      }
      if (/soften[^.]{0,40}modality/i.test(block)) {
        error("skills/infobroker/SKILL.md: REDRAFT-CHECK still instructs softening an unsupported claim to the source's modality (REQ-120)");
      }
    }
    // REQ-120: translation records the output language in the manifest and the
    // final validation checks it.
    const translateBlocks = redraftBlocks(content, /^TRANSLATE/m, /^REVALIDATE/m);
    if (translateBlocks.length === 0) {
      error("skills/infobroker/SKILL.md: no TRANSLATE step found (REQ-120)");
    }
    for (const block of translateBlocks) {
      if (!/manifest/i.test(block) || !/language/i.test(block)) {
        error("skills/infobroker/SKILL.md: TRANSLATE does not record the output language in the manifest (REQ-120)");
      }
    }
    const revalidateBlocks = redraftBlocks(content, /^REVALIDATE/m, /^ARCHIVE/m);
    if (revalidateBlocks.length === 0) {
      error("skills/infobroker/SKILL.md: no REVALIDATE step found (REQ-120)");
    }
    for (const block of revalidateBlocks) {
      if (!/--expect-language/.test(block)) {
        error("skills/infobroker/SKILL.md: REVALIDATE does not pass --expect-language after translation (REQ-120)");
      }
    }
    const corroborationPath = join(ROOT, "skills", "infobroker", "references", "corroboration.md");
    if (existsSync(corroborationPath) && !/\bspan\b/i.test(readFileSync(corroborationPath, "utf-8"))) {
      error("skills/infobroker/references/corroboration.md: does not document the support span (REQ-026h)");
    }
    // REQ-052: the orchestrator references the four pipeline skills by name.
    for (const s of ["summarization", "technical-writing", "proofreading", "translation"]) {
      if (!content.includes(s)) {
        error(`skills/infobroker/SKILL.md: missing pipeline skill reference '${s}' (REQ-052)`);
      }
    }
    if (!/references\/workflows\.md/.test(content)) {
      error("skills/infobroker/SKILL.md: missing references/workflows.md reference (REQ-052)");
    }
  }

  // REQ-053: required reference files present; pipeline-map carries a Mermaid diagram.
  const refDir = join(ROOT, "skills", "infobroker", "references");
  for (const f of ["pipeline-map.md", "provider-map.md", "workflows.md", "journeys.md", "confidence.md"]) {
    if (!existsSync(join(refDir, f))) {
      error(`skills/infobroker/references/${f}: missing (REQ-053)`);
    }
  }
  const pipelineMapPath = join(refDir, "pipeline-map.md");
  if (existsSync(pipelineMapPath) && !/```mermaid/.test(readFileSync(pipelineMapPath, "utf-8"))) {
    error("skills/infobroker/references/pipeline-map.md: missing Mermaid diagram (REQ-053)");
  }

  // REQ-088 — gated-analysis skill technique-selection mechanism + catalog.
  const analysisSkillPath = join(ROOT, "skills", "analysis-loop", "SKILL.md");
  const catalogPath = join(ROOT, "skills", "analysis-loop", "references", "techniques.md");
  if (existsSync(analysisSkillPath)) {
    const content = readFileSync(analysisSkillPath, "utf-8");
    if (!/technique-selection/i.test(content)) {
      error("skills/analysis-loop/SKILL.md: missing technique-selection mechanism (REQ-088)");
    }
  } else {
    error("skills/analysis-loop/SKILL.md: missing (REQ-088)");
  }
  if (!existsSync(catalogPath)) {
    error("skills/analysis-loop/references/techniques.md: missing (REQ-088)");
  } else {
    const catalog = readFileSync(catalogPath, "utf-8");
    const techniqueNames = [...catalog.matchAll(/^###\s+(.+)$/gm)].map((match) => match[1].trim());
    if (techniqueNames.length < 6) {
      error(`skills/analysis-loop/references/techniques.md: fewer than 6 techniques (${techniqueNames.length}) — REQ-088`);
    }

    // REQ-088 — every technique declares exactly one family, and the
    // `## Families` index agrees with those declarations in both directions.
    const familyHeading = catalog.search(/^## Families\s*$/m);
    if (familyHeading === -1) {
      error("skills/analysis-loop/references/techniques.md: missing '## Families' index (REQ-088)");
    } else {
      const familySection = catalog.slice(familyHeading).split("\n").slice(1).join("\n").split(/^## /m)[0] ?? "";
      const tableRows = familySection
        .split("\n")
        .filter((line) => line.trim().startsWith("|"))
        .map((line) =>
          line
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim()),
        )
        .filter(
          (cells) =>
            cells.length >= 2 && cells[0] !== "Family" && !cells.every((cell) => /^:?-{3,}:?$/.test(cell)),
        );

      if (tableRows.length === 0) {
        error("skills/analysis-loop/references/techniques.md: '## Families' index has no data rows (REQ-088)");
      } else {
        const index = new Map<string, string[]>();
        for (const cells of tableRows) {
          const family = cells[0] ?? "";
          const names = (cells[1] ?? "")
            .split(";")
            .map((name) => name.trim())
            .filter(Boolean);
          if (!family) {
            error("skills/analysis-loop/references/techniques.md: '## Families' row has an empty Family cell (REQ-088)");
            continue;
          }
          if (index.has(family)) {
            error(`skills/analysis-loop/references/techniques.md: family '${family}' appears in more than one index row (REQ-088)`);
          }
          if (names.length === 0) {
            error(`skills/analysis-loop/references/techniques.md: family '${family}' has an empty Techniques cell (REQ-088)`);
          }
          index.set(family, names);
        }

        const declared = new Map<string, string>();
        for (const section of catalog.split(/^###\s+/m).slice(1)) {
          const name = (section.split("\n")[0] ?? "").trim();
          const familyLines = [...section.matchAll(/^\*\*Family\.\*\*\s*(.+)$/gm)].map((match) => match[1].trim());
          if (familyLines.length !== 1) {
            error(
              `skills/analysis-loop/references/techniques.md: technique '${name}' declares ${familyLines.length} families, expected exactly one (REQ-088)`,
            );
            continue;
          }
          const family = familyLines[0] ?? "";
          if (!index.has(family)) {
            error(
              `skills/analysis-loop/references/techniques.md: technique '${name}' names family '${family}' absent from the '## Families' index (REQ-088)`,
            );
          } else if (!(index.get(family) ?? []).includes(name)) {
            error(
              `skills/analysis-loop/references/techniques.md: technique '${name}' is missing from family '${family}' in the '## Families' index (REQ-088)`,
            );
          }
          declared.set(name, family);
        }

        const membership = new Map<string, number>();
        for (const [family, names] of index) {
          for (const name of names) {
            membership.set(name, (membership.get(name) ?? 0) + 1);
            if (!techniqueNames.includes(name)) {
              error(
                `skills/analysis-loop/references/techniques.md: '## Families' index names technique '${name}' absent from the catalog (REQ-088)`,
              );
            }
            const owner = declared.get(name);
            if (owner !== undefined && owner !== family) {
              error(
                `skills/analysis-loop/references/techniques.md: technique '${name}' is listed under '${family}' but declares family '${owner}' (REQ-088)`,
              );
            }
          }
        }
        for (const [name, count] of membership) {
          if (count > 1) {
            error(`skills/analysis-loop/references/techniques.md: technique '${name}' appears in ${count} index rows (REQ-088)`);
          }
        }
        const distinctFamilies = [...index.values()].filter((names) => names.length > 0).length;
        if (distinctFamilies < 3) {
          error(`skills/analysis-loop/references/techniques.md: fewer than 3 families (${distinctFamilies}) — REQ-088`);
        }
      }
    }
  }

  // REQ-114/115 — manifest block and one canonical confidence scale.
  const reportTemplatePath = join(refDir, "report-template.md");
  if (!existsSync(reportTemplatePath) || !/```report-manifest/.test(readFileSync(reportTemplatePath, "utf-8"))) {
    error("skills/infobroker/references/report-template.md: missing report-manifest block (REQ-114)");
  }
  if (existsSync(reportTemplatePath)) {
    const template = readFileSync(reportTemplatePath, "utf-8");
    for (const required of ["as_of", "Published", "Accessed", "Relevant interests", "policy", "journalist"]) {
      if (!template.includes(required)) {
        error(`skills/infobroker/references/report-template.md: missing '${required}' (REQ-114, REQ-118)`);
      }
    }
    if (!/skeleton\s+omitted/.test(template)) {
      error("skills/infobroker/references/report-template.md: missing skeleton-omitted escape rule (REQ-119)");
    }
  }
  if (!existsSync(reportTemplatePath) || !/## Baseline and Verification/.test(readFileSync(reportTemplatePath, "utf-8"))) {
    error("skills/infobroker/references/report-template.md: missing monitoring baseline block (REQ-117)");
  }
  const confidencePath = join(refDir, "confidence.md");
  const canonicalLabels = ["High", "Medium", "Low"];
  if (existsSync(confidencePath)) {
    const confidence = readFileSync(confidencePath, "utf-8");
    for (const required of ["High", "Medium", "Low", "almost certain", "Reliability", "Credibility", "GRADE"]) {
      if (!confidence.includes(required)) {
        error(`skills/infobroker/references/confidence.md: missing '${required}' (REQ-115)`);
      }
    }
    const confidenceSection =
      confidence.split(/^## /m).find((section) => section.startsWith("Confidence (strength of the judgment)")) ?? "";
    for (const label of canonicalLabels) {
      if (!new RegExp(`^\\|\\s*${label}\\s*\\|`, "m").test(confidenceSection)) {
        error(`skills/infobroker/references/confidence.md: confidence table has no '${label}' row (REQ-115)`);
      }
    }

    // REQ-115 — the gated-analysis skill cites the canonical scale and does not
    // define a label outside its three-label set.
    if (existsSync(analysisSkillPath)) {
      const skill = readFileSync(analysisSkillPath, "utf-8");
      const blockStart = skill.search(/^\d+\.\s+\*\*Confidence scoring\.\*\*/m);
      if (blockStart === -1) {
        error("skills/analysis-loop/SKILL.md: missing confidence-scoring block (REQ-115)");
      } else {
        const blockLines: string[] = [];
        for (const line of skill.slice(blockStart).split("\n").slice(1)) {
          if (/^\d+\.\s+\*\*/.test(line)) break;
          blockLines.push(line);
        }
        const block = blockLines.join("\n");
        if (!block.includes("skills/infobroker/references/confidence.md")) {
          error(
            "skills/analysis-loop/SKILL.md: confidence-scoring block does not cite skills/infobroker/references/confidence.md (REQ-115)",
          );
        }
        const labels = [...block.matchAll(/^\s*-\s+\*\*([^*]+)\*\*\s*—/gm)].map((match) => match[1].trim());
        if (labels.join("|") !== canonicalLabels.join("|")) {
          const extra = labels.filter((label) => !canonicalLabels.includes(label));
          const detail = extra.length > 0 ? ` — unexpected label(s): ${extra.join(", ")}` : "";
          error(
            `skills/analysis-loop/SKILL.md: confidence-scoring labels are [${labels.join(", ")}], expected [${canonicalLabels.join(", ")}]${detail} (REQ-115)`,
          );
        }
      }
    }
  }
}

checkArtifactContent();

// --- Tool default consistency (REQ-080) ---

// A) No divergent numeric fallback on a config lookup: REQ-080 requires that a
// value the configuration supplies is read from the configuration without a
// substitute literal in source. Every source file is scanned, not a curated
// list, so a new module cannot escape the rule by not being named here.
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(path);
    }
  }
  return out;
}
for (const filePath of sourceFiles(SRC)) {
  const rel = filePath.slice(ROOT.length + 1);
  const text = readFileSync(filePath, "utf-8");
  const re = /config\.[A-Za-z0-9_.()]+\s*\?\?\s*[0-9]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    error(`${rel}: numeric fallback on a config lookup (${m[0].trim()}) — violates REQ-080`);
  }
}

// B) Every default §4 declares SHALL equal the default the tool schema
// applies, every declared maximum SHALL match the schema maximum, and every
// config value that describes the same limit SHALL match. The declaration
// table lives in scripts/lib/tool-defaults.ts.
const shippedConfig: unknown = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf-8"));
for (const problem of reconcile({
  spec: specText,
  schemaSource: readFileSync(join(SRC, "index.ts"), "utf-8"),
  config: shippedConfig,
})) {
  error(problem);
}

// --- Tool-definition quality bar (REQ-092) ---
//
// The REQ-089/090/092 bar is enforced statically over src/index.ts so a tool
// definition that regresses (drops an alternative, the return contract, or a
// behavioral annotation) fails spec validation, not only the live stdio test.
function checkToolDefinitionBar(): void {
  const text = readFileSync(join(SRC, "index.ts"), "utf-8");
  const blocks = text.split(/(?:server\.registerTool|instrumentTool)\(\s*"infobroker_/).slice(1);
  if (blocks.length === 0) {
    error("REQ-092: no infobroker_ registerTool calls found in src/index.ts");
    return;
  }
  for (const block of blocks) {
    const slug = block.slice(0, block.indexOf('"'));
    const descMatch = block.match(/description:\s*"([^"]*)"/);
    const desc = descMatch?.[1] ?? "";
    const label = `infobroker_${slug}`;
    if (!/Use when/i.test(desc)) error(`${label}: description missing 'Use when' (REQ-092)`);
    if (!/Do NOT use/i.test(desc)) error(`${label}: description missing 'Do NOT use' (REQ-092)`);
    if (!/use\s+(?:infobroker_)?(fetch_page|verify_claims|manage_kb|get_citations|inspect_providers|reload_config|search_web)/i.test(desc)) {
      error(`${label}: description missing an alternative-tool reference (REQ-092)`);
    }
    if (!/\[OK\]/.test(desc)) error(`${label}: description missing [OK] return contract (REQ-092)`);
    if (!/\[ERROR\]/.test(desc)) error(`${label}: description missing [ERROR] return contract (REQ-092)`);
    const annMatch = block.match(/annotations:\s*\{([^}]*)\}/);
    const ann = annMatch?.[1] ?? "";
    for (const hint of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
      if (!new RegExp(`\\b${hint}:`).test(ann)) {
        error(`${label}: annotations missing ${hint} (REQ-092)`);
      }
    }
  }
}
checkToolDefinitionBar();

// --- Registry-published distribution (REQ-091) ---
//
// server.json and glama.json are distribution artifacts; verify their presence
// and that the registered version equals the package version exactly.
function checkRegistryArtifacts(): void {
  const serverJsonPath = join(ROOT, "server.json");
  const glamaJsonPath = join(ROOT, "glama.json");
  if (!existsSync(serverJsonPath)) {
    error("server.json missing — REQ-091 registry distribution");
    return;
  }
  if (!existsSync(glamaJsonPath)) {
    error("glama.json missing — REQ-091 registry attribution");
  }
  let pkgVersion: string;
  try {
    pkgVersion = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
  } catch {
    error("package.json missing or unparseable — REQ-091 version parity check unable to run");
    return;
  }
  let serverVersion: string;
  try {
    serverVersion = JSON.parse(readFileSync(serverJsonPath, "utf-8")).version;
  } catch {
    error("server.json missing or unparseable — REQ-091");
    return;
  }
  if (serverVersion !== pkgVersion) {
    error(`server.json version ${serverVersion} diverges from package.json version ${pkgVersion} — REQ-091`);
  }
}
checkRegistryArtifacts();

// --- Agent-facing doc drift checks ---
//
// AGENTS.md is not covered by validate-readme (which derives only the README
// surface), so verify its provider-backend table and version stamp here.

function checkAgentsDoc(): void {
  const agentsPath = join(ROOT, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    error("AGENTS.md missing");
    return;
  }
  const agents = readFileSync(agentsPath, "utf-8");

  const config = readConfig();
  const configSlugs = Object.keys(config.providers).filter((slug) => !PROVIDER_EXCLUSIONS.has(slug));
  const listed = new Set<string>();
  const rowRe = /^\|\s*[^|]+\|\s*`src\/providers\/([a-z0-9_]+)\.ts`\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(agents)) !== null) listed.add(m[1]);

  for (const slug of configSlugs) {
    if (!listed.has(slug)) {
      error(`AGENTS.md provider-backend table missing '${slug}' — add a row to the Provider Backends table`);
    }
  }
  for (const slug of listed) {
    if (!(slug in config.providers)) {
      error(`AGENTS.md provider-backend table lists '${slug}', which is absent from config.json — stale row`);
    }
  }

  let pkgVersion: string;
  try {
    pkgVersion = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
  } catch {
    return;
  }
  const stamp = agents.match(/\(v([0-9.]+)\)/);
  if (!stamp) {
    error("AGENTS.md header missing '(vX.Y.Z)' version stamp");
  } else if (stamp[1] !== pkgVersion) {
    error(`AGENTS.md version stamp (v${stamp[1]}) diverges from package.json version (${pkgVersion}) — update the header`);
  }
}

checkAgentsDoc();

// --- Security model completeness (REQ-096) ---
//
// §E must exist, name both OWASP mappings, map every category, and trace every
// §4.11 security REQ to a gate in the §9.5 manifest, so a requirement that
// loses its gate or its model row is a spec defect. The checks live in a pure
// module so each branch has a negative fixture.
for (const message of checkSecurityModel(specText)) {
  error(message);
}

// --- Dependency vulnerability gate wiring (REQ-101) ---
//
// The audit gate must be part of `npm run check`, not merely present as an npm
// script. `check` runs the manifest, so the manifest is the authority: an
// `audit` gate must exist, run `npm run audit`, and `check` must be the full
// manifest run. A substring scan of the old `&&` chain did not survive the
// move to a manifest and would have passed a check that never ran the audit.
function checkDependencyGate(): void {
  const audit = GATES.find((gate) => gate.name === "audit");
  if (!audit) {
    error("gate manifest has no `audit` gate — REQ-101");
    return;
  }
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    const check = String(pkg?.scripts?.check ?? "");
    if (!check.includes("run-gates.ts --full")) {
      error("package.json `check` does not run the full gate manifest — REQ-101");
    }
    if (!/\baudit\b/.test(String(pkg?.scripts?.["audit"] ?? ""))) {
      error("package.json `audit` script is missing — REQ-101");
    }
  } catch {
    error("package.json missing or unparseable — REQ-101 dependency gate check unable to run");
  }
}
checkDependencyGate();

// --- Spec version parity (README ↔ spec ↔ package) ---
//
// The README cites a spec version. Without a stamp in the spec there is nothing
// to reconcile against, so the claim drifts silently. The spec carries a
// `**Spec version:**` line; it must equal the package version, which the README
// check then reconciles against.
function checkSpecVersion(): void {
  const stamp = /^\*\*Spec version:\*\*\s*([0-9.]+)/m.exec(specText)?.[1];
  let pkgVersion: string;
  try {
    pkgVersion = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
  } catch {
    error("package.json missing or unparseable — spec version parity check unable to run");
    return;
  }
  if (stamp === undefined) {
    error("infobroker.md is missing a `**Spec version:** <CalVer>` stamp — REQ-054/README parity");
    return;
  }
  if (stamp !== pkgVersion) {
    error(`infobroker.md spec version ${stamp} diverges from package.json version ${pkgVersion}`);
  }
}

checkSpecVersion();

// --- AGENTS.md gate-table parity ---
//
// Moved to `scripts/check-gate-table.ts` (`npm run check-gate-table`): the table
// is now generated from the gate manifest and compared byte for byte, which
// subsumes the old command-row reconciliation and also catches a stale
// description. Keeping both checks would test one surface twice.


// --- Report ---

console.log(`\nvalidate-spec — Infobroker spec-code traceability\n`);
console.log(`${allReqs.size} REQs in spec (${artifactReqs.size} artifact-exempt)`);
console.log(`${reqCitedBy.size} REQs cited in source files`);
console.log(`${filesWithoutCitation.length} source file(s) without @implements`);

const errors = violations.filter((v) => v.severity === "error");
const warnings = violations.filter((v) => v.severity === "warning");

if (waivedUncited.length > 0) {
  console.log(`\n${waivedUncited.length} waived REQ(s) (unimplemented, recorded in DECISIONS.md):`);
  for (const w of waivedUncited) console.log(`  WAIVED: ${w}`);
}

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
