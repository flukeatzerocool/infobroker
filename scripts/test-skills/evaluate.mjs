#!/usr/bin/env node
// evaluate.mjs — Evaluate a skill test run against its manifest.
// Reads the opencode JSON event stream from the run file, extracts the
// assistant's final text, checks the expected tokens appear in order, and
// (with --grade) invokes a rubric pass via `opencode run`.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const [manifestPath, runPath, skill, ...rest] = process.argv.slice(2);
const grade = rest.includes("--grade");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// Extract assistant text from the JSON event stream (opencode --format json).
// The stream is newline-delimited JSON; assistant text parts carry type "text"
// and a `.text` field on `ev.part`.
function extractAssistantText(raw) {
  const parts = [];
  for (const line of raw.split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const part = ev?.part;
    if (part?.type === "text" && typeof part.text === "string") parts.push(part.text);
    else if (typeof ev?.text === "string") parts.push(ev.text);
  }
  return parts.join("\n");
}

const raw = readFileSync(runPath, "utf8");
const text = extractAssistantText(raw);

const tokens = manifest.expected_tokens ?? [];
const missing = [];
let lastIdx = -1;
let orderOk = true;
for (const tok of tokens) {
  const idx = text.indexOf(tok);
  if (idx === -1) {
    missing.push(tok);
    orderOk = false;
  } else if (idx < lastIdx) {
    orderOk = false;
  } else {
    lastIdx = idx;
  }
}

if (missing.length > 0) {
  const result = {
    skill,
    status: "fail",
    missing,
    orderOk,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(0);
}

if (!orderOk) {
  const result = { skill, status: "fail", missing: [], orderOk: false, note: "tokens out of order" };
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(0);
}

const result = { skill, status: "pass", missing: [] };

if (grade && manifest.rubric?.length) {
  const rubric = manifest.rubric.join("\n- ");
  const prompt = `You are grading a skill test. The skill "${skill}" was run with this task output:\n\n---OUTPUT---\n${text.slice(0, 6000)}\n---END OUTPUT---\n\nGrade each of the following rubric criteria as yes or no, then output a single line in the exact form: GRADE <n>/<total> pass|fail.\n\nRubric:\n- ${rubric}`;
  try {
    const out = execSync(
      `opencode run --attach ${process.env.SKILL_TEST_SERVER_URL ?? "http://localhost:4096"} --title "skill-grade" --agent build --auto --format json ${JSON.stringify(prompt)}`,
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

process.stdout.write(JSON.stringify(result) + "\n");
