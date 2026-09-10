'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../../components/demo/demo-disclosure';
import { StatusChip } from '../../../../../components/ui/status-chip';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../../lib/use-locale';

type Campaign = DemoGraph['campaigns'][number];
type ContentItem = DemoGraph['contentItems'][number];

export default function CampaignDetailPage() {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    (async () => {
      try {
        const [row, items] = await Promise.all([
          demoApi<Campaign>(`/campaigns/${campaignId}`),
          demoApi<ContentItem[]>('/content'),
        ]);
        if (cancelled) return;
        setCampaign(row);
        setContent(items.filter((c) => c.campaignId === campaignId));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (isDemoForbidden(err)) setUnavailable(true);
        else setError(demoErrorMessage(err, t('demo.unavailable')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, t]);

  return (
    <div className="oma-stack" data-testid="demo-campaign-detail">
      <header className="oma-page-header">
        <div>
          <Link href="/app/campaigns" className="oma-text-link">
            ← {t('demo.campaigns.title')}
          </Link>
          <h1>{campaign ? pickCopy(campaign.name, locale) : t('demo.campaigns.title')}</h1>
        </div>
      </header>
      <DemoDisclosure />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {campaign ? (
        <>
          <div className="oma-chip-row">
            <span
              className={`oma-badge ${campaign.track === 'ORGANIC' ? 'oma-track-organic' : 'oma-track-paid'}`}
            >
              {campaign.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}
            </span>
            <StatusChip status={campaign.status} />
          </div>
          <section className="oma-card">
            <h2>{t('demo.campaign.objective')}</h2>
            <p>{pickCopy(campaign.objective, locale)}</p>
            <h2>{t('demo.campaign.audience')}</h2>
            <p>{pickCopy(campaign.audience, locale)}</p>
            <h2>{t('demo.campaign.channels')}</h2>
            <p>{campaign.channels.join(' · ')}</p>
            <h2>{t('demo.campaign.timeline')}</h2>
            <p className="oma-ltr">
              {campaign.timeline.start} → {campaign.timeline.end}
            </p>
            <h2>{t('demo.campaign.budget')}</h2>
            <p>
              {campaign.budget.planningOnly ? t('demo.planningOnly') : null}
              {campaign.budget.amount > 0
                ? ` — ${campaign.budget.currency} ${campaign.budget.amount.toLocaleString()}`
                : null}
            </p>
            <p className="oma-muted">{t('demo.strategyLinkNote')}</p>
            <p className="oma-ltr" data-testid="demo-strategy-id">
              {campaign.strategyId}
            </p>
            <Link href="/app/brands" className="oma-text-link">
              {t('nav.intelligence')}
            </Link>
          </section>
          <section className="oma-card">
            <h2>{t('demo.campaign.kpis')}</h2>
            <ul className="oma-stack">
              {campaign.kpis.map((kpi, i) => (
                <li key={i}>
                  <div className="oma-section-head">
                    <strong>{pickCopy(kpi.name, locale)}</strong>
                    <span className="oma-muted">{kpi.target}</span>
                  </div>
                  <div className="oma-progress-track" aria-hidden="true">
                    <div
                      className="oma-progress-fill"
                      style={{ width: `${Math.round(kpi.progress * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="oma-card">
            <h2>{t('demo.campaign.content')}</h2>
            {content.length === 0 ? (
              <p className="oma-muted">{t('demo.empty')}</p>
            ) : (
              <ul className="oma-compact-list">
                {content.map((item) => (
                  <li key={item.id}>
                    <Link href="/app/content" className="oma-compact-row">
                      <strong>{pickCopy(item.title, locale)}</strong>
                      <StatusChip status={item.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
