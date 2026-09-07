'use client';

import type { EvidenceItem } from '../../lib/brand-types';
import { useLocale, useT } from '../../lib/use-locale';
import { ConnectorModeBanner } from './connector-mode-banner';

type EvidenceClarityProps = {
  evidence: EvidenceItem;
};

export function EvidenceClarity({ evidence }: EvidenceClarityProps) {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="oma-evidence-clarity">
      {evidence.connector_mode ? <ConnectorModeBanner mode={evidence.connector_mode} /> : null}
      <dl className="oma-evidence-meta">
        <div>
          <dt>{t('brand.evidence.source')}</dt>
          <dd>
            <a
              href={evidence.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="oma-ltr"
            >
              {evidence.canonical_url}
            </a>
          </dd>
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
            <code className="oma-ltr">{evidence.content_hash}</code>
          </dd>
        </div>
      </dl>
      <blockquote className="oma-evidence-excerpt" cite={evidence.source_url}>
        {evidence.excerpt_text}
      </blockquote>
    </div>
  );
}
