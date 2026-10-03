// @implements REQ-036
// Bounded latency tracking for provider health reporting (REQ-036): each
// provider keeps a sliding window of recent samples so `inspect_providers`
// latency is computed over a bounded window rather than unbounded all-time
// accumulation. Extracted from src/index.ts so the bound is unit-testable.
// `getWindowSize` is read per sample so a hot-reloaded config takes effect.
export interface LatencyTracker {
  track(provider: string, latencyMs: number): void;
  avg(provider: string): number;
  total(): number;
}

interface LatencyEntry {
  latencies: number[];
  timestamps: number[];
}

export function createLatencyTracker(getWindowSize: () => number, now: () => number = Date.now): LatencyTracker {
  const samples: Record<string, LatencyEntry> = {};
  let totalRequests = 0;

  return {
    track(provider: string, latencyMs: number): void {
      totalRequests++;
      const windowSize = getWindowSize();
      if (!samples[provider]) samples[provider] = { latencies: [], timestamps: [] };
      const entry = samples[provider];
      entry.latencies.push(latencyMs);
      entry.timestamps.push(now());
      while (entry.latencies.length > windowSize) {
        entry.latencies.shift();
        entry.timestamps.shift();
      }
    },

    avg(provider: string): number {
      const entry = samples[provider];
      if (!entry || entry.latencies.length === 0) return 0;
      return entry.latencies.reduce((a, b) => a + b, 0) / entry.latencies.length;
    },

    total(): number {
      return totalRequests;
    },
  };
}
