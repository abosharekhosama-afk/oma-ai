'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from './demo-disclosure';
import { EmptyState } from '../ui/empty-state';
import { PageHeader, Panel } from '../ui/page-header';
import { StatusChip } from '../ui/status-chip';
import { demoApi, demoErrorMessage, isDemoForbidden, pickCopy } from '../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../lib/use-locale';

type Strategy = DemoGraph['strategies'][number];
type Brand = DemoGraph['brands'][number];
type Campaign = DemoGraph['campaigns'][number];

/** Demo-mode strategy document canvas (not Feature 003 Brand API strategy). */
export function DemoStrategyDocument({
  brandId,
  strategyId,
}: {
  brandId: string;
  strategyId: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const graph = await demoApi<DemoGraph>('/graph');
        if (cancelled) return;
        const row =
          graph.strategies.find((s) => s.id === strategyId && s.brandId === brandId) ?? null;
        setStrategy(row);
        setBrand(graph.brands.find((b) => b.id === brandId) ?? null);
        setCampaigns(graph.campaigns.filter((c) => c.strategyId === strategyId));
        setError(row ? null : 'Not found');
      } catch (err) {
        if (cancelled) return;
        if (isDemoForbidden(err)) setUnavailable(true);
        else setError(demoErrorMessage(err, 'Demo unavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId, strategyId]);

  return (
    <div className="oma-stack" data-testid="demo-strategy-document">
      <div className="oma-breadcrumb" aria-label="Breadcrumb">
        <Link href="/app">{t('nav.home')}</Link>
        <span aria-hidden="true">/</span>
        <Link href="/app/brands">{t('nav.intelligence')}</Link>
        <span aria-hidden="true">/</span>
        <span>{brand ? pickCopy(brand.name, locale) : brandId}</span>
        <span aria-hidden="true">/</span>
        <span>{strategy ? pickCopy(strategy.name, locale) : strategyId}</span>
      </div>

      <PageHeader
        kicker={t('demo.strategy.kicker')}
        title={strategy ? pickCopy(strategy.name, locale) : t('demo.strategy.title')}
        description={t('demo.strategy.subtitle')}
        meta={
          strategy ? (
            <>
              <StatusChip status={strategy.status} />
              {strategy.isCurrent ? (
                <span className="oma-badge oma-badge-muted">{t('strategy.list.current')}</span>
              ) : null}
              <span className="oma-ltr oma-muted" data-testid="demo-strategy-id">
                {strategy.id}
              </span>
            </>
          ) : null
        }
      />

      <DemoDisclosure />

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <EmptyState title={t('demo.unavailable')} /> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {strategy ? (
        <div className="oma-strategy-document-canvas" data-testid="demo-strategy-canvas">
          <Panel title={t('demo.strategy.foundation')} priority>
            <p style={{ marginTop: 0 }}>{t('demo.strategy.foundationBody')}</p>
            <div className="oma-chip-row">
              <span className="oma-track-pill oma-track-pill--organic">{t('demo.organic')}</span>
              <span className="oma-track-pill oma-track-pill--paid">{t('demo.paid')}</span>
            </div>
          </Panel>
          <Panel title={t('demo.strategy.campaigns')}>
            {campaigns.length === 0 ? (
              <p className="oma-muted">{t('demo.empty')}</p>
            ) : (
              <ul className="oma-compact-list">
                {campaigns.map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/campaigns/${c.id}`} className="oma-compact-row">
                      <strong>{pickCopy(c.name, locale)}</strong>
                      <span
                        className={`oma-badge ${c.track === 'ORGANIC' ? 'oma-track-organic' : 'oma-track-paid'}`}
                      >
                        {c.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

export function isDemoStrategyRoute(brandId: string, strategyId: string): boolean {
  return brandId.startsWith('demo-') || strategyId.startsWith('demo-');
}
