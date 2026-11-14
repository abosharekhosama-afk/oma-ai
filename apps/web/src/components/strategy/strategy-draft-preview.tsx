'use client';

import Link from 'next/link';
import { readFoundationText, trackListToText } from '../../lib/strategy-foundation-format';
import type { StrategyVersionDetail } from '../../lib/strategy-types';
import { useT } from '../../lib/use-locale';

type Props = {
  brandId: string;
  strategyId: string;
  version: StrategyVersionDetail;
};

export function StrategyDraftPreview({ brandId, strategyId, version }: Props) {
  const t = useT();
  const foundation = version.foundation ?? {};
  const goals = readFoundationText(foundation.goals);
  const positioning = readFoundationText(foundation.positioning);
  const keyMessages = readFoundationText(foundation.keyMessages);
  const organic = version.organic;
  const pillars = organic ? trackListToText(organic.pillars) : '';
  const channels = organic ? trackListToText(organic.channels) : '';
  const formats = organic ? trackListToText(organic.formats) : '';

  const hasContent = Boolean(goals || positioning || keyMessages || pillars || channels || formats);

  if (!hasContent) {
    return (
      <section
        className="oma-plx-listening-panel oma-plx-brand-section"
        data-testid="strategy-draft-preview-empty"
        role="status"
      >
        <p className="oma-muted">{t('strategy.draftPreview.empty')}</p>
        <Link
          href={`/app/brands/${brandId}/strategies/${strategyId}/edit`}
          className="oma-text-link"
        >
          {t('strategy.nav.foundation')}
        </Link>
      </section>
    );
  }

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section"
      data-testid="strategy-draft-preview"
    >
      <header className="oma-plx-brand-section__head">
        <div>
          <h3 className="oma-plx-brand-section__title">{t('strategy.draftPreview.title')}</h3>
          <p className="oma-muted oma-plx-brand-section__desc">{t('strategy.draftPreview.hint')}</p>
        </div>
      </header>
      <div className="oma-plx-brand-section__body oma-stack">
        {goals ? <PreviewBlock title={t('strategy.foundation.goals')} text={goals} /> : null}
        {positioning ? (
          <PreviewBlock title={t('strategy.foundation.positioning')} text={positioning} />
        ) : null}
        {keyMessages ? (
          <PreviewBlock title={t('strategy.draftPreview.keyMessages')} text={keyMessages} />
        ) : null}
        {version.organic_enabled && (pillars || channels || formats) ? (
          <PreviewBlock
            title={t('strategy.nav.organic')}
            text={[pillars, channels, formats].filter(Boolean).join('\n\n')}
          />
        ) : null}
        <Link
          href={`/app/brands/${brandId}/strategies/${strategyId}/review`}
          className="oma-text-link"
        >
          {t('strategy.draftPreview.reviewCta')}
        </Link>
      </div>
    </section>
  );
}

function PreviewBlock({ title, text }: { title: string; text: string }) {
  return (
    <div
      className="oma-plx-listening-card oma-plx-brand-insight-card"
      style={{ listStyle: 'none' }}
    >
      <h4 className="oma-h4">{title}</h4>
      <p className="oma-muted" style={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </p>
    </div>
  );
}
