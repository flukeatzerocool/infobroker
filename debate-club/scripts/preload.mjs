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
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";

const MODE = process.env.DEBATE_CLUB_MODE || "off";
const FIXTURES = process.env.DEBATE_CLUB_FIXTURES;
const CAPTURE = process.env.DEBATE_CLUB_CAPTURE;
const UNMATCHED = process.env.DEBATE_CLUB_UNMATCHED;

const realFetch = globalThis.fetch;

let index = null;
if (MODE === "replay" && FIXTURES) {
  index = JSON.parse(readFileSync(FIXTURES, "utf8"));
  // The SSRF guard resolves a hostname before fetching (REQ-021a), and a real
  // lookup would make this "offline" Arena depend on DNS — it failed once when
  // example.com could not be resolved. Replay therefore answers resolution with
  // a stable public address for the hosts the fixtures cover. The guard still
  // applies its private-address deny-list to that value, literal-IP targets
  // never reach the resolver, and non-fixture hosts keep the real resolver.
  const fixtureHosts = new Set(
    (index.fixtureHosts || []).map((host) => String(host).toLowerCase())
  );
  const stubAddress = { address: "93.184.216.34", family: 4 };
  const realLookup = dns.promises.lookup.bind(dns.promises);
  dns.promises.lookup = async (hostname, options) => {
    if (fixtureHosts.has(String(hostname).toLowerCase())) {
      return options && options.all ? [{ ...stubAddress }] : { ...stubAddress };
    }
    return realLookup(hostname, options);
  };
  syncBuiltinESMExports();
  index._compiled = (index.entries || []).map((e) => ({
    ...e,
    re: new RegExp(e.path_regex),
    // Optional query-string discriminator: Wikidata and MediaWiki serve every
    // action from one path, so path-only fixtures cannot tell wbsearchentities
    // from wbgetclaims (or list=search from action=parse).
    qre: e.query_regex ? new RegExp(e.query_regex) : null,
  }));
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
    if (e.qre && !e.qre.test(u.search)) continue;
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
      // A fixture can model a transport failure (DNS, connection reset) so the
      // fetch layer's network classification is exercised offline.
      if (entry.error) throw new Error(entry.error);
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
