// @implements REQ-021a resolved-address
import { describe, it, expect } from "vitest";
import { assertPublicUrl, assertPublicUrlResolved, isPrivateHostname, fetchFollowRedirects, SsrRefusalError } from "./url-guard.js";

const stubResolver = async (host: string) => {
  if (host === "private.example") return [{ address: "10.0.0.5", family: 4 }];
  if (host === "rebind.example") return [{ address: "169.254.169.254", family: 4 }];
  if (host === "unresolvable.example") throw new Error("ENOTFOUND");
  return [{ address: "93.184.216.34", family: 4 }];
};

describe("url-guard", () => {
  it("rejects loopback, private, link-local, and metadata hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "::1", "10.0.0.1", "172.16.1.1", "192.168.0.1", "169.254.169.254", "fe80::1", "fc00::1"]) {
      expect(isPrivateHostname(host)).toBe(true);
    }
  });

  it("accepts public hosts", () => {
    for (const host of ["example.com", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"]) {
      expect(isPrivateHostname(host)).toBe(false);
    }
  });

  it("refuses unspecified, CGNAT, benchmarking, multicast, and reserved IPv4", () => {
    for (const host of [
      "0.0.0.0",
      "0.255.255.255",
      "100.64.0.1",
      "100.127.255.255",
      "192.0.0.1",
      "192.0.2.5",
      "198.18.0.1",
      "198.51.100.7",
      "203.0.113.9",
      "224.0.0.1",
      "239.255.255.255",
      "240.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isPrivateHostname(host), host).toBe(true);
    }
  });

  it("refuses IPv4-mapped IPv6 addresses by their embedded IPv4 address", () => {
    for (const host of ["::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.5", "::ffff:0a00:5", "0:0:0:0:0:ffff:7f00:1", "::ffff:169.254.169.254"]) {
      expect(isPrivateHostname(host), host).toBe(true);
    }
  });

  it("accepts IPv4-mapped IPv6 addresses whose embedded IPv4 is public", () => {
    for (const host of ["::ffff:93.184.216.34", "::ffff:5db8:d822"]) {
      expect(isPrivateHostname(host), host).toBe(false);
    }
  });

  it("refuses IPv6 transition, multicast, documentation, and discard ranges", () => {
    for (const host of ["ff02::1", "2001:db8::1", "2002:7f00:1::1", "2001:0:1::1", "64:ff9b::7f00:1", "100::1"]) {
      expect(isPrivateHostname(host), host).toBe(true);
    }
  });

  it("refuses a private URL when the guard is not opted out", () => {
    expect(() => assertPublicUrl("http://169.254.169.254/latest", false)).toThrow(/private\/internal/);
    expect(() => assertPublicUrl("http://localhost:8080/x", false)).toThrow(/private\/internal/);
    expect(() => assertPublicUrl("http://0.0.0.0:8080/x", false)).toThrow(/private\/internal/);
    expect(() => assertPublicUrl("http://[::ffff:127.0.0.1]:8080/x", false)).toThrow(/private\/internal/);
  });

  it("allows a private URL when opted out", () => {
    expect(() => assertPublicUrl("http://localhost:8080/x", true)).not.toThrow();
  });

  it("refuses non-http(s) protocols", () => {
    expect(() => assertPublicUrl("file:///etc/passwd", false)).toThrow(/non-HTTP protocol/);
    expect(() => assertPublicUrl("ftp://example.com/x", false)).toThrow(/non-HTTP protocol/);
  });
});

