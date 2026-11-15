// @implements REQ-084 handler-lock-refusal
// @implements REQ-084 key-source-precedence
// @implements REQ-086 locked-encryption-reachable
// @implements REQ-060h claims-locked-refusal
// @implements REQ-085 store-unchanged-while-locked
// A locked store is refused at the `manage_kb` handler, not only inside the KB
// module: `claims` and `stats` return an [ERROR] envelope while the `encryption`
// action stays reachable and reports the state, the on-disk format, and the
// recovery directive (REQ-086). The key-source chain is asserted through the
// spawned server too: a configured key file wins over the environment, and an
// unreadable key file does not fall back to it.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMcpServer, type McpServer } from "./lib/mcp-stdio.js";
import { makeIsolatedConfig, type IsolatedConfig } from "./lib/test-isolation.js";
import { flushKbWrites, initKb, kbIngest } from "./kb.js";
import type { KbConfig } from "./types.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const STORE_FILE = "vector-store.sqlite";

const dirs: string[] = [];

function newDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

/** Call a tool and return its raw text, requiring the given envelope prefix. */
async function toolText(server: McpServer, name: string, args: Record<string, unknown>, prefix: "[OK] " | "[ERROR] "): Promise<string> {
  const response = await server.call("tools/call", { name, arguments: args });
  expect(response.error).toBeUndefined();
  const text = (response.result as ToolResult).content[0]?.text ?? "";
  expect(text.startsWith(prefix), `expected ${prefix.trim()}, got: ${text.slice(0, 200)}`).toBe(true);
  return text.slice(prefix.length);
}

/** A hermetic config that boots the KB against `storagePath`. */
function writeConfig(root: string, storagePath: string, encryption: { enabled: boolean; key_file?: string }): string {
  const config = JSON.parse(readFileSync(join(REPO_ROOT, "config.json"), "utf-8")) as {
    kb?: Record<string, unknown>;
  };
  config.kb = {
    ...(config.kb ?? {}),
    storage_path: storagePath,
    auto_index: false,
    encryption,
  };
  const path = join(root, "config.json");
  writeFileSync(path, JSON.stringify(config, null, 2));
  return path;
}

let fixtureRoot: string;
let storagePath: string;
let configPath: string;
let secret: string;
let validKeyFile: string;
let fingerprint: { sha256: string; size: number; mtimeMs: number };

beforeAll(() => {
  fixtureRoot = newDir("infobroker-kb-lock-");
  storagePath = join(fixtureRoot, "knowledge-base");
  const iso: IsolatedConfig = makeIsolatedConfig();
  dirs.push(iso.root);
  // The store is created by this process and then read by the children, so the
  // fixture keeps its own config file and reuses the isolated env for HOME/XDG.
  configPath = writeConfig(fixtureRoot, storagePath, { enabled: true });

  // The key file is the fixture's only key material; the env value below is the
  // same secret, so removing it from a child's env locks the store. The file is
  // written here rather than by `generateKeyFile`, which confines its target to
  // the configured keys directory.
  validKeyFile = join(fixtureRoot, "store.key");
  const rawKey = randomBytes(32);
  writeFileSync(validKeyFile, `${rawKey.toString("base64")}\n`, { mode: 0o600 });
  secret = rawKey.toString("base64");
  process.env["INFOBROKER_KB_KEY"] = secret;
  delete process.env["INFOBROKER_KB_PASSPHRASE"];

  const config: KbConfig = {
    storage_path: storagePath,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 10,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    maintenance_interval_minutes: 0,
    encryption: { enabled: true },
  };
  initKb(config);
  kbIngest(
    "At-rest encryption seals every stored chunk, and the store stays readable only while a key is available.",
    "Encrypted store fixture",
    "https://example.com/encrypted-fixture",
    "test"
  );
  flushKbWrites();

  const store = join(storagePath, STORE_FILE);
  const bytes = readFileSync(store);
  fingerprint = {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
    mtimeMs: statSync(store).mtimeMs,
  };
  expect(fingerprint.size).toBeGreaterThan(0);
}, 60_000);

