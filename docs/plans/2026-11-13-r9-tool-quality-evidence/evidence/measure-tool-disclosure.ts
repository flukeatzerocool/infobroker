// measure-tool-disclosure.ts — informational probe for
// docs/plans/2026-11-13-r9-tool-quality-evidence. Starts the real server over
// stdio (the same transport the gates use) and measures five REQ-089
// behavioral-disclosure classes against the advertised tool descriptions.
// Read-only: it never writes inside the repository. Exit codes: 0 = report
// printed; 2 = fatal.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const ROOT = new URL("../../../../", import.meta.url).pathname.replace(/\/$/, "");

interface ToolDef {
  name: string;
  description?: string;
  annotations?: Record<string, boolean>;
}

/** Marker sets the assertion in `src/tool-surface.test.ts` will use. */
const MARKERS = {
  stored: /\bstored\b|\bstore\b|\bpersist|knowledge base|\bcache|disk|config\.local\.json/i,
  external: /\bnetwork\b|\bexternal\b|outbound|\bremote\b|\bHTTP\b|\bprovider|renderer/i,
  ratelimit: /rate.?limit|\bquota\b|throttl/i,
  auth: /authenticat|API key|credential/i,
  destructive: /destructiv|cannot be undone|unrecoverable|\bdelet|\bremov|overwrit/i,
} as const;

type ClassName = keyof typeof MARKERS;

/**
 * Which classes each tool must disclose. `n/a` entries carry the justification
 * that the plan and DECISIONS.md record: a class applies when the tool
 * exercises it.
 */
const REQUIRED: Record<string, Partial<Record<ClassName, string>>> = {
  infobroker_search_web: {
    stored: "caches results in the knowledge base",
    external: "dispatches every provider",
    ratelimit: "per-provider throttling applies",
    auth: "keyed providers need configured keys",
  },
  infobroker_fetch_page: {
    stored: "truncated pages are written to a temp file",
    external: "renderer chain makes outbound calls",
    ratelimit: "renderer chain is throttled",
    auth: "Jina key is optional but configured credentials change coverage",
  },
  infobroker_inspect_providers: {
    external: "health action probes a provider",
    ratelimit: "quota is reported and health is throttled",
  },
  infobroker_verify_claims: {
    stored: "findings are written back to the knowledge base",
    external: "dispatches every provider",
    ratelimit: "per-provider rate limits apply",
    auth: "keyed providers need configured keys",
  },
  infobroker_manage_kb: {
    stored: "ingest, delete, and stats touch the store",
    external: "URL ingest goes through the fetch chain",
    ratelimit: "URL ingest dispatches the fetch chain",
    auth: "URL ingest dispatches the fetch chain",
    destructive: "delete is irreversible",
  },
  infobroker_reload_config: {
    stored: "writes the user-layer config file",
    destructive: "rewrites config.local.json",
  },
  infobroker_get_citations: {
    external: "queries academic providers",
    ratelimit: "provider throttling applies",
    auth: "keyed providers need configured keys",
  },
};

const NA_REASONS: Record<string, Partial<Record<ClassName, string>>> = {
  infobroker_search_web: { destructive: "no irreversible action" },
  infobroker_fetch_page: { destructive: "no irreversible action" },
  infobroker_inspect_providers: { stored: "read-only, no persisted write", auth: "takes no credential", destructive: "no irreversible action" },
  infobroker_verify_claims: { destructive: "no irreversible action" },
  infobroker_manage_kb: {},
  infobroker_reload_config: { external: "local file I/O only", ratelimit: "no provider dispatch", auth: "local file I/O only" },
  infobroker_get_citations: { stored: "writes nothing", destructive: "no irreversible action" },
};

function listTools(): Promise<ToolDef[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(`${ROOT}/node_modules/.bin/tsx`, [`${ROOT}/src/index.ts`], {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "ignore"],
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    const pending = new Map<number, (msg: any) => void>();
    const rl = createInterface({ input: child.stdout! });
    rl.on("line", (line) => {
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        return; // non-JSON stdout line — not an RPC response
      }
      if (typeof msg.id === "number" && pending.has(msg.id)) {
        const done = pending.get(msg.id)!;
        pending.delete(msg.id);
        done(msg);
      }
    });
    const call = (method: string, params: unknown, id: number) =>
      new Promise<any>((done) => {
        pending.set(id, done);
        child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      });
    (async () => {
      await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "measure-tool-disclosure", version: "1" } }, 1);
      child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
      const listed = await call("tools/list", {}, 2);
      child.kill();
      if (listed.error) reject(new Error(listed.error.message));
      else resolve(listed.result.tools as ToolDef[]);
    })().catch(reject);
  });
}

const tools = await listTools();
const classes = Object.keys(MARKERS) as ClassName[];
const rows = tools.map((tool) => {
  const desc = tool.description ?? "";
  const row = Object.fromEntries(
    classes.map((cls) => {
      const required = REQUIRED[tool.name]?.[cls];
      const disclosed = MARKERS[cls].test(desc);
      return [cls, required ? (disclosed ? "disclosed" : "GAP") : `n/a (${NA_REASONS[tool.name]?.[cls] ?? "no reason recorded"})`];
    })
  ) as Record<ClassName, string>;
  return { tool: tool.name, descriptionChars: desc.length, ...row };
});

console.log(`tools: ${tools.length}`);
console.log(["tool", ...classes].join("\t"));
for (const row of rows) {
  console.log([row.tool, ...classes.map((c) => row[c])].join("\t"));
}
const gaps = rows.flatMap((row) => classes.filter((c) => row[c] === "GAP").map((c) => `${row.tool}.${c}`));
console.log(`\ngaps: ${gaps.length}${gaps.length ? ` — ${gaps.join(", ")}` : ""}`);
const undeclared = tools.filter((t) => !REQUIRED[t.name]);
if (undeclared.length) console.log(`undeclared tools: ${undeclared.map((t) => t.name).join(", ")}`);
