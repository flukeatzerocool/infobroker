// weekly.test — unit tests for the weekly report composition.
// Role: test.
//
// The weekly command owns three reports in one artifact, so the composition
// is tested with every source present and with the delivery/timing sources
// absent; the text rendering must name the three sections either way.

import { describe, expect, it } from "vitest";
import type { DeliveryReport } from "./delivery.js";
import { summarizeGateCost, type TimingRow } from "./gate-retirement.js";
import type { DriftRow } from "./loop-audit.js";
import type { Increment } from "./loop-artifacts.js";
import { buildWeeklyReport, renderWeekly, type WeeklyInputs } from "./weekly.js";

const NOW = new Date("2026-11-08T09:00:00.000Z");

function timingRows(count: number): TimingRow[] {
  return Array.from({ length: count }, (_, index) => ({
    at: `2026-11-07T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
    mode: "fast",
    head: "abc123",
    gate: "typecheck",
    ms: 400,
    status: "pass",
  }));
}

function increment(name: string, token: "LOOP PAUSED" | "LOOP OPEN" | null): Increment {
  return {
    name,
    dir: `docs/plans/${name}`,
    hasPlan: true,
    hasTasks: true,
    hasAar: token !== null,
    loopToken: token,
    doneBar: "done",
  };
}

const delivery: DeliveryReport = {
  windowDays: 10,
  pushes: 5,
  deploymentFrequency: 0.5,
  leadTimeMedian: 3600,
  leadTimeP90: 7200,
  commitsPerPushMedian: 2,
  commitsPerPushMax: 4,
  pipelineCommits: 2,
  pipelineFollowUps: 1,
};

const drift: DriftRow = {
  sha: "abcdef123456",
  commitDate: "2026-11-07",
  heading: "2026.11.6",
  headingDate: "2026-11-06",
  drift: true,
};

function baseInputs(rows: TimingRow[] = timingRows(24)): WeeklyInputs {
  return {
    timing: rows,
    costs: summarizeGateCost(rows),
    advisory: [] as string[],
    increments: [increment("2026-11-07-a", "LOOP PAUSED"), increment("2026-11-07-b", "LOOP OPEN")],
    findings: [{ increment: "2026-11-07-b", level: "error" as const, message: "missing plan.md" }],
    drifts: [drift],
    delivery,
    hooks: { ran: 3, skipped: 1, failed: 0 },
    roadmapItems: 2,
    now: NOW,
  };
}

describe("buildWeeklyReport", () => {
  it("carries the gate-cost, loop, and delivery data in one object", () => {
    const report = buildWeeklyReport(baseInputs());
    expect(report.generated_at).toBe(NOW.toISOString());
    expect(report.timing.rows).toBe(24);
    expect(report.gate_cost.eligible).toEqual(["typecheck"]);
    expect(report.gate_cost.advisory).toEqual([]);
    expect(report.gate_cost.gates.typecheck?.state).toBe("eligible");
    expect(report.loop.artifact_errors).toBe(1);
    expect(report.loop.increments.filter((entry) => entry.token === "LOOP OPEN")).toHaveLength(1);
    expect(report.loop.date_drift).toEqual([drift]);
    expect(report.delivery).toEqual(delivery);
    expect(report.roadmap.open_items).toBe(2);
  });

  it("marks an advisory gate and keeps it out of the eligible list", () => {
    const inputs = baseInputs();
    inputs.advisory = ["typecheck"];
    const report = buildWeeklyReport(inputs);
    expect(report.gate_cost.advisory).toEqual(["typecheck"]);
    expect(report.gate_cost.eligible).toEqual([]);
    expect(report.gate_cost.gates.typecheck?.state).toBe("advisory");
  });

  it("reports an empty timing record without failing", () => {
    const report = buildWeeklyReport(baseInputs([]));
    expect(report.timing.rows).toBe(0);
    expect(report.timing.last_at).toBeNull();
    expect(report.gate_cost.eligible).toEqual([]);
  });

  it("keeps a null delivery report as unavailable", () => {
    const inputs = baseInputs();
    inputs.delivery = null;
    expect(buildWeeklyReport(inputs).delivery).toBeNull();
  });
});

describe("renderWeekly", () => {
  it("names the three sections and the report data", () => {
    const text = renderWeekly(buildWeeklyReport(baseInputs()));
    expect(text).toContain("Gate cost");
    expect(text).toContain("Loop");
    expect(text).toContain("Delivery");
    expect(text).toContain("typecheck");
    expect(text).toContain("2026-11-08");
    expect(text).toContain("Roadmap: 2 open item(s)");
  });

  it("renders empty and missing sources as explicit text", () => {
    const inputs = baseInputs([]);
    inputs.delivery = null;
    const text = renderWeekly(buildWeeklyReport(inputs));
    expect(text).toContain("no record");
    expect(text).toContain("unavailable (fewer than two recorded pushes)");
  });
});
