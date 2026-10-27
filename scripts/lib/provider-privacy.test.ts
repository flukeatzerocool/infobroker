// @implements REQ-129
import { describe, it, expect } from "vitest";
import { renderProviderPrivacy } from "./provider-privacy.js";
import type { ProviderConfig } from "../../src/types.js";

const config = {
  providers: {
    zeta: {
      tier: "keyed_http",
      capabilities: ["web_search"],
      rate_limit: {},
      enabled: true,
      priority: 30,
      resells: true,
    },
    alpha: {
      tier: "self_hosted_http",
      capabilities: ["web_search"],
      rate_limit: {},
      enabled: true,
      priority: 40,
      privacy: { query_forwarding: "third_party", notes: "upstream" },
    },
  } as Record<string, ProviderConfig>,
};

describe("provider privacy reference (REQ-129)", () => {
  it("is deterministic and sorts providers by slug", () => {
    const first = renderProviderPrivacy(config);
    const second = renderProviderPrivacy(config);
    expect(first).toBe(second);
    expect(first.indexOf("| alpha |")).toBeLessThan(first.indexOf("| zeta |"));
  });

  it("renders derived and overridden posture columns", () => {
    const md = renderProviderPrivacy(config);
    expect(md).toContain("| zeta | keyed_http | third party | unknown | required | yes |");
    expect(md).toContain("| alpha | self_hosted_http | third party | unknown | none | no | upstream |");
    expect(md).toContain("`unknown` means configuration does not establish the answer");
  });
});
