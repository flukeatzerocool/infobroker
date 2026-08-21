// @implements REQ-010 REQ-042 REQ-043
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Config } from "./types.js";

const BASE: Config = {
  providers: {
    duckduckgo: {
      tier: "builtin",
      capabilities: ["web_search"],
      rate_limit: { per_second: 0.33 },
      enabled: true,
      priority: 10,
    },
    searxng: {
      tier: "self_hosted_http",
      capabilities: ["web_search"],
      rate_limit: {},
      enabled: false,
      priority: 40,
    },
  },
  dispatch: { general_web: ["duckduckgo"], privacy_critical: ["duckduckgo"] },
  convergence: { max_iterations: 5, max_http_calls: 30, confidence_threshold: 0.8 },
  output: { max_chars: 50000 },
  kb: {
    storage_path: "~/.local/share/infobroker/knowledge-base",
    embedding_model: "tf-idf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: true,
    default_collection: "default",
    max_results: 50,
    freshness: {
      tiers: { stable: { decay_hours: 720, expiry_hours: 0 } },
      auto_classify: true,
      default_tier: "stable",
    },
    max_vocab_terms: 10000,
    maintenance_interval_minutes: 60,
  },
};

async function loadWithOverlay(base: Config, overlay: unknown): Promise<Config> {
  const dir = mkdtempSync(join(tmpdir(), "ib-cfg-"));
  const basePath = join(dir, "config.json");
  const overlayPath = join(dir, "config.local.json");
  writeFileSync(basePath, JSON.stringify(base));
  writeFileSync(overlayPath, JSON.stringify(overlay));
  process.env["INFOBROKER_CONFIG"] = basePath;
  process.env["INFOBROKER_CONFIG_LOCAL"] = overlayPath;
  vi.resetModules();
  const mod = await import("./config.js");
  const cfg = mod.loadConfig();
  rmSync(dir, { recursive: true, force: true });
  return cfg;
}

describe("configuration overlay", () => {
  beforeEach(() => {
    delete process.env["INFOBROKER_CONFIG"];
    delete process.env["INFOBROKER_CONFIG_LOCAL"];
  });

  it("merges user values over shipped defaults, user precedence wins", async () => {
    const cfg = await loadWithOverlay(BASE, {
      providers: { duckduckgo: { priority: 99 } },
    });
    expect(cfg.providers.duckduckgo.priority).toBe(99);
    expect(cfg.providers.duckduckgo.enabled).toBe(true);
    expect(cfg.providers.searxng.enabled).toBe(false);
  });

  it("replaces provider objects wholesale for a disabled provider", async () => {
    const cfg = await loadWithOverlay(BASE, {
      providers: { searxng: { enabled: true, tier: "self_hosted_http", capabilities: ["web_search"], rate_limit: {}, priority: 50 } },
    });
    expect(cfg.providers.searxng.enabled).toBe(true);
    expect(cfg.providers.searxng.priority).toBe(50);
  });

  it("replaces arrays in dispatch rather than merging", async () => {
    const cfg = await loadWithOverlay(BASE, {
      dispatch: { general_web: ["searxng", "duckduckgo"] },
    });
    expect(cfg.dispatch.general_web).toEqual(["searxng", "duckduckgo"]);
  });

  it("warns when a user overlay replaces a non-empty shipped array", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadWithOverlay(BASE, {
      dispatch: { general_web: ["searxng"] },
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"general_web"')
    );
    warn.mockRestore();
  });

  it("preserves nested KB defaults not overridden", async () => {
    const cfg = await loadWithOverlay(BASE, {
      kb: { storage_path: "/custom/kb" },
    });
    expect(cfg.kb?.storage_path).toBe("/custom/kb");
    expect(cfg.kb?.chunk_size).toBe(512);
  });

  it("operates on shipped defaults alone when no user layer present", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ib-cfg-"));
    const basePath = join(dir, "config.json");
    writeFileSync(basePath, JSON.stringify(BASE));
    process.env["INFOBROKER_CONFIG"] = basePath;
    vi.resetModules();
    const mod = await import("./config.js");
    const cfg = mod.loadConfig();
    rmSync(dir, { recursive: true, force: true });
    expect(cfg.providers.duckduckgo.priority).toBe(10);
  });
});
