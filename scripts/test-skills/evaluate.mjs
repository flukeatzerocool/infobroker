#!/usr/bin/env node
// evaluate.mjs — Evaluate a skill test run against its manifest.
// Reads the opencode JSON event stream from the run file, extracts the
// assistant's final text, checks the expected tokens appear in order, and
// (with --grade) invokes a rubric pass via `opencode run`.
//
// Optional manifest `checks` add advisory task-quality evidence. They do not
// change `status` or this process's exit code: token ordering alone decides
// pass/fail. File checks read the workdir's input.txt and input.pre.txt;
// text checks read the final assistant text.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { extractFinalAssistantText } from "../lib/event-stream.mjs";

const [manifestPath, runPath, skill, ...rest] = process.argv.slice(2);
const grade = rest.includes("--grade");
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

function evaluateChecks(manifest, text, workdirPath) {
  const checks = manifest.checks;
  if (!checks) return null;

  const after = workdirPath ? readIfExists(join(workdirPath, "input.txt")) : null;
  const before = workdirPath ? readIfExists(join(workdirPath, "input.pre.txt")) : null;
  const results = {};
  const failed = [];

  const record = (name, ok, detail) => {
    results[name] = ok;
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  };

  if (checks.require_file_change) {
    record(
      "require_file_change",
      before !== null && after !== null && before !== after,
      before === null || after === null ? "workdir input missing" : "file unchanged"
    );
  }

  for (const name of ["must_be_absent", "must_be_preserved"]) {
    const items = checks[name];
    if (!Array.isArray(items) || items.length === 0) continue;
    const bad = items.filter((item) =>
      after === null ? true : name === "must_be_absent" ? after.includes(item) : !after.includes(item)
    );
    record(name, bad.length === 0, bad.join(", "));
  }

  const lower = text.replace(/[*_`~]/g, "").toLowerCase();
  const includesAny = (pattern) =>
    pattern.toLowerCase().split("|").some((alt) => alt.length > 0 && lower.includes(alt));

  if (Array.isArray(checks.required_facts) && checks.required_facts.length > 0) {
    const missing = checks.required_facts.filter((fact) => !includesAny(fact));
    record("required_facts", missing.length === 0, missing.join(", "));
  }

  if (Array.isArray(checks.required_any) && checks.required_any.length > 0) {
    record(
      "required_any",
      checks.required_any.some((pattern) => includesAny(pattern)),
      `none of: ${checks.required_any.join(", ")}`
    );
  }

  if (Array.isArray(checks.forbidden_patterns) && checks.forbidden_patterns.length > 0) {
    const found = checks.forbidden_patterns.filter((pattern) => lower.includes(pattern.toLowerCase()));
    record("forbidden_patterns", found.length === 0, found.join(", "));
  }

  return {
    passed: failed.length === 0,
    failed,
    file_changed: before !== null && after !== null && before !== after,
    results,
  };
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const raw = readFileSync(runPath, "utf8");
const text = extractFinalAssistantText(raw);
const checks = evaluateChecks(manifest, text, workdir);

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

const result = { skill, status: "pass", missing: [] };

if (grade && manifest.rubric?.length) {
  const rubric = manifest.rubric.join("\n- ");
  const prompt = `You are grading a skill test. The skill "${skill}" was run with this task output:\n\n---OUTPUT---\n${text.slice(0, 6000)}\n---END OUTPUT---\n\nGrade each of the following rubric criteria as yes or no, then output a single line in the exact form: GRADE <n>/<total> pass|fail.\n\nRubric:\n- ${rubric}`;
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
