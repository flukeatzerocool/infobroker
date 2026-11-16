// @implements REQ-078
// feature-taxonomy.ts — reconcile the README's §MCP Server feature tour against
// the spec §D feature taxonomy, and check the taxonomy's own invariants
// (exactly one home per tool and REQ, gate column = union of member manifest
// gates). Group numbers/names are derived from infobroker.md at validate time;
// only the marketing-title→group binding is declared here, because README prose
// is intentionally non-goal'd away from REQ citations, so features are matched
// at group granularity rather than per-REQ.

export interface FeatureArea {
  group: number;
  name: string;
}

// One §D table row. Columns are `# | Feature area | Tools | Primary REQs | Gate`;
// tools are the backticked names in the THIRD cell only (placeholder text such
// as `(all 7 tools)` yields none), REQs the fourth, gates the fifth.
export interface FeatureTaxonomyRow {
  group: number;
  name: string;
  tools: string[];
  reqs: string[];
  gates: string[];
}

export function parseFeatureTaxonomy(specText: string): FeatureTaxonomyRow[] {
  const taxIdx = specText.indexOf("## §D Appendix: Feature Taxonomy");
  if (taxIdx === -1) return [];
  // Slice to end of file, as this module always has: no appendix after §D
  // starts a table row with an integer first cell, and narrowing the slice
  // would be a behaviour change for `deriveFeatureAreas`.
  const appendix = specText.slice(taxIdx);
  const rows: FeatureTaxonomyRow[] = [];
  for (const line of appendix.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 7 || !/^\d+$/.test(cells[1] ?? "")) continue;
    const name = cells[2];
    if (!name) continue;
    rows.push({
      group: Number(cells[1]),
      name,
      tools: [...cells[3].matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]),
      reqs: [...cells[4].matchAll(/REQ-\d{3}[a-z]?/g)].map((m) => m[0]),
      gates: [...cells[5].matchAll(/\bG[0-3]\b/g)].map((m) => m[0]),
    });
  }
  return rows;
}

// Parse the §9.5 manifest's gate column: REQ id → declared gate tokens. The
// section runs from the heading line to the next `##`/`###` heading.
export function parseManifestGates(specText: string): Map<string, string[]> {
  const gates = new Map<string, string[]>();
  const start = specText.indexOf("### 9.5 REQ Manifest");
  if (start === -1) return gates;
  const lineEnd = specText.indexOf("\n", start);
  const rest = specText.slice(lineEnd === -1 ? specText.length : lineEnd + 1);
  const next = /^#{2,3}\s/m.exec(rest);
  const section = next ? rest.slice(0, next.index) : rest;
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (!/^REQ-\d{3}[a-z]?$/.test(cells[1] ?? "")) continue;
    gates.set(cells[1], [...(cells[4] ?? "").matchAll(/\bG[0-3]\b/g)].map((m) => m[0]));
  }
  return gates;
}

const GATE_ORDER = ["G0", "G1", "G2", "G3"] as const;

function canonicalGates(gates: readonly string[]): string[] {
  return [...new Set(gates)].sort((a, b) => GATE_ORDER.indexOf(a as (typeof GATE_ORDER)[number]) - GATE_ORDER.indexOf(b as (typeof GATE_ORDER)[number]));
}

