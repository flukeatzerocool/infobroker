// @implements REQ-114
// @implements REQ-116
// @implements REQ-118
// @implements REQ-119
// @implements REQ-120
// report-manifest.ts — deterministic parsing and structural validation for
// Infobroker reports (REQ-114, REQ-116, REQ-118, REQ-119, REQ-120). Pure
// functions used by `validate-report` and `check-report-fixtures`; no
// filesystem or network access.
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
  target_length?: number;
  language?: string;
  as_of?: string;
  handling?: string;
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

export const SHAPE_VALUES = [
  "Research & Write",
  "Fact-Check",
  "Deep-Dive",
  "Gated Analysis",
  "Competitive Evaluation",
  "Literature Review",
  "Monitoring / Delta",
  "Adversarial / Red-Team",
  "Vetting / Due-Diligence",
] as const;

export const AUDIENCE_VALUES = [
  "executive",
  "analyst",
  "engineer",
  "policy",
  "legal",
  "journalist",
  "investor",
] as const;

export const HANDLING_VALUES = [
  "TLP:CLEAR",
  "TLP:GREEN",
  "TLP:AMBER",
  "TLP:AMBER+STRICT",
  "TLP:RED",
] as const;

export const RELIABILITY_VALUES = ["A", "B", "C", "D", "E", "F"] as const;
export const CREDIBILITY_VALUES = ["1", "2", "3", "4", "5", "6"] as const;
export const PRIMACY_VALUES = ["primary", "secondary", "aggregated"] as const;

export const SHAPE_BLOCKS: Record<string, { heading: string; prefix?: boolean }[]> = {
  "Research & Write": [],
  "Fact-Check": [],
  "Gated Analysis": [],
  "Deep-Dive": [
    { heading: "Subtopic Coverage" },
    { heading: "Thematic Synthesis" },
    { heading: "Cross-Subtopic Contradictions" },
    { heading: "Open Questions" },
  ],
  "Competitive Evaluation": [
    { heading: "Criteria" },
    { heading: "Decision Matrix" },
    { heading: "Recommendation" },
  ],
  "Literature Review": [
    { heading: "Inclusion / Exclusion Criteria" },
    { heading: "Identification and Screening" },
    { heading: "Thematic Synthesis" },
    { heading: "Gap Analysis" },
  ],
  "Monitoring / Delta": [
    { heading: "Changes Since", prefix: true },
    { heading: "Baseline and Verification" },
  ],
  "Adversarial / Red-Team": [
    { heading: "Weakness Register" },
    { heading: "Assumptions & Attack Surface" },
    { heading: "Robustness Verdict" },
  ],
  "Vetting / Due-Diligence": [
    { heading: "Checklist" },
    { heading: "Red-Flag Register" },
  ],
};

export const READABILITY_GRADE_THRESHOLD = 14;

