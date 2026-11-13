// security-model.test.ts — unit tests for the REQ-096 security-model gate.
//
// Role: test. Every negative fixture mutates the live spec text and first
// asserts that the token it removes or changes is present, so an upstream
// reformat turns the fixture red instead of silently making it a no-op.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OWASP_CATEGORIES, checkSecurityModel, readManifest, securityReqsFromBody } from "./security-model.js";

const ROOT = join(import.meta.dirname, "..", "..");
const LIVE = readFileSync(join(ROOT, "infobroker.md"), "utf-8");

function lineIndex(lines: string[], re: RegExp): number {
  const index = lines.findIndex((line) => re.test(line));
  expect(index, `expected a line matching ${re}`).toBeGreaterThanOrEqual(0);
  return index;
}

function mutateLine(text: string, re: RegExp, mutate: (line: string) => string): string {
  const lines = text.split("\n");
  const index = lineIndex(lines, re);
  lines[index] = mutate(lines[index]!);
  return lines.join("\n");
}

function removeLine(text: string, re: RegExp): string {
  const lines = text.split("\n");
  const index = lineIndex(lines, re);
  lines.splice(index, 1);
  return lines.join("\n");
}

function insertAfter(text: string, re: RegExp, inserted: string): string {
  const lines = text.split("\n");
  const index = lineIndex(lines, re);
  lines.splice(index + 1, 0, inserted);
  return lines.join("\n");
}

/** Rewrite the fourth cell (the gate) of a §9.5 row. */
function withGateCell(line: string, value: string): string {
  const cells = line.split("|");
  expect(cells.length).toBeGreaterThanOrEqual(6);
  cells[4] = ` ${value} `;
  return cells.join("|");
}

/** Rewrite the second cell (the controlling REQ/disposition) of an OWASP row. */
function withCategoryControl(line: string, value: string): string {
  const cells = line.split("|");
  expect(cells.length).toBeGreaterThanOrEqual(4);
  cells[2] = ` ${value} `;
  return cells.join("|");
}

describe("security model (REQ-096)", () => {
  it("passes on the shipped spec", () => {
    expect(checkSecurityModel(LIVE)).toEqual([]);
  });

  it("reads the §4.11 scope from the body headings", () => {
    expect(securityReqsFromBody(LIVE)).toEqual([
      "REQ-096",
      "REQ-097",
      "REQ-098",
      "REQ-099",
      "REQ-100",
      "REQ-101",
      "REQ-102",
    ]);
  });

  it("reads gates from the §9.5 manifest", () => {
    const manifest = readManifest(LIVE);
    expect(manifest.find((row) => row.req === "REQ-101")?.gates).toEqual(["G3"]);
    expect(manifest.find((row) => row.req === "REQ-097")?.gates).toEqual(["G0", "G1"]);
  });

  it("fails when the §E appendix is missing", () => {
    const heading = "## §E Appendix: Security Model";
    expect(LIVE).toContain(heading);
    const spec = LIVE.replace(heading, "## §E Appendix: Security Model Renamed");
    expect(checkSecurityModel(spec)).toEqual(["Security model appendix (§E) missing — REQ-096"]);
  });

  it("fails when the OWASP Top 10 mapping is missing", () => {
    expect(LIVE).toContain("OWASP Top 10:2025");
    const spec = LIVE.replaceAll("OWASP Top 10:2025", "OWASP Top 10:2020");
    expect(checkSecurityModel(spec)).toContain("Security model (§E) missing OWASP Top 10:2025 mapping — REQ-096");
  });

  it("fails when the OWASP LLM Top 10 mapping is missing", () => {
    expect(LIVE).toContain("OWASP LLM Top 10:2025");
    const spec = LIVE.replaceAll("OWASP LLM Top 10:2025", "OWASP LLM Top 10:2020");
    expect(checkSecurityModel(spec)).toContain(
      "Security model (§E) missing OWASP LLM Top 10:2025 mapping — REQ-096",
    );
  });

  it("fails when a security REQ is not referenced in §E", () => {
    const start = LIVE.indexOf("## §E Appendix: Security Model");
    expect(start).toBeGreaterThanOrEqual(0);
    const appendix = LIVE.slice(start);
    expect(appendix).toContain("REQ-099");
    const spec = LIVE.slice(0, start) + appendix.replaceAll("REQ-099", "REQ-098");
    expect(checkSecurityModel(spec)).toContain("Security model (§E) does not reference REQ-099 — REQ-096");
  });

  it("fails when a category row is missing", () => {
    const spec = removeLine(LIVE, /^\| A07 /);
    expect(checkSecurityModel(spec)).toContain("Security model (§E) category 'A07' is missing — REQ-096");
  });

  it("fails when a category row has an empty controlling cell", () => {
    const spec = mutateLine(LIVE, /^\| A07 /, (line) => withCategoryControl(line, ""));
    expect(checkSecurityModel(spec)).toContain("Security model (§E) category 'A07' is unmapped — REQ-096");
  });

  it("fails when a category code is outside the OWASP standard", () => {
    const spec = insertAfter(LIVE, /^\| A10 /, "| X01 Made Up | REQ-096 |");
    expect(checkSecurityModel(spec)).toContain(
      "Security model (§E) category 'X01' is not a known OWASP category — REQ-096",
    );
  });

  it("fails when a security REQ has no §9.5 row", () => {
    const spec = removeLine(LIVE, /^\| REQ-101 \|/);
    expect(checkSecurityModel(spec)).toContain("Security model: §9.5 has no row for REQ-101 — REQ-096");
  });

  it("fails when a security REQ declares no gate", () => {
    const spec = mutateLine(LIVE, /^\| REQ-101 \|/, (line) => withGateCell(line, ""));
    expect(checkSecurityModel(spec)).toContain("Security model: §9.5 declares no gate for REQ-101 — REQ-096");
  });

  it("derives the scope from the body, so a new §4.11 REQ is checked", () => {
    const withReq = insertAfter(LIVE, /^### 4\.11 /, "**REQ-999 — Test obligation**");
    expect(securityReqsFromBody(withReq)).toContain("REQ-999");
    const spec = insertAfter(withReq, /^\| REQ-102 \|/, "| REQ-999 | Test obligation | 4.11 | G1 |");
    expect(checkSecurityModel(spec)).toEqual(["Security model (§E) does not reference REQ-999 — REQ-096"]);
  });

  it("reports multiple missing gates in body order", () => {
    const spec = mutateLine(
      mutateLine(LIVE, /^\| REQ-098 \|/, (line) => withGateCell(line, "")),
      /^\| REQ-102 \|/,
      (line) => withGateCell(line, ""),
    );
    const findings = checkSecurityModel(spec).filter((finding) => finding.includes("declares no gate"));
    expect(findings).toEqual([
      "Security model: §9.5 declares no gate for REQ-098 — REQ-096",
      "Security model: §9.5 declares no gate for REQ-102 — REQ-096",
    ]);
  });

  it("covers every OWASP category the standard names", () => {
    expect(OWASP_CATEGORIES).toHaveLength(20);
    expect(new Set(OWASP_CATEGORIES).size).toBe(20);
  });
});
