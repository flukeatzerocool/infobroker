// weekly.ts — pure composition for the weekly review report.
//
// Role: library (imported by `scripts/weekly.ts`). It takes the already-read
// sources and returns one object plus a text rendering; the script owns the
// filesystem, git, and the report artifact. Keeping the composition pure makes
// the missing-source cases testable.

import type { DeliveryReport } from "./delivery.js";
import type { HookAction } from "./hook-events.js";
import type { DriftRow } from "./loop-audit.js";
import type { Finding, Increment } from "./loop-artifacts.js";
import {
  CLEAN_RUNS,
  retirementState,
  type GateCost,
  type RetirementState,
  type TimingRow,
} from "./gate-retirement.js";

export interface WeeklyInputs {
  timing: TimingRow[];
  costs: Record<string, GateCost>;
  advisory: string[];
  increments: Increment[];
  findings: Finding[];
  drifts: DriftRow[];
  delivery: DeliveryReport | null;
  hooks: Record<HookAction, number>;
  roadmapItems: number;
  now?: Date;
}

export interface WeeklyGateCost {
  policy_clean_runs: number;
  gates: Record<string, GateCost & { state: RetirementState }>;
  advisory: string[];
  eligible: string[];
}

export interface WeeklyLoop {
  increments: Array<{ name: string; token: string | null; done_bar: boolean }>;
  artifact_errors: number;
  artifact_warnings: number;
  heading_commits: number;
  date_drift: DriftRow[];
}

export interface WeeklyReport {
  schema: 1;
  generated_at: string;
  timing: { rows: number; last_at: string | null };
  gate_cost: WeeklyGateCost;
  loop: WeeklyLoop;
  delivery: DeliveryReport | null;
  hooks: Record<HookAction, number>;
  roadmap: { open_items: number };
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** buildWeeklyReport — the one report the weekly run writes. */
export function buildWeeklyReport(inputs: WeeklyInputs): WeeklyReport {
  const advisory = new Set(inputs.advisory);
  const gates: Record<string, GateCost & { state: RetirementState }> = {};
  for (const [name, cost] of Object.entries(inputs.costs)) {
    gates[name] = { ...cost, state: retirementState(cost, advisory.has(name)) };
  }
  const names = Object.keys(gates).sort(
    (a, b) => (gates[b]?.medianMs ?? 0) - (gates[a]?.medianMs ?? 0),
  );
  const sortedGates: typeof gates = {};
  for (const name of names) {
    const gate = gates[name];
    if (gate) sortedGates[name] = gate;
  }
  const eligible = names.filter((name) => gates[name]?.state === "eligible").sort();
  const advisoryList = names.filter((name) => gates[name]?.state === "advisory").sort();

  const errors = inputs.findings.filter((finding) => finding.level === "error").length;
  const warnings = inputs.findings.filter((finding) => finding.level === "warning").length;
  const drifts = inputs.drifts;
  const now = inputs.now ?? new Date();

  return {
    schema: 1,
    generated_at: now.toISOString(),
    timing: {
      rows: inputs.timing.length,
      last_at: inputs.timing[inputs.timing.length - 1]?.at ?? null,
    },
    gate_cost: {
      policy_clean_runs: CLEAN_RUNS,
      gates: sortedGates,
      advisory: advisoryList,
      eligible,
    },
    loop: {
      increments: inputs.increments.map((increment) => ({
        name: increment.name,
        token: increment.loopToken,
        done_bar: increment.doneBar !== null,
      })),
      artifact_errors: errors,
      artifact_warnings: warnings,
      heading_commits: drifts.length,
      date_drift: drifts.filter((row) => row.drift),
    },
    delivery: inputs.delivery,
    hooks: inputs.hooks,
    roadmap: { open_items: inputs.roadmapItems },
  };
}

/** renderWeekly — the human-readable form of the report. */
export function renderWeekly(report: WeeklyReport): string {
  const lines: string[] = [];
  lines.push(`Weekly review — ${report.generated_at.slice(0, 10)}`);
  lines.push("");
  lines.push(
    `Gate cost (local timing record: ${report.timing.rows} row(s), last ${report.timing.last_at ?? "none"})`,
  );

  const names = Object.keys(report.gate_cost.gates);
  if (names.length === 0) {
    lines.push("  no record — run `npm run check` (it writes timing)");
  } else {
    for (const name of names) {
      const gate = report.gate_cost.gates[name];
      if (!gate) continue;
      lines.push(
        `  ${name.padEnd(27)} ${String(gate.runs).padStart(4)} runs ${String(gate.failures).padStart(3)} fails  median ${seconds(gate.medianMs).padStart(7)}  streak ${String(gate.cleanRuns).padStart(3)}  ${gate.state}`,
      );
    }
  }
  lines.push(
    `  policy: ${report.gate_cost.policy_clean_runs} clean runs — ${report.gate_cost.eligible.length} eligible, ${report.gate_cost.advisory.length} advisory`,
  );
  lines.push(
    `  eligible: ${report.gate_cost.eligible.length > 0 ? report.gate_cost.eligible.join(", ") : "none"}`,
  );
  lines.push(
    `  advisory: ${report.gate_cost.advisory.length > 0 ? report.gate_cost.advisory.join(", ") : "none"}`,
  );

  lines.push("");
  lines.push("Loop");
  const open = report.loop.increments.filter((increment) => increment.token !== "LOOP PAUSED").length;
  lines.push(
    `  increments: ${report.loop.increments.length} (${open} open), ${report.loop.artifact_errors} error(s), ${report.loop.artifact_warnings} warning(s)`,
  );
  lines.push(
    `  CHANGELOG heading commits: ${report.loop.heading_commits}, date drift: ${report.loop.date_drift.length}`,
  );
  for (const row of report.loop.date_drift) {
    lines.push(`    DRIFT ${row.sha.slice(0, 12)} — heading ${row.headingDate ?? "?"} vs commit ${row.commitDate}`);
  }
  lines.push(
    `  hooks: ran ${report.hooks.ran}, skipped ${report.hooks.skipped}, failed ${report.hooks.failed}`,
  );

  lines.push("");
  lines.push("Delivery (origin reflog window)");
  if (!report.delivery) {
    lines.push("  unavailable (fewer than two recorded pushes)");
  } else {
    const delivery = report.delivery;
    lines.push(
      `  window: ${delivery.windowDays.toFixed(0)} days, ${delivery.pushes} pushes, ${delivery.deploymentFrequency.toFixed(2)}/day`,
    );
    lines.push(
      `  lead time: median ${(delivery.leadTimeMedian / 3600).toFixed(1)}h, p90 ${(delivery.leadTimeP90 / 3600).toFixed(1)}h`,
    );
    lines.push(
      `  commits per push: median ${delivery.commitsPerPushMedian}, max ${delivery.commitsPerPushMax}`,
    );
    lines.push(
      `  pipeline-fix proxy: ${delivery.pipelineFollowUps}/${delivery.pipelineCommits} within 48h`,
    );
  }

  lines.push("");
  lines.push(`Roadmap: ${report.roadmap.open_items} open item(s)`);
  return `${lines.join("\n")}\n`;
}
