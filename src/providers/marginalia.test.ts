// @implements REQ-020 REQ-024b
// Fixture captured from https://marginalia-search.com/search?query=linux on
// 2026-11-16 (trimmed to two result blocks). The site moved from
// search.marginalia.nu to a Tailwind layout: no `.result` container; the title
// is an `h2 > a[rel="noopener noreferrer"]`, and the snippet lives in
// `div.overflow-auto p` inside the `div.flex.flex-col.grow` result column.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn(async (_url: string): Promise<Response> => new Response("", { status: 200 }));

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string) => mockFetch(url),
}));

import { provider as marginalia } from "./marginalia.js";
import { BotChallengeError } from "../retry.js";

const PAGE = `<html><body>
  <div class="flex flex-col grow">
    <div class="flex flex-row space-x-2 place-items-center">
      <div class="flex grow justify-between items-start">
        <div class="flex-1">
          <h2 class="text-md sm:text-xl text-green-800 font-serif break-words">
            <a href="https://en.wikipedia.org/wiki/Linux" rel="noopener noreferrer" dir="auto">Linux</a>
          </h2>
          <div class="text-sm mt-1">
            <a class="text-liteblue underline break-all" href="https://en.wikipedia.org/wiki/Linux" rel="noopener noreferrer">https://en.wikipedia.org/wiki/Linux</a>
          </div>
        </div>
      </div>
    </div>
    <div class="overflow-auto flex-1">
      <p class="mt-2 text-sm text-black leading-relaxed break-words" dir="auto">
        There are many thousands of Linux distributions, many based directly or indirectly on other distributions.
      </p>
    </div>
  </div>
  <div class="flex flex-col grow">
    <div class="flex flex-row space-x-2 place-items-center">
      <div class="flex grow justify-between items-start">
        <div class="flex-1">
          <h2 class="text-md sm:text-xl text-green-800 font-serif break-words">
            <a href="https://www.kernel.org/" rel="noopener noreferrer" dir="auto">The Linux Kernel Archives</a>
          </h2>
        </div>
      </div>
    </div>
    <div class="overflow-auto flex-1">
      <p class="mt-2 text-sm text-black leading-relaxed break-words" dir="auto">Protocol Location. RSYNC. Latest Release.</p>
    </div>
  </div>
</body></html>`;

describe("marginalia provider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("parses the current marginalia-search.com markup", async () => {
    mockFetch.mockImplementation(async () => new Response(PAGE, { status: 200 }));

    const results = await marginalia.search("linux");

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("Linux");
    expect(results[0].url).toBe("https://en.wikipedia.org/wiki/Linux");
    expect(results[0].snippet).toContain("thousands of Linux distributions");
    expect(results[1].url).toBe("https://www.kernel.org/");
  });

  it("returns an empty list when the layout carries no result headings", async () => {
    mockFetch.mockImplementation(async () => new Response("<html><body><p>none</p></body></html>", { status: 200 }));
    await expect(marginalia.search("zzzz")).resolves.toEqual([]);
  });

  it("treats the bot-activity interstitial as a challenge, not zero results", async () => {
    const challenge = `<html><body><h1>Wait A Moment</h1>
      <p>The search engine is currently seeing a lot of fairly aggressive bot activity.
      Please wait for 1 seconds before proceeding.</p></body></html>`;
    mockFetch.mockImplementation(async () => new Response(challenge, { status: 200 }));
    await expect(marginalia.search("linux")).rejects.toBeInstanceOf(BotChallengeError);
  });
});
