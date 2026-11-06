// @implements REQ-084 REQ-085 REQ-030 REQ-031
// Gate: the shipped default config must never enable KB encryption, so a
// future update cannot silently encrypt (and thereby lock) user stores. The
// same file pins the rate limits and privacy-chain order (CF-1, CF-2): a
// single provider call must not occupy a chain for minutes, and a reselling
// engine must not be the privacy-critical primary.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface ShippedProvider {
  enabled: boolean;
  tier: string;
  capabilities: string[];
  rate_limit?: { per_second?: number; per_day?: number; per_month?: number };
}

interface ShippedConfig {
  kb?: { encryption?: { enabled?: boolean } };
  providers: Record<string, ShippedProvider>;
  dispatch: Record<string, string[]>;
}

const CONFIG_PATH = join(import.meta.dirname, "..", "config.json");
// The pre-CF-1 `per_second: 0.003` implied 333 s of queue per call. A minute is
// the loose upper bound for any shipped provider.
const MAX_IMPLIED_INTERVAL_MS = 60_000;

function shippedConfig(): ShippedConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as ShippedConfig;
}

describe("shipped config default (REQ-084/085)", () => {
  it("ships with KB encryption disabled or absent", () => {
    const enabled = shippedConfig().kb?.encryption?.enabled;
    expect(enabled).not.toBe(true);
  });
});

describe("shipped rate limits and dispatch order (REQ-030, REQ-031)", () => {
  it("bounds every provider's implied throttle interval", () => {
    for (const [slug, provider] of Object.entries(shippedConfig().providers)) {
      const perSecond = provider.rate_limit?.per_second;
      if (!provider.enabled || !perSecond) continue;
      expect(perSecond, `${slug}: per_second`).toBeGreaterThan(0);
      expect(Math.round(1000 / perSecond), `${slug}: implied interval`).toBeLessThanOrEqual(
        MAX_IMPLIED_INTERVAL_MS,
      );
    }
  });

  it("caps Stack Exchange by its daily quota instead of a multi-minute stall", () => {
    const limit = shippedConfig().providers.stack_exchange.rate_limit;
    expect(limit?.per_day, "stack_exchange: per_day").toBeLessThanOrEqual(300);
    expect(
      1000 / (limit?.per_second ?? Infinity),
      "stack_exchange: implied interval",
    ).toBeLessThanOrEqual(MAX_IMPLIED_INTERVAL_MS);
  });

  it("tries the self-hosted and independent engines before the reselling one", () => {
    const chain = shippedConfig().dispatch.privacy_critical ?? [];
    expect(chain).toContain("searxng");
    expect(chain).toContain("mojeek");
    expect(chain).toContain("duckduckgo");
    expect(chain.indexOf("searxng")).toBeLessThan(chain.indexOf("mojeek"));
    expect(chain.indexOf("mojeek")).toBeLessThan(chain.indexOf("duckduckgo"));
  });
});
