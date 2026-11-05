// @implements REQ-011
// The registry manifest must declare exactly the environment variables that
// the shipped provider configuration requires, so client setup cannot drift
// from the provider registry.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

interface Manifest {
  title?: string;
  websiteUrl?: string;
  version?: string;
  packages?: {
    version?: string;
    environmentVariables?: {
      name?: string;
      description?: string;
      isRequired?: boolean;
      isSecret?: boolean;
    }[];
  }[];
}

interface ShippedConfig {
  providers: Record<string, { tier?: string }>;
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(ROOT, name), "utf-8")) as T;
}

describe("server.json manifest (REQ-011)", () => {
  const manifest = readJson<Manifest>("server.json");
  const config = readJson<ShippedConfig>("config.json");
  const pkg = readJson<{ version: string }>("package.json");

  it("declares title and website URL", () => {
    expect(manifest.title).toBe("Infobroker");
    expect(manifest.websiteUrl).toMatch(/^https:\/\//);
  });

  it("keeps the manifest and package versions in sync", () => {
    // Registry manifests carry canonical semver, which drops a leading zero
    // from a date-style patch (2026.11.04 -> 2026.11.4), so compare numerically.
    const parts = (version: string) => version.split(".").map(Number);
    expect(parts(manifest.version ?? "")).toEqual(parts(pkg.version));
    expect(parts(manifest.packages?.[0]?.version ?? "")).toEqual(parts(pkg.version));
  });

  it("declares exactly the keyed and self-hosted provider environment variables", () => {
    const expected = Object.entries(config.providers)
      .filter(([, provider]) => provider.tier === "keyed_http" || provider.tier === "self_hosted_http")
      .map(([slug, provider]) =>
        `INFOBROKER_${slug.toUpperCase()}_${provider.tier === "keyed_http" ? "API_KEY" : "URL"}`,
      )
      .sort();
    const declared = (manifest.packages?.[0]?.environmentVariables ?? [])
      .map((entry) => entry.name)
      .sort();
    expect(declared).toEqual(expected);
  });

  it("marks keyed credentials secret and requires none of them", () => {
    const entries = manifest.packages?.[0]?.environmentVariables ?? [];
    for (const entry of entries) {
      expect(entry.description?.length ?? 0).toBeGreaterThan(0);
      expect(entry.isRequired).not.toBe(true);
      if (entry.name?.endsWith("_API_KEY")) {
        expect(entry.isSecret).toBe(true);
      }
    }
  });
});
