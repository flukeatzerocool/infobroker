// @implements REQ-010 REQ-042 REQ-043 REQ-037 REQ-015 REQ-067 REQ-105 REQ-113
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Config } from "./types.js";
import { validateConfig } from "./config.js";

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
  corroboration: { max_iterations: 5, max_http_calls: 30, confidence_threshold: 0.8, first_pass_max_results: 10, first_pass_max_providers: 5, similarity_threshold: 0.3 },
  output: { max_chars: 50000, latency_window_size: 100, fallback_depth: 3, max_redirect_hops: 5 },
  kb: {
    storage_path: "~/.local/share/infobroker/knowledge-base",
    embedding_model: "signed-hash-tfidf",
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

    maintenance_interval_minutes: 60,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
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
  const cfg = mod.reloadConfig();
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

  it("rejects a null dispatch instead of crashing during validation", async () => {
    await expect(loadWithOverlay(BASE, { dispatch: null })).rejects.toThrow(
      /dispatch must be an object of task-type arrays/
    );
  });

  it("rejects an array dispatch", async () => {
    await expect(loadWithOverlay(BASE, { dispatch: [] })).rejects.toThrow(
      /dispatch must be an object of task-type arrays/
    );
  });

  it("rejects a non-array dispatch chain", async () => {
    await expect(
      loadWithOverlay(BASE, { dispatch: { general_web: "duckduckgo" } })
    ).rejects.toThrow(/dispatch\.general_web must be an array of provider slugs/);
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
    process.env["INFOBROKER_CONFIG_LOCAL"] = join(dir, "config.local.json");
    vi.resetModules();
    const mod = await import("./config.js");
    const cfg = mod.loadConfig();
    rmSync(dir, { recursive: true, force: true });
    expect(cfg.providers.duckduckgo.priority).toBe(10);
  });

  it("rejects a generic_http provider missing endpoint/query_param", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: {
          my_search: { tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20 },
        },
      })
    ).rejects.toThrow(/endpoint/);
  });

  it("rejects a generic_http provider with an invalid endpoint URL", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: {
          my_search: {
            tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20,
            endpoint: "ftp://bad.example.com", query_param: "q",
          },
        },
      })
    ).rejects.toThrow(/endpoint/);
  });

  it("rejects generic-only fields on a non-generic provider", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: { duckduckgo: { endpoint: "https://x.example.com" } },
      })
    ).rejects.toThrow(/only valid for generic_http/);
  });

  it("accepts a valid generic_http provider configuration", async () => {
    const cfg = await loadWithOverlay(BASE, {
      providers: {
        my_search: {
          tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20,
          endpoint: "https://api.example.com/search", query_param: "q", results_path: "data.items",
          health_endpoint: "https://api.example.com/health",
          field_map: {
            title: "name", url: "link", snippet: "summary",
            authors: "author_names", doi: "doi", venue: "journal",
            abstract: "abstract", citation_count: "citations",
          },
        },
      },
    });
    expect(cfg.providers.my_search.endpoint).toBe("https://api.example.com/search");
  });

  it("rejects a generic_http provider that collides with a built-in slug", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: {
          duckduckgo: {
            tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20,
            endpoint: "https://api.example.com/search", query_param: "q",
          },
        },
      })
    ).rejects.toThrow(/already a built-in provider/);
  });

  it("rejects an unknown provider key", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: {
          my_search: {
            tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20,
            endpoint: "https://api.example.com/search", query_param: "q", result_path: "data.items",
          },
        },
      })
    ).rejects.toThrow(/unknown key "result_path"/);
  });

  it("rejects a generic_http capability the shared implementation cannot honor", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: {
          my_search: {
            tier: "generic_http", capabilities: ["web_search", "suggest"], rate_limit: {}, enabled: true, priority: 20,
            endpoint: "https://api.example.com/search", query_param: "q",
          },
        },
      })
    ).rejects.toThrow(/does not implement capability "suggest"/);
  });

  it("rejects an invalid health_endpoint", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: {
          my_search: {
            tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20,
            endpoint: "https://api.example.com/search", query_param: "q", health_endpoint: "ftp://bad",
          },
        },
      })
    ).rejects.toThrow(/health_endpoint/);
  });

  it("accepts auth_header and auth_scheme on a generic_http provider", async () => {
    const cfg = await loadWithOverlay(BASE, {
      providers: {
        my_search: {
          tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20,
          endpoint: "https://api.example.com/search", query_param: "q",
          auth_env: "INFOBROKER_MYSEARCH_API_KEY", auth_header: "X-API-Key", auth_scheme: "",
        },
      },
    });
    expect(cfg.providers.my_search.auth_header).toBe("X-API-Key");
    expect(cfg.providers.my_search.auth_scheme).toBe("");
  });

  it("rejects an invalid auth_header name", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: {
          my_search: {
            tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20,
            endpoint: "https://api.example.com/search", query_param: "q", auth_header: "Bad Header",
          },
        },
      })
    ).rejects.toThrow(/auth_header/);
  });

  it("rejects an auth_scheme with a control character", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: {
          my_search: {
            tier: "generic_http", capabilities: ["web_search"], rate_limit: {}, enabled: true, priority: 20,
            endpoint: "https://api.example.com/search", query_param: "q", auth_scheme: "Bearer\nX-Injected: 1",
          },
        },
      })
    ).rejects.toThrow(/auth_scheme/);
  });

  it("rejects auth_header on a non-generic provider", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: { duckduckgo: { auth_header: "X-API-Key" } },
      })
    ).rejects.toThrow(/only valid for generic_http/);
  });

  it("rejects health_endpoint on a non-generic provider", async () => {
    await expect(
      loadWithOverlay(BASE, {
        providers: { duckduckgo: { health_endpoint: "https://api.example.com/health" } },
      })
    ).rejects.toThrow(/only valid for generic_http/);
  });

  it("appends providers to a dispatch chain without replacing it", async () => {
    const cfg = await loadWithOverlay(BASE, {
      dispatch_append: { general_web: ["searxng", "duckduckgo"] },
    });
    expect(cfg.dispatch.general_web).toEqual(["duckduckgo", "searxng"]);
  });

  it("rejects a dispatch_append for an undeclared task type", async () => {
    await expect(
      loadWithOverlay(BASE, { dispatch_append: { no_such_task: ["duckduckgo"] } })
    ).rejects.toThrow(/does not match a declared dispatch chain/);
  });

  it("rejects a dispatch_append referencing an undeclared provider", async () => {
    await expect(
      loadWithOverlay(BASE, { dispatch_append: { general_web: ["ghost_provider"] } })
    ).rejects.toThrow(/undeclared provider "ghost_provider"/);
  });

  it("rejects a non-positive fallback_depth", async () => {
    await expect(
      loadWithOverlay(BASE, { output: { fallback_depth: 0 } })
    ).rejects.toThrow(/fallback_depth/);
  });

  it("rejects a non-positive max_redirect_hops", async () => {
    await expect(
      loadWithOverlay(BASE, { output: { max_redirect_hops: -1 } })
    ).rejects.toThrow(/max_redirect_hops/);
  });

  it("honors a configured fallback_depth and max_redirect_hops", async () => {
    const cfg = await loadWithOverlay(BASE, { output: { fallback_depth: 2, max_redirect_hops: 9 } });
    expect(cfg.output.fallback_depth).toBe(2);
    expect(cfg.output.max_redirect_hops).toBe(9);
  });

  it("rejects a negative per-provider degraded_latency_ms", async () => {
    await expect(
      loadWithOverlay(BASE, { providers: { duckduckgo: { degraded_latency_ms: -1 } } })
    ).rejects.toThrow(/degraded_latency_ms/);
  });

  it("rejects a negative output degraded_latency_ms", async () => {
    await expect(
      loadWithOverlay(BASE, { output: { degraded_latency_ms: -1 } })
    ).rejects.toThrow(/degraded_latency_ms/);
  });

  it("rejects a non-boolean output hedge_enabled", async () => {
    await expect(
      loadWithOverlay(BASE, { output: { hedge_enabled: "yes" } })
    ).rejects.toThrow(/hedge_enabled/);
  });

  it("rejects a negative output hedge_min_delay_ms", async () => {
    await expect(
      loadWithOverlay(BASE, { output: { hedge_min_delay_ms: -1 } })
    ).rejects.toThrow(/hedge_min_delay_ms/);
  });

  it("rejects an output hedge_max_delay_ms below hedge_min_delay_ms", async () => {
    await expect(
      loadWithOverlay(BASE, { output: { hedge_min_delay_ms: 1000, hedge_max_delay_ms: 500 } })
    ).rejects.toThrow(/hedge_max_delay_ms/);
  });

  it("rejects a negative output hedge_grace_ms", async () => {
    await expect(
      loadWithOverlay(BASE, { output: { hedge_grace_ms: -1 } })
    ).rejects.toThrow(/hedge_grace_ms/);
  });

  it("honors configured hedge fields", async () => {
    const cfg = await loadWithOverlay(BASE, { output: { hedge_min_delay_ms: 100, hedge_max_delay_ms: 900, hedge_grace_ms: 250 } });
    expect(cfg.output.hedge_min_delay_ms).toBe(100);
    expect(cfg.output.hedge_max_delay_ms).toBe(900);
    expect(cfg.output.hedge_grace_ms).toBe(250);
  });

  it("rejects a non-boolean provider resells flag", async () => {
    await expect(
      loadWithOverlay(BASE, { providers: { duckduckgo: { resells: "yes" } } })
    ).rejects.toThrow(/resells/);
  });

  it("rejects a non-boolean corroboration.kb_recall", async () => {
    await expect(
      loadWithOverlay(BASE, { corroboration: { kb_recall: "yes" } })
    ).rejects.toThrow(/kb_recall/);
  });

  it("accepts corroboration.kb_recall", async () => {
    const cfg = await loadWithOverlay(BASE, { corroboration: { kb_recall: false } });
    expect(cfg.corroboration.kb_recall).toBe(false);
  });

  it("rejects a non-positive corroboration.first_pass_max_providers", async () => {
    await expect(
      loadWithOverlay(BASE, { corroboration: { first_pass_max_providers: 0 } })
    ).rejects.toThrow(/first_pass_max_providers/);
  });

  it("accepts corroboration.first_pass_max_providers", async () => {
    const cfg = await loadWithOverlay(BASE, { corroboration: { first_pass_max_providers: 7 } });
    expect(cfg.corroboration.first_pass_max_providers).toBe(7);
  });

  it("accepts per-provider degraded_latency_ms and resells", async () => {
    const cfg = await loadWithOverlay(BASE, {
      providers: { duckduckgo: { degraded_latency_ms: 1500, resells: true } },
    });
    expect(cfg.providers.duckduckgo.degraded_latency_ms).toBe(1500);
    expect(cfg.providers.duckduckgo.resells).toBe(true);
  });

  it("accepts provider languages declarations (REQ-128)", async () => {
    const cfg = await loadWithOverlay(BASE, {
      providers: { duckduckgo: { languages: ["en", "de"] }, searxng: { languages: "*" } },
    });
    expect(cfg.providers.duckduckgo.languages).toEqual(["en", "de"]);
    expect(cfg.providers.searxng.languages).toBe("*");
  });

  it("rejects a malformed provider languages declaration (REQ-128)", async () => {
    await expect(
      loadWithOverlay(BASE, { providers: { duckduckgo: { languages: [42] } } })
    ).rejects.toThrow(/languages/);
  });

  it("accepts and validates the analysis block (REQ-127)", async () => {
    const cfg = await loadWithOverlay(BASE, {
      analysis: { max_topics: 5, cluster_threshold: 0.6, min_cluster_size: 3, timeline: false },
    });
    expect(cfg.analysis?.max_topics).toBe(5);
    expect(cfg.analysis?.timeline).toBe(false);
  });

  it("rejects an out-of-range analysis cluster threshold (REQ-127)", async () => {
    await expect(
      loadWithOverlay(BASE, { analysis: { cluster_threshold: 1.5 } })
    ).rejects.toThrow(/cluster_threshold/);
  });

  it("accepts and validates a provider privacy override (REQ-129)", async () => {
    const cfg = await loadWithOverlay(BASE, {
      providers: { searxng: { privacy: { query_forwarding: "third_party", retains_query: false, notes: "upstream" } } },
    });
    expect(cfg.providers.searxng.privacy?.query_forwarding).toBe("third_party");
    expect(cfg.providers.searxng.privacy?.retains_query).toBe(false);
  });

  it("rejects an invalid provider privacy forwarding value (REQ-129)", async () => {
    await expect(
      loadWithOverlay(BASE, { providers: { searxng: { privacy: { query_forwarding: "elsewhere" } } } })
    ).rejects.toThrow(/query_forwarding/);
  });

  it("rejects a non-numeric rate_limit value (REQ-037)", async () => {
    await expect(
      loadWithOverlay(BASE, { providers: { duckduckgo: { rate_limit: { per_second: "fast" } } } })
    ).rejects.toThrow(/rate_limit\.per_second/);
  });

  it("rejects a non-object rate_limit (REQ-037)", async () => {
    await expect(
      loadWithOverlay(BASE, { providers: { duckduckgo: { rate_limit: 5 } } })
    ).rejects.toThrow(/rate_limit must be an object/);
  });

  it("rejects a negative rate_limit value (REQ-037)", async () => {
    await expect(
      loadWithOverlay(BASE, { providers: { duckduckgo: { rate_limit: { per_day: -1 } } } })
    ).rejects.toThrow(/rate_limit\.per_day/);
  });

  it("rejects a non-positive deep.max_pages", async () => {
    await expect(
      loadWithOverlay(BASE, { deep: { max_pages: 0, max_total_pages: 8, concurrency: 4 } })
    ).rejects.toThrow(/deep.max_pages/);
  });

  it("rejects an out-of-range deep.early_exit_score", async () => {
    await expect(
      loadWithOverlay(BASE, { deep: { max_pages: 3, max_total_pages: 8, concurrency: 4, early_exit_score: 1.5 } })
    ).rejects.toThrow(/deep.early_exit_score/);
  });

  it("accepts a valid deep block", async () => {
    const cfg = await loadWithOverlay(BASE, {
      deep: { max_pages: 4, max_total_pages: 10, concurrency: 3, early_exit_score: 0.5, max_ms: 5000, detect_date: true },
    });
    expect(cfg.deep?.max_pages).toBe(4);
    expect(cfg.deep?.early_exit_score).toBe(0.5);
  });

  it("rejects a non-positive config_version", async () => {
    await expect(
      loadWithOverlay(BASE, { config_version: 0 })
    ).rejects.toThrow(/config_version/);
  });

  it("rejects a config_version newer than this server supports", async () => {
    await expect(
      loadWithOverlay(BASE, { config_version: 999 })
    ).rejects.toThrow(/newer/);
  });

  it("accepts the current config_version", async () => {
    const cfg = await loadWithOverlay(BASE, { config_version: 2 });
    expect(cfg.config_version).toBe(2);
  });

  it("warns about unrecognized user-layer keys without modifying them", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadWithOverlay(BASE, { frobnicate: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("drift"));
    warn.mockRestore();
  });

  it("names an obsolete user-layer key in the startup warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadWithOverlay(BASE, { kb: { store_backend: "json" } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('obsolete key "kb.store_backend"'));
    warn.mockRestore();
  });

  it("migrates an outdated user layer to the current schema with a recoverable backup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ib-cfg-"));
    const basePath = join(dir, "config.json");
    const overlayPath = join(dir, "config.local.json");
    writeFileSync(basePath, JSON.stringify({ ...BASE, config_version: 2 }));
    writeFileSync(overlayPath, JSON.stringify({}));
    process.env["INFOBROKER_CONFIG"] = basePath;
    process.env["INFOBROKER_CONFIG_LOCAL"] = overlayPath;
    vi.resetModules();
    const mod = await import("./config.js");
    mod.loadConfig();

    const result = mod.migrateUserConfigLayer();
    expect(result).not.toBeNull();
    expect(result!.changes.length).toBeGreaterThan(0);
    expect(result!.backup).toBeTruthy();
    expect(existsSync(result!.backup!)).toBe(true);
    const written = JSON.parse(readFileSync(overlayPath, "utf-8")) as { config_version?: number };
    expect(written.config_version).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("startup config recovery and automatic migration (REQ-105, REQ-113)", () => {
  let dir: string;
  let basePath: string;
  let overlayPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ib-cfg-recover-"));
    basePath = join(dir, "config.json");
    overlayPath = join(dir, "config.local.json");
    writeFileSync(basePath, JSON.stringify(BASE));
    process.env["INFOBROKER_CONFIG"] = basePath;
    process.env["INFOBROKER_CONFIG_LOCAL"] = overlayPath;
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env["INFOBROKER_CONFIG"];
    delete process.env["INFOBROKER_CONFIG_LOCAL"];
    vi.resetModules();
  });

  it("starts on shipped defaults when the user layer is invalid, without writing it", async () => {
    const overlay = JSON.stringify({ output: { fallback_depth: 0 } });
    writeFileSync(overlayPath, overlay);
    const mod = await import("./config.js");
    const cfg = mod.loadConfig();
    expect(cfg.output.max_chars).toBe(50000);
    expect(mod.getStartupConfigIssue()?.code).toBe("invalid_merged_user_layer");
    expect(readFileSync(overlayPath, "utf-8")).toBe(overlay);
  });

  it("starts on shipped defaults when the user layer is not valid JSON", async () => {
    const overlay = "{ not json";
    writeFileSync(overlayPath, overlay);
    const mod = await import("./config.js");
    const cfg = mod.loadConfig();
    expect(cfg.output.max_chars).toBe(50000);
    expect(mod.getStartupConfigIssue()?.code).toBe("invalid_user_json");
    expect(readFileSync(overlayPath, "utf-8")).toBe(overlay);
  });

  it("still rejects an invalid user layer on an explicit reload", async () => {
    writeFileSync(overlayPath, JSON.stringify({ state: { update_check: "yes" } }));
    const mod = await import("./config.js");
    mod.loadConfig();
    expect(() => mod.reloadConfig()).toThrow(/update_check/);
  });

  it("falls back on an oversized chunk_overlap and names the file in remediation", async () => {
    const overlay = JSON.stringify({ kb: { chunk_size: 1000, chunk_overlap: 600 } });
    writeFileSync(overlayPath, overlay);
    const mod = await import("./config.js");
    const cfg = mod.loadConfig();
    expect(cfg.kb?.chunk_overlap).toBe(64);
    const issue = mod.getStartupConfigIssue();
    expect(issue?.code).toBe("invalid_merged_user_layer");
    expect(issue?.message).toMatch(new RegExp("chunk_overlap"));
    expect(issue?.remediation).toContain(overlayPath);
    expect(readFileSync(overlayPath, "utf-8")).toBe(overlay);
  });

  it("auto-migrates the user layer when enabled", async () => {
    writeFileSync(overlayPath, JSON.stringify({ config_version: 0, state: { auto_migrate_config: true } }));
    const mod = await import("./config.js");
    mod.loadConfig();
    const migration = mod.getStartupMigration();
    expect(migration).not.toBeNull();
    expect(migration!.backup).toBeTruthy();
    expect(existsSync(migration!.backup!)).toBe(true);
    const written = JSON.parse(readFileSync(overlayPath, "utf-8")) as { config_version?: number; state?: { auto_migrate_config?: boolean } };
    expect(written.config_version).toBe(2);
    expect(written.state?.auto_migrate_config).toBe(true);
  });

  it("does not write an auto-migration that would still be invalid", async () => {
    const overlay = JSON.stringify({ config_version: 0, state: { auto_migrate_config: true }, output: { fallback_depth: 0 } });
    writeFileSync(overlayPath, overlay);
    const mod = await import("./config.js");
    mod.loadConfig();
    expect(mod.getStartupMigration()).toBeNull();
    expect(mod.getStartupConfigIssue()?.code).toBe("auto_migration_invalid");
    expect(readFileSync(overlayPath, "utf-8")).toBe(overlay);
  });
});

