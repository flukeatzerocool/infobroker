// @implements REQ-070
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROVIDERS, resolveProvider } from "./index.js";

const config = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "config.json"), "utf-8")) as {
  providers: Record<string, { tier: string }>;
};

describe("provider registration (REQ-070)", () => {
  it("registers a backend for every non-generic provider declared in config.json", () => {
    const declared = Object.entries(config.providers)
      .filter(([slug, p]) => slug !== "native_fetch" && p.tier !== "generic_http")
      .map(([slug]) => slug);

    for (const slug of declared) {
      expect(resolveProvider(slug), `provider '${slug}' is declared but not registered`).toBeDefined();
    }
  });

  it("exposes the registered backends through the PROVIDERS map", () => {
    expect(Object.keys(PROVIDERS).length).toBeGreaterThan(0);
    expect(PROVIDERS.duckduckgo).toBeDefined();
  });

  it("returns undefined for an unknown, non-generic slug", () => {
    expect(resolveProvider("no-such-provider")).toBeUndefined();
  });
});
