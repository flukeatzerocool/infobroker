// @implements REQ-116
// report-manifest.ts — deterministic parsing and structural validation for
// Infobroker reports (REQ-116). Pure functions used by `validate-report` and
// `check-report-fixtures`; no filesystem or network access.
//
// Exit-code contract is owned by the CLI entry points, not this module.

export type FindingLevel = "error" | "warning";

export interface ReportFinding {
  level: FindingLevel;
  code: string;
  message: string;
  line?: number;
}

export interface ManifestClaim {
  claim: string;
  verdict?: string;
  confidence?: string;
  likelihood?: string;
  sources?: string[];
}

export interface ReportManifest {
  shape?: string;
  audience?: string;
  methodology?: string;
  assumptions?: string[];
  alternatives?: string[];
  gaps?: string[];
  supersedes?: string;
  revision?: number;
  claims?: ManifestClaim[];
}

export interface ReportValidation {
  ok: boolean;
  findings: ReportFinding[];
  manifest?: ReportManifest;
  sources: Map<string, string>;
  sections: string[];
}

export const REQUIRED_SECTIONS = [
  "Executive Summary",
  "Methodology & Scope",
  "Key Findings",
  "Assumptions",
  "Analysis of Alternatives",
  "Evidence & Sources",
  "Contradictions",
  "Gaps",
  "Source Register",
  "Recommendations",
] as const;

export const CONFIDENCE_VALUES = ["High", "Medium", "Low"] as const;

export const LIKELIHOOD_VALUES = [
  "almost certain",
  "very likely",
  "likely",
  "even chance",
  "unlikely",
  "very unlikely",
  "remote",
] as const;

export const VERDICT_VALUES = [
  "True",
  "Mostly True",
  "Half True",
  "Mostly False",
  "False",
  "Misleading",
  "Mixture",
  "Unverifiable",
] as const;

const MANIFEST_FENCE = /```report-manifest[ \t]*\r?\n([\s\S]*?)```/i;
const HEADING = /^(#{2,6})\s+(.+?)\s*#*\s*$/;
const CITATION = /\[(S\d+)\]/g;

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function extractSections(text: string): string[] {
  const names: string[] = [];
  for (const line of text.split("\n")) {
    const match = HEADING.exec(line);
    if (match && match[1]!.length === 2) names.push(match[2]!);
  }
  return names;
}

export function sectionText(text: string, name: string): string | null {
  const wanted = normalizeHeading(name);
  const lines = text.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = HEADING.exec(lines[i]!);
    if (match && match[1]!.length === 2 && normalizeHeading(match[2]!) === wanted) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const match = HEADING.exec(lines[i]!);
    if (match && match[1]!.length === 2) break;
    body.push(lines[i]!);
  }
  return body.join("\n");
}

