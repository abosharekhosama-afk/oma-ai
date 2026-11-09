'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getActiveBrandId, useReloadOnBrandChange } from '../../../../../lib/active-brand';
import { getOptimalTimesHeatmap, type OptimalHeatmap } from '../../../../../lib/optimal-times-api';
import { useT } from '../../../../../lib/use-locale';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../../components/ui/error-state';

const NETWORKS = ['instagram', 'facebook', 'x', 'linkedin', 'tiktok'] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function OptimalTimesClient() {
  const t = useT();
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
        network: network || null,
        metric,
      });
      setData(res);
      if (!pageId && res.social_page_id) setPageId(res.social_page_id);
    } catch (err) {
      setError(errorKindOf(err));
    } finally {
      setLoading(false);
    }
  }, [brandId, network, pageId, metric]);

  useEffect(() => {
    setBrandId(getActiveBrandId());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useReloadOnBrandChange(() => {
    setPageId('');
    setBrandId(getActiveBrandId());
  });

  const dayNames = useMemo(
    () => Array.from({ length: 7 }, (_, d) => t(`analytics.optimal.days.${d}`)),
    [t],
  );

  const tops = useMemo(() => {
    if (!data) return [];
    const cells: Array<{
      day: number;
      hour: number;
      score: number;
      n: number;
      confidence: number;
    }> = [];
    data.cells.forEach((row, day) => {
      row.forEach((cell, hour) => {
        cells.push({ day, hour, score: cell.score, n: cell.n, confidence: cell.confidence });
      });
    });
    return cells.sort((a, b) => b.score - a.score).slice(0, 7);
  }, [data]);

  return (
    <div className="oma-pa oma-ot" data-testid="analytics-optimal-times">
      <header className="oma-pa-top">
        <div className="oma-pa-top__start">
          <h1 className="oma-pa-title">{t('analytics.optimal.title')}</h1>
          <p className="oma-pa-muted">{t('analytics.optimal.subtitle')}</p>
        </div>
        <Link className="oma-pa-btn oma-ot-back" href="/app/analytics">
          {t('analytics.competitors.back')}
        </Link>
      </header>

      <div className="oma-ot-filters" role="toolbar" aria-label={t('analytics.optimal.title')}>
        <div className="oma-ot-seg" role="group" aria-label={t('analytics.optimal.network')}>
          {NETWORKS.map((net) => (
            <button
              key={net}
              type="button"
              className="oma-ot-seg__btn"
              data-active={network === net ? 'true' : 'false'}
              onClick={() => {
                setNetwork((cur) => (cur === net ? '' : net));
                setPageId('');
              }}
            >
              {net === 'x' ? 'X' : net[0]!.toUpperCase() + net.slice(1)}
            </button>
          ))}
        </div>
        <div className="oma-ot-seg" role="group" aria-label={t('analytics.optimal.metric.rate')}>
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
        {data?.pages.length ? (
          <label className="oma-ot-select">
            <span>{t('analytics.optimal.account')}</span>
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              data-testid="optimal-times-page"
            >
              {data.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.network})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {loading && !data ? <p className="oma-pa-muted">{t('analytics.loading')}</p> : null}
      {error ? <ErrorState kind={error} onRetry={() => void load()} /> : null}

      {data && data.status === 'no_data' ? (
        <p className="oma-ot-banner" data-testid="optimal-times-empty">
          {t('analytics.optimal.empty')}{' '}
          <Link href="/app/select-company">{t('analytics.optimal.emptyCta')}</Link>
        </p>
      ) : null}
      {data && data.status === 'low_data' ? (
        <p className="oma-ot-banner oma-ot-banner--low" data-testid="optimal-times-low">
          {t('analytics.optimal.lowData')}
        </p>
      ) : null}

      {data ? (
        <div className="oma-ot-layout">
          <ol className="oma-ot-top" data-testid="optimal-times-top">
            {tops.map((slot, i) => (
              <li key={`${slot.day}-${slot.hour}`}>
                <strong>
                  {i + 1}. {dayNames[slot.day]} {String(slot.hour).padStart(2, '0')}:00
                </strong>
                <span>
                  {t('analytics.optimal.score')}: {slot.score.toFixed(2)} · {slot.n}{' '}
                  {t('analytics.optimal.samples')}
                </span>
              </li>
            ))}
          </ol>

          <div
            className="oma-ot-heat"
            data-testid="optimal-times-heatmap"
            data-status={data.status}
            role="grid"
            aria-label={t('analytics.optimal.title')}
          >
            <div className="oma-ot-heat__corner" />
            {HOURS.map((h) => (
              <div key={h} className="oma-ot-heat__h">
                {String(h).padStart(2, '0')}
              </div>
            ))}
            {dayNames.map((name, d) => (
              <div key={name} className="oma-ot-heat__row">
                <div className="oma-ot-heat__d">{name}</div>
                {HOURS.map((h) => {
                  const cell = data.cells[d]?.[h] ?? { score: 0, n: 0, confidence: 0 };
                  const title = `${name} ${String(h).padStart(2, '0')}:00 · n=${cell.n} · ${cell.score.toFixed(2)}`;
                  return (
                    <button
                      key={h}
                      type="button"
                      className="oma-ot-heat__cell"
                      title={title}
                      aria-label={title}
                      style={{ ['--ot' as string]: String(Math.max(0, Math.min(1, cell.score))) }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
