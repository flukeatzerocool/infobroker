// @implements REQ-036 REQ-081
// Normalized telemetry record for a single debate-club tool call. One JSONL
// record per call so the report/recommend steps share a single schema and can
// carry a reproducibility fingerprint (git sha, config hash, fixture hash).

export interface TelemetryRecord {
  schema: "debate-club/telemetry@1";
  run_id: string;
  scenario_id: string;
  tool: string;
  prefix: "[OK]" | "[ERROR]";
  status: "ok" | "error";
  provider: string;
  error_code?: string;
  expected_error_code?: string;
  results_count: number;
  response_bytes: number;
  latency_ms: number;
  fingerprint: Record<string, string>;
}

export function makeRecord(input: Omit<TelemetryRecord, "schema">): TelemetryRecord {
  return { schema: "debate-club/telemetry@1", ...input };
}

export function toJsonl(records: TelemetryRecord[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "");
}
