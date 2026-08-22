// @implements REQ-021a
import { describe, it, expect } from "vitest";
import { assertPublicUrl, isPrivateHostname, fetchFollowRedirects } from "./url-guard.js";

describe("url-guard", () => {
  it("rejects loopback, private, link-local, and metadata hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "::1", "10.0.0.1", "172.16.1.1", "192.168.0.1", "169.254.169.254", "fe80::1", "fc00::1"]) {
      expect(isPrivateHostname(host)).toBe(true);
    }
  });

  it("accepts public hosts", () => {
    for (const host of ["example.com", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(isPrivateHostname(host)).toBe(false);
    }
  });

  it("refuses a private URL when the guard is not opted out", () => {
    expect(() => assertPublicUrl("http://169.254.169.254/latest", false)).toThrow(/private\/internal/);
    expect(() => assertPublicUrl("http://localhost:8080/x", false)).toThrow(/private\/internal/);
  });

  it("allows a private URL when opted out", () => {
    expect(() => assertPublicUrl("http://localhost:8080/x", true)).not.toThrow();
  });

  it("refuses non-http(s) protocols", () => {
    expect(() => assertPublicUrl("file:///etc/passwd", false)).toThrow(/non-HTTP protocol/);
    expect(() => assertPublicUrl("ftp://example.com/x", false)).toThrow(/non-HTTP protocol/);
  });
});

describe("fetchFollowRedirects", () => {
  function resp(status: number, location?: string, body = "content") {
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (name: string) => (name.toLowerCase() === "location" ? location ?? null : null) },
      text: async () => body,
    };
  }

  it("returns body for a direct 200 response", async () => {
    const fetchImpl = async () => resp(200);
    await expect(fetchFollowRedirects("https://example.com/a", false, fetchImpl as never)).resolves.toBe("content");
  });

  it("follows a chain of redirects and returns the final body", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url === "https://example.com/start") return resp(302, "/next");
      if (url === "https://example.com/next") return resp(301, "https://example.com/final");
      return resp(200, undefined, "final-body");
    };
    await expect(fetchFollowRedirects("https://example.com/start", false, fetchImpl as never)).resolves.toBe("final-body");
    expect(calls).toEqual([
      "https://example.com/start",
      "https://example.com/next",
      "https://example.com/final",
    ]);
  });

  it("refuses a redirect that resolves to a private host", async () => {
    const fetchImpl = async () => resp(302, "http://169.254.169.254/latest");
    await expect(fetchFollowRedirects("https://example.com/start", false, fetchImpl as never))
      .rejects.toThrow(/private\/internal/);
  });

  it("allows a redirect to a private host when opted out", async () => {
    const fetchImpl = async (url: string) => {
      if (url === "https://example.com/start") return resp(302, "http://localhost:8080/x");
      return resp(200, undefined, "private-body");
    };
    await expect(fetchFollowRedirects("https://example.com/start", true, fetchImpl as never)).resolves.toBe("private-body");
  });

  it("throws when a redirect hop exceeds the maximum", async () => {
    const fetchImpl = async () => resp(302, "/loop");
    await expect(fetchFollowRedirects("https://example.com/loop", false, fetchImpl as never, 3))
      .rejects.toThrow(/Too many redirects/);
  });

  it("throws when a redirect has no Location header", async () => {
    const fetchImpl = async () => resp(302);
    await expect(fetchFollowRedirects("https://example.com/start", false, fetchImpl as never))
      .rejects.toThrow(/no Location header/);
  });
});
