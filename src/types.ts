// @implements REQ-001 REQ-003
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published_date?: string;
  source_type?: string;
}

export interface ProviderConfig {
  type: "scraped" | "free_http" | "keyed_http" | "self_hosted_http" | "builtin";
  tier: "builtin" | "free_http" | "self_hosted_http" | "keyed_http";
  capabilities: string[];
  rate_limit: { per_second?: number; per_hour?: number; per_day?: number; per_month?: number };
  auth_env?: string;
  url_env?: string;
  enabled: boolean;
  priority: number;
  timeout?: number;
}

export interface Config {
  providers: Record<string, ProviderConfig>;
  dispatch: Record<string, string[]>;
  convergence: {
    max_iterations: number;
    max_http_calls: number;
    confidence_threshold: number;
  };
  output: {
    max_chars: number;
    latency_window_size?: number;
  };
}

export interface HealthReport {
  status: "active" | "inactive" | "degraded" | "exhausted";
  slug: string;
  tier: string;
  capabilities: string[];
  quota_used?: number;
  quota_remaining?: number;
  quota_reset_at?: string;
  avg_latency_ms?: number;
  last_error?: string;
  last_success?: string;
  auth_ok: boolean;
}

export interface ToolMeta {
  query_time_ms: number;
  fallback_used: boolean;
  quota_remaining?: number;
}

export interface ToolOkResponse {
  status: "ok";
  provider: string;
  results: SearchResult[];
  meta: ToolMeta;
  truncated?: boolean;
  output_path?: string;
}

export interface ToolErrorResponse {
  status: "error";
  provider: string;
  error: {
    code: string;
    message: string;
    provider: string;
    remediation: string;
  };
}

export type ToolResponse = ToolOkResponse | ToolErrorResponse;

export interface ConvergenceFinding {
  topic: string;
  claim: string;
  confidence: number;
  verdict: "confirmed" | "contested" | "unverified";
  sources: Array<{ title: string; url: string; snippet: string }>;
  perspectives?: string[];
}

export interface ConvergenceResult {
  findings: ConvergenceFinding[];
  agreement_map: { green: string[]; yellow: string[]; red: string[] };
  iteration_count: number;
  providers_used: string[];
  total_sources: number;
  convergence: "complete" | "partial";
}

export interface Provider {
  slug: string;
  tier: "builtin" | "free_http" | "self_hosted_http" | "keyed_http";
  capabilities: string[];
  health(): Promise<HealthReport>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  fetchPage?(url: string): Promise<string>;
  suggest?(query: string): Promise<string[]>;
}

export interface SearchOptions {
  max_results?: number;
  safe_search?: "on" | "off";
  time_range?: "day" | "week" | "month" | "year";
  page?: number;
}
