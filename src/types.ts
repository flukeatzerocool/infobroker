// @implements REQ-001 REQ-003 REQ-060 REQ-061 REQ-062 REQ-063 REQ-064 REQ-065 REQ-066 REQ-067 REQ-070
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published_date?: string;
  source_type?: string;
}

export interface ProviderConfig {
  tier: "builtin" | "free_http" | "self_hosted_http" | "keyed_http";
  capabilities: string[];
  rate_limit: { per_second?: number; per_day?: number; per_month?: number };
  auth_env?: string;
  url_env?: string;
  enabled: boolean;
  priority: number;
  timeout?: number;
  retry_count?: number;
  retry_backoff_ms?: number;
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
  kb?: KbConfig;
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
  health(): Promise<{ status: string; avgLatencyMs: number }>;
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

export interface KbConfig {
  storage_path: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  auto_index: boolean;
  default_collection: string;
  max_results: number;
  expiry: Record<string, number>;
  max_vocab_terms: number;
  maintenance_interval_minutes: number;
}

export interface KbChunk {
  id: string;
  text: string;
  embedding: number[];
  source_url: string;
  title: string;
  provider: string;
  collection: string;
  source_type: string;
  ingested_at: number;
}

export interface KbSearchResult {
  chunk_id: string;
  text: string;
  score: number;
  source_url: string;
  title: string;
  provider: string;
  collection: string;
  snippet: string;
}

export interface KbStats {
  chunk_count: number;
  collections: Record<string, number>;
  storage_size_bytes: number;
  last_ingestion: string | null;
  model_available: boolean;
  model_name: string;
  events: string[];
}