afterAll(() => {
  delete process.env["INFOBROKER_KB_KEY"];
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** The isolated env with every key source removed. */
function envWithoutKeys(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...base };
  delete env["INFOBROKER_KB_KEY"];
  delete env["INFOBROKER_KB_PASSPHRASE"];
  return env;
}

describe("manage_kb handler lock refusal (REQ-084, REQ-060h, REQ-086)", () => {
  test("a locked store refuses claims and stats while the encryption action stays reachable", async () => {
    const iso = makeIsolatedConfig();
    dirs.push(iso.root);
    const env = { ...envWithoutKeys(iso.env), INFOBROKER_CONFIG: configPath };
    const server = await startMcpServer({ env, clientName: "kb-handler-lock-test", initDelayMs: 500 });
    try {
      const claims = JSON.parse(await toolText(server, "infobroker_manage_kb", { action: "claims" }, "[ERROR] ")) as {
        error: { code: string; message: string; remediation: string };
      };
      expect(claims.error.code).toBe("config_error");
      expect(claims.error.remediation).toMatch(/key/i);

      const stats = JSON.parse(await toolText(server, "infobroker_manage_kb", { action: "stats" }, "[ERROR] ")) as {
        error: { code: string };
      };
      expect(stats.error.code).toBe("config_error");

      const status = JSON.parse(
        await toolText(server, "infobroker_manage_kb", { action: "encryption", operation: "status" }, "[OK] ")
      ) as { results: Array<Record<string, unknown>> };
      const encryption = status.results[0]!;
      expect(encryption.state).toBe("locked");
      expect(encryption.on_disk_format).toBe("encrypted");
      expect(encryption.key_source).toBe("none");
      expect(encryption.key_resolvable).toBe(false);
      expect(encryption.lock).not.toBeNull();
    } finally {
      await server.stop();
    }

    // REQ-085: the locked server left the store byte-identical.
    const store = join(storagePath, STORE_FILE);
    const bytes = readFileSync(store);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(fingerprint.sha256);
    expect(bytes.length).toBe(fingerprint.size);
    expect(statSync(store).mtimeMs).toBe(fingerprint.mtimeMs);
  }, 60_000);

  test("a configured key file opens the store without any environment key", async () => {
    const iso = makeIsolatedConfig();
    dirs.push(iso.root);
    const configWithKey = writeConfig(iso.root, storagePath, { enabled: true, key_file: validKeyFile });
    const env = { ...envWithoutKeys(iso.env), INFOBROKER_CONFIG: configWithKey };
    const server = await startMcpServer({ env, clientName: "kb-handler-lock-test", initDelayMs: 500 });
    try {
      const status = JSON.parse(
        await toolText(server, "infobroker_manage_kb", { action: "encryption", operation: "status" }, "[OK] ")
      ) as { results: Array<Record<string, unknown>> };
      expect(status.results[0]!.key_source).toBe("key_file");
      expect(status.results[0]!.key_resolvable).toBe(true);
      expect(status.results[0]!.state).toBe("enabled");

      const claims = JSON.parse(
        await toolText(server, "infobroker_manage_kb", { action: "claims" }, "[OK] ")
      ) as Record<string, unknown>;
      expect(claims.status).toBe("ok");
    } finally {
      await server.stop();
    }
  }, 60_000);

  test("an unreadable key file does not fall back to the environment key", async () => {
    const iso = makeIsolatedConfig();
    dirs.push(iso.root);
    const missingKeyFile = join(iso.root, "missing.key");
    const configWithBogusKey = writeConfig(iso.root, storagePath, { enabled: true, key_file: missingKeyFile });
    const env = { ...envWithoutKeys(iso.env), INFOBROKER_CONFIG: configWithBogusKey, INFOBROKER_KB_KEY: secret };
    const server = await startMcpServer({ env, clientName: "kb-handler-lock-test", initDelayMs: 500 });
    try {
      const status = JSON.parse(
        await toolText(server, "infobroker_manage_kb", { action: "encryption", operation: "status" }, "[OK] ")
      ) as { results: Array<Record<string, unknown>> };
      expect(status.results[0]!.key_source).toBe("key_file");
      expect(status.results[0]!.key_resolvable).toBe(false);
      expect(status.results[0]!.state).toBe("locked");

      const claims = JSON.parse(await toolText(server, "infobroker_manage_kb", { action: "claims" }, "[ERROR] ")) as {
        error: { code: string };
      };
      expect(claims.error.code).toBe("config_error");
    } finally {
      await server.stop();
    }
  }, 60_000);
});
