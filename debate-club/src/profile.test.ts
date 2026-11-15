// @implements REQ-055
// profile.test.ts — the Lab profile resolver is total over its named set and
// refuses an unknown name instead of silently falling back to defaults.

import { describe, expect, it } from "vitest";
import { PROFILES, profileHash, profileLayer, resolveProfile } from "../scripts/profile.mjs";

describe("Lab profiles", () => {
  it("resolves every declared profile to an object", () => {
    for (const name of Object.keys(PROFILES)) {
      expect(typeof resolveProfile(name)).toBe("object");
    }
  });

  it("keeps fresh as the empty layer", () => {
    expect(resolveProfile("fresh")).toEqual({});
    expect(profileLayer("fresh").trim()).toBe("{}");
  });

  it("changes exactly one knob for solo-override", () => {
    expect(resolveProfile("solo-override")).toEqual({ output: { fallback_depth: 2 } });
  });

  it("disables the KB and lowers the fallback for constrained", () => {
    expect(resolveProfile("constrained")).toMatchObject({
      kb: null,
      corroboration: { kb_recall: false },
      output: { fallback_depth: 1 },
    });
  });

  it("refuses an unknown profile", () => {
    expect(() => resolveProfile("turbo")).toThrow(/unknown profile: turbo/);
  });

  it("hashes the layer, so a profile edit changes the attribution", () => {
    expect(profileHash("fresh")).not.toBe(profileHash("constrained"));
    expect(profileHash("fresh")).toHaveLength(12);
  });
});
