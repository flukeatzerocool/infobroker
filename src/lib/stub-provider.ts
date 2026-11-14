// @implements REQ-024b REQ-011
// Hermetic fixtures for the spawned provider tests. A loopback server answers
// as SearXNG (or as a generic keyed provider), and the isolated config enables
// only loopback-backed providers, pins every dispatch chain to them, and
// disables every other provider — so a search, the hedge, the health probe, and
// the startup check can never reach an external host.
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

export type StubMode = "ok" | "missing" | "echo401" | "empty" | "rate_limited" | "error";

export interface StubProviderOptions {
  mode?: StubMode;
  /** Delay the response so a hedge race can be observed. */
  delayMs?: number;
  /** Number of results the `ok` mode returns (default 1). */
  results?: number;
  /** Explicit result URLs for the `ok` mode; the stub also serves them as HTML pages. */
  urls?: string[];
  /** Return this stub's own `/page/N` URLs so a deep read stays on loopback. */
  servePages?: boolean;
  /** Per-result content text for the `ok` mode. */
  contents?: string[];
  /** HTML body served for every `/page/N` request (defaults to the fixed stub page). */
  pageBody?: string;
  /** Extra headers served with every `/page/N` response (e.g. `last-modified`). */
  pageHeaders?: Record<string, string>;
}

export interface StubProvider {
  url: string;
  requests: number;
  close(): Promise<void>;
}

/**
 * Start a loopback provider stub: `ok` returns one result, `empty` returns an
 * empty result set, `missing` 404s, `rate_limited` 429s, `error` 500s, and
 * `echo401` rejects every request with a 401 whose body echoes the presented
 * credential — so a leak sweep can detect a response body reaching a client.
 */
export async function startStubProvider(
  modeOrOptions: StubMode | StubProviderOptions,
): Promise<StubProvider> {
  const options: StubProviderOptions = typeof modeOrOptions === "string" ? { mode: modeOrOptions } : modeOrOptions;
  const mode = options.mode ?? "ok";
  const delayMs = options.delayMs ?? 0;
  const resultCount = options.results ?? 1;
  const state = { requests: 0 };
  let selfUrl = "";
  const server = createHttpServer(async (req, res) => {
    state.requests++;
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    // A result URL served by this stub returns a small HTML page, so a deep
    // read can fetch it without leaving the loopback interface.
    if ((req.url ?? "").startsWith("/page/")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...(options.pageHeaders ?? {}) });
      res.end(
        options.pageBody ??
          `<html><head><title>Stub page</title></head><body><p>Stub page content for deep reading with ranked passages and queries.</p></body></html>`
      );
      return;
    }
    if (mode === "ok") {
      const urls = options.urls ?? Array.from({ length: resultCount }, (_, i) =>
        options.servePages ? `${selfUrl}/page/${i + 1}` : `https://example.com/stub-${i + 1}`
      );
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          results: urls.map((url, i) => {
            const body = options.contents?.[i] ?? `stub body ${i + 1}`;
            return { title: `Stub result ${i + 1}`, url, content: body, snippet: body };
          }),
        })
      );
      return;
    }
    if (mode === "empty") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ results: [] }));
      return;
    }
    if (mode === "rate_limited") {
      res.writeHead(429, { "content-type": "application/json", "retry-after": "30" });
      res.end(JSON.stringify({ error: "rate limited" }));
      return;
    }
    if (mode === "error") {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "provider failed" }));
      return;
    }
    if (mode === "echo401") {
      const presented = req.headers["authorization"] ?? req.headers["x-api-key"] ?? "";
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "credential rejected", presented }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  selfUrl = `http://127.0.0.1:${port}`;
  return {
    url: selfUrl,
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
  /** The file call-log path when `fileLogs` is enabled. */
  callLogPath?: string;
  /** The audit-log path when `fileLogs` is enabled. */
  auditLogPath?: string;
}

/** A loopback generic_http provider added to the isolated config. */
export interface HermeticProvider {
  slug: string;
  /** Conventional slug-derived credential variable, e.g. `INFOBROKER_KEYSTUB_API_KEY`. */
  authEnv: string;
  authOptional?: boolean;
  /** Add the provider to every dispatch chain. Defaults to true. */
  dispatch?: boolean;
  /** Own loopback endpoint; defaults to the shared `searxngUrl`. */
  url?: string;
  /** Keep the provider declared but disabled. Defaults to true (enabled). */
  enabled?: boolean;
  /** Quota/throttle override for the provider. */
  rateLimit?: { per_second?: number; per_day?: number; per_month?: number; jitter_ms?: number };
}

export interface HermeticConfigOptions {
  /** Additional loopback generic_http providers (replaces searxng in dispatch). */
  providers?: HermeticProvider[];
  /** Per-task dispatch chains; an unnamed task keeps the default provider order. */
  chains?: Record<string, string[]>;
  /** Overrides merged into the shipped `output` block (e.g. hedge timings). */
  output?: Record<string, unknown>;
  /** Overrides merged into the shipped `fetch` block (e.g. private-target permission). */
  fetch?: Record<string, unknown>;
  /** Overrides merged into the shipped `kb` block (e.g. auto-index). */
  kb?: Record<string, unknown>;
  /** Overrides merged into the shipped `preservation` block (e.g. disabling snapshots). */
  preservation?: Record<string, unknown>;
  /** Overrides merged into the shipped `source_quality` block (e.g. a blocklist). */
  source_quality?: Record<string, unknown>;
  /**
   * Shipped providers to re-enable after the isolation loop disables every
   * provider but `searxng`/`native_fetch` (e.g. a content renderer under test).
   * An unknown slug is rejected rather than silently ignored.
   */
  enable?: string[];
  /** Write the call log and audit log into the temp root. */
  fileLogs?: boolean;
}