// Check the taxonomy's invariants against the live spec text. `toolSlugs` comes
// from live tool registration and `reqIds` from the §4 body, so neither list is
// hardcoded here. Returns findings in emission order; the caller sets the exit
// code.
export function checkFeatureTaxonomyCoverage(
  specText: string,
  toolSlugs: string[],
  reqIds: string[],
): string[] {
  const findings: string[] = [];
  if (specText.indexOf("## §D Appendix: Feature Taxonomy") === -1) {
    return ["Feature taxonomy appendix (§D) not found"];
  }

  const rows = parseFeatureTaxonomy(specText);

  const byGroup = new Map<number, FeatureTaxonomyRow[]>();
  for (const row of rows) {
    if (!byGroup.has(row.group)) byGroup.set(row.group, []);
    byGroup.get(row.group)!.push(row);
  }
  const duplicateGroups = [...byGroup.entries()].filter(([, groupRows]) => groupRows.length > 1);
  for (const [group] of duplicateGroups) {
    findings.push(`Feature taxonomy (§D): group ${group} appears more than once`);
  }
  // A duplicated group also duplicates its tools and REQs; report the root
  // cause only rather than the same defect once per member.
  if (duplicateGroups.length > 0) return findings;

  const emitDuplicate = (kind: "tool" | "REQ", token: string, homes: FeatureTaxonomyRow[]): void => {
    const first = homes[0];
    const others = homes.slice(1).map((row) => `group ${row.group}`).join(", ");
    const noun = kind === "tool" ? `tool \`${token}\`` : token;
    findings.push(
      `Feature taxonomy (§D) group ${first.group} '${first.name}': ${noun} also appears in ${others} — exactly one home required`,
    );
  };

  for (const tool of toolSlugs) {
    const homes = rows.filter((row) => row.tools.includes(tool));
    if (homes.length === 0) {
      findings.push(`Feature taxonomy (§D) is missing tool \`${tool}\``);
    } else if (homes.length > 1) {
      emitDuplicate("tool", tool, homes);
    }
  }

  for (const req of reqIds) {
    const homes = rows.filter((row) => row.reqs.includes(req));
    if (homes.length === 0) {
      findings.push(`Feature taxonomy (§D) is missing ${req}`);
    } else if (homes.length > 1) {
      emitDuplicate("REQ", req, homes);
    }
  }

  if (specText.indexOf("### 9.5 REQ Manifest") === -1) {
    findings.push("REQ manifest (§9.5) not found");
    return findings;
  }
  const manifestGates = parseManifestGates(specText);
  for (const row of rows) {
    const suppliers = new Map<string, string[]>();
    for (const req of row.reqs) {
      const gates = manifestGates.get(req) ?? [];
      if (gates.length === 0) {
        findings.push(
          `Feature taxonomy (§D) group ${row.group} '${row.name}': ${req} declares no gate in §9.5`,
        );
        continue;
      }
      for (const gate of gates) {
        if (!suppliers.has(gate)) suppliers.set(gate, []);
        suppliers.get(gate)!.push(req);
      }
    }
    const union = canonicalGates([...suppliers.keys()]);
    const declared = canonicalGates(row.gates);
    if (union.length !== declared.length || union.some((gate, i) => gate !== declared[i])) {
      findings.push(
        `Feature taxonomy (§D) group ${row.group} '${row.name}': Gate [${declared.join(", ")}] does not match its REQs' manifest gates [${union.join(", ")}]`,
      );
    }
  }

  return findings;
}

// §D groups the README documents as the user-facing feature tour: Groups 1–5
// plus Group 7 (Client Artifacts). Groups 6 and 8 are maintainer/spec concerns
// surfaced only in the spec (per the §D notes), not in the README.
// Audience-facing groups the README tour must cover. Mirrors
// user-surface.ts's AUDIENCE_GROUPS deliberately; both exclude group 11
// (Processing & Provenance), which is cross-cutting and has no tour section.
export const USER_FACING_GROUPS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 7]);

// README §MCP Server subsection title → §D feature-area group.
export const README_FEATURE_GROUPS: Readonly<Record<string, number>> = {
  "Unified Search": 1,
  "Content Extraction": 1,
  Citations: 1,
  "Provider Intelligence": 2,
  "Multi-Source Verification": 3,
  "Knowledge Base": 4,
  "Operational Visibility": 5,
  "Research Pipeline": 7,
};

// Parse the §D feature taxonomy table out of the spec text, returning one entry
// per distinct group number (name trimmed, deduplicated by group).
export function deriveFeatureAreas(specText: string): FeatureArea[] {
  const areas: FeatureArea[] = [];
  for (const row of parseFeatureTaxonomy(specText)) {
    if (!row.name) continue;
    if (areas.some((area) => area.group === row.group)) continue;
    areas.push({ group: row.group, name: row.name });
  }
  return areas;
}

export interface FeatureReconcileIssue {
  error: boolean;
  msg: string;
}

// Extract the feature-tour subsections (### headings between "## MCP Server"
// and "## Skills") and reconcile them against the §D feature areas: every
// subsection must map to a real §D group (no invented features), and every
// user-facing §D group must be covered.
export function reconcileReadmeFeatures(
  readmeText: string,
  featureAreas: FeatureArea[],
): FeatureReconcileIssue[] {
  const issues: FeatureReconcileIssue[] = [];

  const mcpStart = readmeText.indexOf("## MCP Server");
  const skillsStart = readmeText.indexOf("## Skills");
  const tour =
    mcpStart === -1
      ? readmeText
      : readmeText.slice(mcpStart, skillsStart === -1 ? undefined : skillsStart);

  const subTitles: string[] = [];
  for (const line of tour.split("\n")) {
    const m = line.match(/^###\s+(.+)/);
    if (m) subTitles.push(m[1].trim());
  }

  const coveredGroups = new Set<number>();
  for (const title of subTitles) {
    const group = README_FEATURE_GROUPS[title];
    if (group === undefined) {
      issues.push({
        error: true,
        msg: `README feature section '${title}' has no §D feature area — add it to README_FEATURE_GROUPS or remove the section`,
      });
      continue;
    }
    if (!featureAreas.some((a) => a.group === group)) {
      issues.push({
        error: true,
        msg: `README feature section '${title}' maps to §D group ${group}, which is missing from the spec taxonomy`,
      });
    }
    coveredGroups.add(group);
  }

  for (const area of featureAreas) {
    if (USER_FACING_GROUPS.has(area.group) && !coveredGroups.has(area.group)) {
      issues.push({
        error: true,
        msg: `§D feature area ${area.group} '${area.name}' is not covered by the README feature tour`,
      });
    }
  }

  return issues;
}
