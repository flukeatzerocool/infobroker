// @implements REQ-031 REQ-021
// Hedged (speculative) fallback dispatch: bound the tail latency of a
// priority-ordered provider chain by racing a lower-priority provider against
// a slow primary, rather than waiting out the primary's full timeout before
// advancing. Pure and unit-tested so the tail-latency contract is provable
// without network access.

export interface HedgeDelayOptions {
  minMs: number;
  maxMs: number;
}

// When the primary provider has a recorded average latency, the hedge fires
// once the primary has been out for longer than it typically takes —
// clamped to a sane window. With no latency history, the hedge fires at the
// floor (a conservative, early hedge for unknown providers).
export function computeHedgeDelay(avgLatencyMs: number, opts: HedgeDelayOptions): number {
  if (avgLatencyMs > 0) {
    return Math.min(opts.maxMs, Math.max(opts.minMs, avgLatencyMs));
  }
  return opts.minMs;
}

export interface RaceTask<T> {
  slug: string;
  run: () => Promise<T | null | undefined>;
}

export interface RaceOutcome<T> {
  slug: string;
  value: T;
}

export interface RaceOptions {
  // A slug whose success is preferred over a non-preferred winner, within the
  // grace window. Used to keep a marginally-slow primary serving instead of a
  // lower-quality fallback.
  prefer?: string;
  graceMs?: number;
}

interface Failure {
  slug: string;
  reason: string;
}

function isEmpty<T>(value: T): boolean {
  return value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

// Fire every task immediately. Resolve with the first successful (non-empty)
// result. When `prefer` is set and `graceMs` is positive, a non-preferred
// winner is held for up to `graceMs` so the preferred task can still win; a
// preferred success always takes precedence during that window. When every
// task fails (returns empty or throws), reject with the aggregated reasons.
export async function raceFirstSuccess<T>(
  tasks: RaceTask<T>[],
  opts: RaceOptions = {},
): Promise<RaceOutcome<T>> {
  const prefer = opts.prefer;
  const graceMs = Math.max(0, opts.graceMs ?? 0);
  const failures: Failure[] = [];

  return new Promise<RaceOutcome<T>>((resolve, reject) => {
    let done = false;
    let remaining = tasks.length;
    let winner: RaceOutcome<T> | null = null;
    let winnerPendingGrace = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    let preferredFailed = prefer === undefined;

    const commit = (r: RaceOutcome<T>) => {
      if (done) return;
      done = true;
      if (graceTimer) clearTimeout(graceTimer);
      resolve(r);
    };

    const settleFailure = () => {
      remaining--;
      if (remaining === 0 && !done) {
        done = true;
        reject(
          new Error(
            `all providers failed: ${failures.map((f) => `${f.slug}(${f.reason})`).join(", ")}`,
          ),
        );
      }
    };

    const onPreferredFailure = () => {
      preferredFailed = true;
      if (winnerPendingGrace && winner) {
        // The preferred provider failed while an alternate was in grace —
        // release the alternate immediately.
        commit(winner);
      }
    };

    for (const task of tasks) {
      const isPreferred = prefer !== undefined && task.slug === prefer;
      Promise.resolve()
        .then(() => task.run())
        .then((value) => {
          if (isEmpty(value)) {
            failures.push({ slug: task.slug, reason: "empty result" });
            if (isPreferred) onPreferredFailure();
            settleFailure();
            return;
          }
          const r: RaceOutcome<T> = { slug: task.slug, value: value as T };
          if (done) return;
          if (isPreferred) {
            if (winnerPendingGrace && winner) {
              // Preferred succeeded during the grace window — it wins.
              commit(r);
            } else if (!winner) {
              commit(r);
            } else {
              commit(winner);
            }
            return;
          }
          if (!winner) {
            winner = r;
            if (graceMs > 0 && prefer !== undefined && !preferredFailed) {
              winnerPendingGrace = true;
              graceTimer = setTimeout(() => commit(r), graceMs);
            } else {
              commit(r);
            }
          }
        })
        .catch((e) => {
          failures.push({
            slug: task.slug,
            reason: e instanceof Error ? e.message : String(e),
          });
          if (isPreferred) onPreferredFailure();
          settleFailure();
        });
    }
  });
}
