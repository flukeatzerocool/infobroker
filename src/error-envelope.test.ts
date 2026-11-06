// @implements REQ-002 rate-limited-precedence
// @implements REQ-038 cooldown-reporting inspect-providers
import { describe, it, expect } from "vitest";
import { chainExhaustion, providerRemediation } from "./error-envelope.js";

describe("provider remediation (REQ-038)", () => {
  it("appends the provider-status surface", () => {
    expect(providerRemediation("Retry later")).toBe(
      "Retry later. Use infobroker_inspect_providers action=health to see provider status.",
    );
  });

  it("is idempotent when the hint already names the surface", () => {
    const hint = "Retry later, or check provider status with inspect_providers";
    expect(providerRemediation(hint)).toBe(hint);
  });
});

describe("chain exhaustion (REQ-002, REQ-038)", () => {
  it("reports rate_limited when the failure was classified as rate limiting", () => {
    const body = chainExhaustion(["duckduckgo", "marginalia"], {
      rateLimited: true,
      quotaExhausted: { marginalia: 0 },
      remainingMs: () => 0,
    });
    expect(body.status).toBe("error");
    expect(body.provider).toBe("none");
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).toContain("duckduckgo, marginalia");
    expect(body.error.remediation).toMatch(/inspect_providers action=health/);
    expect(body.error.details?.exhausted_chain).toEqual(["duckduckgo", "marginalia"]);
    expect(body.error.details?.quota_exhausted).toEqual([{ slug: "marginalia", remaining_daily: 0 }]);
  });

  it("reports a real retry_after_ms from an active cooldown, even without the rateLimited flag", () => {
    // A bot challenge puts the provider in cooldown without setting
    // rateLimited; the remaining time must still be reported.
    const body = chainExhaustion(["duckduckgo", "mojeek"], {
      rateLimited: false,
      remainingMs: (slug) => (slug === "duckduckgo" ? 29000 : 0),
    });
    expect(body.error.code).toBe("all_providers_exhausted");
    expect(body.error.details?.retry_after_ms).toBe(29000);
    expect(body.error.details?.cooling_down).toEqual([{ provider: "duckduckgo", remaining_ms: 29000 }]);
  });

  it("omits retry_after_ms and cooling_down when nothing is cooling down", () => {
    const body = chainExhaustion(["duckduckgo"], { rateLimited: false, remainingMs: () => 0 });
    expect(body.error.details).not.toHaveProperty("retry_after_ms");
    expect(body.error.details).not.toHaveProperty("cooling_down");
  });

  it("uses the attempted chain for provenance while naming the serving chain", () => {
    const body = chainExhaustion(["duckduckgo"], {
      rateLimited: false,
      attempted: ["duckduckgo", "marginalia", "mojeek"],
      remainingMs: () => 0,
    });
    expect(body.error.message).toContain("duckduckgo");
    expect(body.error.details?.exhausted_chain).toEqual(["duckduckgo", "marginalia", "mojeek"]);
  });
});
