#!/usr/bin/env node
// preload.mjs — debate-club egress interceptor. Loaded with `node --import`
// before the MCP server so every provider call through global `fetch` is
// served from committed fixtures (replay) or captured to NDJSON (record).
//
// Env:
//   DEBATE_CLUB_MODE       replay | record | off
//   DEBATE_CLUB_FIXTURES   path to fixtures/index.json (replay)
//   DEBATE_CLUB_CAPTURE    path to NDJSON capture file (record)
//   DEBATE_CLUB_UNMATCHED  path to log of unmatched fixture-host URLs (replay)
//
// Replay policy: a request whose host has fixtures must match an entry or it
// is recorded to the unmatched log (the Arena fails on a non-empty log). A
// request to a host with no fixtures (e.g. a startup health probe for an
// unrelated provider) returns a synthetic 599 and is not logged.

import { appendFileSync, readFileSync } from "node:fs";

const MODE = process.env.DEBATE_CLUB_MODE || "off";
const FIXTURES = process.env.DEBATE_CLUB_FIXTURES;
const CAPTURE = process.env.DEBATE_CLUB_CAPTURE;
const UNMATCHED = process.env.DEBATE_CLUB_UNMATCHED;

const realFetch = globalThis.fetch;

let index = null;
if (MODE === "replay" && FIXTURES) {
  index = JSON.parse(readFileSync(FIXTURES, "utf8"));
  index._compiled = (index.entries || []).map((e) => ({ ...e, re: new RegExp(e.path_regex) }));
}

function urlOf(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input.url === "string") return input.url;
  return String(input);
}

function matchFixture(href, method) {
  const u = new URL(href);
  const host = u.hostname;
  const m = (method || "GET").toUpperCase();
  for (const e of index._compiled) {
    if (e.host !== host) continue;
    if ((e.method || "GET").toUpperCase() !== m) continue;
    if (e.re.test(u.pathname)) return e;
  }
  return null;
}

if (MODE === "replay" && index) {
  globalThis.fetch = async (input, init) => {
    const href = urlOf(input);
    const method = (init && init.method) || (input && input.method) || "GET";
    const entry = matchFixture(href, method);
    if (entry) {
      return new Response(entry.body ?? "", { status: entry.status ?? 200, headers: entry.headers || {} });
    }
    const host = new URL(href).hostname;
    if (UNMATCHED && Array.isArray(index.fixtureHosts) && index.fixtureHosts.includes(host)) {
      try {
        appendFileSync(UNMATCHED, `${method} ${href}\n`);
      } catch {
        // best-effort logging; a logging failure must not change the response
      }
    }
    return new Response(`debate-club: no fixture for ${href}`, {
      status: 599,
      headers: { "content-type": "text/plain" },
    });
  };
} else if (MODE === "record") {
  globalThis.fetch = async (input, init) => {
    const href = urlOf(input);
    const method = (init && init.method) || (input && input.method) || "GET";
    const resp = await realFetch(input, init);
    try {
      const clone = resp.clone();
      const body = await clone.text();
      const headers = {};
      clone.headers.forEach((v, k) => (headers[k] = v));
      appendFileSync(
        CAPTURE,
        JSON.stringify({ method, url: href, status: resp.status, headers, body }) + "\n"
      );
    } catch {
      // capture is diagnostics; never fail the live request because of it
    }
    return resp;
  };
}
