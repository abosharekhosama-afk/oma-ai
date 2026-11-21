'use client';

import type { EvidenceItem } from '../../lib/brand-types';
import { stripHtmlForExcerpt } from '../../lib/profile-display';
import { useLocale, useT } from '../../lib/use-locale';
type EvidenceClarityProps = {
  evidence: EvidenceItem;
};

export function EvidenceClarity({ evidence }: EvidenceClarityProps) {
  const t = useT();
  const locale = useLocale();
  const excerpt = stripHtmlForExcerpt(evidence.excerpt_text ?? '');

  return (
    <div className="oma-evidence-clarity">
      <div className="oma-evidence-clarity__source">
        <span className="oma-muted">{t('brand.evidence.source')}</span>
        <a
          href={evidence.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="oma-ltr oma-text-link"
        >
          {evidence.page_title || evidence.canonical_url}
        </a>
      </div>
      <blockquote
        className="oma-evidence-excerpt oma-evidence-excerpt--readable"
        cite={evidence.source_url}
      >
        {excerpt || t('brand.evidence.emptyExcerpt')}
      </blockquote>
      <details className="oma-evidence-technical">
        <summary>{t('brand.evidence.technicalDetails')}</summary>
        <dl className="oma-evidence-meta">
          <div>
            <dt>{t('brand.evidence.source')}</dt>
            <dd className="oma-ltr">{evidence.canonical_url}</dd>
          </div>
          {evidence.page_title ? (
            <div>
              <dt>{t('brand.evidence.pageTitle')}</dt>
              <dd>{evidence.page_title}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t('brand.evidence.method')}</dt>
            <dd>{evidence.extraction_method}</dd>
          </div>
          <div>
            <dt>{t('brand.evidence.fetched')}</dt>
            <dd>
              <time dateTime={evidence.fetched_at}>
                {new Date(evidence.fetched_at).toLocaleString(locale)}
              </time>
            </dd>
          </div>
          <div>
            <dt>{t('brand.evidence.hash')}</dt>
            <dd>
              <code className="oma-ltr oma-evidence-hash">{evidence.content_hash}</code>
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
