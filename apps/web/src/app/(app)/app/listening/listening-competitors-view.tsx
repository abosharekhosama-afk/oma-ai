'use client';

import { useCallback, useEffect, useState } from 'react';
import { InfoCircleOutlined } from '../../../../components/ui/lucide-icons';
import { useActiveBrandId } from '../../../../lib/active-brand';
import {
  getListeningCompetitors,
  type ListeningCompetitorDashboard,
} from '../../../../lib/listening-api';
import { useLocale, useT } from '../../../../lib/use-locale';
import { ListeningDateRange, resolveDateRange, type DateRangeValue } from './listening-date-range';
import { ListeningSourceMenu } from './listening-source-menu';
import { formatCount } from './listening-utils';

const PALETTE = ['#1570ef', '#ee46bc', '#f79009', '#0e9f95', '#7a5af8'];

function formatTrend(pct: number | null) {
  if (pct == null) return '—';
  const sign = pct >= 0 ? '↑' : '↓';
  return `${sign} ${Math.abs(pct)}%`;
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 28 - (v / max) * 24;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg className="oma-plx-listening-comp__spark" viewBox="0 0 100 32" aria-hidden>
      <polyline points={pts} fill="none" stroke="#d1d5db" strokeWidth="2" />
    </svg>
  );
}

