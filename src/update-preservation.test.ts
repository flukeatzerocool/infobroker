// @implements REQ-043
//
// Simulated update (REQ-043 / §2 F11): user-owned state lives outside the
// distributed tree, so replacing the package root must leave the user
// configuration layer, the indexed knowledge base, and the accumulated quota
// counters readable and effective, with no reconfiguration.
//
// Scenario: setup (write state through the real modules) → update (delete and
// re-create `install/` from a newer shipped config) → post-update read (fresh
// module instances assert the preserved state).
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");
const BODY = "The reservoir level fell by two metres during the 2026 drought.";
const SOURCE_URL = "https://example.com/update-survival";
const USER_MAX_RESPONSE_CHARS = 4321;

// XDG_CONFIG_HOME is honoured only on Linux (src/config.ts:98-106), so the
// suite skips elsewhere rather than reading a real home directory.
const describeLinux = process.platform === "linux" ? describe : describe.skip;

interface World {
  root: string;
  install: string;
  xdg: string;
  data: string;
  closed: string;
  home: string;
  layerPath: string;
}

let world: World;
let layerBytesBefore: Buffer;
let newMaxChars: number;
let initialMaxChars: number;
const savedEnv: Record<string, string | undefined> = {};

interface Post {
  config: typeof import("./config.js");
  cfg: import("./types.js").Config;
  kb: typeof import("./kb.js");
  quota: typeof import("./quota.js");
  quotaFile: { providers?: Record<string, { daily: { count: number }; monthly: { count: number } }> };
}

let post: Post;

function writeShippedInstall(target: string, release: string, maxChars: number): void {
  const base = JSON.parse(readFileSync(join(REPO_ROOT, "config.json"), "utf-8"));
  base.output.max_chars = maxChars;
  writeFileSync(join(target, "config.json"), JSON.stringify(base, null, 2));
  writeFileSync(join(target, "package.json"), JSON.stringify({ name: "infobroker", version: release }, null, 2));
  writeFileSync(join(target, "RELEASE"), release);
}

function freshInstall(release: string, maxChars: number): void {
  rmSync(world.install, { recursive: true, force: true });
  mkdirSync(world.install, { recursive: true });
  writeShippedInstall(world.install, release, maxChars);
}

async function importModules() {
  vi.resetModules();
  const config = await import("./config.js");
  const kb = await import("./kb.js");
  const quota = await import("./quota.js");
  return { config, kb, quota };
}