function setAt(target: unknown, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = target as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

// One path per numeric validation branch. Adding a numeric config field without
// a row here leaves a non-finite hole the validator cannot catch.
const NUMERIC_BRANCHES = [
  "providers.duckduckgo.priority",
  "providers.duckduckgo.rate_limit.per_second",
  "providers.duckduckgo.timeout",
  "providers.duckduckgo.retry_count",
  "providers.duckduckgo.retry_backoff_ms",
  "providers.duckduckgo.degraded_latency_ms",
  "providers.duckduckgo.rate_limit.jitter_ms",
  "defaults.timeout",
  "defaults.retry_count",
  "defaults.retry_backoff_ms",
  "corroboration.max_iterations",
  "corroboration.max_http_calls",
  "corroboration.confidence_threshold",
  "corroboration.first_pass_max_results",
  "corroboration.first_pass_max_providers",
  "corroboration.similarity_threshold",
  "corroboration.family_similarity_threshold",
  "corroboration.calibration.secondary_only_cap",
  "corroboration.authority_weights.wikipedia",
  "preservation.max_sources_per_finding",
  "preservation.max_bytes",
  "output.max_chars",
  "output.latency_window_size",
  "output.fallback_depth",
  "output.max_redirect_hops",
  "output.degraded_latency_ms",
  "output.hedge_min_delay_ms",
  "output.hedge_max_delay_ms",
  "output.hedge_grace_ms",
  "output.rate_limit_cooldown_ms",
  "output.call_log_max_bytes",
  "content_policy.threshold",
  "fetch.passage_size",
  "fetch.max_passages",
  "fetch.crawl_max_pages",
  "fetch.crawl_max_depth",
  "fetch.cache.kb_max_age_hours",
  "expand.max_expansions",
  "research.max_variants",
  "research.max_pages_per_variant",
  "deep.max_pages",
  "deep.max_total_pages",
  "deep.concurrency",
  "deep.early_exit_score",
  "deep.max_ms",
  "analysis.max_topics",
  "analysis.max_entities",
  "analysis.cluster_threshold",
  "analysis.min_cluster_size",
  "kb.chunk_size",
  "kb.chunk_overlap",
  "kb.max_results",
  "kb.maintenance_interval_minutes",
  "kb.freshness.tiers.stable.decay_hours",
  "kb.freshness.tiers.stable.expiry_hours",
  "kb.kb_first_relevance_threshold",
  "kb.kb_first_confidence_threshold",
  "kb.expiry.stable",
] as const;

function configWith(path: string, value: unknown): Config {
  const cfg = structuredClone(BASE);
  setAt(cfg, "content_policy.mode", "off");
  setAt(cfg, path, value);
  return cfg;
}

describe("numeric config hardening (REQ-067, REQ-010)", () => {
  beforeEach(() => {
    delete process.env["INFOBROKER_CONFIG"];
    delete process.env["INFOBROKER_CONFIG_LOCAL"];
  });

  it("rejects a chunk_overlap at or above half the chunk_size", async () => {
    await expect(
      loadWithOverlay(BASE, { kb: { chunk_size: 1000, chunk_overlap: 600 } })
    ).rejects.toThrow(new RegExp("chunk_overlap"));
  });

  it("accepts a chunk_overlap below half the chunk_size", async () => {
    const cfg = await loadWithOverlay(BASE, { kb: { chunk_size: 1000, chunk_overlap: 499 } });
    expect(cfg.kb?.chunk_size).toBe(1000);
    expect(cfg.kb?.chunk_overlap).toBe(499);
  });

  it("rejects Infinity at every numeric validation branch", () => {
    for (const path of NUMERIC_BRANCHES) {
      const field = path.split(".").pop()!;
      expect(() => validateConfig(configWith(path, Infinity)), `branch ${path}`).toThrow(new RegExp(field));
    }
  });

  it("rejects NaN at representative numeric branches", () => {
    for (const path of [
      "providers.duckduckgo.timeout",
      "defaults.retry_count",
      "output.fallback_depth",
      "kb.chunk_size",
      "kb.freshness.tiers.stable.expiry_hours",
    ]) {
      const field = path.split(".").pop()!;
      expect(() => validateConfig(configWith(path, NaN)), `branch ${path}`).toThrow(new RegExp(field));
    }
  });

  it("rejects out-of-range and non-numeric retry fields", () => {
    expect(() => validateConfig(configWith("defaults.retry_count", 11))).toThrow(new RegExp("retry_count"));
    expect(() => validateConfig(configWith("defaults.retry_count", "2"))).toThrow(new RegExp("retry_count"));
    expect(() => validateConfig(configWith("providers.duckduckgo.retry_backoff_ms", 60001))).toThrow(
      new RegExp("retry_backoff_ms")
    );
    expect(() => validateConfig(configWith("providers.duckduckgo.timeout", "1000"))).toThrow(new RegExp("timeout"));
  });

  it("validates call-log and source-quality settings (REQ-111a, REQ-020h)", () => {
    expect(() => validateConfig(configWith("output.call_log", "syslog"))).toThrow(/call_log/);
    expect(() => validateConfig(configWith("output.call_log_max_bytes", 10))).toThrow(/call_log_max_bytes/);
    expect(() => validateConfig(configWith("providers.duckduckgo.rate_limit.jitter_ms", -1))).toThrow(/jitter_ms/);
    expect(() => validateConfig(configWith("source_quality.weight", 2))).toThrow(/source_quality.weight/);
    expect(() => validateConfig(configWith("source_quality.blocklist", [""]))).toThrow(/source_quality.blocklist/);
  });

  it("rejects finite values that would overflow the 32-bit timer", () => {
    expect(() => validateConfig(configWith("providers.duckduckgo.timeout", 1e308))).toThrow(new RegExp("timeout"));
    expect(() => validateConfig(configWith("kb.maintenance_interval_minutes", 1e308))).toThrow(
      new RegExp("maintenance_interval_minutes")
    );
    expect(() => validateConfig(configWith("deep.max_ms", 1e308))).toThrow(new RegExp("max_ms"));
  });
});

// @implements REQ-031
describe("keyed provider activation (REQ-031)", () => {
  const savedKey = process.env["INFOBROKER_EXA_API_KEY"];
  afterEach(() => {
    if (savedKey === undefined) delete process.env["INFOBROKER_EXA_API_KEY"];
    else process.env["INFOBROKER_EXA_API_KEY"] = savedKey;
  });

  it("includes a keyed provider only when its credential is present", async () => {
    const keyedBase: Config = {
      ...BASE,
      providers: {
        ...BASE.providers,
        exa: {
          tier: "keyed_http",
          capabilities: ["web_search"],
          rate_limit: {},
          auth_env: "INFOBROKER_EXA_API_KEY",
          enabled: true,
          priority: 30,
        },
      },
      dispatch: { ...BASE.dispatch, general_web: ["exa", "duckduckgo"] },
    };
    await loadWithOverlay(keyedBase, {});
    const mod = await import("./config.js");

    process.env["INFOBROKER_EXA_API_KEY"] = "test-key";
    expect(mod.getDispatchChain("general_web")[0]).toBe("exa");

    delete process.env["INFOBROKER_EXA_API_KEY"];
    expect(mod.getDispatchChain("general_web")).not.toContain("exa");
  });
});
