// @implements REQ-111a
// Bounded per-provider counters for the current server process. The summary is
// exposed through `inspect_providers action=spec`; it stores no per-call data,
// so memory is bounded by the configured provider set.
export type ProviderOutcome = "ok" | "empty" | "error" | "cooldown" | "quota";

export interface ProviderSessionStats {
  http_calls: number;
  http_errors: number;
  attempts: number;
  ok: number;
  empty: number;
  errors: number;
  cooldown_skips: number;
  quota_skips: number;
  avg_latency_ms: number;
  last_error_code?: string;
}

export interface SessionSnapshot {
  since: string;
  providers: Record<string, ProviderSessionStats>;
}

interface ProviderEntry {
  http_calls: number;
  http_errors: number;
  http_ms_total: number;
  attempts: number;
  ok: number;
  empty: number;
  errors: number;
  cooldown_skips: number;
  quota_skips: number;
  last_error_code?: string;
}

export interface SessionStats {
  recordHttp(provider: string, ok: boolean, durationMs: number): void;
  recordAttempt(provider: string, outcome: ProviderOutcome, errorCode?: string): void;
  snapshot(): SessionSnapshot;
  reset(): void;
}

export function createSessionStats(now: () => number = Date.now): SessionStats {
  let since = now();
  let providers: Record<string, ProviderEntry> = {};

  function entry(provider: string): ProviderEntry {
    return (providers[provider] ??= {
      http_calls: 0,
      http_errors: 0,
      http_ms_total: 0,
      attempts: 0,
      ok: 0,
      empty: 0,
      errors: 0,
      cooldown_skips: 0,
      quota_skips: 0,
    });
  }

  return {
    recordHttp(provider, ok, durationMs) {
      const e = entry(provider);
      e.http_calls++;
      if (!ok) e.http_errors++;
      e.http_ms_total += Math.max(0, durationMs);
    },

    recordAttempt(provider, outcome, errorCode) {
      const e = entry(provider);
      e.attempts++;
      if (outcome === "ok") e.ok++;
      else if (outcome === "empty") e.empty++;
      else if (outcome === "cooldown") e.cooldown_skips++;
      else if (outcome === "quota") e.quota_skips++;
      else e.errors++;
      if (errorCode) e.last_error_code = errorCode;
    },

    snapshot(): SessionSnapshot {
      const out: Record<string, ProviderSessionStats> = {};
      for (const [provider, e] of Object.entries(providers)) {
        out[provider] = {
          http_calls: e.http_calls,
          http_errors: e.http_errors,
          attempts: e.attempts,
          ok: e.ok,
          empty: e.empty,
          errors: e.errors,
          cooldown_skips: e.cooldown_skips,
          quota_skips: e.quota_skips,
          avg_latency_ms: e.http_calls > 0 ? Math.round(e.http_ms_total / e.http_calls) : 0,
          ...(e.last_error_code ? { last_error_code: e.last_error_code } : {}),
        };
      }
      return { since: new Date(since).toISOString(), providers: out };
    },

    reset() {
      since = now();
      providers = {};
    },
  };
}

/** Process-wide counters shared by the HTTP seam and the dispatch paths. */
export const sessionStats = createSessionStats();
