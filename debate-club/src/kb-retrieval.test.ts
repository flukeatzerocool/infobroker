// @implements REQ-076a REQ-103
// Arena: R6 retrieval remediation (F-R6-C-5, F-R6-C-6). Drives the real server
// over stdio: a research request and a deep request report recall as not
// applicable, a blend returns cached rows that fail the KB-first sufficiency
// thresholds, and the default mode still gates on them. All outbound requests
// are served from committed fixtures; `general_web` providers have no fixture
// hosts, so replay answers them with a synthetic 599 and the chain fails.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { join } from "node:path";

import { startServer, type DebateServer } from "./client.js";
import { expectOk, parseEnvelope } from "./contracts.js";

const SEED_URL = "https://example.com/arena-retrieval-seed";
const SEED_TEXT = "Survivor Series 1997 attendance was 20,593 at the Rosemont Horizon.";
const QUERY = "Survivor Series 1997 attendance";
const COLLECTION = "arena-retrieval";

function retrievalLayer(tmpDir: string): Record<string, unknown> {
  return {
    kb: {
      storage_path: join(tmpDir, "kb-retrieval"),
      keys_path: join(tmpDir, "keys-retrieval"),
      reports_path: join(tmpDir, "reports-retrieval"),
      auto_index: false,
      default_collection: COLLECTION,
      // Both thresholds sit above a realistic relevance score, so the seeded
      // row is sub-threshold for the default KB-first mode.
      kb_first_relevance_threshold: 0.99,
      kb_first_confidence_threshold: 0.99,
    },
  };
}

let server: DebateServer;
let bare: DebateServer;

beforeAll(async () => {
  server = await startServer({ configLayer: retrievalLayer });
  bare = await startServer({ configLayer: () => ({ kb: null }) });
  // The KB initializes after the MCP handshake; give it a beat.
  await new Promise((resolve) => setTimeout(resolve, 500));

  expectOk(
    (
      await server.call("infobroker_manage_kb", {
        action: "ingest",
        title: "Arena retrieval seed",
        text: SEED_TEXT,
        source_url: SEED_URL,
        collection: COLLECTION,
        source_type: "explicit",
        freshness_tier: "stable",
      })
    ).text
  );
});

afterAll(() => {
  server?.stop();
  bare?.stop();
});

async function search(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  return expectOk(
    (await server.call("infobroker_search_web", { query: QUERY, max_results: 5, ...args })).text
  );
}

function urls(body: Record<string, unknown>): string[] {
  return ((body.results as Array<Record<string, unknown>> | undefined) ?? []).map((r) => String(r.url));
}

describe("blend below the KB-first thresholds (REQ-076a)", () => {
  test("the seeded row is sub-threshold on the relevance leg", async () => {
    const searched = expectOk(
      (
        await server.call("infobroker_manage_kb", {
          action: "search",
          query: QUERY,
          collection: COLLECTION,
        })
      ).text
    );
    const row = (searched.results as Array<Record<string, unknown>>)[0];
    expect(row).toBeDefined();
    expect(Number(row.score)).toBeLessThan(0.99);
  });

  test("a blend returns a cached row that fails the sufficiency filter", async () => {
    // general_web has no fixture hosts, so every provider answers with 599 and
    // the external tier fails; the cached row must still be returned.
    const out = await search({ fresh: "blend", task_type: "general_web", collection: COLLECTION });
    const meta = out.meta as Record<string, unknown>;
    expect(meta.kb_recall).toBe("blended");
    expect(urls(out)).toContain(SEED_URL);
  });

  test("the default mode still gates the same row on the thresholds", async () => {
    // encyclopedia succeeds through the Wikipedia fixture, so the default mode
    // reaches the external tier instead of returning the cached row.
    const out = await search({ task_type: "encyclopedia", collection: COLLECTION });
    const meta = out.meta as Record<string, unknown>;
    expect(meta.kb_recall).toBe("miss");
    expect(urls(out)).not.toContain(SEED_URL);
  });
});

describe("recall state for deep and research requests (REQ-076a)", () => {
  test("a deep request reports not applicable even when skip is also requested", async () => {
    const out = await search({ deep: true, fresh: true, task_type: "encyclopedia", collection: COLLECTION });
    const meta = out.meta as Record<string, unknown>;
    expect(meta.deep).toBe(true);
    expect(meta.kb_recall).toBe("not_applicable");
  });

  test("a research request reports not applicable", async () => {
    // A research compile returns `groups`, not a top-level `results` array, so
    // the standard OK-shape helper does not apply.
    const parsed = parseEnvelope(
      (await server.call("infobroker_search_web", {
        query: QUERY,
        max_results: 5,
        research: true,
        task_type: "general_web",
        collection: COLLECTION,
      })).text
    );
    expect(parsed.ok).toBe(true);
    const meta = parsed.body.meta as Record<string, unknown>;
    expect(meta.research).toBe(true);
    expect(meta.kb_recall).toBe("not_applicable");
  });

  test("a deep request with no knowledge base reports not applicable", async () => {
    const out = expectOk(
      (
        await bare.call("infobroker_search_web", {
          query: QUERY,
          max_results: 5,
          deep: true,
          task_type: "encyclopedia",
        })
      ).text
    );
    expect((out.meta as Record<string, unknown>).kb_recall).toBe("not_applicable");
  });
});
