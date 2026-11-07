// @implements REQ-021h doi-metadata open-access wayback classified-failure paywall access-restricted not-found rate-limited
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classifyFailure,
  classifyStatus,
  extractDoi,
  failureTaxonomy,
  resolveFetchFallback,
} from "./fetch-fallback.js";
import { HttpStatusError, UnsupportedProtocolError } from "./lib/url-guard.js";
import { BotChallengeError } from "./retry.js";

const { lookupDoi, openalexLookup } = vi.hoisted(() => ({
  lookupDoi: vi.fn(),
  openalexLookup: vi.fn(),
}));

vi.mock("./providers/index.js", () => ({
  PROVIDERS: {
    crossref: { lookupDoi },
    openalex: { lookupDoi: openalexLookup },
  },
}));
vi.mock("./rate-limiter.js", () => ({ throttle: async () => {} }));
vi.mock("./cooldown.js", () => ({ inCooldown: () => false, cooldownRemainingMs: () => 0 }));

const fetched = (content: string, slug = "jina") => ({
  slug,
  content,
  truncated: { text: content, truncated: false },
  elapsed: 10,
});

describe("fetch failure classification (REQ-021h)", () => {
  it("maps status codes to failure kinds", () => {
    expect(classifyStatus(402)).toBe("paywall");
    expect(classifyStatus(401)).toBe("access_restricted");
    expect(classifyStatus(403)).toBe("access_restricted");
    expect(classifyStatus(407)).toBe("access_restricted");
    expect(classifyStatus(451)).toBe("access_restricted");
    expect(classifyStatus(404)).toBe("not_found");
    expect(classifyStatus(410)).toBe("not_found");
    expect(classifyStatus(429)).toBe("rate_limited");
    expect(classifyStatus(500)).toBe("unknown");
  });

  it("recognises typed renderer errors", () => {
    expect(classifyFailure(new HttpStatusError("HTTP 402", 402), "jina")).toMatchObject({
      renderer: "jina",
      kind: "paywall",
      status: 402,
    });
    expect(classifyFailure(new HttpStatusError("HTTP 403", 403), "jina")).toMatchObject({
      renderer: "jina",
      kind: "access_restricted",
      status: 403,
    });
    expect(classifyFailure(new BotChallengeError("challenge"), "jina")).toMatchObject({
      renderer: "jina",
      kind: "anti_bot",
    });
    expect(classifyFailure(new Error("getaddrinfo ENOTFOUND example.com"), "jina")).toMatchObject({
      renderer: "jina",
      kind: "network",
    });
    expect(classifyFailure(new Error("weird"), "jina").kind).toBe("unknown");
  });

  it("keeps the scheme error distinct from a network failure", () => {
    const failure = classifyFailure(new UnsupportedProtocolError("file:"), "native_fetch");
    expect(failure.kind).toBe("unknown");
  });

  it("maps collected failures to the REQ-002 taxonomy", () => {
    expect(failureTaxonomy([{ renderer: "jina", kind: "paywall" }])).toMatchObject({
      code: "access_blocked",
      cause: "paywall",
    });
    expect(failureTaxonomy([{ renderer: "jina", kind: "anti_bot" }]).cause).toBe("anti_bot");
    expect(failureTaxonomy([{ renderer: "jina", kind: "access_restricted" }])).toMatchObject({
      code: "access_blocked",
      cause: "access_restricted",
    });
    expect(failureTaxonomy([{ renderer: "jina", kind: "rate_limited" }]).code).toBe("rate_limited");
    expect(failureTaxonomy([{ renderer: "jina", kind: "not_found" }])).toMatchObject({
      code: "all_providers_exhausted",
      cause: "not_found",
    });
    expect(failureTaxonomy([{ renderer: "jina", kind: "network" }]).code).toBe("network_error");
    expect(
      failureTaxonomy([
        { renderer: "jina", kind: "network" },
        { renderer: "native_fetch", kind: "unknown" },
      ]).code
    ).toBe("all_providers_exhausted");
    expect(failureTaxonomy([]).cause).toBeUndefined();
  });

  // CR-11: a 403 is an access restriction, not a payment wall, and the most
  // specific access blocker wins when renderers fail differently.
  it("reports the most specific cause when renderers fail differently", () => {
    expect(
      failureTaxonomy([
        { renderer: "jina", kind: "access_restricted" },
        { renderer: "native_fetch", kind: "paywall" },
      ]).cause
    ).toBe("paywall");
    expect(
      failureTaxonomy([
        { renderer: "jina", kind: "access_restricted" },
        { renderer: "native_fetch", kind: "anti_bot" },
      ]).cause
    ).toBe("anti_bot");
    expect(
      failureTaxonomy([
        { renderer: "jina", kind: "network" },
        { renderer: "native_fetch", kind: "rate_limited" },
      ]).code
    ).toBe("rate_limited");
  });

  // REQ-038: a provider-attributable remediation names the status surface,
  // including the access-restriction, rate-limit, and not-found branches.
  it("names the provider-status surface in every remediation", () => {
    const branches = [
      failureTaxonomy([{ renderer: "jina", kind: "paywall" }]),
      failureTaxonomy([{ renderer: "jina", kind: "anti_bot" }]),
      failureTaxonomy([{ renderer: "jina", kind: "access_restricted" }]),
      failureTaxonomy([{ renderer: "jina", kind: "rate_limited" }]),
      failureTaxonomy([{ renderer: "jina", kind: "not_found" }]),
      failureTaxonomy([{ renderer: "jina", kind: "network" }]),
      failureTaxonomy([]),
    ];
    for (const branch of branches) {
      expect(branch.remediation).toMatch(/inspect_providers action=health/);
    }
    // No doubled sentence when the branch already named it.
    expect(branches[6].remediation.match(/inspect_providers/g)).toHaveLength(1);
  });
});

