// @implements REQ-031 REQ-031a REQ-034 REQ-038 REQ-015 REQ-027a REQ-111a
// @implements REQ-031b win-cancel
// @implements REQ-031b exhaustion
// Dispatch orchestration is asserted through the spawned server against
// loopback providers, so the hedge switch, cross-task fallback, empty-vs-error
// distinction, exhaustion skip, and cooldown skip are measured on the real
// handler instead of a copy of it.
import { afterAll, describe, expect, test } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  startStubProvider,
  writeHermeticConfig,
  type HermeticConfig,
  type HermeticConfigOptions,
  type HermeticProvider,
  type StubMode,
  type StubProvider,
  type StubProviderOptions,
} from "./lib/stub-provider.js";
import { withServer, type RpcMessage } from "./lib/mcp-stdio.js";
import { flushKbWrites, initKb, kbIngest } from "./kb.js";
import type { KbConfig } from "./types.js";

const cleanups: Array<() => Promise<void> | void> = [];

afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

interface ToolPayload {
  status: string;
  provider: string;
  results: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
  notices?: Array<{ code: string; severity?: string; message: string; details?: Record<string, unknown> }>;
  error?: { code: string; message: string; details?: Record<string, unknown> };
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
  options: Omit<HermeticConfigOptions, "providers"> = {},
): Promise<{ cfg: HermeticConfig; env: NodeJS.ProcessEnv }> {
  const cfg = writeHermeticConfig(providers[0]?.url ?? "http://127.0.0.1:1", {
    providers,
    ...options,
  });
  return { cfg, env: cfg.env };
}

async function stub(mode: StubMode | StubProviderOptions, delayMs?: number) {
  const server = await startStubProvider(
    typeof mode === "string" ? (delayMs === undefined ? mode : { mode, delayMs }) : mode,
  );
  cleanups.push(() => server.close());
  return server;
}

