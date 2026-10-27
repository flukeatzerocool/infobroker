// @implements REQ-126
// Deterministic report exports (REQ-126): JSON (manifest + sections + parsed
// sources), CSV for the Source Register, and CSV for manifest claims. Pure
// functions over a validated Markdown report; no filesystem or network.

import { validateReport } from "./report-manifest.js";

export interface ReportJson {
  manifest: unknown;
  sections: string[];
  sources: Array<{ id: string; url: string }>;
  claims: Array<{ claim: string; verdict?: string; confidence?: string; sources: string[] }>;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
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

export function reportToJson(markdown: string): ReportJson {
  const validation = validateReport(markdown);
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

export function reportToSourcesCsv(markdown: string): string {
  const rows = sourceRegisterRows(markdown);
  return rows.map((cells) => cells.map(csvCell).join(",")).join("\n");
}

export function reportToClaimsCsv(markdown: string): string {
  const validation = validateReport(markdown);
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
