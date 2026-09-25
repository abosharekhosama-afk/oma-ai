'use client';
import { SelectField } from '@oma/ui/controls';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import {
  EMPTY_ANALYTICS_FILTERS,
  filterCampaignRows,
  filterChannels,
  filterContentPerf,
  filterSeries,
  kpiDeltaTone,
  organicPaidComparison,
  percentDelta,
  sparklinePoints,
  type AnalyticsData,
  type AnalyticsFilters,
} from '../../../../lib/demo/stage6-analytics';
import { useLocale, useT } from '../../../../lib/use-locale';

function formatKpi(value: number, unit: string): string {
  if (unit === 'percent') return `${value}%`;
  if (unit === 'currency') return `AED ${value.toLocaleString()}`;
  return value.toLocaleString();
}

export default function AnalyticsPage() {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_ANALYTICS_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await demoApi<AnalyticsData>('/analytics');
      setData(next);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (isDemoForbidden(err)) setUnavailable(true);
      else setError(demoErrorMessage(err, 'Demo unavailable'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const series = useMemo(() => (data ? filterSeries(data, filters) : []), [data, filters]);
  const channels = useMemo(() => (data ? filterChannels(data, filters) : []), [data, filters]);
  const campaigns = useMemo(() => (data ? filterCampaignRows(data, filters) : []), [data, filters]);
  const contentRows = useMemo(
    () => (data ? filterContentPerf(data, filters) : []),
    [data, filters],
  );
  const comparison = useMemo(() => (data ? organicPaidComparison(data) : null), [data]);
  const organicSpark = useMemo(() => {
    const organic = series.filter((p) => p.track === 'ORGANIC').map((p) => p.impressions);
    return sparklinePoints(organic);
  }, [series]);
  const paidSpark = useMemo(() => {
    const paid = series.filter((p) => p.track === 'PAID').map((p) => p.impressions);
    return sparklinePoints(paid);
  }, [series]);

  return (
    <div className="oma-stack" data-testid="demo-analytics">
      <PageHeader
        title={t('demo.analytics.title')}
        description={t('demo.analytics.subtitle')}
        meta={
          <span className="oma-badge oma-badge-muted" data-testid="demo-analytics-sample-badge">
            {t('demo.analytics.sampleBadge')}
          </span>
        }
      />
      <DemoDisclosure
        message={data ? pickCopy(data.disclosure, locale) : t('demo.analyticsDisclosure')}
      />
      <p className="oma-honesty-inline" data-testid="demo-analytics-honesty">
        {t('demo.analytics.externalNotConnected')}
      </p>

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {data ? (
        <div className="oma-analytics-layout">
          <div className="oma-analytics-period" data-testid="demo-analytics-period">
            <span>
              {t('demo.analytics.dateRange')}: {pickCopy(data.period.label, locale)} ·{' '}
              <span className="oma-ltr">
                {data.period.start} → {data.period.end}
              </span>
            </span>
            <span data-testid="demo-analytics-comparison">
              {t('demo.analytics.comparisonPeriod')}: {pickCopy(data.previousPeriod.label, locale)}{' '}
              ·{' '}
              <span className="oma-ltr">
                {data.previousPeriod.start} → {data.previousPeriod.end}
              </span>
            </span>
            <span>
              {t('demo.analytics.lastRefresh')}:{' '}
              <span className="oma-ltr">{data.lastSimulatedRefresh}</span>
            </span>
            <span className="oma-badge oma-badge-muted">{t('demo.analytics.planningPreview')}</span>
          </div>

          <div className="oma-stage6-toolbar" data-testid="demo-analytics-filters">
            <label>
              {t('demo.filter.track')}
              <SelectField
                value={filters.track}
                data-testid="demo-analytics-filter-track"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    track: e.target.value as AnalyticsFilters['track'],
                  }))
                }
              >
                <option value="all">{t('demo.filter.all')}</option>
                <option value="ORGANIC">{t('demo.organic')}</option>
                <option value="PAID">{t('demo.paid')}</option>
              </SelectField>
            </label>
            <label>
              {t('demo.filter.channel')}
              <SelectField
                value={filters.channel}
                data-testid="demo-analytics-filter-channel"
                onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {[...new Set(data.channels.map((c) => c.channel))].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.analytics.filter.campaign')}
              <SelectField
                value={filters.campaignId}
                data-testid="demo-analytics-filter-campaign"
                onChange={(e) => setFilters((f) => ({ ...f, campaignId: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {data.campaigns.map((c) => (
                  <option key={c.campaignId} value={c.campaignId}>
                    {c.campaignId}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>

          <section className="oma-analytics-kpis" aria-label={t('demo.analytics.kpis')}>
            <div className="oma-kpi-row" data-testid="demo-analytics-kpis">
              {data.kpis.map((kpi) => {
                const delta = percentDelta(kpi.value, kpi.previous);
                const tone = kpiDeltaTone(delta, kpi.higherIsBetter);
                const dir = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
                return (
                  <div key={kpi.id} className="oma-kpi-cell">
                    <span className="oma-muted">{pickCopy(kpi.name, locale)}</span>
                    <strong className="oma-ltr">{formatKpi(kpi.value, kpi.unit)}</strong>
                    <span
                      className="oma-kpi-delta oma-ltr"
                      data-tone={tone}
                      data-dir={dir === 'flat' ? undefined : dir}
                      data-testid={`demo-analytics-kpi-delta-${kpi.id}`}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta}% vs {pickCopy(data.previousPeriod.label, locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            className="oma-chart-panel oma-analytics-primary"
            data-testid="demo-analytics-trend"
          >
            <h2>{t('demo.analytics.trend')}</h2>
            <p>{pickCopy(data.executiveSummary, locale)}</p>
            <div className="oma-chart-legend" aria-hidden="true">
              {(filters.track === 'all' || filters.track === 'ORGANIC') && organicSpark.points ? (
                <span className="oma-chart-legend-item">
                  <span className="oma-chart-legend-swatch" data-series="organic" />
                  {t('demo.organic')} (solid)
                </span>
              ) : null}
              {(filters.track === 'all' || filters.track === 'PAID') && paidSpark.points ? (
                <span className="oma-chart-legend-item">
                  <span className="oma-chart-legend-swatch" data-series="paid" />
                  {t('demo.paid')} (dashed)
                </span>
              ) : null}
            </div>
            <svg
              viewBox="0 0 320 80"
              role="img"
              aria-label={t('demo.analytics.trendSummary')}
              data-testid="demo-analytics-trend-svg"
            >
              {(filters.track === 'all' || filters.track === 'ORGANIC') && organicSpark.points ? (
                <polyline
                  fill="none"
                  stroke="var(--oma-primary)"
                  strokeWidth="2"
                  points={organicSpark.points}
                />
              ) : null}
              {(filters.track === 'all' || filters.track === 'PAID') && paidSpark.points ? (
                <polyline
                  fill="none"
                  stroke="var(--oma-ink)"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  points={paidSpark.points}
                />
              ) : null}
            </svg>
            <table className="oma-chart-sr" data-testid="demo-analytics-trend-table">
              <caption>{t('demo.analytics.trendSummary')}</caption>
              <thead>
                <tr>
                  <th>{t('demo.analytics.date')}</th>
                  <th>{t('demo.analytics.impressions')}</th>
                  <th>{t('demo.analytics.engagement')}</th>
                  <th>{t('demo.analytics.clicks')}</th>
                  <th>{t('demo.filter.track')}</th>
                </tr>
              </thead>
              <tbody>
                {series.map((p, i) => (
                  <tr key={`${p.date}-${p.track}-${i}`}>
                    <td>{p.date}</td>
                    <td>{p.impressions}</td>
                    <td>{p.engagement}</td>
                    <td>{p.clicks}</td>
                    <td>{p.track}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="oma-muted">{t('demo.analytics.chartAccessible')}</p>
          </section>

          {comparison ? (
            <section className="oma-card" data-testid="demo-analytics-organic-paid">
              <h2>{t('demo.analytics.organicPaid')}</h2>
              <div className="oma-kpi-row">
                <div className="oma-kpi-cell">
                  <span className="oma-muted">{t('demo.organic')}</span>
                  <strong className="oma-ltr">
                    {comparison.organic.impressions.toLocaleString()}
                  </strong>
                  <span className="oma-muted">{t('demo.analytics.impressions')}</span>
                </div>
                <div className="oma-kpi-cell">
                  <span className="oma-muted">{t('demo.paid')}</span>
                  <strong className="oma-ltr">
                    {comparison.paid.impressions.toLocaleString()}
                  </strong>
                  <span className="oma-muted">{t('demo.analytics.planningSampleSpend')}</span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="oma-card" data-testid="demo-analytics-channels">
            <h2>{t('demo.analytics.channels')}</h2>
            {channels.length === 0 ? (
              <EmptyState title={t('demo.empty')} body={t('demo.analytics.noData')} />
            ) : (
              <div className="oma-table-wrap">
                <table className="oma-table">
                  <thead>
                    <tr>
                      <th>{t('demo.filter.channel')}</th>
                      <th>{t('demo.filter.track')}</th>
                      <th>{t('demo.analytics.reach')}</th>
                      <th>{t('demo.analytics.engagement')}</th>
                      <th>{t('demo.analytics.clicks')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((ch) => (
                      <tr key={`${ch.channel}-${ch.track}`}>
                        <td>{ch.channel}</td>
                        <td>{ch.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}</td>
                        <td className="oma-ltr">{ch.reach.toLocaleString()}</td>
                        <td className="oma-ltr">{ch.engagement}</td>
                        <td className="oma-ltr">{ch.clicks.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="oma-card" data-testid="demo-analytics-campaigns">
            <h2>{t('demo.analytics.campaigns')}</h2>
            <div className="oma-table-wrap">
              <table className="oma-table">
                <thead>
                  <tr>
                    <th>{t('demo.analytics.filter.campaign')}</th>
                    <th>{t('demo.filter.track')}</th>
                    <th>{t('demo.analytics.impressions')}</th>
                    <th>{t('demo.analytics.sampleSpend')}</th>
                    <th>{t('demo.analytics.index')}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.campaignId} data-testid={`demo-analytics-campaign-${c.campaignId}`}>
                      <td>
                        <Link href={`/app/campaigns/${c.campaignId}`} className="oma-text-link">
                          {c.campaignId}
                        </Link>
                      </td>
                      <td>{c.track}</td>
                      <td className="oma-ltr">{c.impressions.toLocaleString()}</td>
                      <td className="oma-ltr">{c.sampleSpend.toLocaleString()}</td>
                      <td className="oma-ltr">{c.resultsIndex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="oma-card" data-testid="demo-analytics-content">
            <h2>{t('demo.analytics.contentPerf')}</h2>
            <ul className="oma-compact-list">
              {contentRows.map((item) => (
                <li key={`${item.contentId}-${item.channel}`}>
                  <Link
                    href={`/app/content?item=${item.contentId}`}
                    className="oma-compact-row"
                    data-testid={`demo-analytics-content-${item.contentId}`}
                  >
                    <strong>{item.contentId}</strong>
                    <span className="oma-muted oma-ltr">
                      {item.channel} · {item.impressions.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="oma-card">
            <h2>{t('demo.analytics.topContent')}</h2>
            <ul className="oma-compact-list">
              {data.topContent.map((item) => (
                <li key={item.contentId}>
                  <Link href={`/app/content?item=${item.contentId}`} className="oma-compact-row">
                    <strong>{pickCopy(item.label, locale)}</strong>
                    <span className="oma-muted oma-ltr">{item.metric}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="oma-card" data-testid="demo-analytics-under">
            <h2>{t('demo.analytics.underperforming')}</h2>
            <ul>
              {data.underperforming.map((u) => (
                <li key={u.contentId}>
                  <Link href={`/app/content?item=${u.contentId}`} className="oma-text-link">
                    {u.contentId}
                  </Link>
                  {' — '}
                  {pickCopy(u.reason, locale)}
                </li>
              ))}
            </ul>
          </section>

          <p className="oma-muted" data-testid="demo-analytics-source">
            {t('demo.analytics.sourcePanel')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