/** Wait until the stub has seen `count` aborts, so the assertion is not racy. */
async function waitForAborts(server: StubProvider, count: number, timeoutMs = 3_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.aborts >= count) return server.aborts;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return server.aborts;
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

    await withServer({ env: cfg.env }, async (call) => {
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

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "mixed probe" });
      expect(payload.status).toBe("error");
      expect(payload.error?.code).toBe("all_providers_exhausted");
    });
  });

  test("an all-empty chain stays a successful zero-result answer", async () => {
    const a = await stub("empty");
    const b = await stub("empty");
    const { cfg } = await setup([provider("stub_a", a.url), provider("stub_b", b.url)]);

    await withServer({ env: cfg.env }, async (call) => {
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

    await withServer({ env: cfg.env }, async (call) => {
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

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "hedge on" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_b");
    });
  });

  // REQ-031b: a losing provider is cancelled while its request is in flight.
  test("a hedged loss aborts the losing provider instead of letting it finish", async () => {
    const slow = await stub("ok", 800);
    const fast = await stub("ok");
    const { cfg } = await setup(
      [provider("stub_a", slow.url), provider("stub_b", fast.url)],
      { output: { hedge_enabled: true, hedge_min_delay_ms: 50, hedge_max_delay_ms: 60 } },
    );

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "hedge cancel" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_b");
      expect(await waitForAborts(slow, 1)).toBe(1);
    });
  });

  // REQ-031b: the builtin searxng module forwards the cancellation signal too.
  test("the builtin provider shape aborts its losing request as well", async () => {
    const slow = await stub("ok", 800);
    const fast = await stub("ok");
    const cfg = writeHermeticConfig(slow.url, {
      providers: [provider("stub_b", fast.url)],
      enable: ["searxng"],
      chains: { general_web: ["searxng", "stub_b"] },
      output: { hedge_enabled: true, hedge_min_delay_ms: 50, hedge_max_delay_ms: 60 },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "hedge cancel builtin" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_b");
      expect(await waitForAborts(slow, 1)).toBe(1);
    });
  });

  // REQ-031b: on exhaustion nothing is cancelled early — every provider settles.
  test("an exhausting hedge cancels nothing and reports exhaustion", async () => {
    const a = await stub("error", 120);
    const b = await stub("error", 120);
    const { cfg } = await setup([provider("stub_a", a.url), provider("stub_b", b.url)], {
      chains: { general_web: ["stub_a", "stub_b"] },
      output: { hedge_enabled: true, hedge_min_delay_ms: 20, hedge_max_delay_ms: 30 },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "hedge exhausted" });
      expect(payload.status).toBe("error");
      expect(payload.error?.code).toBe("all_providers_exhausted");
      expect(a.aborts).toBe(0);
      expect(b.aborts).toBe(0);
    });
  });

  // REQ-031b: a retry waiting in backoff must not re-dispatch after the loss.
  test("a losing provider in retry backoff does not dispatch again", async () => {
    const failing = await stub({ mode: "error", delayMs: 10 });
    const fast = await stub("ok");
    const { cfg } = await setup(
      [
        provider("stub_a", failing.url, { retryCount: 2, retryBackoffMs: 400 }),
        provider("stub_b", fast.url),
      ],
      {
        chains: { general_web: ["stub_a", "stub_b"] },
        output: { hedge_enabled: true, hedge_min_delay_ms: 20, hedge_max_delay_ms: 30 },
      },
    );

    await withServer({ env: cfg.env }, async (call) => {
      // The startup probe may already have touched the provider once.
      const before = failing.requests;
      const payload = await search(call, { query: "hedge retry cancel" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_b");
      // Give the retry loop time to wake up; the abort must stop it re-dispatching.
      await new Promise((resolve) => setTimeout(resolve, 900));
      expect(failing.requests - before).toBe(1);
    });
  });

  test("disabling the hedge serves from the primary", async () => {    const slow = await stub("ok", 300);
    const fast = await stub("ok");
    const { cfg } = await setup(
      [provider("stub_a", slow.url), provider("stub_b", fast.url)],
      { output: { hedge_enabled: false } },
    );

    await withServer({ env: cfg.env }, async (call) => {
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

    await withServer({ env: cfg.env }, async (call) => {
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

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "all error" });
      expect(payload.status).toBe("error");
      expect(payload.error?.code).toBe("all_providers_exhausted");
    });
  });

  test("a provider in cooldown is skipped without a new outbound call", async () => {
    const a = await stub("rate_limited");
    const { cfg } = await setup([provider("stub_a", a.url)]);

    await withServer({ env: cfg.env }, async (call) => {
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

describe("cooldown notice on tool responses (REQ-111a)", () => {
  // The existing search() helper hardcodes infobroker_search_web; the notice
  // contract is about every tool response, so this local helper calls any tool
  // and parses the same [OK] / [ERROR] envelope.
  const toolPayload = async (
    call: (method: string, params: unknown) => Promise<RpcMessage>,
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolPayload> => {
    const msg = await call("tools/call", { name, arguments: args });
    const text = (msg.result as { content?: Array<{ text?: string }> } | undefined)?.content?.[0]?.text ?? "";
    return parse(text);
  };

  test("a successful response carries the bounded cooldown notice", async () => {
    const a = await stub("rate_limited");
    const b = await stub("ok");
    const { cfg } = await setup([provider("stub_a", a.url), provider("stub_b", b.url)], {
      output: { hedge_enabled: false },
    });
    const window = (
      JSON.parse(readFileSync(join(cfg.root, "config.json"), "utf-8")) as {
        output?: { rate_limit_cooldown_ms?: number };
      }
    ).output?.rate_limit_cooldown_ms;
    expect(typeof window).toBe("number");
    const cooldownWindow = window as number;
    expect(cooldownWindow).toBeGreaterThan(0);

    await withServer({ env: cfg.env }, async (call) => {
      // Control: before any provider is cooled down, the same tool carries no
      // cooldown notice. This also proves its payload has no notices of its
      // own, which is the precondition injectNotices requires.
      const control = await toolPayload(call, "infobroker_inspect_providers", { action: "list" });
      expect(control.status).toBe("ok");
      expect((control.notices ?? []).filter((n) => n.code === "provider_cooldown")).toHaveLength(0);

      // The search itself must be what cools stub_a down.
      const before = a.requests;
      const first = await search(call, { query: "cooldown notice first" });
      expect(a.requests - before).toBe(1);
      expect(first.status).toBe("ok");
      expect(first.provider).toBe("stub_b");

      const notices = (first.notices ?? []).filter((n) => n.code === "provider_cooldown");
      expect(notices).toHaveLength(1);
      expect(notices[0]).toMatchObject({ severity: "info", details: { provider: "stub_a" } });
      expect(notices[0]!.message).toContain("stub_a");
      const remaining = notices[0]!.details?.["remaining_ms"];
      expect(typeof remaining).toBe("number");
      expect(remaining as number).toBeGreaterThan(0);
      expect(remaining as number).toBeLessThanOrEqual(cooldownWindow);
      expect((first.notices ?? []).length).toBeLessThanOrEqual(5);

      // Every successful tool response, not only the search that triggered it.
      const second = await toolPayload(call, "infobroker_inspect_providers", { action: "list" });
      expect(second.status).toBe("ok");
      const repeated = (second.notices ?? []).filter((n) => n.code === "provider_cooldown");
      expect(repeated).toHaveLength(1);
      expect(repeated[0]!.details).toMatchObject({ provider: "stub_a" });
      // No second outbound call: the notice came from the existing cooldown.
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

    await withServer({ env: cfg.env }, async (call) => {
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

// F-R3-1 / §7.4: an explicit provider keeps precedence over the priority chain.
describe("explicit provider precedence (REQ-020a)", () => {
  test("an explicit provider survives privacy and free_only selection", async () => {
    const a = await stub("ok");
    const b = await stub("ok");
    const { cfg } = await setup(
      [provider("stub_a", a.url), provider("stub_b", b.url)],
      {
        chains: { general_web: ["stub_a", "stub_b"], privacy_critical: ["stub_a"], free: ["stub_a", "stub_b"] },
        output: { hedge_enabled: false },
      },
    );

    await withServer({ env: cfg.env }, async (call) => {
      for (const priority of ["privacy", "free_only", "quality"] as const) {
        const payload = await search(call, { query: "precedence probe", provider: "stub_b", priority });
        expect(payload.status, priority).toBe("ok");
        expect(payload.provider, priority).toBe("stub_b");
      }
    });
  });

  test("an unusable explicit provider does not displace the selected chain", async () => {
    const a = await stub("ok");
    const { cfg } = await setup([provider("stub_a", a.url)], {
      chains: { general_web: ["stub_a"], privacy_critical: ["stub_a"] },
    });
    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "precedence probe", provider: "stub_a", priority: "privacy" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_a");
    });
  });
});

// F-R3-15 / REQ-020g: collapse consumes provider headroom before the caller's
// maximum is applied, so duplicate-heavy leading results cannot undershoot.
describe("collapse before the maximum slice (REQ-020g)", () => {
  test("returns the requested maximum after collapsing duplicates", async () => {
    const duplicate = "Quantum error correction breakthrough with logical qubits at scale";
    const contents = [
      duplicate,
      duplicate,
      "Sourdough baking guide for beginners at home",
      "Orbital mechanics for small satellite operators",
      "Medieval history of the Hanseatic League",
      "Photosynthesis in deep ocean algae",
      "Vintage motorcycle restoration checklist",
      "Modern poetry translation practices",
    ];
    const a = await stub({ mode: "ok", results: contents.length, contents });
    const { cfg } = await setup([provider("stub_a", a.url)], { output: { hedge_enabled: false } });

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "quantum error correction", max_results: 4 });
      expect(payload.status).toBe("ok");
      expect(payload.results).toHaveLength(4);
      const titles = payload.results.map((row) => String(row.title));
      expect(new Set(titles).size).toBe(4);
    });
  });
});

// F-R3-20 / REQ-128: every chain provider that cannot honor the language is
// reported, including under compact verbosity.
describe("chain-wide language reporting (REQ-128)", () => {
  test("reports the non-capable chain-mates and keeps the field in compact mode", async () => {
    const a = await stub("ok");
    const b = await stub("ok");
    for (const verbose of [true, false]) {
      const { cfg } = await setup(
        [provider("stub_a", a.url), provider("stub_b", b.url)],
        { output: { hedge_enabled: false, verbose } },
      );
      await withServer({ env: cfg.env }, async (call) => {
        const payload = await search(call, { query: "language probe", language: "fr" });
        expect(payload.status).toBe("ok");
        expect(payload.provider).toBe("stub_a");
        expect(payload.meta?.language_unsupported).toEqual(["stub_b"]);
      });
    }
  });
});

// F-R3-28 / REQ-127: analysis is omitted when the result set is empty after
// blocklist filtering.
describe("analysis omission (REQ-127)", () => {
  test("omits analysis when every result is blocklisted", async () => {
    const a = await stub("ok");
    const { cfg } = await setup([provider("stub_a", a.url)], {
      output: { hedge_enabled: false },
      source_quality: { enabled: true, weight: 0.15, blocklist: ["example.com"] },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "blocked probe", analyze: true });
      expect(payload.status).toBe("ok");
      expect(payload.results).toHaveLength(0);
      expect(payload.meta?.blocked_count).toBe(1);
      expect(payload.meta?.analysis).toBeUndefined();
    });
  });
});

// F-R3-24 / REQ-028: deep reading runs under compact verbosity instead of
// silently returning a plain search.
describe("deep reading under compact verbosity (REQ-028)", () => {
  test("fetches and ranks pages while compact shaping trims the payload", async () => {
    const a = await stub({ mode: "ok", servePages: true });
    const { cfg } = await setup([provider("stub_a", a.url)], {
      chains: { general_web: ["stub_a"], content_fetch: ["native_fetch"] },
      output: { hedge_enabled: false, verbose: false },
      fetch: { allow_private_urls: true },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const before = a.requests;
      const payload = await search(call, { query: "deep compact probe", deep: true });
      expect(payload.status).toBe("ok");
      // The search hit the provider and the deep read fetched the page from the
      // same loopback stub; compact shaping keeps `deep`/`pages_read` out of meta.
      expect(a.requests - before).toBeGreaterThan(1);
      expect(payload.meta?.pages_read).toBeUndefined();
    });
  });
});

// F-R3-23 / REQ-004: an oversized response is truncated at the boundary with
// the flag and path preserved in the structured body.
describe("response truncation (REQ-004)", () => {
  test("bounds an oversized search response and keeps structuredContent intact", async () => {
    const a = await stub("ok");
    const { cfg } = await setup([provider("stub_a", a.url)], {
      output: { hedge_enabled: false, response_max_chars: 220 },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const msg = await call("tools/call", { name: "infobroker_search_web", arguments: { query: "truncation probe" } });
      const result = msg.result as {
        content: Array<{ text: string }>;
        structuredContent?: Record<string, unknown>;
      };
      expect(result.content[0].text).toContain("[truncated at 220 chars");
      expect(result.structuredContent?.truncated).toBe(true);
      expect(typeof result.structuredContent?.output_path).toBe("string");
      expect((result.structuredContent?.results as unknown[]).length).toBeGreaterThan(0);
    });
  });
});

// F-R3-3 / F-R3-18: a KB-first hit reports the same request metadata as a
// cache miss and takes the same source-quality ordering. The store is seeded
// from this process before the server spawns, using the hermetic storage path.
describe("KB-first metadata and ordering (REQ-020d, REQ-020h)", () => {
  test("reports task type and ignored parameters on a cache hit", async () => {
    const a = await stub("ok");
    const { cfg } = await setup([provider("stub_a", a.url)], { output: { hedge_enabled: false } });
    const rawConfig = JSON.parse(readFileSync(join(cfg.root, "config.json"), "utf-8")) as { kb: KbConfig };
    initKb(rawConfig.kb);
    kbIngest(
      "Stored knowledge base note about catalogue archives and records",
      "Catalogue archive note",
      "https://archive.example/note",
      "knowledge_base",
      "default",
      "note",
      "stable",
    );
    kbIngest(
      "Sourdough baking guide covering flour water salt and starter",
      "Sourdough baking guide",
      "https://kitchen.example/bread",
      "knowledge_base",
      "default",
      "note",
      "stable",
    );
    flushKbWrites();

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "catalogue archive note", fresh: false });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("knowledge_base");
      expect(payload.meta?.kb_recall).toBe("hit");
      expect(payload.meta?.task_type).toBeDefined();
      expect(payload.meta?.ignored_params).toBeDefined();
      expect(payload.meta?.ignored_operators).toBeDefined();
      // REQ-020h: the stored rows are ordered by relevance, not insertion order.
      expect(payload.results[0]?.url).toBe("https://archive.example/note");
    });
  });
});

// F-R5-C-3 / REQ-122: deep reading reports the snapshot hash and freshness
// tier alongside the live URL, and omits them when preservation is off.
describe("deep-reading snapshot reporting (REQ-122)", () => {
  test("carries the snapshot hash and tier for each fetched page", async () => {
    const a = await stub({ mode: "ok", servePages: true });
    const { cfg } = await setup([provider("stub_a", a.url)], {
      chains: { general_web: ["stub_a"], content_fetch: ["native_fetch"] },
      output: { hedge_enabled: false },
      fetch: { allow_private_urls: true },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "deep snapshot probe", deep: true });
      expect(payload.status).toBe("ok");
      const read = (payload.results ?? []).filter((r) => typeof r.snapshot_sha256 === "string");
      expect(read.length).toBeGreaterThan(0);
      expect(read[0]!.snapshot_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(read[0]!.snapshot_tier).toBe("evergreen");
      expect(read[0]!.snapshot_basis).toBe("document");
    });
  });

  test("omits the snapshot fields when preservation is disabled", async () => {
    const a = await stub({ mode: "ok", servePages: true });
    const { cfg } = await setup([provider("stub_a", a.url)], {
      chains: { general_web: ["stub_a"], content_fetch: ["native_fetch"] },
      output: { hedge_enabled: false },
      fetch: { allow_private_urls: true },
      preservation: { enabled: false },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "deep snapshot probe", deep: true });
      expect(payload.status).toBe("ok");
      expect((payload.results ?? []).every((r) => r.snapshot_sha256 === undefined)).toBe(true);
    });
  });
});

