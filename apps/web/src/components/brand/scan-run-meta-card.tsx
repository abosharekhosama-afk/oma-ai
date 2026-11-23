'use client';

import type { ScanDetail } from '../../lib/brand-types';
import { formatBrandDateTime } from '../../lib/brand-format';
import { ConnectorModeChip } from './connector-mode-banner';
import { StatusChip, statusLabel } from '../ui/status-chip';
import { useLocale, useT } from '../../lib/use-locale';

function durationMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start) return null;
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 60_000));
}

type Props = {
  scan: ScanDetail;
  testId?: string;
};

/** Compact scan run facts for discovery / evidence surfaces. */
export function ScanRunMetaCard({ scan, testId = 'scan-run-meta' }: Props) {
  const t = useT();
  const locale = useLocale();
  const started = scan.started_at;
  const finished = scan.finished_at;
  const duration = durationMinutes(started, finished);
  const maxPages = scan.coverage?.scan_max_pages ?? scan.pages_fetched;

  return (
    <section className="oma-scan-run-meta" data-testid={testId}>
      <div className="oma-scan-run-meta__head">
        <div>
          <h3 className="oma-scan-run-meta__title">{t('brand.discovery.scanRunTitle')}</h3>
          <p className="oma-muted oma-scan-run-meta__sub">
            {t('brand.discovery.scanRunSubtitle')}
          </p>
        </div>
        <div className="oma-scan-run-meta__chips">
          <StatusChip status={scan.status} label={statusLabel(t, scan.status)} />
          <ConnectorModeChip mode={scan.connector_mode} />
        </div>
      </div>
      <dl className="oma-scan-run-meta__grid">
        <div>
          <dt>{t('brand.scan.startedAt')}</dt>
          <dd>{started ? formatBrandDateTime(started, locale) : '—'}</dd>
        </div>
        <div>
          <dt>{t('brand.scan.finishedAt')}</dt>
          <dd>
            {finished
              ? formatBrandDateTime(finished, locale)
              : t('brand.scan.stillRunning')}
          </dd>
        </div>
        <div>
          <dt>{t('brand.discovery.scanDuration')}</dt>
          <dd>
            {duration != null
              ? t('brand.discovery.scanDurationValue').replace('{minutes}', String(duration))
              : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('brand.scan.pipelineProgressLabel')}</dt>
          <dd>{scan.progress_percent}%</dd>
        </div>
        <div>
          <dt>{t('brand.discovery.statsScanPages')}</dt>
          <dd>
            {t('brand.discovery.statsScanFetched')
              .replace('{fetched}', String(scan.pages_fetched))
              .replace('{max}', String(maxPages))}
          </dd>
        </div>
        {scan.discovery_summary ? (
          <div className="oma-scan-run-meta__span">
            <dt>{t('brand.discovery.tabSummary')}</dt>
            <dd className="oma-scan-run-meta__summary">
              <span>
                {t('brand.discovery.statsPages')}: {scan.discovery_summary.pages}
              </span>
              <span>
                {t('brand.discovery.statsProducts')}: {scan.discovery_summary.products}
              </span>
              <span>
                {t('brand.discovery.statsServices')}: {scan.discovery_summary.services}
              </span>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}