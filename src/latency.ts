// @implements REQ-036
// Bounded latency tracking for provider health reporting (REQ-036): each
// provider keeps a sliding window of recent samples so `inspect_providers`
// latency is computed over a bounded window rather than unbounded all-time
// accumulation. Extracted from src/index.ts so the bound is unit-testable.
// The window is resolved per sample and per read, so a hot-reloaded config
// takes effect without a restart.
export interface LatencyWindow {
  /** Maximum samples retained by the count bound. */
  size: number;
  /** Maximum age in milliseconds for the time bound. */
  ms?: number;
  /** `count` ignores age, `time` ignores the sample count, `both` applies the tighter. */
  strategy?: "count" | "time" | "both";
}

export interface LatencyTracker {
  track(provider: string, latencyMs: number): void;
  avg(provider: string): number;
  total(): number;
}

interface LatencyEntry {
  latencies: number[];
  timestamps: number[];
}

function normalizeWindow(spec: LatencyWindow | number): LatencyWindow {
  return typeof spec === "number" ? { size: spec, strategy: "count" } : spec;
}

function prune(entry: LatencyEntry, window: LatencyWindow, at: number): void {
  const strategy = window.strategy ?? "count";
  if (strategy === "count" || strategy === "both") {
    while (entry.latencies.length > window.size) {
      entry.latencies.shift();
      entry.timestamps.shift();
    }
  }
  if ((strategy === "time" || strategy === "both") && window.ms !== undefined) {
    const cutoff = at - window.ms;
    while (entry.timestamps.length > 0 && entry.timestamps[0] <= cutoff) {
      entry.latencies.shift();
      entry.timestamps.shift();
    }
  }
}

export function createLatencyTracker(
  getWindow: () => LatencyWindow | number,
  now: () => number = Date.now,
): LatencyTracker {
  const samples: Record<string, LatencyEntry> = {};
  let totalRequests = 0;

  return {
    track(provider: string, latencyMs: number): void {
      totalRequests++;
      if (!samples[provider]) samples[provider] = { latencies: [], timestamps: [] };
      const entry = samples[provider];
      const at = now();
      entry.latencies.push(latencyMs);
      entry.timestamps.push(at);
      prune(entry, normalizeWindow(getWindow()), at);
    },

    avg(provider: string): number {
      const entry = samples[provider];
      if (!entry) return 0;
      // REQ-036: an idle provider must not keep serving a stale average. The
      // read path prunes by age as well as the write path.
      prune(entry, normalizeWindow(getWindow()), now());
      if (entry.latencies.length === 0) return 0;
      return entry.latencies.reduce((a, b) => a + b, 0) / entry.latencies.length;
    },

    total(): number {
      return totalRequests;
    },
  };
}
