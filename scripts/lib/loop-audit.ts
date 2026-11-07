// loop-audit.ts — pure helpers for the session-loop report.
//
// The report answers one question the delivery metrics do not: did each
// increment's record agree with the date it was committed? A CHANGELOG heading
// written after midnight, or a version stamped from the previous day, drifts
// silently because no gate compares the heading to the commit. These helpers
// keep that comparison unit-testable without git or the filesystem.
//
// Exit codes: n/a (library).

export interface HeadingEntry {
  /** `YYYY.M.D` exactly as the heading spells it. */
  version: string;
  /** Normalized `YYYY-MM-DD`, or null when the version is not a CalVer date. */
  date: string | null;
  title: string;
}

export interface DriftRow {
  sha: string;
  commitDate: string;
  heading: string | null;
  headingDate: string | null;
  drift: boolean;
}

/**
 * parseHeading — the first `## <version> — <title>` heading in a CHANGELOG.
 * Returns null when the file has no heading in that shape.
 */
export function parseHeading(text: string): HeadingEntry | null {
  const match = /^## ([0-9][0-9.]*)[ \u2014-]+(.+)$/m.exec(text);
  if (!match) return null;
  const version = match[1] as string;
  return { version, date: versionToDate(version), title: (match[2] as string).trim() };
}

/**
 * versionToDate — `2026.11.07` or `2026.11.7` to `2026-11-07`; null for a
 * version that is not a three-part date (a SemVer prerelease, for example).
 */
export function versionToDate(version: string): string | null {
  const match = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(version);
  if (!match) return null;
  const [, year, month, day] = match as unknown as [string, string, string, string];
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * driftRows — compare each commit's author date to the CHANGELOG heading it
 * left behind. A missing heading or an unparseable version is reported as
 * unknown, not as drift: the audit is a signal, not a gate.
 */
export function driftRows(entries: Array<{ sha: string; commitDate: string; changelog: string }>): DriftRow[] {
  return entries.map((entry) => {
    const heading = parseHeading(entry.changelog);
    return {
      sha: entry.sha,
      commitDate: entry.commitDate,
      heading: heading?.version ?? null,
      headingDate: heading?.date ?? null,
      drift: heading?.date !== null && heading?.date !== undefined && heading.date !== entry.commitDate,
    };
  });
}
