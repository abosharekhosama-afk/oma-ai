'use client';

import Link from 'next/link';
import type { DiscoveredPage } from '../../lib/brand-types';
import { StatusChip, statusLabel } from '../ui/status-chip';
import { useT } from '../../lib/use-locale';

export function DiscoveryPageCard({
  page,
  evidenceId,
  onViewEvidence,
}: {
  page: DiscoveredPage;
  evidenceId?: string;
  onViewEvidence?: () => void;
}) {
  const t = useT();
  const displayUrl = page.canonical_url || page.url;
  const crawledUrl = page.url !== page.canonical_url ? page.url : null;
  const failureKey = page.failure_reason ? `brand.discovery.failure.${page.failure_reason}` : null;
  const failureLabel =
    failureKey && t(failureKey) !== failureKey ? t(failureKey) : (page.failure_reason ?? null);

  return (
    <li
      className={`oma-plx-listening-card oma-plx-brand-catalog-card oma-discovery-page-card${
        evidenceId ? ' is-selected' : ''
      }`}
      data-fetch-status={page.fetch_status}
    >
      <header className="oma-discovery-page-card__head">
        <h3 className="oma-discovery-page-card__title" dir="auto">
          {page.title?.trim() || t('brand.discovery.untitledPage')}
        </h3>
        <div className="oma-chip-row oma-discovery-page-card__chips">
          <StatusChip status={page.classification} />
          <StatusChip status={page.fetch_status} />
          {page.http_status != null ? (
            <span className="oma-badge oma-badge-muted" data-testid="discovery-page-http">
              HTTP {page.http_status}
            </span>
          ) : null}
        </div>
      </header>

      <dl className="oma-discovery-page-card__meta">
        <div>
          <dt>{t('brand.discovery.fieldUrl')}</dt>
          <dd>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="oma-ltr oma-text-link"
            >
              {displayUrl}
            </a>
          </dd>
        </div>
        {crawledUrl ? (
          <div>
            <dt>{t('brand.discovery.fieldCrawledUrl')}</dt>
            <dd className="oma-muted oma-ltr">{crawledUrl}</dd>
          </div>
        ) : null}
        {page.locale_hint ? (
          <div>
            <dt>{t('brand.discovery.fieldLocale')}</dt>
            <dd>{page.locale_hint}</dd>
          </div>
        ) : null}
        {page.content_type ? (
          <div>
            <dt>{t('brand.discovery.fieldContentType')}</dt>
            <dd className="oma-ltr">{page.content_type}</dd>
          </div>
        ) : null}
        {failureLabel ? (
          <div>
            <dt>{t('brand.discovery.fieldFailure')}</dt>
            <dd>{failureLabel}</dd>
          </div>
        ) : null}
        {page.reference_class ? (
          <div>
            <dt>{t('brand.discovery.fieldEvidenceClass')}</dt>
            <dd>{statusLabel(t, page.reference_class)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="oma-discovery-page-card__actions">
        {evidenceId && onViewEvidence ? (
          <button
            type="button"
            className="oma-text-link"
            data-testid={`view-evidence-${page.id}`}
            onClick={onViewEvidence}
          >
            {t('brand.evidence.view')}
          </button>
        ) : (
          <span className="oma-muted">{t('brand.evidence.none')}</span>
        )}
        <Link href={displayUrl} target="_blank" rel="noopener noreferrer" className="oma-text-link">
          {t('brand.discovery.openLive')}
        </Link>
      </div>
    </li>
  );
}
