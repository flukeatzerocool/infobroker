// @implements REQ-020 REQ-024b
// Fixture captured from https://wiby.me/?q=linux on 2026-11-16 (trimmed to two
// result blocks; the surrounding chrome is omitted). Wiby renders each result
// inside a <blockquote>: an `a.tlink` title, a `p.url` display URL, and a
// plain <p> snippet.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn(async (_url: string): Promise<Response> => new Response("", { status: 200 }));

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string) => mockFetch(url),
}));

import { provider as wiby } from "./wiby.js";

const PAGE = `<html><body>
  <form><input name="q" value="linux"></form>
  <blockquote>
    <a class="tlink" href="https://www.embeddedlinuxconference.com/elc_2009/sponsor.html">CELF - Embedded Linux Conference</a><br>
    <p class="url">https://www.embeddedlinuxconference.com/elc_2009/sponsor.html</p>
    <p> CELF Embedded Linux Conference April 6th-8th, 2009 - San Francisco </p>
  </blockquote>
  <blockquote>
    <a class="tlink" href="http://choice.tiepi.it/~matteobin/scritti/gnulinux-come-win31.html">Far assomigliare GNU/Linux a Windows 3.1</a><br>
    <p class="url">http://choice.tiepi.it/~matteobin/scritti/gnulinux-come-win31.html</p>
    <p> Far assomigliare GNU/Linux a Windows 3.1 con LXDE o dwm </p>
  </blockquote>
</body></html>`;

describe("wiby provider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("parses the current January-2026 result markup", async () => {
    mockFetch.mockImplementation(async () => new Response(PAGE, { status: 200 }));

    const results = await wiby.search("linux");

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("CELF - Embedded Linux Conference");
    expect(results[0].url).toBe("https://www.embeddedlinuxconference.com/elc_2009/sponsor.html");
    expect(results[0].snippet).toContain("April 6th-8th");
    expect(results[1].url).toBe("http://choice.tiepi.it/~matteobin/scritti/gnulinux-come-win31.html");
  });

  it("returns an empty list for a page with no result blocks", async () => {
    mockFetch.mockImplementation(async () => new Response("<html><body>no results</body></html>", { status: 200 }));
    await expect(wiby.search("zzzz")).resolves.toEqual([]);
  });
});
