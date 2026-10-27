// @implements REQ-129
// @implements REQ-129 unknown-posture
import { describe, it, expect } from "vitest";
import type { ProviderConfig } from "./types.js";
import { derivePrivacy } from "./privacy.js";

function provider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    tier: "free_http",
    capabilities: ["web_search"],
    rate_limit: {},
    enabled: true,
    priority: 10,
    ...overrides,
  };
}

describe("derivePrivacy (REQ-129)", () => {
  it("derives forwarding and account requirements from the tier", () => {
    expect(derivePrivacy(provider({ tier: "free_http" })).query_forwarding).toBe("origin");
    expect(derivePrivacy(provider({ tier: "builtin" })).query_forwarding).toBe("origin");
    expect(derivePrivacy(provider({ tier: "keyed_http" })).query_forwarding).toBe("third_party");
    expect(derivePrivacy(provider({ tier: "self_hosted_http" })).query_forwarding).toBe("none");
    expect(derivePrivacy(provider({ tier: "keyed_http" })).requires_account).toBe(true);
    expect(derivePrivacy(provider({ tier: "self_hosted_http" })).requires_account).toBe(false);
  });

  it("reports retention as unknown rather than assuming privacy", () => {
    expect(derivePrivacy(provider()).retains_query).toBe("unknown");
  });

  it("lets explicit overrides take precedence over derivation", () => {
    const posture = derivePrivacy(
      provider({
        tier: "self_hosted_http",
        resells: true,
        privacy: { query_forwarding: "third_party", retains_query: false, requires_account: true, resells: false, notes: "upstream" },
      }),
    );
    expect(posture.query_forwarding).toBe("third_party");
    expect(posture.retains_query).toBe(false);
    expect(posture.requires_account).toBe(true);
    expect(posture.resells).toBe(false);
    expect(posture.notes).toBe("upstream");
  });

  it("defaults resale to the provider's resells flag", () => {
    expect(derivePrivacy(provider({ resells: true })).resells).toBe(true);
    expect(derivePrivacy(provider({ resells: false })).resells).toBe(false);
  });
});
