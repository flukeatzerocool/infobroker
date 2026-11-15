// tmp-inode.ts — temp-filesystem inode pressure for the gate runner.
//
// `run-gates.ts` samples this once before the suite and prints one advisory
// line above the threshold. It never changes an exit code: temp exhaustion is
// an environment condition, not a defect in the tree under test.
import { statfsSync } from "node:fs";
import { tmpdir } from "node:os";

/** Warn above this share of inodes used. */
export const DEFAULT_THRESHOLD_PERCENT = 80;

/** Share of inodes used, or `null` when the filesystem reports no totals. */
export function inodeUsedPercent(stat: { files: number; ffree: number }): number | null {
  if (!Number.isFinite(stat.files) || stat.files <= 0) return null;
  const used = stat.files - stat.ffree;
  return (used / stat.files) * 100;
}

/**
 * The inode share used on the filesystem holding `path`, or `null` when
 * `statfs` is unavailable on this platform or the path.
 */
export function tempInodePercent(path: string = tmpdir()): number | null {
  try {
    const stat = statfsSync(path);
    return inodeUsedPercent({ files: Number(stat.files), ffree: Number(stat.ffree) });
  } catch {
    // statfs is not implemented everywhere (notably some Windows paths); a
    // missing pressure signal is not worth failing a gate run over.
    return null;
  }
}

/** The advisory line for a known pressure reading, or `null` below the threshold. */
export function warningForPercent(
  percent: number | null,
  path: string,
  threshold: number = DEFAULT_THRESHOLD_PERCENT,
): string | null {
  if (percent === null || percent <= threshold) return null;
  return `gates: warn: ${percent.toFixed(0)}% of ${path} inodes used (threshold ${threshold}%); run npm run clean:tmp -- --dry-run`;
}

/** The advisory line for the filesystem holding `path`, if it is under pressure. */
export function inodeWarningLine(
  path: string = tmpdir(),
  threshold: number = DEFAULT_THRESHOLD_PERCENT,
): string | null {
  return warningForPercent(tempInodePercent(path), path, threshold);
}
