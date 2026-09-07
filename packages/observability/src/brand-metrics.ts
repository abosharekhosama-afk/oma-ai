/**
 * Brand crawl / scan observability field names for structured logs and metrics.
 * Log these on ingestion worker progress, cancel, permission_denied_midflight, and approval.
 */
export const BRAND_METRIC_FIELDS = {
  correlation_id: 'correlation_id',
  tenant_id: 'tenant_id',
  brand_id: 'brand_id',
  scan_attempt_id: 'scan_attempt_id',
  job_run_id: 'job_run_id',
  progress_percent: 'progress_percent',
  pages_fetched: 'pages_fetched',
  pages_failed: 'pages_failed',
  pages_skipped: 'pages_skipped',
  ai_availability: 'ai_availability',
  crawl_duration_ms: 'crawl_duration_ms',
  error_code: 'error_code',
} as const;

export type BrandMetricField = keyof typeof BRAND_METRIC_FIELDS;
