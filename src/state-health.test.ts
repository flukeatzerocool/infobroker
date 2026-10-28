// @implements REQ-111
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { injectNotices } from "./state-health.js";

const BASE = {
  config_version: 2,
  providers: {
    duckduckgo: {
      tier: "builtin",
      capabilities: ["web_search"],
      rate_limit: { per_second: 0.33 },
      enabled: true,
      priority: 10,
    },
  },
  dispatch: { general_web: ["duckduckgo"] },
  corroboration: {
    max_iterations: 5,
    max_http_calls: 30,
    confidence_threshold: 0.8,
    first_pass_max_results: 10,
    first_pass_max_providers: 5,
    similarity_threshold: 0.3,
  },
  output: { max_chars: 50000, latency_window_size: 100, fallback_depth: 3, max_redirect_hops: 5 },
  kb: {
    storage_path: "/tmp/ib-state-health-kb",
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
  state: { auto_migrate_config: false, update_check: false },
};

function result(text: string) {
  return { content: [{ type: "text", text }] };
}

function injectText(text: string, notices: Parameters<typeof injectNotices>[1]): string {
  const output = injectNotices(result(text), notices);
  return (output as { content: Array<{ text: string }> }).content[0].text;
}

describe("notice injection (REQ-111)", () => {
  const notice = {
    code: "config_migration_pending",
    severity: "action_required" as const,
    message: "migration pending",
    remediation: "run reload_config",
  };

  it("adds notices to an OK envelope", () => {
    const text = `[OK] ${JSON.stringify({ status: "ok", provider: "x", results: [] })}`;
    const output = injectText(text, [notice]);
    expect(JSON.parse(output.slice(5)).notices).toEqual([notice]);
  });

  it("leaves an OK envelope byte-identical when there are no notices", () => {
    const text = `[OK] ${JSON.stringify({ status: "ok", provider: "x", results: [] })}`;
    expect(injectText(text, [])).toBe(text);
  });

  it("leaves error and non-JSON content unchanged", () => {
    const errText = `[ERROR] ${JSON.stringify({ status: "error", provider: "x", error: { code: "x", message: "m", remediation: "r" } })}`;
    expect(injectText(errText, [notice])).toBe(errText);
    expect(injectText("plain text", [notice])).toBe("plain text");
  });

  it("is idempotent when notices are already present", () => {
    const text = `[OK] ${JSON.stringify({ status: "ok", provider: "x", results: [], notices: [notice] })}`;
    expect(injectText(text, [notice])).toBe(text);
  });
});

describe("state health with a stale user layer (REQ-111)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ib-state-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env["INFOBROKER_CONFIG"];
    delete process.env["INFOBROKER_CONFIG_LOCAL"];
    vi.resetModules();
  });

  it("emits no notices for a clean configuration", async () => {
    writeFileSync(join(dir, "config.json"), JSON.stringify(BASE));
    process.env["INFOBROKER_CONFIG"] = join(dir, "config.json");
    process.env["INFOBROKER_CONFIG_LOCAL"] = join(dir, "config.local.json");
    vi.resetModules();
    const config = await import("./config.js");
    config.loadConfig();
    const health = await import("./state-health.js");
    expect(health.collectNotices()).toEqual([]);
  });

  it("reports migration and unrecognized-key notices", async () => {
    writeFileSync(join(dir, "config.json"), JSON.stringify(BASE));
    writeFileSync(join(dir, "config.local.json"), JSON.stringify({ config_version: 0, frobnicate: true }));
    process.env["INFOBROKER_CONFIG"] = join(dir, "config.json");
    process.env["INFOBROKER_CONFIG_LOCAL"] = join(dir, "config.local.json");
    vi.resetModules();
    const config = await import("./config.js");
    config.loadConfig();
    const health = await import("./state-health.js");
    const codes = health.collectNotices().map((n) => n.code);
    expect(codes).toContain("config_migration_pending");
    expect(codes).toContain("config_key_unrecognized");
  });

  it("reports an obsolete kb.store_backend option", async () => {
    writeFileSync(join(dir, "config.json"), JSON.stringify(BASE));
    writeFileSync(join(dir, "config.local.json"), JSON.stringify({ kb: { store_backend: "json" } }));
    process.env["INFOBROKER_CONFIG"] = join(dir, "config.json");
    process.env["INFOBROKER_CONFIG_LOCAL"] = join(dir, "config.local.json");
    vi.resetModules();
    const config = await import("./config.js");
    config.loadConfig();
    const health = await import("./state-health.js");
    const notices = health.collectNotices();
    const codes = notices.map((n) => n.code);
    expect(codes).toContain("config_key_removed");
    // The obsolete key must not also raise a pending-migration notice.
    expect(codes.filter((code) => code === "config_key_removed")).toHaveLength(1);
    expect(codes).not.toContain("config_migration_pending");
    expect(notices.find((n) => n.code === "config_key_removed")?.severity).toBe("action_required");
  });

  it("surfaces a degraded startup through state health", async () => {
    writeFileSync(join(dir, "config.json"), JSON.stringify(BASE));
    writeFileSync(join(dir, "config.local.json"), JSON.stringify({ output: { fallback_depth: 0 } }));
    process.env["INFOBROKER_CONFIG"] = join(dir, "config.json");
    process.env["INFOBROKER_CONFIG_LOCAL"] = join(dir, "config.local.json");
    vi.resetModules();
    const config = await import("./config.js");
    config.loadConfig();
    const health = await import("./state-health.js");
    expect(health.collectNotices().map((n) => n.code)).toContain("config_invalid_startup");
  });
});
