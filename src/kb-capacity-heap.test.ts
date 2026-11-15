// @implements REQ-108 heap-bounded-retrieval
// REQ-108 clause (a): "retrieval and inspection operations SHALL return complete
// results under a heap smaller than the stored chunk data." This suite stores
// 288 chunks of 512 KiB (146.6 MiB across 96 documents) and drives the real
// server over stdio at a 64 MB V8 old-space limit, asserting complete `search`,
// `list`, `get`, and `stats` results. The payload is seeded directly through
// `SqliteStore.insertChunks`: `kbIngest` would pay a whole-store dedup scan per
// document (src/kb.ts:684), which is quadratic and unrelated to the clause.
//
// The search case covers both read paths. A cold child's first `search` builds
// the candidate prefilter and collects from a full scan (src/kb.ts:612-618); a
// second search in the same process reads only the candidates through
// `iterateChunksByIds` (:621-623). Half the documents share the query's first
// nonzero embedding bucket, so the candidate set is a strict subset and the
// prefilter cannot degenerate into a silent full scan
// (src/kb-prefilter.ts:141).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { makeIsolatedConfig, type IsolatedConfig } from "./lib/test-isolation.js";
import { withServer } from "./lib/mcp-stdio.js";
import { SqliteStore } from "./kb-sqlite.js";
import { createModel } from "./embed.js";
import type { KbChunk } from "./types.js";

/** The heap the server runs under: the measured 48 MB boot floor plus margin. */
const HEAP_MB = 64;
const HEAP_BYTES = HEAP_MB * 1024 * 1024;
/** One document carries the bulk of the store; it is never read whole. */
const HUGE_CHUNK_BYTES = 512 * 1024;
const HUGE_CHUNKS = 288;
/** Small documents keep every tool response under the 50k response cap. */
const SMALL_CHUNK_BYTES = 10 * 1024;
const SMALL_DOCUMENTS = 8;
const SMALL_CHUNKS_PER_DOCUMENT = 3;
/** Small documents whose chunks carry the query bucket; the rest carry another. */
const SMALL_CANDIDATE_DOCUMENTS = SMALL_DOCUMENTS / 2;
const DOCUMENT_COUNT = SMALL_DOCUMENTS + 1;
const CHUNK_COUNT = HUGE_CHUNKS + SMALL_DOCUMENTS * SMALL_CHUNKS_PER_DOCUMENT;
const TARGET_URL = "https://example.com/small/0";

interface SeededPayload {
  iso: IsolatedConfig;
  bytes: number;
  chunkCount: number;
  query: string;
  /** The stored text of the target document's chunks, in `chunk_index` order. */
  targetChunks: string[];
}

let payload: SeededPayload;

/** Deterministic, incompressible ASCII text from a seeded LCG over a token alphabet. */
function textGenerator(bytes: number): () => string {
  let state = 0x2f6e2b1 >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const token = () => `w${next().toString(36)}x${next().toString(36)}`;
  return () => {
    const parts: string[] = [];
    let size = 0;
    while (size < bytes - 24) {
      const word = token();
      parts.push(word);
      size += word.length + 1;
    }
    return parts.join(" ").slice(0, bytes);
  };
}

function directoryBytes(dir: string): number {
  let total = 0;
  for (const name of readdirSync(dir)) total += statSync(join(dir, name)).size;
  return total;
}

beforeAll(() => {
  const iso = makeIsolatedConfig();
  const smallText = textGenerator(SMALL_CHUNK_BYTES);
  const hugeText = textGenerator(HUGE_CHUNK_BYTES);
  const model = createModel("signed-hash-tfidf")!;

  // The query is derived from the target chunk, so its tokens provably exist in
  // the store; the embedding bucket is derived from the query itself.
  const targetText = smallText();
  const query = targetText.split(" ").slice(0, 2).join(" ");
  const queryVector = model.embed(query);
  const queryBucket = queryVector.findIndex((value) => value !== 0);
  const querySign = Math.sign(queryVector[queryBucket] ?? 1) || 1;
  const otherBucket = (queryBucket + 1) % model.dims;
  const candidateVector = () => {
    const embedding = new Array<number>(model.dims).fill(0);
    embedding[queryBucket] = querySign;
    return embedding;
  };

  // Recent timestamps keep every chunk in the "fresh" band, so ranking is
  // decided by similarity rather than by freshness decay.
  const baseTimestamp = Date.now() - 60_000;

  const store = new SqliteStore(iso.storagePath);
  const targetChunks: string[] = [];
  store.init();
  try {
    // The bulk: one document, never retrieved whole. Its chunks are candidates,
    // so the second search's by-id read still has to stream the whole store.
    const huge: KbChunk[] = [];
    for (let index = 0; index < HUGE_CHUNKS; index++) {
      huge.push({
        id: randomUUID(),
        text: hugeText(),
        embedding: candidateVector(),
        source_url: "https://example.com/huge",
        chunk_index: index,
        title: "huge document",
        provider: "test",
        collection: "default",
        source_type: "web_search",
        freshness_tier: "fresh",
        ingested_at: baseTimestamp + index,
      });
    }
    store.insertChunks(huge);

    for (let document = 0; document < SMALL_DOCUMENTS; document++) {
      const chunks: KbChunk[] = [];
      for (let index = 0; index < SMALL_CHUNKS_PER_DOCUMENT; index++) {
        const text = document === 0 && index === 0 ? targetText : smallText();
        if (document === 0) targetChunks.push(text);
        // The target document's chunks carry the whole query vector, so they
        // outrank every other candidate instead of tying with them.
        const embedding = document === 0 ? queryVector : candidateVector();
        if (document >= SMALL_CANDIDATE_DOCUMENTS) embedding[queryBucket] = 0;
        if (document >= SMALL_CANDIDATE_DOCUMENTS) embedding[otherBucket] = 1;
        chunks.push({
          id: randomUUID(),
          text,
          embedding,
          source_url: `https://example.com/small/${document}`,
          chunk_index: index,
          title: `small doc ${document}`,
          provider: "test",
          collection: "default",
          source_type: "web_search",
          freshness_tier: "fresh",
          ingested_at: baseTimestamp + 100_000 + document * 1_000 + index,
        });
      }
      store.insertChunks(chunks);
    }
    store.flush();
  } finally {
    store.close();
  }

  payload = {
    iso,
    bytes: directoryBytes(iso.storagePath),
    chunkCount: CHUNK_COUNT,
    query,
    targetChunks,
  };
}, 120_000);

