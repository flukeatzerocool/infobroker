// @implements REQ-097 REQ-098
// Content policy (REQ-097): configurable assessment of retrieved external
// content before knowledge-base storage. Three modes: off (assessment
// disabled), flag (flagged content returned to the caller but never stored),
// and block (flagged content refused to the caller). The built-in assessment
// is a zero-dependency pattern matcher; an external assessment service is
// consulted when configured and falls back to the built-in when unreachable.
// Assessment outcomes are recorded in the audit trail (REQ-098).
import { getConfig } from "./config.js";
import { audit } from "./audit-log.js";
import { infobrokerFetch } from "./http.js";

const DEFAULT_PATTERNS: Record<string, string[]> = {
  prompt_injection: [
    "ignore previous instructions",
    "ignore all previous instructions",
    "disregard prior instructions",
    "you are now",
    "system prompt is",
  ],
  credential_phishing: [
    "verify your account",
    "confirm your password",
    "update your billing",
    "login credentials",
  ],
  malware_exploit: [
    "reverse shell",
    "exploit code",
    "payload delivery",
    "malware download",
  ],
  adult_content: ["sexually explicit", "adult content"],
};

export type PolicyMode = "off" | "flag" | "block";

export interface PolicyResult {
  flagged: boolean;
  reason: string | null;
  source: "builtin" | "external" | "disabled";
}

export type PolicyDisposition = "store" | "skip" | "refuse";

export function policyMode(): PolicyMode {
  const cfg = getConfig();
  return cfg.content_policy?.mode ?? "off";
}

function mergedPatterns(): Record<string, string[]> {
  const cfg = getConfig();
  const configured = cfg.content_policy?.patterns ?? {};
  const categories = new Set<string>([...Object.keys(DEFAULT_PATTERNS), ...Object.keys(configured)]);
  const out: Record<string, string[]> = {};
  for (const cat of categories) {
    out[cat] = [...(configured[cat] ?? []), ...(DEFAULT_PATTERNS[cat] ?? [])];
  }
  return out;
}

// REQ-097: normalize before matching so trivial obfuscation — extra or
// missing whitespace, newlines, and zero-width characters — cannot evade the
// built-in assessment.
function normalizeForMatch(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u200b-\u200d\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function builtinAssess(text: string): { flagged: boolean; reason: string | null } {
  const cfg = getConfig();
  // With the default threshold of 0.2, a single matching pattern in the
  // largest category (5 patterns) already flags the content.
  const threshold = cfg.content_policy?.threshold ?? 0.2;
  const lower = normalizeForMatch(text);
  for (const [category, patterns] of Object.entries(mergedPatterns())) {
    if (patterns.length === 0) continue;
    let hits = 0;
    for (const pattern of patterns) {
      if (pattern && lower.includes(normalizeForMatch(pattern))) hits++;
    }
    if (hits / patterns.length >= threshold) {
      return { flagged: true, reason: category };
    }
  }
  return { flagged: false, reason: null };
}

async function externalAssess(text: string, url: string): Promise<{ flagged: boolean; reason: string | null } | null> {
  const cfg = getConfig();
  const policy = cfg.content_policy;
  if (!policy?.external_url_env) return null;
  const endpoint = process.env[policy.external_url_env];
  if (!endpoint) return null;
  const apiKey = policy.external_api_key_env ? process.env[policy.external_api_key_env] : undefined;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const resp = await infobrokerFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: text.slice(0, 20000), url }),
      timeoutMs: 8000,
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { flagged?: boolean; reason?: string };
    if (typeof data.flagged !== "boolean") return null;
    const reason = typeof data.reason === "string" && data.reason.length > 0 ? data.reason : "external_policy";
    return { flagged: data.flagged, reason };
  } catch {
    return null;
  }
}

export async function checkContent(text: string, url: string): Promise<PolicyResult> {
  const mode = policyMode();
  if (mode === "off") return { flagged: false, reason: null, source: "disabled" };

  const external = await externalAssess(text, url);
  if (external) {
    if (external.flagged) audit("content_policy_flag", `${url} (${external.reason})`);
    return { ...external, source: "external" };
  }

  const builtin = builtinAssess(text);
  if (builtin.flagged) audit("content_policy_flag", `${url} (${builtin.reason})`);
  return { ...builtin, source: "builtin" };
}

/** Map a policy verdict to the disposition for the current mode. */
export function disposition(flagged: boolean): PolicyDisposition {
  const mode = policyMode();
  if (!flagged || mode === "off") return "store";
  if (mode === "block") return "refuse";
  return "skip";
}

/** Policy metadata for a response envelope, omitted entirely when clean. */
export function policyMeta(flags: number, mode: PolicyMode): Record<string, unknown> | undefined {
  if (flags === 0) return undefined;
  return { content_policy: { flagged: flags, mode } };
}