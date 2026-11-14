export type BrandListItem = {
  id: string;
  name: string;
  status: string;
  primary_website_url: string | null;
  current_approved_profile_version_id: string | null;
  latest_scan_status: string | null;
  latest_scan_id: string | null;
  latest_profile_status: string | null;
  latest_profile_version_id: string | null;
  logo_url?: string | null;
  logo_asset_id?: string | null;
  timezone?: string;
  archived_at?: string | null;
  updated_at: string;
};

export type BrandDetail = {
  id: string;
  name: string;
  status: string;
  version: number;
  current_approved_profile_version_id: string | null;
  current_approved_strategy_id: string | null;
  website: {
    website_source_id: string;
    normalized_url: string;
    validation_status: string;
    source_revision: number;
  } | null;
  latest_scan: {
    id: string;
    status: string;
    job_run_id: string;
    connector_mode: 'FIXTURE' | 'NOT_CONFIGURED' | 'LIVE';
  } | null;
  latest_profile_status: string | null;
  latest_profile_version_id: string | null;
  next_scan_connector_mode: 'FIXTURE' | 'NOT_CONFIGURED' | 'LIVE';
  archived_at: string | null;
  logo_url?: string | null;
  logo_asset_id?: string | null;
  timezone?: string;
  access?: { role: string | null; capabilities: string[] };
  updated_at: string;
};

export type ScanDetail = {
  id: string;
  status: string;
  progress_percent: number;
  pages_fetched: number;
  pages_failed: number;
  pages_skipped: number;
  ai_availability: string;
  analysis_status?: string;
  analysis_error_code?: string | null;
  connector_mode: 'FIXTURE' | 'NOT_CONFIGURED' | 'LIVE';
  coverage: {
    required_missing?: string[];
    unknown_fields?: string[];
    failed_pages?: { url: string; reason: string }[];
    skipped_pages?: { url: string; reason: string }[];
    pages_js_rendered?: number;
    pages_js_render_attempted?: number;
    pages_js_render_failed?: number;
    js_render_errors?: string[];
    js_render_error_details?: string[];
    js_render_launch_detail?: string | null;
    js_render_mode?: string;
    scan_max_pages?: number;
    pages_discovered?: number;
    products_discovered?: number;
    services_discovered?: number;
  } | null;
  job_run_id: string;
  error_code: string | null;
  started_at: string | null;
  finished_at: string | null;
  profile_version_id: string | null;
  discovery_summary?: {
    pages: number;
    products: number;
    services: number;
  };
  content_outlook?: {
    catalog_items: number;
    product_names: string[];
    service_names: string[];
    estimated_organic_requests: number;
    estimated_paid_requests: number;
  };
};

export type DiscoveredPage = {
  id: string;
  url: string;
  canonical_url: string;
  title: string | null;
  classification: string;
  fetch_status: string;
  http_status: number | null;
  locale_hint: string | null;
};

export type DiscoveredProduct = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  category: string | null;
  sku_public: string | null;
  price_amount: string | null;
  price_currency: string | null;
  availability: string | null;
  source_page_id: string | null;
  parent_product_id: string | null;
};

export type EvidenceItem = {
  id: string;
  source_url: string;
  canonical_url: string;
  page_title: string | null;
  fetched_at: string;
  excerpt_text: string;
  content_hash: string;
  extraction_method: string;
  scan_attempt_id: string;
  discovered_page_id: string | null;
  connector_mode?: 'FIXTURE' | 'NOT_CONFIGURED' | 'LIVE';
};

export type InsightItem = {
  id: string;
  field_key: string;
  info_state: string;
  review_status: string;
  discovery_tier: string;
  evidence_id: string | null;
  text_value: string | null;
  value_json: unknown;
  row_version: number;
  confidence?: number | null;
  created_by?: string;
};

export type ProfileDetail = {
  id: string;
  status: string;
  row_version: number;
  scan_attempt_id: string | null;
  ai_availability: string;
  analysis_status?: string;
  sections: Record<string, unknown>;
  insights: InsightItem[];
  coverage_snapshot: Record<string, unknown> | null;
  eligibility: { approvable: boolean; blocking_reasons: string[] };
  review_history?: Array<{
    id: string;
    kind: string;
    action: string;
    created_at: string;
  }>;
  created_at: string;
  approved_at: string | null;
};

export type Paginated<T> = {
  data: T[];
  page: { next_cursor: string | null; limit: number };
};
