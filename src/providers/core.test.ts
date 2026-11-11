// @implements REQ-104 REQ-020
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const h = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string, init?: unknown) => h.fetch(url, init),
}));

import { provider } from "./core.js";
import { resetKeyPoolStateForTests } from "../key-pool.js";

type Reply = { ok: boolean; status: number; json: () => Promise<unknown> };

function reply(status: number, body: unknown = { results: [] }): Reply {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function sentAuthorization(call: number): string | undefined {
  const init = h.fetch.mock.calls[call]?.[1] as { headers?: Record<string, string> } | undefined;
  return init?.headers?.["Authorization"];
}

let dir: string;
const saved = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "core-pool-"));
  process.env["INFOBROKER_KEYPOOL_STATE"] = join(dir, "key-pool.json");
  resetKeyPoolStateForTests();
  delete process.env["INFOBROKER_CORE_API_KEY"];
  delete process.env["INFOBROKER_CORE_API_KEYS"];
  h.fetch.mockReset();
  h.fetch.mockResolvedValue(reply(200));
});

afterEach(() => {
  process.env = { ...saved };
  rmSync(dir, { recursive: true, force: true });
});

describe("CORE credential pool (REQ-104)", () => {
  it("uses the first pooled credential", async () => {
    process.env["INFOBROKER_CORE_API_KEYS"] = "k1,k2";
    await provider.search!("q");
    expect(sentAuthorization(0)).toBe("Bearer k1");
  });

  it("disables a rejected credential and serves the next request with the following one", async () => {
    process.env["INFOBROKER_CORE_API_KEYS"] = "k1,k2";
    h.fetch.mockResolvedValueOnce(reply(401));
    await expect(provider.search!("q")).rejects.toThrow(/401/);
    h.fetch.mockResolvedValue(reply(200));
    await provider.search!("q");
    expect(sentAuthorization(1)).toBe("Bearer k2");
  });

  it("still falls back to the single-key variable of REQ-011", async () => {
    process.env["INFOBROKER_CORE_API_KEY"] = "single";
    await provider.search!("q");
    expect(sentAuthorization(0)).toBe("Bearer single");
  });

  it("sends no credential when neither variable is set (keyless use)", async () => {
    await provider.search!("q");
    expect(sentAuthorization(0)).toBeUndefined();
  });
});
