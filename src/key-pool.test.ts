// @implements REQ-104 REQ-011
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveApiKey,
  resolveApiKeyForEnv,
  markKeyRejected,
  markKeyRateLimited,
  noteAuthStatus,
  poolKeys,
  poolKeysForEnv,
  hasUsableKey,
  keyPoolStatus,
  resetKeyPoolStateForTests,
} from "./key-pool.js";

let dir: string;
let stateFile: string;
const saved = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "keypool-"));
  stateFile = join(dir, "key-pool.json");
  process.env["INFOBROKER_KEYPOOL_STATE"] = stateFile;
  delete process.env["INFOBROKER_ACME_API_KEY"];
  delete process.env["INFOBROKER_ACME_API_KEYS"];
  resetKeyPoolStateForTests();
});

afterEach(() => {
  process.env = { ...saved };
  rmSync(dir, { recursive: true, force: true });
});

describe("key pool (REQ-104)", () => {
  it("falls back to the single-key variable of REQ-011", () => {
    process.env["INFOBROKER_ACME_API_KEY"] = "single";
    expect(poolKeys("acme")).toEqual(["single"]);
    expect(resolveApiKey("acme")).toBe("single");
  });

  it("parses a comma/whitespace separated pool", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "k1, k2 k3";
    expect(poolKeys("acme")).toEqual(["k1", "k2", "k3"]);
  });

  it("rotates round-robin across available keys", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "k1,k2";
    expect(resolveApiKey("acme")).toBe("k1");
    expect(resolveApiKey("acme")).toBe("k2");
    expect(resolveApiKey("acme")).toBe("k1");
  });

  it("stops using a rejected key for the session", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "k1,k2";
    markKeyRejected("acme", "k1");
    expect(resolveApiKey("acme")).toBe("k2");
    expect(resolveApiKey("acme")).toBe("k2");
  });

  it("returns undefined when every key is unavailable", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "k1,k2";
    markKeyRejected("acme", "k1");
    markKeyRejected("acme", "k2");
    expect(resolveApiKey("acme")).toBeUndefined();
  });

  it("cools a rate-limited key and recovers after the window", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "k1,k2";
    markKeyRateLimited("acme", "k1", 60_000);
    expect(resolveApiKey("acme")).toBe("k2");
    // Past the cooldown window the key is usable again.
    expect(resolveApiKey("acme", Date.now() + 120_000)).toBe("k1");
  });

  it("maps 401/403 to disable and 429 to cooldown", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "k1,k2";
    noteAuthStatus("acme", "k1", 401);
    expect(keyPoolStatus("acme").find((s) => s.index === 0)?.reason).toBe("rejected");
    noteAuthStatus("acme", "k2", 429);
    expect(keyPoolStatus("acme").find((s) => s.index === 1)?.reason).toBe("cooldown");
  });

  it("persists state without writing key material", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "supersecret1,supersecret2";
    markKeyRejected("acme", "supersecret1");
    const raw = readFileSync(stateFile, "utf-8");
    expect(raw).not.toContain("supersecret1");
    expect(raw).not.toContain("supersecret2");
    expect(existsSync(stateFile)).toBe(true);
  });

  it("creates the state directory with owner-only permissions (REQ-100)", () => {
    const nested = join(dir, "nested", "key-pool.json");
    process.env["INFOBROKER_KEYPOOL_STATE"] = nested;
    resetKeyPoolStateForTests();
    process.env["INFOBROKER_ACME_API_KEY"] = "k1";
    resolveApiKey("acme");
    expect(existsSync(nested)).toBe(true);
    if (process.platform !== "win32") {
      expect(statSync(join(dir, "nested")).mode & 0o777).toBe(0o700);
      expect(statSync(nested).mode & 0o777).toBe(0o600);
    }
  });

  it("discards and resets malformed persisted state (REQ-100)", () => {
    writeFileSync(stateFile, JSON.stringify({ cursor: "not-a-number", keys: "nope" }));
    resetKeyPoolStateForTests();
    process.env["INFOBROKER_ACME_API_KEY"] = "k1";
    expect(resolveApiKey("acme")).toBe("k1");
    const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as { cursor: unknown; keys: unknown };
    expect(typeof raw.cursor).toBe("number");
    expect(raw.keys).toEqual({});
  });
});

// REQ-104: a predicate must be able to ask whether any credential is usable
// without spending one. F-R2-8/F-R2-29 depend on it, so it must not advance the
// cursor or write state.
describe("credential availability predicate (REQ-104)", () => {
  it("reports an exhausted pool as unusable", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "k1,k2";
    markKeyRejected("acme", "k1");
    expect(hasUsableKey("acme")).toBe(true);
    markKeyRejected("acme", "k2");
    expect(hasUsableKey("acme")).toBe(false);
  });

  it("does not advance the selection cursor", () => {
    process.env["INFOBROKER_ACME_API_KEYS"] = "k1,k2";
    expect(hasUsableKey("acme")).toBe(true);
    expect(hasUsableKey("acme")).toBe(true);
    expect(resolveApiKey("acme")).toBe("k1");
  });

  it("reports an absent credential as unusable", () => {
    expect(hasUsableKey("acme")).toBe(false);
  });

  it("derives the pool variable from a declared credential variable", () => {
    process.env["ACME_TOKEN"] = "single";
    expect(poolKeysForEnv("ACME_TOKEN")).toEqual(["single"]);

    process.env["ACME_TOKEN_POOL"] = "p1,p2";
    expect(poolKeysForEnv("ACME_TOKEN")).toEqual(["p1", "p2"]);

    process.env["INFOBROKER_OTHER_API_KEY"] = "single";
    process.env["INFOBROKER_OTHER_API_KEYS"] = "q1,q2";
    expect(poolKeysForEnv("INFOBROKER_OTHER_API_KEY")).toEqual(["q1", "q2"]);

    delete process.env["ACME_TOKEN"];
    delete process.env["ACME_TOKEN_POOL"];
    delete process.env["INFOBROKER_OTHER_API_KEY"];
    delete process.env["INFOBROKER_OTHER_API_KEYS"];
  });

  it("resolves a pool for a declared credential variable under a provider scope", () => {
    process.env["ACME_TOKEN_POOL"] = "a1,a2";
    expect(resolveApiKeyForEnv("ACME_TOKEN", "acme")).toBe("a1");
    expect(resolveApiKeyForEnv("ACME_TOKEN", "acme")).toBe("a2");
    delete process.env["ACME_TOKEN_POOL"];
  });
});
