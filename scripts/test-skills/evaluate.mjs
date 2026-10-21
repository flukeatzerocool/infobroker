#!/usr/bin/env node
// evaluate.mjs — Evaluate a skill test run against its manifest.
// Reads the opencode JSON event stream from the run file, extracts the
// assistant's final text, checks the expected tokens appear in order, and
// (with --grade) invokes a rubric pass via `opencode run`.
//
// Optional manifest `checks` add task-quality evidence. By default they are
// advisory and do not change `status`; with --checks-gating a failed
// non-advisory check fails the run. File checks read the workdir's input.txt
// and input.pre.txt; text checks read the assistant text. Manifest
// `scan: "all-assistant"` (or --scan=all-assistant) includes intermediate
// assistant messages instead of only the final one.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { extractFinalAssistantText, extractAllAssistantText } from "../lib/event-stream.mjs";
import { evaluateChecks } from "./checks.mjs";

const [manifestPath, runPath, skill, ...rest] = process.argv.slice(2);
const grade = rest.includes("--grade");
const checksGating = rest.includes("--checks-gating");
const gradeModel = flagValue("--grade-model=");
const workdir = flagValue("--workdir=");

function flagValue(prefix) {
  const hit = rest.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

function readIfExists(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    // unreadable workdir file — treated as missing evidence
    return null;
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const raw = readFileSync(runPath, "utf8");
const scanAll = rest.includes("--scan=all-assistant") || manifest.scan === "all-assistant";
const text = scanAll ? extractAllAssistantText(raw) : extractFinalAssistantText(raw);
const after = workdir ? readIfExists(join(workdir, "input.txt")) : null;
const before = workdir ? readIfExists(join(workdir, "input.pre.txt")) : null;
const checks = evaluateChecks(manifest, text, { before, after });

const tokens = manifest.expected_tokens ?? [];
const missing = [];
const outOfOrder = [];
let lastIdx = -1;
let orderOk = true;
for (const tok of tokens) {
  const idx = text.indexOf(tok);
  if (idx === -1) {
    missing.push(tok);
    orderOk = false;
  } else if (idx < lastIdx) {
    outOfOrder.push(tok);
    orderOk = false;
  } else {
    lastIdx = idx;
  }
}

function emit(result) {
  if (checks) result.checks = checks;
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(0);
}

if (!orderOk) {
  emit({ skill, status: "fail", missing, outOfOrder, orderOk });
}

if (checksGating && checks && !checks.passed) {
  emit({ skill, status: "fail", missing, orderOk, checks_failed: checks.failed });
}

const result = { skill, status: "pass", missing: [] };

if (grade && manifest.rubric?.length) {
  const rubric = manifest.rubric.join("\n- ");
  const gradeText =
    text.length <= 16000
      ? text
      : `${text.slice(0, 12000)}\n\n[... middle omitted ...]\n\n${text.slice(-4000)}`;
  const prompt = `You are grading a skill test. The skill "${skill}" was run with this task output:\n\n---OUTPUT---\n${gradeText}\n---END OUTPUT---\n\nGrade each of the following rubric criteria as yes or no, then output a single line in the exact form: GRADE <n>/<total> pass|fail.\n\nRubric:\n- ${rubric}`;
  const modelFlag = gradeModel ? ` --model ${JSON.stringify(gradeModel)}` : "";
  try {
    const out = execSync(
      `opencode run --attach ${process.env.SKILL_TEST_SERVER_URL ?? "http://localhost:4096"} --title "skill-grade" --agent build --auto --format json${modelFlag} ${JSON.stringify(prompt)}`,
      { timeout: 300000, encoding: "utf8" }
    );
    const m = out.match(/GRADE\s+(\d+)\/(\d+)\s+(pass|fail)/);
    if (m) {
      result.grade = `${m[1]}/${m[2]} ${m[3]}`;
    } else {
      result.grade = "unscored";
    }
  } catch (e) {
    result.grade = "error";
  }
}

emit(result);