describe("DOI extraction (REQ-021h)", () => {
  it("extracts a DOI from doi.org and dx.doi.org", () => {
    expect(extractDoi("https://doi.org/10.1162/dram_c_00764")).toBe("10.1162/dram_c_00764");
    expect(extractDoi("https://dx.doi.org/10.1000/xyz?x=1")).toBe("10.1000/xyz");
    expect(extractDoi("https://example.com/article")).toBeNull();
  });
});

describe("fetch fallback order (REQ-021h)", () => {
  beforeEach(() => {
    lookupDoi.mockReset();
    openalexLookup.mockReset();
  });

  it("returns Crossref metadata when no open-access copy is available", async () => {
    lookupDoi.mockResolvedValue({
      doi: "10.1162/dram_c_00764",
      title: "Working Loose",
      url: "https://doi.org/10.1162/dram_c_00764",
      venue: "TDR/The Drama Review",
      year: "2018",
    });
    openalexLookup.mockResolvedValue(null);

    const result = await resolveFetchFallback("https://doi.org/10.1162/dram_c_00764", async () => null);
    expect(result?.kind).toBe("metadata");
    if (result?.kind === "metadata") {
      expect(result.record.title).toBe("Working Loose");
      expect(result.doi).toBe("10.1162/dram_c_00764");
    }
  });

  it("prefers an open-access copy before metadata", async () => {
    lookupDoi.mockResolvedValue({ doi: "10.1000/xyz", title: "Paper", url: "https://doi.org/10.1000/xyz" });
    openalexLookup.mockResolvedValue({ doi: "10.1000/xyz", title: "Paper", url: "https://doi.org/10.1000/xyz", oa_url: "https://repo.example/paper.pdf" });
    const calls: Array<{ url: string; renderers: string[] }> = [];
    const fetchContent = async (url: string, renderers: string[]) => {
      calls.push({ url, renderers });
      return fetched("open access text");
    };

    const result = await resolveFetchFallback("https://doi.org/10.1000/xyz", fetchContent);
    expect(result?.kind).toBe("content");
    if (result?.kind === "content") expect(result.fallback_kind).toBe("open_access");
    // A PDF is fetched through the reader only.
    expect(calls[0].renderers).toEqual(["jina"]);
  });

  it("falls back to an Internet Archive snapshot when there is no DOI", async () => {
    const calls: Array<{ url: string; renderers: string[] }> = [];
    const fetchContent = async (url: string, renderers: string[]) => {
      calls.push({ url, renderers });
      return fetched("<html><body><p>archived text</p></body></html>", "internet_archive");
    };

    const result = await resolveFetchFallback("https://example.com/gone", fetchContent);
    expect(result?.kind).toBe("content");
    if (result?.kind === "content") {
      expect(result.fallback_kind).toBe("wayback");
      expect(result.fetched.content).toContain("archived text");
      expect(result.fetched.content).not.toContain("<html>");
    }
    expect(calls[0].renderers).toEqual(["internet_archive"]);
  });

  it("falls back to an archived snapshot when a DOI URL has no metadata record", async () => {
    lookupDoi.mockResolvedValue(null);
    const calls: Array<{ url: string; renderers: string[] }> = [];
    const fetchContent = async (url: string, renderers: string[]) => {
      calls.push({ url, renderers });
      return fetched("<html><body><p>archived copy</p></body></html>", "internet_archive");
    };

    const result = await resolveFetchFallback("https://doi.org/10.1000/missing", fetchContent);
    expect(result?.kind).toBe("content");
    if (result?.kind === "content") expect(result.fallback_kind).toBe("wayback");
    expect(calls[0].renderers).toEqual(["internet_archive"]);
    expect(openalexLookup).not.toHaveBeenCalled();
  });

  it("returns null when every fallback fails", async () => {
    lookupDoi.mockResolvedValue(null);
    const result = await resolveFetchFallback("https://example.com/gone", async () => null);
    expect(result).toBeNull();
  });
});
