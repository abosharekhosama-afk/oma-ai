'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';

type Analytics = DemoGraph['analytics'];

export default function AnalyticsPage() {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await demoApi<Analytics>('/analytics');
        if (!cancelled) setData(next);
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
  }, [t]);

  return (
    <div className="oma-stack" data-testid="demo-analytics">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('demo.analytics.title')}</h1>
          <p className="oma-muted">{t('demo.analytics.subtitle')}</p>
        </div>
      </header>
      <DemoDisclosure
        message={data ? pickCopy(data.disclosure, locale) : t('demo.analyticsDisclosure')}
      />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {data ? (
        <>
          <section className="oma-card">
            <h2>{t('demo.analytics.title')}</h2>
            <p>{pickCopy(data.executiveSummary, locale)}</p>
          </section>
          <section className="oma-card">
            <h2>{t('demo.analytics.channels')}</h2>
            <div className="oma-table-wrap">
              <table className="oma-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Track</th>
                    <th>Reach</th>
                    <th>Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.map((ch) => (
                    <tr key={ch.channel}>
                      <td>{ch.channel}</td>
                      <td>{ch.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}</td>
                      <td className="oma-ltr">{ch.reach.toLocaleString()}</td>
                      <td className="oma-ltr">{ch.engagement}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="oma-card">
            <h2>{t('demo.analytics.kpis')}</h2>
            <ul className="oma-stack">
              {data.kpiProgress.map((kpi, i) => {
                const pct = Math.min(100, Math.round((kpi.value / kpi.target) * 100));
                return (
                  <li key={i}>
                    <div className="oma-section-head">
                      <strong>{pickCopy(kpi.name, locale)}</strong>
                      <span className="oma-muted oma-ltr">
                        {kpi.value} / {kpi.target}
                      </span>
                    </div>
                    <div className="oma-progress-track" aria-hidden="true">
                      <div className="oma-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="oma-card">
            <h2>{t('demo.analytics.topContent')}</h2>
            <ul className="oma-compact-list">
              {data.topContent.map((item) => (
                <li key={item.contentId}>
                  <Link href="/app/content" className="oma-compact-row">
                    <strong>{item.contentId}</strong>
                    <span className="oma-muted oma-ltr">{item.metric}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
