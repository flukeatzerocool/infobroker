// @implements REQ-021a renderer-path
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withGuardedTarget } from "./lib/fetch-target.js";
import { SsrRefusalError, type Resolver } from "./lib/url-guard.js";

const REPO_ROOT = join(import.meta.dirname, "..");

const stubResolver: Resolver = async (host: string) => {
  if (host === "private.example") return [{ address: "10.0.0.5", family: 4 }];
  if (host === "rebind.example") return [{ address: "169.254.169.254", family: 4 }];
  if (host === "unresolvable.example") throw new Error("ENOTFOUND");
  return [{ address: "93.184.216.34", family: 4 }];
};

function counter() {
  const state = { calls: 0 };
  const dispatch = async () => {
    state.calls += 1;
    return "rendered";
  };
  return { state, dispatch };
}

describe("withGuardedTarget refuses before dispatch (REQ-021a renderer-path)", () => {
  it("refuses a host resolving to a private address and never dispatches", async () => {
    const { state, dispatch } = counter();
    await expect(
      withGuardedTarget("http://private.example/x", false, dispatch, stubResolver)
    ).rejects.toBeInstanceOf(SsrRefusalError);
    expect(state.calls).toBe(0);
  });

  it("refuses a rebinding host that resolves to a metadata address", async () => {
    const { state, dispatch } = counter();
    await expect(
      withGuardedTarget("http://rebind.example/latest", false, dispatch, stubResolver)
    ).rejects.toBeInstanceOf(SsrRefusalError);
    expect(state.calls).toBe(0);
  });

  it("fails closed when the host cannot be resolved", async () => {
    const { state, dispatch } = counter();
    await expect(
      withGuardedTarget("http://unresolvable.example/x", false, dispatch, stubResolver)
    ).rejects.toThrow(/could not resolve/i);
    expect(state.calls).toBe(0);
  });

  it("dispatches exactly once for a public host", async () => {
    const { state, dispatch } = counter();
    await expect(
      withGuardedTarget("http://example.com/x", false, dispatch, stubResolver)
    ).resolves.toBe("rendered");
    expect(state.calls).toBe(1);
  });

  it("dispatches a private host when private targets are permitted", async () => {
    const { state, dispatch } = counter();
    await expect(
      withGuardedTarget("http://private.example/x", true, dispatch, stubResolver)
    ).resolves.toBe("rendered");
    expect(state.calls).toBe(1);
  });

  it("refuses a non-HTTP scheme with SsrRefusalError naming the protocol", async () => {
    const { state, dispatch } = counter();
    await expect(
      withGuardedTarget("ftp://example.com/x", false, dispatch, stubResolver)
    ).rejects.toThrow(/non-HTTP protocol "ftp:"/);
    expect(state.calls).toBe(0);
  });
});

describe("renderer dispatch adopts the resolved-address guard (REQ-021a renderer-path)", () => {
  it("wraps the fetchPageContent body in withGuardedTarget", () => {
    const source = readFileSync(join(REPO_ROOT, "src", "index.ts"), "utf-8");
    const start = source.indexOf("async function fetchPageContent(");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 6000);
    expect(body).toContain("withGuardedTarget(");
  });
});