function ShareDonut({
  entities,
  total,
}: {
  entities: ListeningCompetitorDashboard['entities'];
  total: number;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="oma-plx-listening-comp__donut-wrap">
      <svg viewBox="0 0 120 120" className="oma-plx-listening-comp__donut" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="14" />
        {entities.map((e, i) => {
          const frac = total ? e.mentions / total : 0;
          const dash = c * frac;
          const el = (
            <circle
              key={e.ruleId}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="14"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="oma-plx-listening-comp__donut-center">
        <strong className="oma-ltr">{formatCount(total)}</strong>
        <span>Mentions</span>
      </div>
    </div>
  );
}

function SentimentStack({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const total = positive + neutral + negative || 1;
  const p = (positive / total) * 100;
  const n = (neutral / total) * 100;
  const neg = (negative / total) * 100;
  return (
    <div className="oma-plx-listening-comp__sent-track">
      <span className="seg seg--pos" style={{ width: `${p}%` }} />
      <span className="seg seg--neu" style={{ width: `${n}%` }} />
      <span className="seg seg--neg" style={{ width: `${neg}%` }} />
    </div>
  );
}

const BUCKET_LABEL: Record<string, { en: string; ar: string }> = {
  leading: { en: 'Leading', ar: 'رائد' },
  under_fire: { en: 'Under fire', ar: 'تحت الضغط' },
  well_liked: { en: 'Well-liked', ar: 'محبوب' },
  quiet: { en: 'Quiet', ar: 'هادئ' },
};

export function ListeningCompetitorsView() {
  const t = useT();
  const locale = useLocale();
  const ar = locale.startsWith('ar');
  const brandId = useActiveBrandId();
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => resolveDateRange('7'));
  const [platforms, setPlatforms] = useState<Set<string>>(() => new Set());
  const [data, setData] = useState<ListeningCompetitorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricTab, setMetricTab] = useState<'mentions' | 'engagement'>('mentions');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getListeningCompetitors({
        brandId: brandId || undefined,
        from: dateRange.start.toISOString(),
        to: dateRange.end.toISOString(),
        platforms: platforms.size ? [...platforms].join(',') : undefined,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load competitors');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [brandId, dateRange, platforms]);

  useEffect(() => {
    void load();
  }, [load]);

  const entities = data?.entities ?? [];
  const totalMentions = data?.totals.mentions ?? 0;

  return (
    <div
      className="oma-plx-listening oma-plx-listening-comp"
      data-testid="listening-competitors-page"
    >
      <header className="oma-plx-listening__toolbar">
        <div className="oma-plx-listening__toolbar-spacer" />
        <ListeningDateRange value={dateRange} onChange={setDateRange} />
      </header>

      <div className="oma-plx-listening__intro">
        <div>
          <h1 className="oma-plx-listening__title">
            {t('listening.nav.competitors') || (ar ? 'المنافسون' : 'Competitors')}
          </h1>
          <ListeningSourceMenu selected={platforms} onChange={setPlatforms} />
        </div>
      </div>

      {error ? (
        <p className="oma-inbox-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? <p className="oma-muted">{ar ? 'جاري التحميل…' : 'Loading…'}</p> : null}

      {data ? (
        <>
          <section className="oma-plx-listening-panel oma-plx-listening-comp__volume">
            <header className="oma-plx-listening-panel__head">
              <h2>{ar ? 'حجم الإشارات' : 'Mention volume'}</h2>
              <div className="oma-plx-listening-segment">
                <button
                  type="button"
                  className={metricTab === 'mentions' ? 'is-active' : ''}
                  onClick={() => setMetricTab('mentions')}
                >
                  {ar ? 'إشارات' : 'Mentions'}
                </button>
                <button
                  type="button"
                  className={metricTab === 'engagement' ? 'is-active' : ''}
                  onClick={() => setMetricTab('engagement')}
                >
                  {ar ? 'تفاعل' : 'Engagement'}
                </button>
              </div>
            </header>
            <div className="oma-plx-listening-comp__entity-row">
              {entities.map((e, i) => (
                <article key={e.ruleId} className="oma-plx-listening-comp__entity">
                  <span
                    className="oma-plx-listening-comp__dot"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                    aria-hidden
                  />
                  <h3>
                    {e.name}
                    {e.isYou ? <small>{ar ? ' · أنت' : ' · You'}</small> : null}
                  </h3>
                  <strong className="oma-ltr">
                    {formatCount(metricTab === 'mentions' ? e.mentions : e.engagement)}
                  </strong>
                  <p
                    className={`oma-plx-listening-kpi__trend ${
                      (metricTab === 'mentions'
                        ? (e.mentionsTrendPct ?? 0)
                        : (e.engagementTrendPct ?? 0)) >= 0
                        ? 'trend--up'
                        : 'trend--down'
                    }`}
                  >
                    {formatTrend(
                      metricTab === 'mentions' ? e.mentionsTrendPct : e.engagementTrendPct,
                    )}
                  </p>
                  <Sparkline values={e.sparkline} />
                </article>
              ))}
            </div>
          </section>

          <div className="oma-plx-listening-comp__grid">
            <section className="oma-plx-listening-panel oma-plx-listening-comp__quadrant">
              <header className="oma-plx-listening-panel__head">
                <h2>{ar ? 'موقعك' : 'Where you stand'}</h2>
                <InfoCircleOutlined aria-hidden />
              </header>
              <div className="oma-plx-listening-comp__matrix">
                {(['under_fire', 'leading', 'quiet', 'well_liked'] as const).map((bucket) => (
                  <div
                    key={bucket}
                    className={`oma-plx-listening-comp__quad oma-plx-listening-comp__quad--${bucket}`}
                  >
                    <span className="oma-plx-listening-comp__quad-label">
                      {ar ? BUCKET_LABEL[bucket].ar : BUCKET_LABEL[bucket].en}
                    </span>
                    <div className="oma-plx-listening-comp__quad-chips">
                      {(data.quadrant ?? [])
                        .filter((q) => q.bucket === bucket)
                        .map((q) => (
                          <span key={q.ruleId} className={q.isYou ? 'is-you' : ''} title={q.name}>
                            {q.name.slice(0, 1).toUpperCase()}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="oma-plx-listening-panel oma-plx-listening-comp__sov">
              <header className="oma-plx-listening-panel__head">
                <h2>{ar ? 'حصة الصوت' : 'Share of voice'}</h2>
              </header>
              <div className="oma-plx-listening-comp__sov-body">
                <ShareDonut entities={entities} total={totalMentions} />
                <table>
                  <tbody>
                    {entities.map((e, i) => (
                      <tr key={e.ruleId}>
                        <td>
                          <span
                            className="oma-plx-listening-comp__dot"
                            style={{ background: PALETTE[i % PALETTE.length] }}
                            aria-hidden
                          />
                          {e.name}
                          {e.isYou ? ` (${ar ? 'أنت' : 'You'})` : ''}
                        </td>
                        <td className="oma-ltr">{e.sharePct}%</td>
                        <td className="oma-ltr">
                          {e.shareChangePts >= 0 ? '+' : ''}
                          {e.shareChangePts} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="oma-plx-listening-panel oma-plx-listening-comp__sentiment">
              <header className="oma-plx-listening-panel__head">
                <h2>{ar ? 'المشاعر' : 'Sentiment'}</h2>
              </header>
              <table className="oma-plx-listening-comp__sent-table">
                <thead>
                  <tr>
                    <th>{ar ? 'العلامة' : 'Brand'}</th>
                    <th>{ar ? 'المشاعر' : 'Sentiment'}</th>
                    <th>{ar ? 'إشارات' : 'Mentions'}</th>
                    <th>{ar ? 'التوازن' : 'Balance'}</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((e, i) => (
                    <tr key={e.ruleId}>
                      <td>
                        <span
                          className="oma-plx-listening-comp__dot"
                          style={{ background: PALETTE[i % PALETTE.length] }}
                          aria-hidden
                        />
                        {e.name}
                      </td>
                      <td>
                        <SentimentStack
                          positive={e.sentiment.positive}
                          neutral={e.sentiment.neutral}
                          negative={e.sentiment.negative}
                        />
                      </td>
                      <td className="oma-ltr">{e.mentions}</td>
                      <td className="oma-ltr">
                        {e.sentiment.balance >= 0 ? '+' : ''}
                        {e.sentiment.balance} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="oma-plx-listening-panel oma-plx-listening-comp__source">
              <header className="oma-plx-listening-panel__head">
                <h2>{ar ? 'حسب المصدر' : 'Share by source'}</h2>
              </header>
              <table className="oma-plx-listening-comp__source-table">
                <thead>
                  <tr>
                    <th>{ar ? 'المصدر' : 'Source'}</th>
                    <th>{ar ? 'توزيع العلامات' : 'Brand split'}</th>
                    <th>{ar ? 'إشارات' : 'Mentions'}</th>
                    <th>{ar ? 'حصتك' : 'Your share'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.bySource ?? []).map((row) => (
                    <tr key={row.platform}>
                      <td>{row.label}</td>
                      <td>
                        <div className="oma-plx-listening-comp__split-bar">
                          {row.splits
                            .filter((s) => s.mentions > 0)
                            .map((s, i) => {
                              const w = row.mentions ? (s.mentions / row.mentions) * 100 : 0;
                              const idx = entities.findIndex((e) => e.ruleId === s.ruleId);
                              return (
                                <span
                                  key={s.ruleId}
                                  style={{
                                    width: `${w}%`,
                                    background:
                                      PALETTE[idx >= 0 ? idx % PALETTE.length : i % PALETTE.length],
                                  }}
                                  title={s.name}
                                />
                              );
                            })}
                        </div>
                      </td>
                      <td className="oma-ltr">{row.mentions}</td>
                      <td className="oma-ltr">{row.yourSharePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
