// @implements REQ-112
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  compareVersions,
  configureUpdateCheck,
  getUpdateState,
  resetUpdateCheckForTest,
  runUpdateCheck,
} from "./update-check.js";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("version comparison (REQ-112)", () => {
  it("compares CalVer components numerically", () => {
    expect(compareVersions("2026.10.26", "2026.10.22")).toBeGreaterThan(0);
    expect(compareVersions("2026.10.22", "2026.10.22")).toBe(0);
    expect(compareVersions("2026.9.30", "2026.10.1")).toBeLessThan(0);
  });
});

describe("update availability check (REQ-112)", () => {
  let dir: string;
  let cachePath: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ib-update-"));
    cachePath = join(dir, "update-check.json");
    resetUpdateCheckForTest();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    resetUpdateCheckForTest();
  });

  it("reports available when the registry has a newer version", async () => {
    const state = await runUpdateCheck("2026.10.22", async () => jsonResponse({ version: "2026.10.26" }), cachePath);
    expect(state.status).toBe("available");
    expect(state.latest_version).toBe("2026.10.26");
    expect(JSON.parse(readFileSync(cachePath, "utf-8")).status).toBe("available");
  });

  it("reports current when versions match", async () => {
    const state = await runUpdateCheck("2026.10.22", async () => jsonResponse({ version: "2026.10.22" }), cachePath);
    expect(state.status).toBe("current");
  });

  it("returns unavailable without throwing on a network or shape failure", async () => {
    const state = await runUpdateCheck("2026.10.22", async () => {
      throw new Error("offline");
    }, cachePath);
    expect(state.status).toBe("unavailable");
    expect(getUpdateState().status).toBe("unavailable");
  });

  it("performs no request when disabled", () => {
    const fetcher = vi.fn();
    const state = configureUpdateCheck(false, "2026.10.22", cachePath, fetcher as unknown as typeof fetch);
    expect(state.status).toBe("disabled");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses a fresh cache without a request", async () => {
    await runUpdateCheck("2026.10.22", async () => jsonResponse({ version: "2026.10.26" }), cachePath);
    const fetcher = vi.fn();
    const state = configureUpdateCheck(true, "2026.10.22", cachePath, fetcher as unknown as typeof fetch);
    expect(state.status).toBe("available");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
