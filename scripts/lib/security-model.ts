// security-model.ts — gate helper: pure REQ-096 assertions over the spec text.
//
// Role: gate helper (pure; called by scripts/validate-spec.ts; mutates nothing).
// Purpose: assert that the security model appendix (§E) is present, maps every
// OWASP Top 10:2025 and OWASP LLM Top 10:2025 category, references every REQ in
// §4.11, and traces each of those REQs to a gate in the §9.5 manifest.
// Exit contract: `checkSecurityModel` returns the finding list; the caller
// (validate-spec) decides the exit code.

/** The OWASP category codes the model must map, in model order. */
export const OWASP_CATEGORIES: readonly string[] = [
  "A01",
  "A02",
  "A03",
  "A04",
  "A05",
  "A06",
  "A07",
  "A08",
  "A09",
  "A10",
  "LLM01",
  "LLM02",
  "LLM03",
  "LLM04",
  "LLM05",
  "LLM06",
  "LLM07",
  "LLM08",
  "LLM09",
  "LLM10",
];

export interface ManifestRow {
  req: string;
  gates: string[];
}

const GATE_RE = /\bG[0-3]\b/g;
const REQ_ID_RE = /^REQ-\d{3}[a-z]?$/;
const CATEGORY_CODE_RE = /^([A-Z]+\d{2})\b/;

/** Parse a markdown table from a section body into trimmed cells. */
function tableRows(body: string): string[][] {
  const rows: string[][] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    rows.push(cells);
  }
  return rows;
}

/** Find a heading, return the body after it up to `stop` (or to EOF). */
function sectionBody(text: string, heading: RegExp, stopAtHeading: boolean): string | null {
  const match = heading.exec(text);
  if (!match) return null;
  const rest = text.slice(match.index + match[0].length);
  if (!stopAtHeading) return rest;
  const next = rest.search(/^#{2,3} /m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** REQ ids declared as `**REQ-NNN — …**` headings inside a §4.x body. */
export function securityReqsFromBody(specText: string): string[] {
  const body = sectionBody(specText, /^### 4\.11\b.*$/m, true);
  if (body === null) return [];
  const ids: string[] = [];
  for (const match of body.matchAll(/^\*\*(REQ-\d{3}[a-z]?) —/gm)) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The §9.5 manifest rows that declare a gate. */
export function readManifest(specText: string): ManifestRow[] {
  const body = sectionBody(specText, /^### 9\.5 REQ Manifest\s*$/m, true);
  if (body === null) return [];
  const rows: ManifestRow[] = [];
  for (const cells of tableRows(body)) {
    const req = cells[0] ?? "";
    if (!REQ_ID_RE.test(req)) continue;
    rows.push({ req, gates: (cells[3] ?? "").match(GATE_RE) ?? [] });
  }
  return rows;
}

function hasReqReference(text: string, req: string): boolean {
  return new RegExp(`\\b${req}\\b`).test(text);
}

/**
 * REQ-096: fail when a category is unmapped or a §4.11 security requirement is
 * not traceable to a gate. Returns one message per finding, in emission order;
 * an empty array means the model is complete.
 */
export function checkSecurityModel(specText: string): string[] {
  const findings: string[] = [];

  const eBody = sectionBody(specText, /^## §E Appendix: Security Model\s*$/m, false);
  if (eBody === null) {
    return ["Security model appendix (§E) missing — REQ-096"];
  }
  if (!/OWASP Top 10:2025/.test(eBody)) {
    findings.push("Security model (§E) missing OWASP Top 10:2025 mapping — REQ-096");
  }
  if (!/OWASP LLM Top 10:2025/.test(eBody)) {
    findings.push("Security model (§E) missing OWASP LLM Top 10:2025 mapping — REQ-096");
  }

  const securityReqs = securityReqsFromBody(specText);
  if (securityReqs.length === 0) {
    findings.push("Security model: §4.11 section not found — REQ-096");
  }
  for (const req of securityReqs) {
    if (!hasReqReference(eBody, req)) {
      findings.push(`Security model (§E) does not reference ${req} — REQ-096`);
    }
  }

  const mapped = new Map<string, boolean>();
  for (const section of [/^### E\.2\b.*$/m, /^### E\.3\b.*$/m]) {
    const body = sectionBody(specText, section, true);
    if (body === null) continue;
    for (const cells of tableRows(body)) {
      const code = (cells[0] ?? "").match(CATEGORY_CODE_RE)?.[1];
      if (!code) continue;
      mapped.set(code, (cells[1] ?? "").length > 0);
    }
  }
  for (const code of OWASP_CATEGORIES) {
    const entry = mapped.get(code);
    if (entry === undefined) {
      findings.push(`Security model (§E) category '${code}' is missing — REQ-096`);
    } else if (!entry) {
      findings.push(`Security model (§E) category '${code}' is unmapped — REQ-096`);
    }
  }
  for (const code of mapped.keys()) {
    if (!OWASP_CATEGORIES.includes(code)) {
      findings.push(`Security model (§E) category '${code}' is not a known OWASP category — REQ-096`);
    }
  }

  const manifest = readManifest(specText);
  if (manifest.length === 0) {
    findings.push("Security model: §9.5 REQ Manifest not found — REQ-096");
    return findings;
  }
  const gatesByReq = new Map(manifest.map((row) => [row.req, row.gates]));
  for (const req of securityReqs) {
    const gates = gatesByReq.get(req);
    if (gates === undefined) {
      findings.push(`Security model: §9.5 has no row for ${req} — REQ-096`);
    } else if (gates.length === 0) {
      findings.push(`Security model: §9.5 declares no gate for ${req} — REQ-096`);
    }
  }

  return findings;
}
