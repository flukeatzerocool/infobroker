// @implements REQ-001 REQ-003 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-064 REQ-065 REQ-066 REQ-067 REQ-070 REQ-074 REQ-075 REQ-076 REQ-084 REQ-085 REQ-110 REQ-060i REQ-111
export type StructuredFactKind =
  | "attendance"
  | "population"
  | "area"
  | "elevation"
  | "percentage"
  | "date";

// REQ-021i: a sourced, machine-readable answer to a measurable-attribute
// query. `value` is the typed value when the source supplies one; `display`
// preserves the source's formatting. No value is ever computed client-side.
export interface StructuredFact {
  kind: StructuredFactKind;
  value: number | string;
  display: string;
  unit?: string;
  property?: string;
  key?: string;
  as_of?: string;
  source: string;
  url: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Structured fact attached to this result (REQ-021i). */
  fact?: StructuredFact;
  published_date?: string;
  source_type?: string;
  original_source?: string;
  /** Canonical URL / content family used for independence checks (REQ-121). */
  source_family?: string;
  /** Serving provider slug, when known. */
  provider?: string;
  /** SHA-256 of the stored source text (REQ-122/REQ-026d). */
  content_sha256?: string;
  /** ISO time the source was retrieved. */
  retrieved_at?: string;
  /** Scholarly metadata when the provider supplies it (REQ-003). */
  doi?: string;
  authors?: string[];
  venue?: string;
  abstract?: string;
  citation_count?: number;
}

export interface ProviderConfig {
  tier: "builtin" | "free_http" | "self_hosted_http" | "keyed_http" | "generic_http";
  capabilities: string[];
  rate_limit: { per_second?: number; per_day?: number; per_month?: number };
  auth_env?: string;
  auth_optional?: boolean;
  url_env?: string;
  enabled: boolean;
  priority: number;
  timeout?: number;
  retry_count?: number;
  retry_backoff_ms?: number;
  degraded_latency_ms?: number;
  resells?: boolean;
  /** ISO 639-1 tags this provider can serve, or "*" for any language (REQ-128). */
  languages?: string[] | "*";
  /** Explicit privacy-posture overrides; defaults are derived from tier (REQ-129). */
  privacy?: {
    query_forwarding?: "none" | "origin" | "third_party";
    retains_query?: boolean | "unknown";
    requires_account?: boolean;
    resells?: boolean;
    notes?: string;
  };
  endpoint?: string;
  query_param?: string;
  results_path?: string;
  field_map?: { title?: string; url?: string; snippet?: string; published_date?: string; source_type?: string; original_source?: string };
}

export interface Config {
  // Schema version of the shipped configuration layer (REQ-105). The user
  // configuration layer may carry its own copy to declare which schema version
  // it was written against.
  config_version?: number;
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
    /**
     * Cap on claims accepted in one batch `verify_claims` call (REQ-026g).
     * Configuration validation clamps it; the tool rejects a larger request.
     */
    max_batch_claims?: number;
    /** Override for the modality marker lexicon (REQ-026h). */
    modality_markers?: {
      reported?: string[];
      speculative?: string[];
    };
    confidence_threshold: number;
    first_pass_max_results: number;
    first_pass_max_providers: number;
    similarity_threshold: number;
    authority_weights?: Record<string, number>;
    archive_sources?: boolean;
    kb_recall?: boolean;
    family_similarity_threshold?: number;
    calibration?: {
      enabled?: boolean;
      secondary_only_cap?: number;
    };
  };
  preservation?: {
    enabled?: boolean;
    max_sources_per_finding?: number;
    max_bytes?: number;
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
    rate_limit_cooldown_ms?: number;
    audit_log_path?: string;
  };
  content_policy?: ContentPolicyConfig;
  fetch?: {
    allow_private_urls?: boolean;
    passage_size?: number;
    max_passages?: number;
    detect_date?: boolean;
    crawl_max_pages?: number;
    crawl_max_depth?: number;
    cache?: {
      kb_read?: boolean;
      kb_max_age_hours?: number;
    };
  };
  expand?: {
    max_expansions?: number;
  };
  research?: {
    max_variants?: number;
    max_pages_per_variant?: number;
  };
  deep?: DeepConfig;
  analysis?: AnalysisConfig;
  kb?: KbConfig;
  state?: {
    auto_migrate_config?: boolean;
    update_check?: boolean;
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
  quota_warning?: boolean;
  avg_latency_ms?: number;
  last_error?: string;
  last_success?: string;
  auth_ok: boolean;
  cooldown_remaining_ms?: number;
}

