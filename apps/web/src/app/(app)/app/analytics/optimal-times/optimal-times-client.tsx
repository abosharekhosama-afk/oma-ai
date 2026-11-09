'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getActiveBrandId, useReloadOnBrandChange } from '../../../../../lib/active-brand';
import {
  getOptimalTimesHeatmap,
  type OptimalHeatmap,
  type OptimalSlot,
  type OptimalTimesStatus,
} from '../../../../../lib/optimal-times-api';
import { useLocale, useT } from '../../../../../lib/use-locale';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../../components/ui/error-state';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const NETWORK_ORDER = ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'whatsapp'] as const;

function formatHourClock(hour: number, isAr: boolean) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  if (isAr) {
    if (hour === 12) return '12 ظهراً';
    if (hour === 0) return '12 منتصف الليل';
    return hour < 12 ? `${h12} صباحاً` : `${h12} مساءً`;
  }
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
}

function formatWhen(dayName: string, hour: number, isAr: boolean) {
  return `${dayName} ${formatHourClock(hour, isAr)}`;
}

function slotHour(slot: OptimalSlot) {
  return Math.floor(slot.minute_of_day / 60);
}

export default function OptimalTimesClient() {
  const t = useT();
  const locale = useLocale();
  const isAr = locale.toLowerCase().startsWith('ar');
  const [brandId, setBrandId] = useState<string | null>(null);
  const [network, setNetwork] = useState<string>('');
  const [pageId, setPageId] = useState<string>('');
  const [metric, setMetric] = useState<'rate' | 'engagements'>('rate');
  const [data, setData] = useState<OptimalHeatmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOptimalTimesHeatmap({
        brandId,
        socialPageId: pageId || null,
        metric,
      });
      setData(res);
      const ids = new Set(res.pages.map((p) => p.id));
      if (!pageId || !ids.has(pageId)) {
        if (res.social_page_id) setPageId(res.social_page_id);
      }
    } catch (err) {
      setError(errorKindOf(err));
    } finally {
      setLoading(false);
    }
  }, [brandId, pageId, metric]);

  useEffect(() => {
    setBrandId(getActiveBrandId());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useReloadOnBrandChange(() => {
    setPageId('');
    setNetwork('');
    setBrandId(getActiveBrandId());
  });

  const dayNames = useMemo(
    () => Array.from({ length: 7 }, (_, d) => t(`analytics.optimal.days.${d}`)),
    [t],
  );

  const connectedNetworks = useMemo(() => {
    const present = new Set((data?.pages ?? []).map((p) => p.network));
    return NETWORK_ORDER.filter((n) => present.has(n));
  }, [data]);

  const visiblePages = useMemo(() => {
    const pages = data?.pages ?? [];
    return network ? pages.filter((p) => p.network === network) : pages;
  }, [data, network]);

  useEffect(() => {
    if (!visiblePages.length || !pageId) return;
    if (visiblePages.some((p) => p.id === pageId)) return;
    setPageId(visiblePages[0]!.id);
  }, [visiblePages, pageId]);

  const selectedPage = data?.pages.find((p) => p.id === (pageId || data.social_page_id)) ?? null;
  const sampleSize = selectedPage?.sample_size ?? data?.sample_size ?? 0;
  const status: OptimalTimesStatus = data?.status ?? 'no_data';
  const hasAccounts = (data?.pages.length ?? 0) > 0;
  const usingPriors = status !== 'ready';

  const recommended = useMemo(() => {
    const slots = data?.slots ?? [];
    if (slots.length) {
      return [...slots]
        .sort((a, b) => a.rank - b.rank || b.score - a.score)
        .slice(0, 7)
        .map((slot) => ({
          day: slot.day_of_week,
          hour: slotHour(slot),
          score: slot.score,
          n: sampleSize,
          confidence: slot.confidence,
          label: slot.label,
          source: slot.source,
        }));
    }
    if (!data) return [];
    const cells: Array<{
      day: number;
      hour: number;
      score: number;
      n: number;
      confidence: number;
      label: 'high' | 'medium' | 'low';
    }> = [];
    data.cells.forEach((row, day) => {
      row.forEach((cell, hour) => {
        cells.push({
          day,
          hour,
          score: cell.score,
          n: cell.n,
          confidence: cell.confidence,
          label: cell.confidence >= 0.6 ? 'high' : cell.confidence >= 0.3 ? 'medium' : 'low',
        });
      });
    });
    return cells.sort((a, b) => b.score - a.score).slice(0, 7);
  }, [data, sampleSize]);

  const headline = recommended[0]
    ? formatWhen(dayNames[recommended[0].day] ?? '', recommended[0].hour, isAr)
    : null;

  return (
    <div className="oma-pa oma-ot" data-testid="analytics-optimal-times" data-status={status}>
      <header className="oma-pa-top">
        <div className="oma-pa-top__start">
          <h1 className="oma-pa-title">{t('analytics.optimal.title')}</h1>
        </div>
        <Link className="oma-pa-btn oma-ot-back" href="/app/analytics">
          {t('analytics.competitors.back')}
        </Link>
      </header>

      <div className="oma-ot-body">
        <section className="oma-pa-card oma-ot-explain" data-testid="optimal-times-explain">
          <h2 className="oma-pa-card__title">{t('analytics.optimal.howItWorks')}</h2>
          <p className="oma-pa-muted">{t('analytics.optimal.howItWorksBody')}</p>
          <p className="oma-pa-muted">{t('analytics.optimal.dataSource')}</p>
          <p className="oma-pa-muted">{t('analytics.optimal.importDaily')}</p>
        </section>

        <div className="oma-ot-filters" role="toolbar" aria-label={t('analytics.optimal.title')}>
          {connectedNetworks.length > 1 ? (
            <div className="oma-pa-seg" role="group" aria-label={t('analytics.optimal.network')}>
              <button
                type="button"
                className="oma-ot-seg__btn"
                data-active={network === '' ? 'true' : 'false'}
                onClick={() => setNetwork('')}
              >
                {t('analytics.optimal.accountsAll')}
              </button>
              {connectedNetworks.map((net) => (
                <button
                  key={net}
                  type="button"
                  className="oma-ot-seg__btn"
                  data-active={network === net ? 'true' : 'false'}
                  onClick={() => setNetwork(net)}
                >
                  {t(`analytics.optimal.networks.${net}`)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="oma-pa-seg" role="group" aria-label={t('analytics.optimal.metric.rate')}>
            <button
              type="button"
              className="oma-ot-seg__btn"
              data-active={metric === 'rate' ? 'true' : 'false'}
              onClick={() => setMetric('rate')}
            >
              {t('analytics.optimal.metric.rate')}
            </button>
            <button
              type="button"
              className="oma-ot-seg__btn"
              data-active={metric === 'engagements' ? 'true' : 'false'}
              onClick={() => setMetric('engagements')}
            >
              {t('analytics.optimal.metric.engagements')}
            </button>
          </div>
          {visiblePages.length ? (
            <label className="oma-ot-select">
              <span>{t('analytics.optimal.account')}</span>
              <select
                className="oma-pa-select"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                data-testid="optimal-times-page"
              >
                {visiblePages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {t(`analytics.optimal.networks.${p.network}`)} ·{' '}
                    {t('analytics.optimal.postsAnalyzedCount').replace(
                      '{count}',
                      String(p.sample_size ?? 0),
                    )}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {loading && !data ? <p className="oma-pa-muted">{t('analytics.loading')}</p> : null}
        {error ? <ErrorState kind={error} onRetry={() => void load()} /> : null}

        {!loading && data && !hasAccounts ? (
          <p className="oma-ot-banner" data-testid="optimal-times-empty">
            {t('analytics.optimal.noAccounts')}{' '}
            <Link href="/app/brands">{t('analytics.optimal.emptyCta')}</Link>
          </p>
        ) : null}

        {data && hasAccounts ? (
          <div className="oma-ot-meta" data-testid="optimal-times-meta">
            <span className={`oma-ot-pill oma-ot-pill--${status}`}>
              {t(`analytics.optimal.status.${status}`)}
            </span>
            <span>
              {t('analytics.optimal.postsAnalyzedCount').replace('{count}', String(sampleSize))}
            </span>
            {selectedPage ? (
              <span>
                {selectedPage.name} · {t(`analytics.optimal.networks.${selectedPage.network}`)}
              </span>
            ) : null}
            <span>
              {t('analytics.optimal.timezone')}: {data.timezone}
            </span>
          </div>
        ) : null}

        {data && hasAccounts && usingPriors ? (
          <p className="oma-ot-banner oma-ot-banner--low" data-testid="optimal-times-low">
            {t('analytics.optimal.usingPriorsDetail').replace('{count}', String(sampleSize))}
          </p>
        ) : null}

        {data && hasAccounts ? (
          <div className="oma-ot-layout">
            <section className="oma-pa-card oma-ot-top-card" data-testid="optimal-times-top">
              <h2 className="oma-pa-card__title">{t('analytics.optimal.recommendedTitle')}</h2>
              {headline ? (
                <p className="oma-ot-headline" data-testid="optimal-times-headline">
                  {t('analytics.optimal.bestTime').replace('{when}', headline)}
                </p>
              ) : (
                <p className="oma-pa-muted">{t('analytics.optimal.emptyTimes')}</p>
              )}
              <ol className="oma-ot-top">
                {recommended.map((slot, i) => (
                  <li key={`${slot.day}-${slot.hour}-${i}`}>
                    <strong>
                      {i === 0
                        ? t('analytics.optimal.bestTime').replace(
                            '{when}',
                            formatWhen(dayNames[slot.day] ?? '', slot.hour, isAr),
                          )
                        : formatWhen(dayNames[slot.day] ?? '', slot.hour, isAr)}
                    </strong>
                    <span>
                      {t(`analytics.optimal.confidence.${slot.label ?? 'low'}`)} ·{' '}
                      {t('analytics.optimal.score')}: {slot.score.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="oma-pa-card oma-ot-heat-card">
              <header className="oma-pa-card__head">
                <h2 className="oma-pa-card__title">{t('analytics.optimal.heatmapTitle')}</h2>
                <div className="oma-ot-legend" aria-hidden>
                  <span>{t('analytics.optimal.legendLow')}</span>
                  <span className="oma-ot-legend__bar" />
                  <span>{t('analytics.optimal.legendHigh')}</span>
                </div>
              </header>
              <p className="oma-pa-muted oma-ot-heat-help">{t('analytics.optimal.heatmapHelp')}</p>
              <div className="oma-ot-heat-scroll">
                <div
                  className="oma-ot-heat"
                  data-testid="optimal-times-heatmap"
                  data-status={status}
                  role="grid"
                  aria-label={t('analytics.optimal.heatmapTitle')}
                >
                  <div className="oma-ot-heat__corner" />
                  {HOURS.map((h) => (
                    <div key={h} className="oma-ot-heat__h">
                      {String(h).padStart(2, '0')}
                    </div>
                  ))}
                  {dayNames.flatMap((name, d) => [
                    <div key={`d-${d}`} className="oma-ot-heat__d">
                      {name}
                    </div>,
                    ...HOURS.map((h) => {
                      const cell = data.cells[d]?.[h] ?? { score: 0, n: 0, confidence: 0 };
                      const title = `${formatWhen(name, h, isAr)} · ${t('analytics.optimal.score')} ${cell.score.toFixed(2)}`;
                      return (
                        <button
                          key={`${d}-${h}`}
                          type="button"
                          className="oma-ot-heat__cell"
                          title={title}
                          aria-label={title}
                          style={{
                            ['--ot' as string]: String(Math.max(0, Math.min(1, cell.score))),
                          }}
                        />
                      );
                    }),
                  ])}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
