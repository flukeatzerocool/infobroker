// @implements REQ-126
// Deterministic report exports (REQ-126): JSON (manifest + sections + parsed
// sources), CSV for the Source Register, and CSV for manifest claims. Pure
// functions over a validated Markdown report; no filesystem or network. Each
// export validates by default and refuses an invalid report; the caller's
// explicit `skipValidation` opt-out is the only bypass.

import { validateReport } from "./report-manifest.js";
import type { ReportFinding, ReportValidation } from "./report-manifest.js";

export interface ReportJson {
  manifest: unknown;
  sections: string[];
  sources: Array<{ id: string; url: string }>;
  claims: Array<{ claim: string; verdict?: string; confidence?: string; sources: string[] }>;
}

/** Export options. `skipValidation` is the caller's explicit opt-out (REQ-126). */
export interface ExportOptions {
  skipValidation?: boolean;
}

/**
 * Raised when an export is asked for an invalid report. The message names the
 * finding codes only; the structured findings stay on `findings` so callers can
 * print or route them without the exception carrying report content.
 */
export class ReportExportError extends Error {
  readonly findings: ReportFinding[];

  constructor(validation: ReportValidation) {
    const codes = [...new Set(validation.findings.filter((finding) => finding.level === "error").map((finding) => finding.code))];
    super(`report failed validation (${codes.join(", ")})`);
    this.name = "ReportExportError";
    this.findings = validation.findings;
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function ensureValidated(markdown: string, options: ExportOptions): ReportValidation {
  const validation = validateReport(markdown);
  if (!options.skipValidation && !validation.ok) throw new ReportExportError(validation);
  return validation;
}

function sourceRegisterRows(markdown: string): string[][] {
  const start = markdown.indexOf("## Source Register");
  if (start === -1) return [];
  const rest = markdown.slice(start);
  const end = rest.indexOf("\n## ", 1);
  const block = end === -1 ? rest : rest.slice(0, end);
  return block
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .filter((line) => !/^\|\s*-+/.test(line.trim()))
    .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length > 1);
}

export function reportToJson(markdown: string, options: ExportOptions = {}): ReportJson {
  const validation = ensureValidated(markdown, options);
  const rows = sourceRegisterRows(markdown);
  const sources = rows.filter((cells) => cells[0] !== "#").map((cells) => ({ id: cells[0] ?? "", url: cells[cells.length - 1] ?? "" }));
  return {
    manifest: validation.manifest ?? null,
    sections: validation.sections,
    sources,
    claims: (validation.manifest?.claims ?? []).map((claim) => ({
      claim: claim.claim,
      verdict: claim.verdict,
      confidence: claim.confidence,
      sources: claim.sources ?? [],
    })),
  };
}

export function reportToSourcesCsv(markdown: string, options: ExportOptions = {}): string {
  ensureValidated(markdown, options);
  const rows = sourceRegisterRows(markdown);
  return rows.map((cells) => cells.map(csvCell).join(",")).join("\n");
}

export function reportToClaimsCsv(markdown: string, options: ExportOptions = {}): string {
  const validation = ensureValidated(markdown, options);
  const header = ["#", "claim", "verdict", "confidence", "likelihood", "sources"];
  const rows = (validation.manifest?.claims ?? []).map((claim, index) => [
    String(index + 1),
    claim.claim,
    claim.verdict ?? "",
    claim.confidence ?? "",
    claim.likelihood ?? "",
    (claim.sources ?? []).join(" "),
  ]);
  return [header, ...rows].map((cells) => cells.map(csvCell).join(",")).join("\n");
}