export interface ToolMeta {
  query_time_ms: number;
  fallback_used: boolean;
  quota_remaining?: number;
}

/** REQ-111: one actionable state notice attached to a successful response. */
export interface ToolNotice {
  code: string;
  severity: "action_required" | "info";
  message: string;
  remediation: string;
  details?: Record<string, unknown>;
}

export interface ToolOkResponse {
  status: "ok";
  provider: string;
  results: SearchResult[];
  meta?: ToolMeta;
  notices?: ToolNotice[];
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
  notices?: ToolNotice[];
}

export interface CorroborationSource {
  title: string;
  url: string;
  snippet: string;
  claim?: string;
  /** Span of the supporting text inside `snippet` (REQ-026h). */
  span?: { start: number; end: number; text: string };
  /** Modality of this source's claim (REQ-026h); advisory only. */
  modality?: "asserted" | "reported" | "speculative";
  /** The marker that produced `modality`, for explainability. */
  modality_marker?: string;
  source_type?: string;
  archived_url?: string;
  original_source?: string;
  /** ISO time the source was first attributed to this claim (REQ-109). */
  retrieved_at?: string;
  /** Source family used for independence counting (REQ-121). */
  source_family?: string;
  /** Serving provider slug. */
  provider?: string;
  /** SHA-256 of the snapshot text (REQ-122). */
  content_sha256?: string;
  /** Freshness tier used for the snapshot (REQ-122). */
  snapshot_tier?: string;
  /** Whether the hash covers the document or only a supplied snippet (REQ-122). */
  snapshot_basis?: "document" | "snippet";
  /** KB identity of the stored snapshot; snippet copies are distinct. */
  snapshot_url?: string;
  /** True when the stored snapshot was clipped at the byte bound (REQ-122). */
  snapshot_truncated?: boolean;
}

export interface CorroborationFinding {
  topic: string;
  claim: string;
  /** Position of this claim in the caller's batch list (REQ-026g). */
  claim_index?: number;
  confidence: number;
  verdict: "confirmed" | "contested" | "unverified";
  sources: CorroborationSource[];
  perspectives?: string[];
  source_types?: Record<string, number>;
  /** Number of independent source families (REQ-121). */
  family_count?: number;
}

/**
 * One persisted claim record (REQ-109). The read API returns these; the
 * store keeps the sealed payload and exposes it through `fromStored`.
 */
export interface ClaimRecord {
  id: string;
  claim_key: string;
  claim: string;
  verdict: "confirmed" | "contested" | "unverified";
  confidence: number;
  first_seen_at: string;
  updated_at: string;
  sources: ClaimSourceEdge[];
}

export interface ClaimSourceEdge {
  source_key: string;
  url: string;
  title: string;
  retrieved_at: string;
}

export interface ClaimLedgerQuery {
  query?: string;
  source_url?: string;
  max_results?: number;
}

export interface ClaimLedgerResult {
  claims: ClaimRecord[];
  truncated: boolean;
  scanned: number;
}

/**
 * Caller-supplied receipt structure for a report ingest (REQ-110). Only the
 * claim text, optional grade, and cited sources are read; the server owns the
 * identity, every hash, and the digest.
 */
export interface ReportReceiptSourceInput {
  url: string;
  title?: string;
  retrieved_at?: string;
  snippet?: string;
}

export interface ReportReceiptClaimInput {
  claim: string;
  grade?: string;
  verdict?: string;
  confidence?: "High" | "Medium" | "Low";
  likelihood?: string;
  sources: ReportReceiptSourceInput[];
}

/**
 * Optional report-level metadata carried beside the receipt claims (REQ-114).
 * Additive: a manifest without it remains valid and verifiable (REQ-110).
 */
export interface ReportManifestMeta {
  shape?: string;
  audience?: string;
  methodology?: string;
  assumptions?: string[];
  alternatives?: string[];
  gaps?: string[];
  supersedes?: string;
  revision?: number;
}

export interface ReportReceiptInput {
  claims: ReportReceiptClaimInput[];
  report?: ReportManifestMeta;
}

