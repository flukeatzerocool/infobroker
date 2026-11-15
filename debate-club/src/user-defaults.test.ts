// @implements REQ-001 REQ-002 REQ-003 REQ-020 REQ-038 REQ-079 REQ-111
// user-defaults.test.ts — the shipped default path, the invalid-layer
// recovery path, and two observable config behaviors. These are the
// "new user, no tuning" contracts the Lab profiles attribute their runs to.

import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startServer, type DebateServer } from "./client.js";
import { expectError, expectOk, parseEnvelope } from "./contracts.js";

const servers: DebateServer[] = [];

async function boot(options: Parameters<typeof startServer>[0] = {}): Promise<DebateServer> {
  const server = await startServer(options);
  servers.push(server);
  // The KB initializes after the MCP handshake; give it a beat.
  await new Promise((resolve) => setTimeout(resolve, 300));
  return server;
}

afterAll(() => {
  for (const server of servers) server.stop();
});

describe("shipped default path", () => {
  it("exposes all seven tools and answers a search with no keys or setup", async () => {
    const server = await boot({ configLayer: () => ({}) });
    expect((await server.listTools()).sort()).toEqual([
      "infobroker_fetch_page",
      "infobroker_get_citations",
      "infobroker_inspect_providers",
      "infobroker_manage_kb",
      "infobroker_reload_config",
      "infobroker_search_web",
      "infobroker_verify_claims",
    ]);

    const listed = expectOk((await server.call("infobroker_inspect_providers", { action: "list" })).text);
    expect((listed.results as unknown[]).length).toBeGreaterThan(0);

    const search = expectOk(
      (
        await server.call("infobroker_search_web", {
          query: "retrieval augmented generation",
          task_type: "encyclopedia",
          max_results: 3,
        })
      ).text
    );
    expect((search.results as unknown[]).length).toBeGreaterThan(0);
    expect(String(search.provider)).toBe("wikipedia");
  }, 60000);

  it("starts on shipped defaults when config.local.json is invalid, and leaves it untouched", async () => {
    const raw = '{ "output": ';
    const server = await boot({ configLocalRaw: raw });
    const body = expectOk((await server.call("infobroker_inspect_providers", { action: "list" })).text);
    const notices = (body.notices ?? []) as Array<Record<string, unknown>>;
    expect(notices.some((notice) => notice.code === "config_invalid_startup")).toBe(true);
    expect(notices.length).toBeLessThanOrEqual(5);
    expect(readFileSync(join(server.tmpDir, "config.local.json"), "utf8")).toBe(raw);
  }, 60000);
});

describe("config behavior", () => {
  it("caps a crawl at fetch.crawl_max_pages", async () => {
    const capped = await boot({ configLayer: () => ({ fetch: { crawl_max_pages: 2 } }) });
    const body = expectOk(
      (
        await capped.call("infobroker_fetch_page", {
          url: "https://example.com/crawl",
          crawl: true,
          detect_date: false,
        })
      ).text
    );
    expect((body.results as unknown[]).length).toBe(2);
  }, 60000);

  it("keeps only title/url/snippet and required meta when verbose is false", async () => {
    const compact = await boot({ configLayer: () => ({ output: { verbose: false } }) });
    const body = expectOk(
      (
        await compact.call("infobroker_search_web", {
          query: "retrieval augmented generation",
          task_type: "encyclopedia",
          max_results: 2,
        })
      ).text
    );
    for (const result of body.results as Array<Record<string, unknown>>) {
      expect(Object.keys(result).sort()).toEqual(["snippet", "title", "url"]);
    }
    const meta = (body.meta ?? {}) as Record<string, unknown>;
    expect(Object.keys(meta).every((key) => ["per_query", "fact_status", "language_unsupported"].includes(key))).toBe(true);
  }, 60000);

  it("marks a rate-limited provider as cooling down (REQ-038)", async () => {
    const server = await boot({ configLayer: () => ({}) });
    const denied = await server.call("infobroker_search_web", {
      query: "CooldownProbe",
      provider: "wikipedia",
      max_results: 1,
    });
    expectError(denied.text, "rate_limited");

    const spec = expectOk((await server.call("infobroker_inspect_providers", { action: "spec" })).text);
    const row = (spec.results as Array<Record<string, unknown>>)[0];
    const session = row.session as Record<string, unknown>;
    expect((session.cooldowns_active as unknown[]).length).toBeGreaterThan(0);
    expect(parseEnvelope(denied.text).ok).toBe(false);
  }, 60000);
});