// F-R5-E-3 / REQ-027a: compact verbosity must not drop the per-provider status
// or the zero-result provider list that REQ-027a requires unconditionally.
describe("compact get_citations metadata (REQ-027a)", () => {
  async function citations(
    call: (method: string, params: unknown) => Promise<RpcMessage>,
    args: Record<string, unknown>,
  ): Promise<ToolPayload> {
    const msg = await call("tools/call", { name: "infobroker_get_citations", arguments: args });
    const text = (msg.result as { content?: Array<{ text?: string }> } | undefined)?.content?.[0]?.text ?? "";
    return parse(text);
  }

  test("retains per-provider status under compact verbosity", async () => {
    const a = await stub("ok");
    const { cfg } = await setup([provider("stub_a", a.url)], {
      chains: { academic: ["stub_a"] },
      output: { verbose: false },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await citations(call, { query: "compact citation probe", max_results: 3 });
      expect(payload.status).toBe("ok");
      expect(payload.results.length).toBeGreaterThan(0);
      const providers = payload.meta?.providers as Array<{ slug: string; status: string }> | undefined;
      expect(Array.isArray(providers)).toBe(true);
      expect(providers?.some((p) => p.slug === "stub_a" && p.status === "ok")).toBe(true);
    });
  });

  test("retains the zero-result provider list and diagnostic under compact verbosity", async () => {
    const a = await stub("empty");
    const { cfg } = await setup([provider("stub_a", a.url)], {
      chains: { academic: ["stub_a"] },
      output: { verbose: false },
    });

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await citations(call, { query: "empty citation probe", max_results: 3 });
      expect(payload.status).toBe("ok");
      expect(payload.results).toEqual([]);
      const providers = payload.meta?.providers as Array<{ slug: string; status: string }> | undefined;
      expect(providers?.some((p) => p.slug === "stub_a")).toBe(true);
      expect(payload.meta?.no_results).toBe(true);
      expect(String(payload.meta?.diagnostic)).toContain("stub_a");
    });
  });
});