/** One cited source inside a stored manifest, with the server's hash. */
export interface ReportReceiptSource {
  url: string;
  title: string;
  retrieved_at?: string;
  /**
   * `document` when the source was hashed from its cached KB document;
   * `snippet` when only a supplied excerpt was available (unverifiable).
   */
  hash_basis: "document" | "snippet";
  source_sha256: string;
}

export interface ReportReceiptClaim {
  claim: string;
  grade?: string;
  verdict?: string;
  confidence?: "High" | "Medium" | "Low";
  likelihood?: string;
  sources: ReportReceiptSource[];
}

/**
 * Canonical manifest stored for a report (REQ-110). `digest_sha256` is the
 * hash of the canonical JSON of the manifest without that field. The optional
 * `report` block is additive so version-1 manifests remain verifiable.
 */
export interface ReportReceiptManifest {
  version: 1;
  report_id: string;
  content_sha256: string;
  report?: ReportManifestMeta;
  claims: ReportReceiptClaim[];
  digest_sha256: string;
}

/** A stored receipt as read back from the store. */
export interface ReportReceiptRecord {
  id: string;
  report_key: string;
  report_id: string;
  created_at: string;
  updated_at: string;
  manifest: ReportReceiptManifest;
}

export interface ReportSourceCheck {
  claim_index: number;
  url: string;
  state: "drift" | "unverifiable";
  hash_basis: "document" | "snippet";
}

/** Result of the read-only, offline `verify_report` action (REQ-060i). */
export interface ReportVerificationResult {
  state: "verified" | "drift" | "incomplete" | "unverifiable";
  digest_match: boolean;
  digest_sha256: string;
  report: "verified" | "drift" | "unverifiable";
  report_id: string;
  content_sha256: string;
  report_meta?: ReportManifestMeta;
  revision?: number;
  supersedes?: string;
  created_at?: string;
  age_days?: number;
  freshness_tier?: string;
  stale?: boolean;
  claims: number;
  sources: {
    total: number;
    verified: number;
    drift: number;
    unverifiable: number;
    details: ReportSourceCheck[];
  };
}

export interface CorroborationResult {
  findings: CorroborationFinding[];
  agreement_map: { green: string[]; yellow: string[]; red: string[] };
  synthesis: string;
  iteration_count: number;
  providers_used: string[];
  total_sources: number;
  corroboration: "complete" | "partial";
  /** True when the call supplied a claim list rather than one query string. */
  batch?: boolean;
  /** Identical claims collapsed during batch seeding (REQ-026g). */
  duplicate_claims?: number;
  provenance?: CorroborationProvenance;
}

export interface CorroborationProvenance {
  tool: string;
  version: string;
  max_iterations: number;
  confidence_threshold: number;
  source_types: Record<string, number>;
  config_hash?: string;
  sources?: Array<{
    url: string;
    retrieved_at?: string;
    content_sha256?: string;
    source_family?: string;
    provider?: string;
  }>;
}

// REQ-021h: a bibliographic record resolved by DOI, used when the publisher
// page itself cannot be fetched (paywall, anti-bot, or network failure).
export interface DoiRecord {
  doi: string;
  title: string;
  url: string;
  authors?: string[];
  venue?: string;
  year?: string;
  abstract?: string;
  citation_count?: number;
  oa_url?: string;
  oa_status?: string;
}

export interface Provider {
  slug: string;
  tier: "builtin" | "free_http" | "self_hosted_http" | "keyed_http" | "generic_http";
  capabilities: string[];
  health(): Promise<{ status: string; avgLatencyMs: number }>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  fetchPage?(url: string): Promise<string>;
  suggest?(query: string): Promise<string[]>;
  lookupDoi?(doi: string): Promise<DoiRecord | null>;
}

export interface SearchOptions {
  max_results?: number;
  safe_search?: "on" | "off" | "strict";
  time_range?: "day" | "week" | "month" | "year";
  page?: number;
  content_type?: string;
  region?: string;
  language?: string;
}

export interface AnalysisConfig {
  enabled?: boolean;
  max_topics?: number;
  max_entities?: number;
  cluster_threshold?: number;
  min_cluster_size?: number;
  timeline?: boolean;
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
  keys_dir?: string;
}

export interface ContentPolicyConfig {
  mode: "off" | "flag" | "block";
  threshold?: number;
  external_url_env?: string;
  external_api_key_env?: string;
  patterns?: Record<string, string[]>;
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
