#!/usr/bin/env npx tsx
// publish-workflow.test.ts — guards the publish workflow's two load-bearing
// invariants: every action is SHA-pinned, and the npm-propagation budget is
// long enough to cover npm's publish lag.
//
// Why these two: run 43947605837 failed after `npm publish` had already
// succeeded, because the workflow waited a fixed 5 minutes for npm's read side
// to serve the version and npm took 5m18s. The registry step never ran, so
// 2026.11.16 reached npm but not the MCP Registry. A unit test is the cheapest
// place to keep that window from shrinking back.
//
// Exit codes: 0 = assertions pass (the test runner owns the failure signal).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

interface WorkflowStep {
  name?: string;
  uses?: string;
  env?: Record<string, string>;
  run?: string;
}

interface Workflow {
  jobs: Record<string, { steps: WorkflowStep[] }>;
}

function loadWorkflow(name: string): Workflow {
  return yaml.load(readFileSync(join(root, ".github", "workflows", name), "utf-8")) as Workflow;
}

/** Total seconds the workflow will wait for npm before giving up. */
function propagationBudgetSeconds(env: Record<string, string>): number {
  const attempts = Number(env.WAIT_ATTEMPTS);
  const shortAttempts = Number(env.SHORT_ATTEMPTS);
  const shortDelay = Number(env.SHORT_DELAY);
  const longDelay = Number(env.LONG_DELAY);
  return shortAttempts * shortDelay + (attempts - shortAttempts) * longDelay;
}

describe("publish workflow", () => {
  const workflow = loadWorkflow("publish.yml");
  const steps = workflow.jobs.publish.steps;

  it("pins every action to a full commit SHA", () => {
    const uses = steps.map((step) => step.uses).filter((value): value is string => Boolean(value));
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) {
      expect(action, `${action} is not pinned to a 40-character commit SHA`).toMatch(
        /^[^@]+@[0-9a-f]{40}$/,
      );
    }
  });

  it("waits on the registry step rather than a fixed pre-wait that can expire", () => {
    // A separate "Wait for npm" step fails the job on its own, before the
    // registry publish is even attempted, so a slow-but-healthy release is
    // reported as a failure. The wait belongs inside the publish step.
    const preWait = steps.find((step) => /wait for npm/i.test(step.name ?? ""));
    expect(preWait).toBeUndefined();

    const registry = steps.find((step) => step.name === "Publish to MCP Registry");
    expect(registry, "the MCP Registry step is missing").toBeDefined();
    expect(registry?.run).toContain("wait_for_npm");
  });

  it("keeps the npm propagation budget above 15 minutes", () => {
    const registry = steps.find((step) => step.name === "Publish to MCP Registry");
    const env = registry?.env ?? {};
    for (const key of ["WAIT_ATTEMPTS", "SHORT_ATTEMPTS", "SHORT_DELAY", "LONG_DELAY"]) {
      expect(env[key], `${key} is missing from the publish step env`).toBeDefined();
    }
    expect(propagationBudgetSeconds(env)).toBeGreaterThanOrEqual(15 * 60);
  });
});
