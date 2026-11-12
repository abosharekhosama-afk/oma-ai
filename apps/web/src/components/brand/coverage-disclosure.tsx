'use client';

import { useT } from '../../lib/use-locale';

type CoverageSnapshot = {
  required_missing?: string[];
  unknown_fields?: string[];
  failed_pages?: { url: string; reason: string }[];
  skipped_pages?: { url: string; reason: string }[];
  pages_fetched?: number;
  pages_failed?: number;
  pages_js_rendered?: number;
  pages_js_render_attempted?: number;
  pages_js_render_failed?: number;
  js_render_errors?: string[];
  js_render_error_details?: string[];
  js_render_launch_detail?: string | null;
  js_render_mode?: string;
} | null;

/**
 * Semrush-authority coverage presentation: which subset the figure covers,
 * and what remains unknown or failed — never implied as a complete site audit.
 */
export function CoverageDisclosure({
  coverage,
  scanStatus,
}: {
  coverage: CoverageSnapshot;
  scanStatus?: string | null;
}) {
  const t = useT();
  if (!coverage && !scanStatus) return null;

  const requiredMissing = coverage?.required_missing ?? [];
  const unknownFields = coverage?.unknown_fields ?? [];
  const failed = coverage?.failed_pages ?? [];
  const skipped = coverage?.skipped_pages ?? [];

  return (
    <section className="oma-card" aria-labelledby="coverage-disclosure-title">
      <h3 id="coverage-disclosure-title">{t('brand.coverage.title')}</h3>
      <p className="oma-muted">{t('brand.coverage.subsetBody')}</p>
      {scanStatus ? (
        <p>
          <span className="oma-badge">{scanStatus}</span>
        </p>
      ) : null}
      <dl className="oma-detail-dl">
        <div>
          <dt>{t('brand.coverage.requiredMissing')}</dt>
          <dd data-testid="coverage-required-missing">
            {requiredMissing.length ? requiredMissing.join(', ') : t('brand.coverage.noneListed')}
          </dd>
        </div>
        <div>
          <dt>{t('brand.coverage.unknownFields')}</dt>
          <dd data-testid="coverage-unknown-fields">
            {unknownFields.length ? unknownFields.join(', ') : t('brand.coverage.noneListed')}
          </dd>
        </div>
        <div>
          <dt>{t('brand.coverage.failedPages')}</dt>
          <dd data-testid="coverage-failed-pages">
            {failed.length
              ? failed.map((p) => `${p.url} (${p.reason})`).join('; ')
              : t('brand.coverage.noneListed')}
          </dd>
        </div>
        <div>
          <dt>{t('brand.coverage.skippedPages')}</dt>
          <dd>
            {skipped.length
              ? skipped.map((p) => `${p.url} (${p.reason})`).join('; ')
              : t('brand.coverage.noneListed')}
          </dd>
        </div>
        {coverage?.js_render_mode && coverage.js_render_mode !== 'off' ? (
          <>
            <div>
              <dt>{t('brand.coverage.jsRender')}</dt>
              <dd data-testid="coverage-js-render">
                {t('brand.coverage.jsRenderDetail')
                  .replace('{mode}', coverage.js_render_mode)
                  .replace('{rendered}', String(coverage.pages_js_rendered ?? 0))
                  .replace('{attempted}', String(coverage.pages_js_render_attempted ?? 0))
                  .replace('{failed}', String(coverage.pages_js_render_failed ?? 0))}
              </dd>
            </div>
            {(coverage.js_render_errors?.length ?? 0) > 0 ? (
              <div>
                <dt>{t('brand.coverage.jsRenderErrors')}</dt>
                <dd data-testid="coverage-js-render-errors">
                  {coverage.js_render_errors!.join(', ')}
                </dd>
              </div>
            ) : null}
            {(coverage.js_render_error_details?.length ?? 0) > 0 ? (
              <div>
                <dt>{t('brand.coverage.jsRenderErrorDetails')}</dt>
                <dd data-testid="coverage-js-render-error-details">
                  <ul>
                    {coverage.js_render_error_details!.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            {(coverage.pages_js_render_failed ?? 0) > 0 && (coverage.pages_js_rendered ?? 0) > 0 ? (
              <p className="oma-muted" role="status">
                {t('brand.coverage.jsRenderPartialHint')}
              </p>
            ) : null}
            {coverage.js_render_errors?.includes('PLAYWRIGHT_LAUNCH_FAILED') ? (
              <div
                className="oma-banner oma-banner-warning"
                role="status"
                data-testid="coverage-js-chromium-fix"
              >
                <strong>{t('brand.coverage.chromiumFixTitle')}</strong>
                <p>{t('brand.coverage.chromiumFixBody')}</p>
                <p className="oma-muted">
                  <code>{t('brand.coverage.chromiumFixCommand')}</code>
                </p>
                {coverage.js_render_launch_detail ? (
                  <p className="oma-muted" data-testid="coverage-js-launch-detail">
                    {t('brand.coverage.chromiumFixDetail')}: {coverage.js_render_launch_detail}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </dl>
    </section>
  );
}
