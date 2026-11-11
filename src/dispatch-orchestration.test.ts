// @implements REQ-031 REQ-031a REQ-034 REQ-038 REQ-015
// Dispatch orchestration is asserted through the spawned server against
// loopback providers, so the hedge switch, cross-task fallback, empty-vs-error
// distinction, exhaustion skip, and cooldown skip are measured on the real
// handler instead of a copy of it.
import { afterAll, describe, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  startStubProvider,
  writeHermeticConfig,
  type HermeticConfig,
  type HermeticProvider,
  type StubMode,
} from "./lib/stub-provider.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const cleanups: Array<() => Promise<void> | void> = [];

afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolPayload {
  status: string;
  provider: string;
  results: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

async function withServer<T>(
  env: NodeJS.ProcessEnv,
  fn: (call: (method: string, params: unknown) => Promise<RpcMessage>) => Promise<T>,
): Promise<T> {
  const child = spawn(join(REPO_ROOT, "node_modules", ".bin", "tsx"), [join(REPO_ROOT, "src", "index.ts")], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env,
  });
  const pending = new Map<number, (msg: RpcMessage) => void>();
  const rl = createInterface({ input: child.stdout! });
  rl.on("line", (line) => {
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line) as RpcMessage;
    } catch {
      return; // non-JSON stdout line is not an RPC response
    }
    if (typeof msg.id === "number" && pending.has(msg.id)) {
      const resolve = pending.get(msg.id)!;
      pending.delete(msg.id);
      resolve(msg);
    }
  });
  let nextId = 1;
  const send = (obj: unknown) => child.stdin!.write(JSON.stringify(obj) + "\n");
  const call = (method: string, params: unknown): Promise<RpcMessage> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      send({ jsonrpc: "2.0", id, method, params });
    });
  };
  try {
    const init = await call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "dispatch-orchestration-test", version: "1.0.0" },
    });
    expect(init.error).toBeUndefined();
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return await fn(call);
  } finally {
    child.kill();
  }
}

function parse(text: string): ToolPayload {
  const prefix = text.startsWith("[OK] ") ? "[OK] " : text.startsWith("[ERROR] ") ? "[ERROR] " : "";
  expect(prefix).not.toBe("");
  return JSON.parse(text.slice(prefix.length)) as ToolPayload;
}

async function search(call: (method: string, params: unknown) => Promise<RpcMessage>, args: Record<string, unknown>): Promise<ToolPayload> {
  const msg = await call("tools/call", { name: "infobroker_search_web", arguments: args });
  const text = (msg.result as { content?: Array<{ text?: string }> } | undefined)?.content?.[0]?.text ?? "";
  return parse(text);
}

async function setup(
  providers: HermeticProvider[],
  options: { chains?: Record<string, string[]>; output?: Record<string, unknown> } = {},
): Promise<{ cfg: HermeticConfig; env: NodeJS.ProcessEnv }> {
  const cfg = writeHermeticConfig(providers[0]?.url ?? "http://127.0.0.1:1", {
    providers,
    ...(options.chains ? { chains: options.chains } : {}),
    ...(options.output ? { output: options.output } : {}),
  });
  return { cfg, env: cfg.env };
}

async function stub(mode: StubMode, delayMs?: number) {
  const server = await startStubProvider(delayMs === undefined ? mode : { mode, delayMs });
  cleanups.push(() => server.close());
  return server;
}

function seedQuota(root: string, slug: string, dailyCount: number): void {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  writeFileSync(
    join(root, "quota.json"),
    JSON.stringify({
      providers: {
        [slug]: {
          daily: { count: dailyCount, resetAt: future },
          monthly: { count: 0, resetAt: future },
        },
      },
    }),
    { mode: 0o600 },
  );
}

const provider = (slug: string, url: string, extra: Partial<HermeticProvider> = {}): HermeticProvider => ({
  slug,
  authEnv: `INFOBROKER_${slug.toUpperCase()}_API_KEY`,
  authOptional: true,
  url,
  ...extra,
});

