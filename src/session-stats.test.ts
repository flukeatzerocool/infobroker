// @implements REQ-111a
import { describe, it, expect } from "vitest";
import { createSessionStats } from "./session-stats.js";

describe("session statistics (REQ-111a)", () => {
  it("counts HTTP calls, errors, and average latency per provider", () => {
    const stats = createSessionStats(() => 1_700_000_000_000);
    stats.recordHttp("duckduckgo", true, 100);
    stats.recordHttp("duckduckgo", false, 300);
    stats.recordHttp("wikipedia", true, 50);

    const snapshot = stats.snapshot();
    expect(snapshot.since).toBe(new Date(1_700_000_000_000).toISOString());
    expect(snapshot.providers.duckduckgo).toMatchObject({
      http_calls: 2,
      http_errors: 1,
      avg_latency_ms: 200,
    });
    expect(snapshot.providers.wikipedia).toMatchObject({ http_calls: 1, http_errors: 0, avg_latency_ms: 50 });
  });

  it("counts attempt outcomes separately from HTTP calls", () => {
    const stats = createSessionStats();
    stats.recordAttempt("duckduckgo", "ok");
    stats.recordAttempt("duckduckgo", "empty");
    stats.recordAttempt("duckduckgo", "cooldown");
    stats.recordAttempt("duckduckgo", "quota");
    stats.recordAttempt("wikipedia", "error", "parse_error");

    const snapshot = stats.snapshot().providers;
    expect(snapshot.duckduckgo).toMatchObject({
      attempts: 4,
      ok: 1,
      empty: 1,
      cooldown_skips: 1,
      quota_skips: 1,
      errors: 0,
      http_calls: 0,
    });
    expect(snapshot.wikipedia).toMatchObject({ attempts: 1, errors: 1, last_error_code: "parse_error" });
  });

  it("resets to an empty snapshot", () => {
    const stats = createSessionStats();
    stats.recordHttp("duckduckgo", true, 10);
    stats.recordAttempt("duckduckgo", "ok");
    stats.reset();
    expect(stats.snapshot().providers).toEqual({});
  });
});