// REQ-031: a search-capable provider outside the serving chain rescues the
// request before the empty-vs-error end state. The keyed-provider case is the
// one that matters when every keyless provider is blocked.
describe("keyed rescue (REQ-031)", () => {
  test("a usable provider outside the chain serves after an all-empty chain", async () => {
    const empty = await stub("empty");
    const rescue = await stub("ok");
    const { cfg } = await setup([
      provider("stub_empty", empty.url),
      provider("stub_rescue", rescue.url, { dispatch: false }),
    ]);

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "rescue probe", fresh: true, task_type: "general_web" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_rescue");
      expect(payload.results.length).toBeGreaterThan(0);
      expect(payload.meta?.rescued_providers).toContain("stub_rescue");
    });
  });

  test("a usable provider outside the chain serves after an all-error chain", async () => {
    const failing = await stub("error");
    const rescue = await stub("ok");
    const { cfg } = await setup([
      provider("stub_fail", failing.url),
      provider("stub_rescue", rescue.url, { dispatch: false }),
    ]);

    await withServer({ env: cfg.env }, async (call) => {
      const payload = await search(call, { query: "rescue probe", fresh: true, task_type: "general_web" });
      expect(payload.status).toBe("ok");
      expect(payload.provider).toBe("stub_rescue");
    });
  });
});

// REQ-031: a failing rescue attempt must not turn an all-empty chain into an
// exhaustion error; the zero-result answer is still legitimate.
test("a failed rescue preserves the all-empty success", async () => {
  const empty = await stub("empty");
  const failing = await stub("error");
  const { cfg } = await setup([
    provider("stub_empty", empty.url),
    provider("stub_rescue", failing.url, { dispatch: false }),
  ]);

  await withServer({ env: cfg.env }, async (call) => {
    const payload = await search(call, { query: "empty rescue probe", fresh: true, task_type: "general_web" });
    expect(payload.status).toBe("ok");
    expect(payload.results).toEqual([]);
    expect(payload.meta?.no_results).toBe(true);
  });
});
