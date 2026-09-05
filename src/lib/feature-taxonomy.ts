// @implements REQ-078
// feature-taxonomy.ts — reconcile the README's §MCP Server feature tour against
// the spec §D feature taxonomy. Group numbers/names are derived from
// infobroker.md at validate time; only the marketing-title→group binding is
// declared here, because README prose is intentionally non-goal'd away from REQ
// citations, so features are matched at group granularity rather than per-REQ.

export interface FeatureArea {
  group: number;
  name: string;
}

// §D groups the README documents as the user-facing feature tour: Groups 1–5
// plus Group 7 (Client Artifacts). Groups 6 and 8 are maintainer/spec concerns
// surfaced only in the spec (per the §D notes), not in the README.
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

// Parse the §D feature taxonomy table out of the spec text, returning one
// entry per group number (name trimmed, deduplicated by group).
export function deriveFeatureAreas(specText: string): FeatureArea[] {
  const taxIdx = specText.indexOf("## §D Appendix: Feature Taxonomy");
  if (taxIdx === -1) return [];
  const appendix = specText.slice(taxIdx);
  const areas: FeatureArea[] = [];
  for (const line of appendix.split("\n")) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const group = Number(m[1]);
    const name = m[2].trim();
    if (!name || /^[-:]+$/.test(name)) continue;
    if (areas.some((a) => a.group === group)) continue;
    areas.push({ group, name });
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
