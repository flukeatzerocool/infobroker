// @implements REQ-001 REQ-003 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-064 REQ-065 REQ-066 REQ-067 REQ-070 REQ-074 REQ-075 REQ-076 REQ-084 REQ-085
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published_date?: string;
  source_type?: string;
  original_source?: string;
}

export interface ProviderConfig {
  tier: "builtin" | "free_http" | "self_hosted_http" | "keyed_http" | "generic_http";
  capabilities: string[];
  rate_limit: { per_second?: number; per_day?: number; per_month?: number };
  auth_env?: string;
  url_env?: string;
  enabled: boolean;
  priority: number;
  timeout?: number;
  retry_count?: number;
  retry_backoff_ms?: number;
  degraded_latency_ms?: number;
  resells?: boolean;
  endpoint?: string;
  query_param?: string;
  results_path?: string;
  field_map?: { title?: string; url?: string; snippet?: string; published_date?: string; source_type?: string; original_source?: string };
}

export interface Config {
  providers: Record<string, ProviderConfig>;
  dispatch: Record<string, string[]>;
  defaults?: {
    timeout?: number;
    retry_count?: number;
    retry_backoff_ms?: number;
  };
  corroboration: {
    max_iterations: number;
    max_http_calls: number;
    confidence_threshold: number;
    first_pass_max_results: number;
    similarity_threshold: number;
    authority_weights?: Record<string, number>;
    archive_sources?: boolean;
    kb_recall?: boolean;
  };
  output: {
    max_chars: number;
    latency_window_size: number;
    verbose?: boolean;
    fallback_depth: number;
    max_redirect_hops: number;
    degraded_latency_ms?: number;
    hedge_enabled?: boolean;
    hedge_min_delay_ms?: number;
    hedge_max_delay_ms?: number;
    hedge_grace_ms?: number;
  };
  fetch?: {
    allow_private_urls?: boolean;
    passage_size?: number;
    max_passages?: number;
    detect_date?: boolean;
  };
  expand?: {
    max_expansions?: number;
  };
  deep?: DeepConfig;
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
  quota_warning?: boolean;
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
  meta?: ToolMeta;
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
    details?: Record<string, unknown>;
  };
}

export interface CorroborationFinding {
  topic: string;
  claim: string;
  confidence: number;
  verdict: "confirmed" | "contested" | "unverified";
  sources: Array<{ title: string; url: string; snippet: string; claim: string; source_type?: string; archived_url?: string; original_source?: string }>;
  perspectives?: string[];
  source_types?: Record<string, number>;
}

export interface CorroborationResult {
  findings: CorroborationFinding[];
  agreement_map: { green: string[]; yellow: string[]; red: string[] };
  synthesis: string;
  iteration_count: number;
  providers_used: string[];
  total_sources: number;
  corroboration: "complete" | "partial";
  provenance?: CorroborationProvenance;
}

export interface CorroborationProvenance {
  tool: string;
  version: string;
  max_iterations: number;
  confidence_threshold: number;
  source_types: Record<string, number>;
}

export interface Provider {
  slug: string;
  tier: "builtin" | "free_http" | "self_hosted_http" | "keyed_http" | "generic_http";
  capabilities: string[];
  health(): Promise<{ status: string; avgLatencyMs: number }>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  fetchPage?(url: string): Promise<string>;
  suggest?(query: string): Promise<string[]>;
}

export interface SearchOptions {
  max_results?: number;
  safe_search?: "on" | "off" | "strict";
  time_range?: "day" | "week" | "month" | "year";
  page?: number;
  content_type?: string;
  region?: string;
}

export interface DeepConfig {
  max_pages: number;
  max_total_pages: number;
  concurrency: number;
  early_exit_score?: number;
  max_ms?: number;
  detect_date?: boolean;
}

export interface KbConfig {
  storage_path: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  auto_index: boolean;
  default_collection: string;
  max_results: number;
  expiry?: Record<string, number>;
  reports_dir?: string;
  default_save_destination?: "kb" | "disk" | "both";
  freshness?: {
    tiers: Record<string, { decay_hours: number; expiry_hours: number }>;
    auto_classify: boolean;
    default_tier: string;
  };
  kb_first_relevance_threshold: number;
  kb_first_confidence_threshold: number;
  maintenance_interval_minutes: number;
  encryption?: KbEncryptionConfig;
}

export interface KbEncryptionConfig {
  enabled: boolean;
  key_file?: string;
}

export interface KbChunk {
  id: string;
  text: string;
  embedding: number[];
  source_url: string;
  chunk_index: number;
  title: string;
  provider: string;
  collection: string;
  source_type: string;
  freshness_tier: string;
  ingested_at: number;
  source_updated_at?: string;
}

export interface KbSearchResult {
  score: number;
  freshness_score: number;
  freshness_tier: string;
  source_url: string;
  title: string;
  snippet: string;
  collection: string;
  provider: string;
  source_type: string;
  ingested_at: number;
  source_updated_at?: string;
}

export interface KbListEntry {
  source_url: string;
  title: string;
  collection: string;
  source_type: string;
  freshness_tier: string;
  chunk_count: number;
  ingested_at: number;
  source_updated_at?: string;
}

export interface KbStats {
  chunk_count: number;
  collections: Record<string, number>;
  freshness_tiers?: Record<string, number>;
  storage_size_bytes: number;
  last_ingestion: string | null;
  model_available: boolean;
  model_name: string;
  events: string[];
  encryption?: "enabled" | "disabled" | "locked";
}