/** Every option `writeHermeticConfig` understands; a stray key is rejected, not dropped. */
const HERMETIC_OPTION_KEYS: ReadonlySet<string> = new Set([
  "providers",
  "chains",
  "output",
  "fetch",
  "kb",
  "preservation",
  "source_quality",
  "enable",
  "fileLogs",
]);

function assertKnownOptions(options: HermeticConfigOptions): void {
  for (const key of Object.keys(options)) {
    if (!HERMETIC_OPTION_KEYS.has(key)) {
      throw new Error(`writeHermeticConfig: unknown option "${key}"`);
    }
  }
}

/** Drop every credential variable so a spawned server cannot inherit one. */
function scrubCredentials(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const key of Object.keys(env)) {
    if (/^INFOBROKER_[A-Z0-9_]+_API_KEYS?$/.test(key)) delete env[key];
  }
  return env;
}

/**
 * Write an isolated config for a spawned server: by default only `searxng`
 * (and the inline `native_fetch` fallback) stay enabled and every dispatch
 * chain points at `searxng`. With `providers`, each loopback generic_http
 * entry replaces searxng in every chain. The KB lives under the temp root.
 */
export function writeHermeticConfig(
  searxngUrl: string,
  options: HermeticConfigOptions = {},
): HermeticConfig {
  assertKnownOptions(options);
  const root = mkdtempSync(join(tmpdir(), "infobroker-health-"));
  const storage = join(root, "knowledge-base");
  mkdirSync(storage, { recursive: true, mode: 0o700 });

  const config = JSON.parse(readFileSync(join(REPO_ROOT, "config.json"), "utf-8")) as {
    kb?: Record<string, unknown>;
    output?: Record<string, unknown>;
    fetch?: Record<string, unknown>;
    preservation?: Record<string, unknown>;
    source_quality?: Record<string, unknown>;
    dispatch: Record<string, string[]>;
    providers: Record<string, Record<string, unknown>>;
  };
  config.kb = { ...(config.kb ?? {}), storage_path: storage, auto_index: false };

  const extra = options.providers ?? [];
  config.providers.searxng.enabled = extra.length === 0;
  for (const [slug, provider] of Object.entries(config.providers)) {
    if (slug !== "searxng" && slug !== "native_fetch") provider.enabled = false;
  }
  for (const slug of options.enable ?? []) {
    const entry = config.providers[slug];
    if (!entry) throw new Error(`writeHermeticConfig: unknown provider "${slug}"`);
    entry.enabled = true;
  }
  for (const provider of extra) {
    config.providers[provider.slug] = {
      tier: "generic_http",
      capabilities: ["web_search"],
      enabled: provider.enabled ?? true,
      priority: 1,
      rate_limit: provider.rateLimit ?? { per_second: 10 },
      endpoint: `${provider.url ?? searxngUrl}/search`,
      query_param: "q",
      results_path: "results",
      auth_env: provider.authEnv,
      ...(provider.authOptional ? { auth_optional: true } : {}),
      // Keep error-path tests fast: a loopback stub answers immediately.
      retry_count: 0,
      field_map: { title: "title", url: "url", snippet: "snippet" },
    };
  }

  const chain = extra.length > 0
    ? extra.filter((provider) => provider.dispatch !== false).map((provider) => provider.slug)
    : ["searxng"];
  for (const taskType of Object.keys(config.dispatch)) {
    config.dispatch[taskType] = options.chains?.[taskType] ?? [...chain];
  }
  if (options.output) config.output = { ...(config.output ?? {}), ...options.output };
  if (options.fetch) config.fetch = { ...(config.fetch ?? {}), ...options.fetch };
  if (options.kb) config.kb = { ...(config.kb ?? {}), ...options.kb };
  if (options.preservation) {
    config.preservation = { ...(config.preservation ?? {}), ...options.preservation };
  }
  if (options.source_quality) {
    config.source_quality = { ...(config.source_quality ?? {}), ...options.source_quality };
  }

  let callLogPath: string | undefined;
  let auditLogPath: string | undefined;
  if (options.fileLogs) {
    callLogPath = join(root, "call-log.jsonl");
    auditLogPath = join(root, "audit.log");
    config.output = {
      ...(config.output ?? {}),
      call_log: "file",
      call_log_path: callLogPath,
      audit_log_path: auditLogPath,
    };
  }

  const configPath = join(root, "config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });

  const env = scrubCredentials(process.env);
  env["HOME"] = root;
  env["XDG_DATA_HOME"] = join(root, "data");
  env["TMPDIR"] = root;
  env["INFOBROKER_CONFIG"] = configPath;
  env["INFOBROKER_CONFIG_LOCAL"] = join(root, "config.local.json");
  env["INFOBROKER_QUOTA_STATE"] = join(root, "quota.json");
  env["INFOBROKER_KEYPOOL_STATE"] = join(root, "key-pool.json");
  env["INFOBROKER_SEARXNG_URL"] = searxngUrl;

  return { root, env, ...(callLogPath ? { callLogPath } : {}), ...(auditLogPath ? { auditLogPath } : {}) };
}
