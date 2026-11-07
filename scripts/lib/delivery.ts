// delivery.ts — delivery metrics over git history.
//
// Split from scripts/metrics.ts so the loop audit reports the same numbers.
// The readers shell out to git; the computation (`deliveryReport`) is pure and
// unit-tested over timestamp arrays. No network.

import { execFileSync } from "node:child_process";

export const DAY = 86_400;

export interface DeliveryReport {
  windowDays: number;
  pushes: number;
  deploymentFrequency: number;
  leadTimeMedian: number;
  leadTimeP90: number;
  commitsPerPushMedian: number;
  commitsPerPushMax: number;
  pipelineCommits: number;
  pipelineFollowUps: number;
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function numbers(text: string): number[] {
  return text
    .split("\n")
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isFinite(value));
}

/** pushTimestamps — origin/main reflog entries created by a push, in seconds. */
export function pushTimestamps(root: string): number[] {
  let raw = "";
  try {
    raw = git(root, ["reflog", "show", "origin/main", "--date=raw"]);
  } catch {
    // No remote-tracking reflog (fresh clone or no origin): the window cannot
    // be reconstructed, and that is reported rather than guessed.
    return [];
  }
  const stamps = new Set<number>();
  for (const line of raw.split("\n")) {
    if (!line.includes("update by push")) continue;
    const match = /@\{(\d+) [+-]\d{4}\}/.exec(line);
    if (match) stamps.add(Number(match[1]));
  }
  return [...stamps].sort((a, b) => a - b);
}

/** commitTimes — every commit timestamp, in seconds. */
export function commitTimes(root: string): number[] {
  return numbers(git(root, ["log", "--format=%ct"]));
}

/** pipelineCommitTimes — commit timestamps that touched the push pipeline. */
export function pipelineCommitTimes(root: string): number[] {
  return numbers(
    git(root, ["log", "--format=%ct", "--", "scripts/push-pipeline.sh", "scripts/pipeline"]),
  );
}

/** percentile — nearest-rank percentile; NaN for an empty input. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

export function median(values: number[]): number {
  return percentile(values, 0.5);
}

/** hours — a compact duration for display. */
export function hours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

/**
 * deliveryReport — the four delivery numbers. Returns null when fewer than two
 * pushes are recorded: a window needs two endpoints, and reporting zeros would
 * look like a measured calm.
 */
export function deliveryReport(
  pushes: number[],
  commits: number[],
  pipelineTimes: number[],
): DeliveryReport | null {
  if (pushes.length < 2) return null;
  const windowDays = (pushes[pushes.length - 1] - pushes[0]) / DAY;

  const leadTimes: number[] = [];
  for (const t of commits) {
    const next = pushes.find((p) => p >= t);
    if (next !== undefined) leadTimes.push(next - t);
  }

  const perPush: number[] = [];
  let previous = 0;
  for (const p of pushes) {
    perPush.push(commits.filter((t) => t > previous && t <= p).length);
    previous = p;
  }

  let followUps = 0;
  for (const t of pipelineTimes) {
    if (pipelineTimes.some((other) => other > t && other - t <= 2 * DAY)) followUps += 1;
  }

  return {
    windowDays,
    pushes: pushes.length,
    deploymentFrequency: windowDays === 0 ? 0 : pushes.length / windowDays,
    leadTimeMedian: median(leadTimes),
    leadTimeP90: percentile(leadTimes, 0.9),
    commitsPerPushMedian: median(perPush),
    commitsPerPushMax: perPush.length === 0 ? 0 : Math.max(...perPush),
    pipelineCommits: pipelineTimes.length,
    pipelineFollowUps: followUps,
  };
}
