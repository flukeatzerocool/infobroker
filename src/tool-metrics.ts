// @implements REQ-024c

interface ToolEntry {
  calls: number;
  errors: number;
  samples: number[];
}

export interface ToolMetricsSnapshot {
  calls: number;
  errors: number;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
}

export interface ToolMetrics {
  record(name: string, durationMs: number, ok: boolean): void;
  snapshot(): Record<string, ToolMetricsSnapshot>;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

export function createToolMetrics(windowSize = 200): ToolMetrics {
  const tools: Record<string, ToolEntry> = {};

  return {
    record(name: string, durationMs: number, ok: boolean): void {
      const entry = (tools[name] ??= { calls: 0, errors: 0, samples: [] });
      entry.calls++;
      if (!ok) entry.errors++;
      entry.samples.push(Math.max(0, durationMs));
      while (entry.samples.length > windowSize) entry.samples.shift();
    },

    snapshot(): Record<string, ToolMetricsSnapshot> {
      const out: Record<string, ToolMetricsSnapshot> = {};
      for (const [name, entry] of Object.entries(tools)) {
        const sorted = [...entry.samples].sort((a, b) => a - b);
        out[name] = {
          calls: entry.calls,
          errors: entry.errors,
          p50_ms: Math.round(percentile(sorted, 0.5)),
          p95_ms: Math.round(percentile(sorted, 0.95)),
          max_ms: Math.round(sorted[sorted.length - 1] ?? 0),
        };
      }
      return out;
    },
  };
}