describe("assertPublicUrlResolved (REQ-021a resolved-address)", () => {
  it("refuses a hostname that resolves to a private address", async () => {
    await expect(assertPublicUrlResolved("http://private.example/x", false, stubResolver))
      .rejects.toThrow(SsrRefusalError);
    await expect(assertPublicUrlResolved("http://private.example/x", false, stubResolver))
      .rejects.toThrow(/resolved private\/internal address/);
  });

  it("refuses a hostname that resolves to a metadata address", async () => {
    await expect(assertPublicUrlResolved("http://rebind.example/latest", false, stubResolver))
      .rejects.toThrow(/resolved private\/internal address/);
  });

  it("fails closed when resolution fails", async () => {
    await expect(assertPublicUrlResolved("http://unresolvable.example/x", false, stubResolver))
      .rejects.toThrow(SsrRefusalError);
    await expect(assertPublicUrlResolved("http://unresolvable.example/x", false, stubResolver))
      .rejects.toThrow(/Could not resolve host/);
  });

  it("accepts a hostname that resolves publicly", async () => {
    await expect(assertPublicUrlResolved("http://example.com/x", false, stubResolver)).resolves.toBeUndefined();
  });

  it("skips resolution for private targets when opted out", async () => {
    await expect(assertPublicUrlResolved("http://private.example/x", true, stubResolver)).resolves.toBeUndefined();
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

  const guard = (fetchImpl: never, url = "https://example.com/a") =>
    fetchFollowRedirects(url, false, fetchImpl, 5, "Infobroker/1.0", stubResolver);

  it("returns body for a direct 200 response", async () => {
    const fetchImpl = async () => resp(200);
    await expect(guard(fetchImpl as never)).resolves.toBe("content");
  });

  it("follows a chain of redirects and returns the final body", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url === "https://example.com/start") return resp(302, "/next");
      if (url === "https://example.com/next") return resp(301, "https://example.com/final");
      return resp(200, undefined, "final-body");
    };
    await expect(guard(fetchImpl as never, "https://example.com/start")).resolves.toBe("final-body");
    expect(calls).toEqual([
      "https://example.com/start",
      "https://example.com/next",
      "https://example.com/final",
    ]);
  });

  it("refuses a redirect that resolves to a private host", async () => {
    const fetchImpl = async () => resp(302, "http://169.254.169.254/latest");
    await expect(guard(fetchImpl as never, "https://example.com/start"))
      .rejects.toThrow(/private\/internal/);
  });

  it("refuses a redirect to a public host that resolves privately", async () => {
    const fetchImpl = async () => resp(302, "http://private.example/x");
    await expect(guard(fetchImpl as never, "https://example.com/start"))
      .rejects.toThrow(/resolved private\/internal address/);
  });

  it("allows a redirect to a private host when opted out", async () => {
    const fetchImpl = async (url: string) => {
      if (url === "https://example.com/start") return resp(302, "http://localhost:8080/x");
      return resp(200, undefined, "private-body");
    };
    await expect(fetchFollowRedirects("https://example.com/start", true, fetchImpl as never, 5, "Infobroker/1.0", stubResolver))
      .resolves.toBe("private-body");
  });

  it("throws when a redirect hop exceeds the maximum", async () => {
    const fetchImpl = async () => resp(302, "/loop");
    await expect(fetchFollowRedirects("https://example.com/loop", false, fetchImpl as never, 3, "Infobroker/1.0", stubResolver))
      .rejects.toThrow(/Too many redirects/);
  });

  it("throws when a redirect has no Location header", async () => {
    const fetchImpl = async () => resp(302);
    await expect(guard(fetchImpl as never)).rejects.toThrow(/no Location header/);
  });

  it("refuses an unspecified-address start URL without invoking fetch", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return resp(200);
    };
    await expect(
      fetchFollowRedirects("http://0.0.0.0:8080/", false, fetchImpl as never, 5, "Infobroker/1.0", stubResolver)
    ).rejects.toThrow(/private\/internal/);
    expect(called).toBe(false);
  });

  it("refuses an IPv4-mapped start URL without invoking fetch", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return resp(200);
    };
    await expect(
      fetchFollowRedirects("http://[::ffff:127.0.0.1]:8080/", false, fetchImpl as never, 5, "Infobroker/1.0", stubResolver)
    ).rejects.toThrow(/private\/internal/);
    expect(called).toBe(false);
  });
});