export function extractManifest(text: string): { ok: true; value: ReportManifest } | { ok: false; message: string } {
  const match = MANIFEST_FENCE.exec(text);
  if (!match) {
    return { ok: false, message: "missing fenced ```report-manifest block" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]!.trim());
  } catch (error) {
    return { ok: false, message: `report-manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, message: "report-manifest must be a JSON object" };
  }
  return { ok: true, value: parsed as ReportManifest };
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateManifest(manifest: ReportManifest): ReportFinding[] {
  const findings: ReportFinding[] = [];
  const push = (code: string, message: string): void => {
    findings.push({ level: "error", code, message });
  };
  for (const key of ["shape", "audience", "methodology", "supersedes"] as const) {
    if (manifest[key] !== undefined && typeof manifest[key] !== "string") {
      push("manifest-type", `report-manifest.${key} must be a string`);
    }
  }
  for (const key of ["assumptions", "alternatives", "gaps"] as const) {
    if (manifest[key] !== undefined && !stringArray(manifest[key])) {
      push("manifest-type", `report-manifest.${key} must be an array of strings`);
    }
  }
  if (manifest.revision !== undefined) {
    if (typeof manifest.revision !== "number" || !Number.isInteger(manifest.revision) || manifest.revision < 1) {
      push("manifest-revision", "report-manifest.revision must be a positive integer");
    } else if (manifest.revision > 1 && typeof manifest.supersedes !== "string") {
      findings.push({
        level: "warning",
        code: "manifest-supersedes",
        message: "report-manifest.revision > 1 should name the report it supersedes",
      });
    }
  }
  if (manifest.claims !== undefined) {
    if (!Array.isArray(manifest.claims)) {
      push("manifest-type", "report-manifest.claims must be an array");
    } else {
      for (const [index, claim] of manifest.claims.entries()) {
        if (typeof claim !== "object" || claim === null || typeof claim.claim !== "string" || claim.claim.trim() === "") {
          push("manifest-claim", `report-manifest.claims[${index}] needs a non-empty claim string`);
          continue;
        }
        if (claim.confidence !== undefined && !CONFIDENCE_VALUES.includes(claim.confidence as (typeof CONFIDENCE_VALUES)[number])) {
          push("manifest-confidence", `report-manifest.claims[${index}].confidence must be one of ${CONFIDENCE_VALUES.join(", ")}`);
        }
        if (claim.likelihood !== undefined && !LIKELIHOOD_VALUES.includes(claim.likelihood.toLowerCase() as (typeof LIKELIHOOD_VALUES)[number])) {
          push("manifest-likelihood", `report-manifest.claims[${index}].likelihood must be one of ${LIKELIHOOD_VALUES.join(", ")}`);
        }
        if (claim.verdict !== undefined && !VERDICT_VALUES.some((value) => value.toLowerCase() === claim.verdict!.toLowerCase())) {
          push("manifest-verdict", `report-manifest.claims[${index}].verdict must be one of ${VERDICT_VALUES.join(", ")}`);
        }
        if (claim.sources !== undefined && !stringArray(claim.sources)) {
          push("manifest-type", `report-manifest.claims[${index}].sources must be an array of source ids`);
        }
      }
    }
  }
  return findings;
}

export function parseSourceRegister(text: string): { sources: Map<string, string>; findings: ReportFinding[] } {
  const sources = new Map<string, string>();
  const findings: ReportFinding[] = [];
  const register = sectionText(text, "Source Register");
  if (register === null) return { sources, findings };
  const lines = register.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    const id = cells[0]!;
    if (!/^S\d+$/.test(id)) continue;
    const url = cells.slice(1).reverse().find((cell) => /^https?:\/\//i.test(cell));
    if (url === undefined) {
      findings.push({ level: "error", code: "register-url", message: `Source Register row ${id} has no http(s) URL` });
      continue;
    }
    sources.set(id, url);
  }
  return { sources, findings };
}

function stripSection(text: string, name: string): string {
  const wanted = normalizeHeading(name);
  const lines = text.split("\n");
  const kept: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const match = HEADING.exec(line);
    if (match && match[1]!.length === 2) {
      skipping = normalizeHeading(match[2]!) === wanted;
    }
    if (!skipping) kept.push(line);
  }
  return kept.join("\n");
}

function validateCitations(text: string, sources: Map<string, string>): ReportFinding[] {
  const findings: ReportFinding[] = [];
  const withoutNoise = stripSection(text, "Source Register");
  const cited = new Set<string>();
  for (const match of withoutNoise.matchAll(CITATION)) {
    const id = match[1]!;
    cited.add(id);
    if (!sources.has(id)) {
      const index = withoutNoise.indexOf(match[0]);
      findings.push({
        level: "error",
        code: "citation-unresolved",
        message: `${match[0]} does not resolve to a Source Register row with a URL`,
        ...(index >= 0 ? { line: lineOf(withoutNoise, index) } : {}),
      });
    }
  }
  for (const id of sources.keys()) {
    if (!cited.has(id)) {
      findings.push({
        level: "warning",
        code: "register-uncited",
        message: `Source Register row ${id} is not cited anywhere in the report`,
      });
    }
  }
  return findings;
}

function validateKeyFindings(text: string): ReportFinding[] {
  const findings: ReportFinding[] = [];
  const section = sectionText(text, "Key Findings");
  if (section === null) return findings;
  const subBlocks = section.split(/^###\s+/m).slice(1);
  const check = (label: string, body: string): void => {
    if (!/\[S\d+\]/.test(body)) {
      findings.push({
        level: "error",
        code: "finding-uncited",
        message: `${label} has no [S#] citation`,
      });
    }
  };
  if (subBlocks.length > 0) {
    for (const block of subBlocks) {
      const title = block.split("\n")[0]!.trim() || "a Key Findings sub-section";
      check(title, block);
    }
  } else {
    for (const line of section.split("\n")) {
      if (/^\s*\*\*Finding:\*\*/i.test(line)) check("a **Finding:** line", line);
    }
  }
  return findings;
}

function validateEvidence(text: string): ReportFinding[] {
  const findings: ReportFinding[] = [];
  const section = sectionText(text, "Evidence & Sources");
  if (section === null) return findings;
  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("|") || line.startsWith("#") || /^none\.?$/i.test(line)) continue;
    if (!/\[S\d+\]/.test(line) && !/https?:\/\//i.test(line)) {
      findings.push({
        level: "warning",
        code: "evidence-uncited",
        message: "an Evidence & Sources line carries neither a [S#] citation nor a URL",
      });
    }
  }
  return findings;
}

export function validateReport(text: string): ReportValidation {
  const findings: ReportFinding[] = [];
  const sections = extractSections(text);
  for (const required of REQUIRED_SECTIONS) {
    if (!sections.some((section) => normalizeHeading(section) === normalizeHeading(required))) {
      findings.push({ level: "error", code: "section-missing", message: `missing required section: ${required}` });
    }
  }

  const manifestResult = extractManifest(text);
  let manifest: ReportManifest | undefined;
  if (!manifestResult.ok) {
    findings.push({ level: "error", code: "manifest-missing", message: manifestResult.message });
  } else {
    manifest = manifestResult.value;
    findings.push(...validateManifest(manifest));
  }

  const register = parseSourceRegister(text);
  findings.push(...register.findings);
  if (!register.sources.size) {
    findings.push({ level: "error", code: "register-empty", message: "Source Register has no S# rows with a URL" });
  }

  findings.push(...validateCitations(text, register.sources));
  findings.push(...validateKeyFindings(text));
  findings.push(...validateEvidence(text));

  if (manifest?.claims) {
    for (const [index, claim] of manifest.claims.entries()) {
      for (const id of claim.sources ?? []) {
        if (!register.sources.has(id)) {
          findings.push({
            level: "error",
            code: "manifest-source-unresolved",
            message: `report-manifest.claims[${index}] cites ${id}, which is not in the Source Register`,
          });
        }
      }
    }
  }

  return {
    ok: findings.every((finding) => finding.level !== "error"),
    findings,
    ...(manifest ? { manifest } : {}),
    sources: register.sources,
    sections,
  };
}
