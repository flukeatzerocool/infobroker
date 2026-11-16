// @implements REQ-021
// The reader endpoint is a deployment surface: the shipped default stays
// `https://r.jina.ai/`, and an `INFOBROKER_JINA_URL` override (the
// `INFOBROKER_<NAME>_URL` convention) reaches both the fetch and the health
// path with one normalized base, so a self-hosted reader never yields a
// mangled target. `fetch` is stubbed throughout — no test here makes a request.
import { afterEach, describe, expect, it, vi } from "vitest";
import { jinaBaseUrl, provider } from "./jina.js";

const DEFAULT_BASE = "https://r.jina.ai/";

function stubFetch(body = "rendered page"): string[] {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: unknown) => {
    calls.push(String(input));
    return new Response(body, { status: 200 });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Jina reader endpoint (REQ-021)", () => {
  it("targets the shipped reader when no override is set", async () => {
    const calls = stubFetch();

    expect(jinaBaseUrl()).toBe(DEFAULT_BASE);
    await provider.fetchPage!("https://example.com/article");

    expect(calls).toEqual([`${DEFAULT_BASE}https://example.com/article`]);
  });

  it("normalizes an override that has no trailing slash", async () => {
    const calls = stubFetch();
    vi.stubEnv("INFOBROKER_JINA_URL", "http://127.0.0.1:8080");

    expect(jinaBaseUrl()).toBe("http://127.0.0.1:8080/");
    await provider.fetchPage!("https://example.com/article");

    expect(calls).toEqual(["http://127.0.0.1:8080/https://example.com/article"]);
  });

  it("leaves an override that already ends in a slash unchanged", async () => {
    const calls = stubFetch();
    vi.stubEnv("INFOBROKER_JINA_URL", "http://127.0.0.1:8080/reader/");

    expect(jinaBaseUrl()).toBe("http://127.0.0.1:8080/reader/");
    await provider.fetchPage!("https://example.com/article");

    expect(calls).toEqual(["http://127.0.0.1:8080/reader/https://example.com/article"]);
  });

  it("probes health against the same base", async () => {
    const calls = stubFetch();
    vi.stubEnv("INFOBROKER_JINA_URL", "http://127.0.0.1:8080");

    const status = await provider.health!();

    expect(status.status).toBe("active");
    expect(calls).toEqual(["http://127.0.0.1:8080/https://example.com"]);
  });
});

describe("Jina target-error warning (REQ-021h)", () => {
  it("treats a warning-only 404 page as a renderer failure carrying the status", async () => {
    stubFetch(
      "Title: Example Domain\n\nURL Source: https://example.com/nope\n\nWarning: Target URL returned error 404: Not Found\n\nMarkdown Content:\n"
    );
    await expect(provider.fetchPage!("https://example.com/nope")).rejects.toMatchObject({ status: 404 });
  });

  it("serves a page that mentions the warning but carries real content", async () => {
    const body =
      "Warning: Target URL returned error 404: Not Found\n\n" +
      "This page documents how a reader reports a missing target. ".repeat(6);
    stubFetch(body);
    await expect(provider.fetchPage!("https://example.com/doc")).resolves.toContain("documents how a reader");
  });
});
