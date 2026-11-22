'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStrategyPlan } from '../../lib/strategy-plan-api';
import { readFoundationText, trackListToText } from '../../lib/strategy-foundation-format';
import type { StrategyVersionDetail } from '../../lib/strategy-types';
import { useLocale, useT } from '../../lib/use-locale';

type Props = {
  brandId: string;
  strategyId: string;
  version: StrategyVersionDetail;
};

export function StrategyDraftPreview({ brandId, strategyId, version }: Props) {
  const t = useT();
  const locale = useLocale();
  const foundation = version.foundation ?? {};
  const goals = readFoundationText(foundation.goals);
  const positioning = readFoundationText(foundation.positioning);
  const keyMessages = readFoundationText(foundation.keyMessages);
  const organic = version.organic;
  const [organicV2, setOrganicV2] = useState<{
    pillars: string;
    channels: string;
    formats: string;
  } | null>(null);
  // v2 plan is the source of truth (DEC-029 4.1); legacy lists only before migration.
  const pillars = organicV2?.pillars || (organic ? trackListToText(organic.pillars) : '');
  const channels = organicV2?.channels || (organic ? trackListToText(organic.channels) : '');
  const formats = organicV2?.formats || (organic ? trackListToText(organic.formats) : '');

  const [paidSummary, setPaidSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!version.paid_enabled && !version.organic_enabled) {
      setPaidSummary(null);
      setOrganicV2(null);
      return;
    }
    let cancelled = false;
    void getStrategyPlan(brandId, strategyId, version.id)
      .then((res) => {
        if (cancelled) return;
        const org = res.data.organic;
        const cadence = (org.cadence ?? []).filter((c) => c.posts_per_week > 0);
        setOrganicV2({
          pillars: org.pillars.map((p) => (locale === 'ar' ? p.name_ar : p.name_en)).join('\n'),
          channels: cadence
            .map((c) => `${c.channel} · ${c.posts_per_week}/${t('strategy.plan.cadence.week')}`)
            .join('\n'),
          formats: [...new Set(cadence.flatMap((c) => c.formats))].join('\n'),
        });
        if (!version.paid_enabled) {
          setPaidSummary(null);
          return;
        }
        const paid = res.data.paid;
        const lines: string[] = [];
        if (paid.budget_amount) {
          lines.push(
            `${t('strategy.paid.budget')}: ${paid.budget_amount} ${paid.budget_currency ?? ''}`.trim(),
          );
        }
        if (paid.allocations.length > 0) {
          lines.push(
            paid.allocations.map((a) => `${a.platform}/${a.objective} ${a.share_pct}%`).join(' · '),
          );
        }
        if (paid.audiences.length > 0) {
          lines.push(paid.audiences.map((a) => a.name).join(' · '));
        }
        if (paid.experiments.length > 0) {
          lines.push(paid.experiments.map((e) => e.name).join(' · '));
        }
        setPaidSummary(lines.length ? lines.join('\n\n') : null);
      })
      .catch(() => {
        if (!cancelled) setPaidSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [brandId, strategyId, version.id, version.paid_enabled, version.organic_enabled, locale, t]);

  const hasContent = Boolean(
    goals || positioning || keyMessages || pillars || channels || formats || paidSummary,
  );

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
        {version.paid_enabled && paidSummary ? (
          <PreviewBlock title={t('strategy.nav.paid')} text={paidSummary} />
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