const MANIFEST_FENCE = /```report-manifest[ \t]*\r?\n([\s\S]*?)```/i;
const HEADING = /^(#{2,6})\s+(.+?)\s*#*\s*$/;
const CITATION = /\[(S\d+)\]/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DOI = /^10\.\d{4,9}\/\S+$/i;

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

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function validateManifest(manifest: ReportManifest): ReportFinding[] {
  const findings: ReportFinding[] = [];
  const push = (code: string, message: string): void => {
    findings.push({ level: "error", code, message });
  };

  if (typeof manifest.shape !== "string" || manifest.shape.trim() === "") {
    push("manifest-shape-required", "report-manifest.shape is required");
  } else if (!SHAPE_VALUES.some((value) => normalizeValue(value) === normalizeValue(manifest.shape!))) {
    push("manifest-shape", `report-manifest.shape must be one of ${SHAPE_VALUES.join(", ")}`);
  }

  for (const key of ["audience", "language", "methodology", "supersedes"] as const) {
    if (manifest[key] !== undefined && typeof manifest[key] !== "string") {
      push("manifest-type", `report-manifest.${key} must be a string`);
    }
  }
  if (typeof manifest.audience === "string" && !AUDIENCE_VALUES.some((value) => value === normalizeValue(manifest.audience!))) {
    push("manifest-audience", `report-manifest.audience must be one of ${AUDIENCE_VALUES.join(", ")}`);
  }
  if (typeof manifest.language === "string" && manifest.language.trim() === "") {
    push("manifest-language", "report-manifest.language must not be empty");
  }
  if (manifest.target_length !== undefined && (!Number.isInteger(manifest.target_length) || manifest.target_length <= 0)) {
    push("manifest-target-length", "report-manifest.target_length must be a positive integer");
  }
  if (typeof manifest.as_of !== "string" || !isIsoDate(manifest.as_of)) {
    push("manifest-as-of", "report-manifest.as_of must be an ISO date (YYYY-MM-DD)");
  }
  if (typeof manifest.handling !== "string" || manifest.handling.trim() === "") {
    push("manifest-handling-required", "report-manifest.handling is required");
  } else if (!HANDLING_VALUES.some((value) => value === manifest.handling!.toUpperCase())) {
    push("manifest-handling", `report-manifest.handling must be one of ${HANDLING_VALUES.join(", ")}`);
  }
  for (const key of ["assumptions", "alternatives", "gaps"] as const) {
    if (manifest[key] !== undefined && !stringArray(manifest[key])) {
      push("manifest-type", `report-manifest.${key} must be an array of strings`);
    }
  }
  if (manifest.revision !== undefined) {
    if (typeof manifest.revision !== "number" || !Number.isInteger(manifest.revision) || manifest.revision < 1) {
      push("manifest-revision", "report-manifest.revision must be a positive integer");
    } else if (manifest.revision > 1 && (typeof manifest.supersedes !== "string" || manifest.supersedes.trim() === "")) {
      push("manifest-supersedes", "report-manifest.revision > 1 must name the report it supersedes");
    }
  }

  if (!Array.isArray(manifest.claims) || manifest.claims.length === 0) {
    push("manifest-claims-required", "report-manifest.claims must be a non-empty array");
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
  return findings;
}

export function parseSourceRegister(text: string): { sources: Map<string, string>; findings: ReportFinding[] } {
  const sources = new Map<string, string>();
  const findings: ReportFinding[] = [];
  const register = sectionText(text, "Source Register");
  if (register === null) return { sources, findings };

  const rows = register
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));

  const headerIndex = rows.findIndex((cells) => cells.some((cell) => /^#$/i.test(cell)) && cells.some((cell) => /^url$/i.test(cell)));
  if (headerIndex === -1) {
    findings.push({ level: "error", code: "register-header", message: "Source Register has no table header with # and URL columns" });
    return { sources, findings };
  }

  const header = rows[headerIndex]!.map((cell) => normalizeValue(cell));
  const column = (aliases: string[]): number => header.findIndex((name) => aliases.includes(name));
  const idIndex = column(["#"]);
  const sourceIndex = column(["source"]);
  const typeIndex = column(["type"]);
  const primacyIndex = column(["primary/secondary", "primacy"]);
  const reliabilityIndex = column(["reliability"]);
  const credibilityIndex = column(["credibility"]);
  const interestsIndex = column(["relevant interests", "interests"]);
  const publishedIndex = column(["published", "publication date"]);
  const accessedIndex = column(["accessed", "access date"]);
  const urlIndex = column(["url"]);
  const identifierIndex = column(["doi", "durable citation identifier"]);

  const required: [string, number][] = [
    ["Source", sourceIndex],
    ["Type", typeIndex],
    ["Primary/Secondary", primacyIndex],
    ["Reliability", reliabilityIndex],
    ["Credibility", credibilityIndex],
    ["Relevant interests", interestsIndex],
    ["Published", publishedIndex],
    ["Accessed", accessedIndex],
    ["URL", urlIndex],
  ];
  for (const [label, index] of required) {
    if (index === -1) {
      findings.push({ level: "error", code: "register-column", message: `Source Register is missing the ${label} column` });
    }
  }

  const data = rows.slice(headerIndex + 1);
  for (const cells of data) {
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    const id = cells[idIndex] ?? "";
    if (!/^S\d+$/.test(id)) continue;
    const value = (index: number): string => (index >= 0 ? (cells[index] ?? "") : "");

    const url = value(urlIndex);
    if (!/^https?:\/\//i.test(url)) {
      findings.push({ level: "error", code: "register-url", message: `Source Register row ${id} has no http(s) URL` });
    } else {
      sources.set(id, url);
    }

    if (value(sourceIndex).trim() === "") {
      findings.push({ level: "error", code: "register-source", message: `Source Register row ${id} has no source name` });
    }
    if (value(typeIndex).trim() === "") {
      findings.push({ level: "error", code: "register-type", message: `Source Register row ${id} has no source type` });
    }
    if (!PRIMACY_VALUES.some((item) => item === normalizeValue(value(primacyIndex)))) {
      findings.push({ level: "error", code: "register-primacy", message: `Source Register row ${id} must be primary, secondary, or aggregated` });
    }
    if (!RELIABILITY_VALUES.some((item) => item === value(reliabilityIndex).toUpperCase())) {
      findings.push({ level: "error", code: "register-reliability", message: `Source Register row ${id} must carry a reliability grade A–F` });
    }
    if (!CREDIBILITY_VALUES.some((item) => item === value(credibilityIndex))) {
      findings.push({ level: "error", code: "register-credibility", message: `Source Register row ${id} must carry a credibility grade 1–6` });
    }
    if (value(interestsIndex).trim() === "") {
      findings.push({ level: "error", code: "register-interests", message: `Source Register row ${id} must state relevant interests` });
    }
    const published = normalizeValue(value(publishedIndex));
    if (published !== "undeterminable" && !isIsoDate(value(publishedIndex))) {
      findings.push({ level: "error", code: "register-published", message: `Source Register row ${id} needs a publication date or "undeterminable"` });
    }
    if (!isIsoDate(value(accessedIndex))) {
      findings.push({ level: "error", code: "register-accessed", message: `Source Register row ${id} needs an access date (YYYY-MM-DD)` });
    }
    const identifier = value(identifierIndex);
    if (identifier !== "") {
      const valid = DOI.test(identifier) || /^https?:\/\//i.test(identifier) || /^(?:97[89]\d{10}|\d{9}[\dXx])$/.test(identifier);
      if (!valid) {
        findings.push({ level: "error", code: "register-citation-id", message: `Source Register row ${id} has a malformed durable citation identifier` });
      }
    }
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
  const check = (label: string, body: string): void => {
    if (!/\[S\d+\]/.test(body)) {
      findings.push({
        level: "error",
        code: "finding-uncited",
        message: `${label} has no [S#] citation`,
      });
    }
    if (!/^\s*\*\*Confidence:\*\*\s*(High|Medium|Low)\s*$/im.test(body)) {
      findings.push({
        level: "error",
        code: "finding-unlabeled",
        message: `${label} has no confidence label (High, Medium, or Low)`,
      });
    }
  };
  const subBlocks = section.split(/^###\s+/m).slice(1);
  if (subBlocks.length > 0) {
    for (const block of subBlocks) {
      const title = block.split("\n")[0]!.trim() || "a Key Findings sub-section";
      check(title, block);
    }
  } else {
    const chunks = section.split(/^\s*\*\*Finding:\*\*/im).slice(1);
    for (const chunk of chunks) check("a **Finding:** entry", chunk);
    if (chunks.length === 0) {
      findings.push({ level: "error", code: "finding-missing", message: "Key Findings has no finding entries" });
    }
  }
  return findings;
}

function shapeBlockFindings(manifest: ReportManifest | undefined, sections: string[]): ReportFinding[] {
  const findings: ReportFinding[] = [];
  if (typeof manifest?.shape !== "string") return findings;
  const shape = SHAPE_VALUES.find((value) => normalizeValue(value) === normalizeValue(manifest.shape!));
  if (shape === undefined || SHAPE_BLOCKS[shape] === undefined) return findings;
  for (const required of SHAPE_BLOCKS[shape]!) {
    const wanted = normalizeHeading(required.heading);
    const present = sections.some((section) => {
      const normalized = normalizeHeading(section);
      return required.prefix ? normalized.startsWith(wanted) : normalized === wanted;
    });
    if (!present) {
      findings.push({
        level: "error",
        code: "shape-block",
        message: `${shape} report is missing the ${required.heading} block`,
      });
    }
  }
  return findings;
}

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length <= 3) return 1;
  const groups = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

function readabilityGrade(text: string): number {
  const prose = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\|/g, " ")
    .replace(/[#*_>`~-]/g, " ");
  const words = prose.match(/[A-Za-z]+/g) ?? [];
  const sentences = Math.max(1, (prose.match(/[.!?]+/g) ?? []).length);
  if (words.length === 0) return 0;
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
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

  const manifestMatch = MANIFEST_FENCE.exec(text);
  const firstSection = text.search(/^##\s+/m);
  if (manifestMatch !== null && firstSection !== -1 && manifestMatch.index > firstSection) {
    findings.push({ level: "error", code: "manifest-placement", message: "report-manifest block must appear before the first report section" });
  }

  const manifestResult = extractManifest(text);
  let manifest: ReportManifest | undefined;
  if (!manifestResult.ok) {
    findings.push({ level: "error", code: "manifest-missing", message: manifestResult.message });
  } else {
    manifest = manifestResult.value;
    findings.push(...validateManifest(manifest));
    findings.push(...shapeBlockFindings(manifest, sections));
  }

  const register = parseSourceRegister(text);
  findings.push(...register.findings);
  if (!register.sources.size) {
    findings.push({ level: "error", code: "register-empty", message: "Source Register has no S# rows with a URL" });
  }

  findings.push(...validateCitations(text, register.sources));
  findings.push(...validateKeyFindings(text));
  findings.push(...validateEvidence(text));

  const grade = readabilityGrade(text);
  if (grade > READABILITY_GRADE_THRESHOLD) {
    findings.push({
      level: "warning",
      code: "readability-high",
      message: `report reads at grade ${grade.toFixed(1)}; consider plainer language (advisory, threshold ${READABILITY_GRADE_THRESHOLD})`,
    });
  }

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
