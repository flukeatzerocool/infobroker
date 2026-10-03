import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EVALUATOR = join(import.meta.dirname, "..", "scripts", "evaluate-lab.mjs");

function makeScenario() {
  return {
    id: "TX",
    persona: "tester",
    shape: "fact-check",
    tokens: ["fact-check complete."],
    absent: [],
    sections: ["verdict", "confidence"],
    tool_audit: { verify_claims: true, uses_infobroker: true },
    rubric: ["A verdict is given"],
  };
}

function makeTranscript() {
  return [
    JSON.stringify({
      type: "text",
      part: { type: "text", role: "assistant", text: "Verdict: false. Confidence 0.9. fact-check complete." },
    }),
    JSON.stringify({
      type: "tool_use",
      part: {
        type: "tool",
        tool: "infobroker_infobroker_verify_claims",
        state: { input: { query: "q" }, output: "corroborated" },
      },
    }),
    JSON.stringify({
      type: "tool_use",
      part: {
        type: "tool",
        tool: "infobroker_infobroker_search_web",
        state: { input: { query: "q" }, output: "results" },
      },
    }),
  ].join("\n");
}

function run(criticText: string | undefined) {
  const dir = mkdtempSync(join(tmpdir(), "eval-lab-"));
  const scenarioPath = join(dir, "scenario.json");
  const transcriptPath = join(dir, "turn0.txt");
  writeFileSync(scenarioPath, JSON.stringify(makeScenario()));
  writeFileSync(transcriptPath, makeTranscript());
  if (criticText !== undefined) writeFileSync(join(dir, "critic.txt"), criticText);
  const out = execFileSync(process.execPath, [EVALUATOR, scenarioPath, transcriptPath, dir], { encoding: "utf8" });
  return JSON.parse(out.trim());
}

const VERDICT = [
  "## Analysis",
  "Some prose.",
  "",
  "```",
  "CRITIC VERDICT: qualified",
  "UNSOURCED CLAIMS: 2",
  "OVERSTATED CLAIMS: 1",
  "WEAKEST LINK: The confidence figure has no method.",
  "```",
].join("\n");

describe("evaluate-lab", () => {
  it("passes the mechanical gates and emits normalized Infobroker coverage", () => {
    const r = run(VERDICT);
    expect(r.status).toBe("pass");
    expect(r.auditFails).toEqual([]);
    expect(r.tools).toEqual(["infobroker_search_web", "infobroker_verify_claims"]);
  });

  it("parses the critic verdict block that sits at the tail of the text", () => {
    const r = run(VERDICT);
    expect(r.critic_status).toBe("ok");
    expect(r.critic_verdict).toMatchObject({ verdict: "qualified", unsourced: 2, overstated: 1 });
    expect(r.critic_verdict.weakest_link).toContain("confidence figure");
  });

  it("reports an explicit not-run status when no critic artifact exists", () => {
    const r = run(undefined);
    expect(r.critic_status).toBe("not-run");
    expect(r.critic).toBeNull();
    expect(r.critic_verdict).toBeNull();
  });

  it("distinguishes an empty critic from a malformed one", () => {
    expect(run("").critic_status).toBe("empty");
    expect(run("prose with no verdict block").critic_status).toBe("malformed");
  });

  it("records a critic command failure reason when one is present", () => {
    const dir = mkdtempSync(join(tmpdir(), "eval-lab-"));
    const scenarioPath = join(dir, "scenario.json");
    const transcriptPath = join(dir, "turn0.txt");
    writeFileSync(scenarioPath, JSON.stringify(makeScenario()));
    writeFileSync(transcriptPath, makeTranscript());
    writeFileSync(join(dir, "critic.err"), "critic command exited non-zero\n");
    const out = execFileSync(process.execPath, [EVALUATOR, scenarioPath, transcriptPath, dir], { encoding: "utf8" });
    const r = JSON.parse(out.trim());
    expect(r.critic_status).toBe("not-run");
    expect(r.critic_error).toContain("non-zero");
  });
});