describeLinux("simulated update preservation (REQ-043)", () => {
  beforeAll(async () => {
    const root = mkdtempSync(join(tmpdir(), "ib-update-"));
    world = {
      root,
      install: join(root, "install"),
      xdg: join(root, "xdg"),
      data: join(root, "data"),
      closed: join(root, "closed"),
      home: join(root, "home"),
      layerPath: join(root, "xdg", "infobroker", "config.local.json"),
    };
    mkdirSync(world.install, { recursive: true });
    mkdirSync(join(world.xdg, "infobroker"), { recursive: true });
    mkdirSync(join(world.data, "knowledge-base"), { recursive: true });
    mkdirSync(world.home, { recursive: true });
    mkdirSync(world.closed, { recursive: true });

    for (const key of [
      "INFOBROKER_CONFIG",
      "INFOBROKER_CONFIG_LOCAL",
      "XDG_CONFIG_HOME",
      "INFOBROKER_QUOTA_STATE",
      "HOME",
    ]) {
      savedEnv[key] = process.env[key];
    }

    const base = JSON.parse(readFileSync(join(REPO_ROOT, "config.json"), "utf-8"));
    initialMaxChars = base.output?.max_chars;
    if (!Number.isInteger(initialMaxChars) || initialMaxChars < 1) {
      throw new Error(`config.json output.max_chars is not a positive integer: ${String(initialMaxChars)}`);
    }
    newMaxChars = initialMaxChars + 1000;
    freshInstall("before", initialMaxChars);

    writeFileSync(
      world.layerPath,
      JSON.stringify(
        {
          kb: { storage_path: join(world.data, "knowledge-base") },
          output: { response_max_chars: USER_MAX_RESPONSE_CHARS },
        },
        null,
        2
      )
    );
    layerBytesBefore = readFileSync(world.layerPath);

    process.env["INFOBROKER_CONFIG"] = join(world.install, "config.json");
    delete process.env["INFOBROKER_CONFIG_LOCAL"];
    process.env["XDG_CONFIG_HOME"] = world.xdg;
    process.env["INFOBROKER_QUOTA_STATE"] = join(world.data, "quota.json");
    process.env["HOME"] = world.home;

    // --- Scenario stage 1: setup, through the real modules -----------------
    const setup = await importModules();
    const setupCfg = setup.config.loadConfig();
    expect(setupCfg.output.response_max_chars).toBe(USER_MAX_RESPONSE_CHARS);

    setup.kb.initKb(setupCfg.kb!);
    expect(setup.kb.getKbLockError()).toBeNull();
    setup.kb.kbIngest(BODY, "Update survival", SOURCE_URL, "test");
    setup.kb.flushKbWrites();

    setup.quota.loadQuotaState();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      setup.quota.increment("duckduckgo");
      setup.quota.increment("duckduckgo");
      vi.advanceTimersByTime(30_000);
    } finally {
      vi.useRealTimers();
    }

    // Pin the quota windows far future so the post-update assertion cannot
    // depend on the wall clock; the counts remain what the server wrote.
    const quotaPath = join(world.data, "quota.json");
    const written = JSON.parse(readFileSync(quotaPath, "utf-8"));
    const providerCounter = written.providers?.duckduckgo;
    if (!providerCounter) {
      throw new Error(`quota write did not land: ${JSON.stringify(written)}`);
    }
    providerCounter.daily.resetAt = "2099-01-01T00:00:00.000Z";
    providerCounter.monthly.resetAt = "2099-01-01T00:00:00.000Z";
    writeFileSync(quotaPath, JSON.stringify(written, null, 2));

    // Release the real store: initKb closes the previous one (src/kb.ts:339);
    // interval 0 arms no maintenance timer over the directory deleted next.
    // A "Storage path changed" warning is expected here.
    setup.kb.initKb({
      ...setupCfg.kb!,
      storage_path: world.closed,
      maintenance_interval_minutes: 0,
    });

    expect(existsSync(join(world.data, "knowledge-base"))).toBe(true);
    expect(existsSync(quotaPath)).toBe(true);
    expect(existsSync(join(world.install, "config.local.json"))).toBe(false);

    // --- Scenario stage 2: the update --------------------------------------
    freshInstall("after", newMaxChars);
    vi.resetModules();

    // --- Scenario stage 3: post-update read --------------------------------
    const fresh = await importModules();
    const cfg = fresh.config.loadConfig();
    fresh.kb.initKb(cfg.kb!);
    fresh.quota.loadQuotaState();

    post = {
      config: fresh.config,
      cfg,
      kb: fresh.kb,
      quota: fresh.quota,
      quotaFile: JSON.parse(readFileSync(quotaPath, "utf-8")),
    };
  }, 30_000);

  afterAll(() => {
    try {
      if (post?.kb) {
        post.kb.initKb({
          ...post.cfg.kb!,
          storage_path: world.closed,
          maintenance_interval_minutes: 0,
        });
      }
    } catch {
      // best effort: the root is removed next and the worker exits
    }
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (world) rmSync(world.root, { recursive: true, force: true });
  });

  it("1. replaced the package tree and applied the new shipped default", () => {
    expect(readFileSync(join(world.install, "RELEASE"), "utf-8")).toBe("after");
    expect(post.cfg.output.max_chars).toBe(newMaxChars);
    expect(post.cfg.output.response_max_chars).toBe(USER_MAX_RESPONSE_CHARS);
  });

  it("2. still finds the user layer and needs no reconfiguration", () => {
    expect(post.config.getUserConfigPath()).toBe(world.layerPath);
    expect(post.config.getStartupConfigIssue()).toBeNull();
    const drift = post.config.getUserConfigDrift();
    expect(drift).not.toBeNull();
    expect(drift!.hasDrift).toBe(false);
  });

  it("3. did not overwrite the user layer", () => {
    expect(readFileSync(world.layerPath)).toEqual(layerBytesBefore);
  });

  it("4. preserves indexed knowledge base content", () => {
    const stored = post.kb.kbGet(SOURCE_URL);
    expect(stored).not.toBeNull();
    // Ingestion stores the chunk with its title prefix ("Update survival: …"),
    // so the body is asserted by containment, not byte equality.
    expect(stored!.text).toContain(BODY);
    expect(post.kb.kbStats().chunk_count).toBeGreaterThan(0);
  });

  it("5. preserves accumulated quota counters", () => {
    const counter = post.quotaFile.providers!.duckduckgo!;
    expect(counter.daily.count).toBe(2);
    expect(counter.monthly.count).toBe(2);
    const report = post.quota.checkQuota("duckduckgo");
    expect(report.daily.used).toBe(2);
    expect(report.monthly.used).toBe(2);
  });

  it("6. keeps user state outside the package tree", () => {
    expect(readdirSync(world.install).sort()).toEqual(["RELEASE", "config.json", "package.json"]);
    expect(resolve(post.cfg.kb!.storage_path).startsWith(world.install + "/")).toBe(false);
    expect(post.quota.getQuotaStatePath().startsWith(world.install + "/")).toBe(false);
  });
});
