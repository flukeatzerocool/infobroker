// @implements REQ-024b
// Hermetic fixtures for the spawned health-action tests. A loopback server
// answers as SearXNG, and the isolated config enables only that provider, pins
// every dispatch chain to it, and disables every other provider — so the
// search, the hedge, and the health probe can never reach an external host.
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

export type StubMode = "ok" | "missing";

export interface StubProvider {
  url: string;
  requests: number;
  close(): Promise<void>;
}

/** Start a loopback SearXNG-shaped stub: `ok` returns one result, `missing` 404s. */
export async function startStubProvider(mode: StubMode): Promise<StubProvider> {
  const state = { requests: 0 };
  const server = createHttpServer((_req, res) => {
    state.requests++;
    if (mode === "ok") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          results: [{ title: "Stub result", url: "https://example.com/stub", content: "stub body" }],
        })
      );
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    get requests() {
      return state.requests;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** A loopback URL that is provably closed (bound, then released). */
export async function closedPortUrl(): Promise<string> {
  return new Promise((resolve) => {
    const server = createNetServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(`http://127.0.0.1:${port}`));
    });
  });
}

export interface HermeticConfig {
  root: string;
  env: NodeJS.ProcessEnv;
}

/**
 * Write an isolated config for a spawned server: only `searxng` (and the inline
 * `native_fetch` fallback) stay enabled, every dispatch chain points at
 * `searxng`, and the KB lives under the temp root.
 */
export function writeHermeticConfig(searxngUrl: string): HermeticConfig {
  const root = mkdtempSync(join(tmpdir(), "infobroker-health-"));
  const storage = join(root, "knowledge-base");
  mkdirSync(storage, { recursive: true, mode: 0o700 });

  const config = JSON.parse(readFileSync(join(REPO_ROOT, "config.json"), "utf-8")) as {
    kb?: Record<string, unknown>;
    dispatch: Record<string, string[]>;
    providers: Record<string, { enabled: boolean }>;
  };
  config.kb = { ...(config.kb ?? {}), storage_path: storage, auto_index: false };
  config.providers.searxng.enabled = true;
  for (const [slug, provider] of Object.entries(config.providers)) {
    if (slug !== "searxng" && slug !== "native_fetch") provider.enabled = false;
  }
  for (const taskType of Object.keys(config.dispatch)) config.dispatch[taskType] = ["searxng"];

  const configPath = join(root, "config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });

  return {
    root,
    env: {
      ...process.env,
      HOME: root,
      XDG_DATA_HOME: join(root, "data"),
      TMPDIR: root,
      INFOBROKER_CONFIG: configPath,
      INFOBROKER_CONFIG_LOCAL: join(root, "config.local.json"),
      INFOBROKER_QUOTA_STATE: join(root, "quota.json"),
      INFOBROKER_KEYPOOL_STATE: join(root, "key-pool.json"),
      INFOBROKER_SEARXNG_URL: searxngUrl,
    },
  };
}