afterAll(() => {
  if (payload?.iso.root) rmSync(payload.iso.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Spawn the real server at a bounded heap and run one or more tool calls. */
/** The KB tool, driven against a server capped at HEAP_MB of old space. */
async function withHeapBoundedKb<T>(fn: (call: (arguments_: Record<string, unknown>) => Promise<Record<string, unknown>>) => Promise<T>): Promise<T> {
  return withServer(
    {
      env: { ...payload.iso.env, NODE_OPTIONS: `--max-old-space-size=${HEAP_MB}` },
      clientName: "kb-capacity-heap",
      killSignal: "SIGKILL",
    },
    async (rpc) => {
      const call = async (arguments_: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const reply = await rpc("tools/call", { name: "infobroker_manage_kb", arguments: arguments_ });
        if (reply.error) throw new Error(`tools/call failed: ${reply.error.message}`);
        const text = (reply.result as { content?: Array<{ text?: string }> } | undefined)?.content?.[0]?.text ?? "";
        expect(text.startsWith("[OK] "), `expected [OK], got: ${text.slice(0, 200)}`).toBe(true);
        return JSON.parse(text.slice("[OK] ".length)) as Record<string, unknown>;
      };
      return fn(call);
    },
  );
}

describe("REQ-108 clause (a): complete retrieval under a heap smaller than the store", () => {
  test("the seeded store is larger than twice the server heap", () => {
    expect(payload.chunkCount).toBe(CHUNK_COUNT);
    expect(payload.bytes).toBeGreaterThan(2 * HEAP_BYTES);
    expect(HEAP_BYTES).toBeLessThan(payload.bytes);
  });

  test("search returns the hit on a cold build scan and again on the bounded by-id read", async () => {
    await withHeapBoundedKb(async (call) => {
      for (const pass of ["cold", "candidates"]) {
        const body = await call({ action: "search", query: payload.query, max_results: 10 });
        const results = body["results"] as Array<Record<string, unknown>>;
        expect(Array.isArray(results), `${pass} search returned no results array`).toBe(true);
        expect(results.length, `${pass} search returned nothing`).toBeGreaterThan(0);
        expect(results[0]!["source_url"]).toBe(TARGET_URL);
        expect(String(results[0]!["snippet"] ?? "").length).toBeGreaterThan(0);
      }
    });
  });

  test("list returns every stored document with its complete chunk count", async () => {
    await withHeapBoundedKb(async (call) => {
      const body = await call({ action: "list" });
      const entries = body["results"] as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(DOCUMENT_COUNT);
      const bySource = new Map(entries.map((entry) => [entry["source_url"], entry["chunk_count"]]));
      expect(bySource.get("https://example.com/huge")).toBe(HUGE_CHUNKS);
      expect(bySource.get(TARGET_URL)).toBe(SMALL_CHUNKS_PER_DOCUMENT);
      for (const document of [0, 1, 2, 3, 4, 5, 6, 7]) {
        expect(bySource.get(`https://example.com/small/${document}`)).toBe(SMALL_CHUNKS_PER_DOCUMENT);
      }
    });
  });

  test("get returns the whole document body", async () => {
    await withHeapBoundedKb(async (call) => {
      const body = await call({ action: "get", source_url: TARGET_URL });
      const document = (body["results"] as Array<Record<string, unknown>>)[0]!;
      // `sqliteGet` orders by chunk_index and joins the chunk texts with "\n".
      expect(document["text"]).toBe(payload.targetChunks.join("\n"));
    });
  });

  test("stats counts the whole store and reports its size", async () => {
    await withHeapBoundedKb(async (call) => {
      const body = await call({ action: "stats" });
      const stats = (body["results"] as Array<Record<string, unknown>>)[0]!;
      expect(stats["chunk_count"]).toBe(CHUNK_COUNT);
      expect(stats["storage_size_bytes"] as number).toBeGreaterThan(2 * HEAP_BYTES);
    });
  });

  test("one process answers all four inspection actions in sequence", async () => {
    await withHeapBoundedKb(async (call) => {
      expect(((await call({ action: "stats" }))["results"] as unknown[]).length).toBe(1);
      expect(((await call({ action: "list" }))["results"] as unknown[]).length).toBe(DOCUMENT_COUNT);
      const search = await call({ action: "search", query: payload.query, max_results: 10 });
      expect((search["results"] as unknown[]).length).toBeGreaterThan(0);
      const get = await call({ action: "get", source_url: TARGET_URL });
      expect((get["results"] as Array<Record<string, unknown>>)[0]!["text"]).toBe(payload.targetChunks.join("\n"));
    });
  });
});