describe("quota exhaustion and chain shape (REQ-031, REQ-034)", () => {
  test("a fully quota-exhausted chain returns an exhaustion error carrying quota_exhausted", async () => {
    const a = await stub("ok");
    const { cfg } = await setup([provider("stub_a", a.url, { rateLimit: { per_day: 1 } })]);
    seedQuota(cfg.root, "stub_a", 1);

    await withServer(cfg.env, async (call) => {
      const before = a.requests;
      const payload = await search(call, { query: "quota probe" });
      expect(payload.status).toBe("error");
      expect(payload.error?.code).toBe("all_providers_exhausted");
      const exhausted = payload.error?.details?.quota_exhausted as Array<{ slug: string }> | undefined;
      expect(exhausted?.map((row) => row.slug)).toContain("stub_a");
      // The startup probe is not a search; the spent provider must not be searched.
      expect(a.requests - before).toBe(0);
    });
  });

  test("an exhausted provider plus an empty provider is an error, not an empty success", async () => {
    const a = await stub("ok");
    const b = await stub("empty");
    const { cfg } = await setup([
      provider("stub_a", a.url, { rateLimit: { per_day: 1 } }),
      provider("stub_b", b.url),
    ]);
    seedQuota(cfg.root, "stub_a", 1);

    await withServer(cfg.env, async (call) => {
      const payload = await search(call, { query: "mixed probe" });
      expect(payload.status).toBe("error");
      expect(payload.error?.code).toBe("all_providers_exhausted");
    });
  });

  test("an all-empty chain stays a successful zero-result answer", async () => {
    const a = await stub("empty");
    const b = await stub("empty");
    const { cfg } = await setup([provider("stub_a", a.url), provider("stub_b", b.url)]);

    await withServer(cfg.env, async (call) => {
      const payload = await search(call, { query: "empty probe" });
      expect(payload.status).toBe("ok");
      expect(payload.results).toEqual([]);
      expect(payload.meta?.no_results).toBe(true);
    });
  });

  test("a provider at 100% receives zero outbound calls while a healthy chain-mate serves", async () => {
    const a = await stub("ok");
    const b = await stub("ok");
    const { cfg } = await setup([
      provider("stub_a", a.url, { rateLimit: { per_day: 1 } }),
      provider("stub_b", b.url),
    ]);
    seedQuota(cfg.root, "stub_a", 1);

    await withServer(cfg.env, async (call) => {
      const aBefore = a.requests;
      const bBefore = b.requests;
      const payload = await search(call, { query: "skip probe" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_b");
      expect(a.requests - aBefore).toBe(0);
      expect(b.requests - bBefore).toBe(1);
    });
  });
});

describe("hedge, cross-task fallback and cooldown (REQ-031, REQ-031a, REQ-038)", () => {
  test("hedging selects the fast secondary over a slow primary", async () => {
    const slow = await stub("ok", 400);
    const fast = await stub("ok");
    const { cfg } = await setup(
      [provider("stub_a", slow.url), provider("stub_b", fast.url)],
      { output: { hedge_enabled: true, hedge_min_delay_ms: 50, hedge_max_delay_ms: 60 } },
    );

    await withServer(cfg.env, async (call) => {
      const payload = await search(call, { query: "hedge on" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_b");
    });
  });

  test("disabling the hedge serves from the primary", async () => {
    const slow = await stub("ok", 300);
    const fast = await stub("ok");
    const { cfg } = await setup(
      [provider("stub_a", slow.url), provider("stub_b", fast.url)],
      { output: { hedge_enabled: false } },
    );

    await withServer(cfg.env, async (call) => {
      const payload = await search(call, { query: "hedge off" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_a");
    });
  });

  test("a failed specialized chain falls back to the general_web chain in order", async () => {
    const failing = await stub("error");
    const healthy = await stub("ok");
    const { cfg } = await setup(
      [provider("stub_a", failing.url), provider("stub_b", healthy.url)],
      {
        chains: {
          academic: ["stub_a"],
          general_web: ["stub_b"],
        },
      },
    );

    await withServer(cfg.env, async (call) => {
      const payload = await search(call, { query: "cross task", task_type: "academic" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_b");
      expect(payload.meta?.task_type).toBe("academic");
    });
  });

  test("all providers failing returns all_providers_exhausted", async () => {
    const a = await stub("error");
    const b = await stub("error");
    const { cfg } = await setup([provider("stub_a", a.url), provider("stub_b", b.url)], {
      chains: { general_web: ["stub_a", "stub_b"] },
    });

    await withServer(cfg.env, async (call) => {
      const payload = await search(call, { query: "all error" });
      expect(payload.status).toBe("error");
      expect(payload.error?.code).toBe("all_providers_exhausted");
    });
  });

  test("a provider in cooldown is skipped without a new outbound call", async () => {
    const a = await stub("rate_limited");
    const { cfg } = await setup([provider("stub_a", a.url)]);

    await withServer(cfg.env, async (call) => {
      const before = a.requests;
      const first = await search(call, { query: "cooldown first" });
      expect(first.status).toBe("error");
      expect(first.error?.code).toBe("rate_limited");
      expect(a.requests - before).toBe(1);

      const second = await search(call, { query: "cooldown second" });
      expect(second.status).toBe("error");
      expect(second.error?.code).toBe("rate_limited");
      // The cooldown skip makes no new outbound call.
      expect(a.requests - before).toBe(1);
    });
  });
});

describe("disabled provider exclusion (REQ-015)", () => {
  test("a disabled provider is never called and the enabled chain-mate serves", async () => {
    const disabled = await stub("ok");
    const healthy = await stub("ok");
    const { cfg } = await setup([
      provider("stub_a", disabled.url, { enabled: false }),
      provider("stub_b", healthy.url),
    ]);

    await withServer(cfg.env, async (call) => {
      const disabledBefore = disabled.requests;
      const healthyBefore = healthy.requests;
      const payload = await search(call, { query: "disabled probe" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_b");
      expect(disabled.requests - disabledBefore).toBe(0);
      expect(healthy.requests - healthyBefore).toBe(1);
    });
  });
});
