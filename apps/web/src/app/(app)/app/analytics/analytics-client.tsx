'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NetworkIcon } from '../../../../components/content/network-icon';
import { resolveNetwork } from '../../../../components/content/post-preview-model';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../components/ui/error-state';
import {
  getActiveBrandId,
  setActiveBrandId,
  useReloadOnBrandChange,
} from '../../../../lib/active-brand';
import {
  OVERVIEW_METRICS,
  chartPoints,
  deltaTone,
  formatHours,
  formatRate,
  getContentOverview,
  getWorkAnalytics,
  matchesContentFilter,
  niceMax,
  numberFormat,
  toCsv,
  type AnalyticsPeriod,
  type ContentFilter,
  type ContentOverview,
  type OverviewMetric,
  type OverviewRow,
  type WorkAnalytics,
} from '../../../../lib/analytics-api';
import { useLocale, useT } from '../../../../lib/use-locale';

/** Calm categorical palette (tokens only, no purple). */
const SERIES_COLORS = [
  'var(--oma-primary)',
  'var(--status-success)',
  'var(--oma-home-warning)',
  'var(--status-danger)',
  'var(--oma-home-subtle)',
  'var(--oma-home-ink-3)',
];
const SOCIAL_METRICS = ['followers', 'impressions', 'engagements', 'engagement_rate'] as const;
const DAY = 86400_000;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const t = useT();
  const locale = useLocale();
  const rtl = locale === 'ar';
  const [period, setPeriod] = useState<AnalyticsPeriod>('30');
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * DAY)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [brandId, setBrandId] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[] | null>(null);
  const [cross, setCross] = useState(true);
  const [granularity, setGranularity] = useState<'day' | 'week' | null>(null);
  const [metric, setMetric] = useState<OverviewMetric>('posts');
  const [split, setSplit] = useState<'total' | 'platform'>('total');
  const [topBy, setTopBy] = useState<'comments' | 'approvals'>('comments');
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [data, setData] = useState<ContentOverview | null>(null);
  const [work, setWork] = useState<WorkAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const params = { period, from, to, brandId };
      const [overview, workData] = await Promise.all([
        getContentOverview({ ...params, channels, granularity }),
        getWorkAnalytics(params),
      ]);
      if (id !== reqId.current) return;
      setData(overview);
      setWork(workData);
    } catch (err) {
      if (id !== reqId.current) return;
      // Stale brand id from another workspace → fall back to all brands.
      if ((err as { status?: number }).status === 404 && brandId) {
        setActiveBrandId(null);
        setBrandId(null);
        return;
      }
      setError(errorKindOf(err));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [period, from, to, brandId, channels, granularity]);

  useEffect(() => {
    setBrandId(getActiveBrandId());
  }, []);
  useEffect(() => {
    if (period === 'custom' && (!from || !to || from > to)) return;
    void load();
  }, [load, period, from, to]);
  useReloadOnBrandChange(() => {
    setChannels(null);
    setBrandId(getActiveBrandId());
  });

  const nf = useMemo(() => numberFormat(locale), [locale]);
  const compact = useMemo(
    () => numberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
    [locale],
  );
  const dayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
    [locale],
  );
  const fullFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    [locale],
  );

  const available = data?.filters.available_channels ?? [];
  const selected = (ch: string) => !channels || channels.includes(ch.toLowerCase());
  function toggleChannel(ch: string) {
    const key = ch.toLowerCase();
    const all = available.map((a) => a.channel.toLowerCase());
    if (!cross) {
      setChannels([key]);
      return;
    }
    const cur = channels ?? all;
    const next = cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key];
    setChannels(next.length === 0 || next.length === all.length ? null : next);
  }
  function setCrossView(on: boolean) {
    setCross(on);
    if (on) setChannels(null);
    else if (available[0]) setChannels([available[0].channel.toLowerCase()]);
  }
  const networkLabel = (ch: string) => t(`preview.network.${resolveNetwork(ch)}`);
  const rangeLabel = data
    ? `${dayFmt.format(new Date(data.range.from))} – ${dayFmt.format(new Date(data.range.to))}`
    : '';

  function downloadCsv() {
    if (!data) return;
    const rows = data.content.rows.filter((r) => matchesContentFilter(r.content_type, filter));
    const csv = toCsv([
      [
        t('analytics.table.date'),
        t('analytics.table.channel'),
        t('analytics.perBrand'),
        t('analytics.table.post'),
        t('analytics.table.status'),
        t('analytics.metric.comments'),
        t('analytics.metric.approvals'),
        t('analytics.changesRequested'),
      ],
      ...rows.map((r) => [
        r.date.slice(0, 10),
        networkLabel(r.channel),
        r.brand_name,
        pickText(r.caption, locale) || pickText(r.title, locale),
        t(`analytics.status.${r.status}`),
        r.comments,
        r.approvals,
        r.changes_requested,
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `oma-content-${data.range.from.slice(0, 10)}_${data.range.to.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="oma-pa" data-testid="analytics-page">
      <header className="oma-pa-top">
        <div className="oma-pa-top__start">
          <h1 className="oma-pa-title">{t('analytics.title')}</h1>
          {available.length > 0 ? (
            <span className="oma-pa-stack" title={t('analytics.channels.title')}>
              {available.slice(0, 5).map((a) => (
                <span key={a.channel} className="oma-pa-stack__i">
                  <NetworkIcon channel={a.channel} size={12} />
                </span>
              ))}
              <span className="oma-pa-stack__n oma-ltr">{nf.format(available.length)}</span>
            </span>
          ) : null}
        </div>
        <div className="oma-pa-top__end">
          <div className="oma-pa-range">
            <button
              type="button"
              className="oma-pa-btn"
              aria-haspopup="dialog"
              aria-expanded={rangeOpen}
              data-testid="analytics-range"
              onClick={() => setRangeOpen((o) => !o)}
            >
              <CalendarIcon />
              <span>{rangeLabel || t(`analytics.period.${period}`)}</span>
            </button>
            <select
              className="oma-pa-select"
              aria-label={t('analytics.period')}
              data-testid="analytics-period"
              value={period}
              onChange={(e) => {
                const v = e.target.value as AnalyticsPeriod;
                setPeriod(v);
                setRangeOpen(v === 'custom');
              }}
            >
              {(['7', '30', '90', 'custom'] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`analytics.period.${p}`)}
                </option>
              ))}
            </select>
            {rangeOpen ? (
              <div className="oma-pa-range__pop" role="dialog" aria-label={t('analytics.period')}>
                {(['7', '30', '90'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="oma-pa-range__preset"
                    data-active={period === p ? 'true' : 'false'}
                    onClick={() => {
                      setPeriod(p);
                      setRangeOpen(false);
                    }}
                  >
                    {t(`analytics.period.${p}`)}
                  </button>
                ))}
                <div className="oma-pa-range__custom">
                  <label>
                    <span>{t('analytics.from')}</span>
                    <input
                      type="date"
                      value={from}
                      max={to}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setPeriod('custom');
                      }}
                    />
                  </label>
                  <label>
                    <span>{t('analytics.to')}</span>
                    <input
                      type="date"
                      value={to}
                      min={from}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setPeriod('custom');
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="oma-pa-btn oma-pa-btn--primary"
            disabled
            aria-disabled="true"
            title={t('analytics.report.soon')}
            data-tooltip={t('analytics.report.soon')}
          >
            {t('analytics.report.create')}
          </button>
        </div>
      </header>

      <div className="oma-pa-body">
        <aside className="oma-pa-side" aria-label={t('analytics.channels.title')}>
          <label className="oma-pa-cross">
            <span className="oma-pa-cross__label">
              <GridIcon /> {t('analytics.channels.cross')}
            </span>
            <input
              type="checkbox"
              role="switch"
              className="oma-pa-switch"
              checked={cross}
              onChange={(e) => setCrossView(e.target.checked)}
              data-testid="analytics-cross"
            />
          </label>
          {available.length === 0 && !loading && !error ? (
            <p className="oma-pa-side__empty">{t('analytics.channels.none')}</p>
          ) : null}
          <ul className="oma-pa-chlist">
            {available.map((a) => (
              <li key={a.channel}>
                <label className="oma-pa-ch" data-on={selected(a.channel) ? 'true' : 'false'}>
                  <NetworkIcon channel={a.channel} size={14} />
                  <span className="oma-pa-ch__name">{networkLabel(a.channel)}</span>
                  <input
                    type={cross ? 'checkbox' : 'radio'}
                    name="oma-pa-channel"
                    checked={selected(a.channel)}
                    onChange={() => toggleChannel(a.channel)}
                    aria-label={networkLabel(a.channel)}
                  />
                </label>
              </li>
            ))}
          </ul>
          <p className="oma-pa-side__note">{t('analytics.channels.note')}</p>
        </aside>

        <main className="oma-pa-main">
          {error ? (
            <ErrorState kind={error} onRetry={() => void load()} />
          ) : !data || (loading && !data) ? (
            <AnalyticsSkeleton />
          ) : (
            <div className="oma-pa-stackv" data-loading={loading ? 'true' : 'false'}>
              <div className="oma-pa-kpis" role="tablist" aria-label={t('analytics.kpis')}>
                {OVERVIEW_METRICS.map((m) => {
                  const k = data.kpis[m];
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={metric === m}
                      className="oma-pa-kpi"
                      data-active={metric === m ? 'true' : 'false'}
                      data-testid={`analytics-kpi-${m}`}
                      onClick={() => setMetric(m)}
                    >
                      <span className="oma-pa-kpi__label">{t(`analytics.metric.${m}`)}</span>
                      <span className="oma-pa-kpi__row">
                        <strong className="oma-pa-kpi__value">{nf.format(k.value)}</strong>
                        <Delta d={k.delta} locale={locale} t={t} />
                      </span>
                    </button>
                  );
                })}
              </div>

              <section className="oma-pa-card" data-testid="analytics-chart">
                <header className="oma-pa-card__head">
                  <h2 className="oma-pa-card__title">
                    {t(`analytics.metric.${metric}`)}
                    <span className="oma-pa-help" title={t(`analytics.metricHelp.${metric}`)}>
                      ?
                    </span>
                  </h2>
                  <div className="oma-pa-card__tools">
                    <div className="oma-pa-seg" role="group">
                      {(['total', 'platform'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          data-active={split === s ? 'true' : 'false'}
                          aria-pressed={split === s}
                          onClick={() => setSplit(s)}
                        >
                          {t(`analytics.split.${s}`)}
                        </button>
                      ))}
                    </div>
                    <select
                      className="oma-pa-select"
                      aria-label={t('analytics.granularity')}
                      value={granularity ?? data.granularity}
                      onChange={(e) => setGranularity(e.target.value as 'day' | 'week')}
                    >
                      <option value="day">{t('analytics.granularity.day')}</option>
                      <option value="week">{t('analytics.granularity.week')}</option>
                    </select>
                  </div>
                </header>
                <AreaChart
                  data={data}
                  metric={metric}
                  split={split}
                  rtl={rtl}
                  label={(b) => dayFmt.format(new Date(`${b}T00:00:00Z`))}
                  fmt={(n) => compact.format(n)}
                  seriesLabel={(ch) => (ch ? networkLabel(ch) : t(`analytics.metric.${metric}`))}
                  emptyLabel={t('analytics.chart.empty')}
                />
                <table className="oma-pa-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('analytics.table.channel')}</th>
                      <th scope="col" className="oma-pa-num">
                        {t(`analytics.metric.${metric}`)}
                      </th>
                      <th scope="col" className="oma-pa-num">
                        {t('analytics.table.change')}
                      </th>
                      <th scope="col" className="oma-pa-num">
                        {t('analytics.table.changePct')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((c) => {
                      const diff = c.current[metric] - c.previous[metric];
                      return (
                        <tr key={c.channel}>
                          <td>
                            <span className="oma-pa-chcell">
                              <NetworkIcon channel={c.channel} size={14} />
                              {networkLabel(c.channel)}
                            </span>
                          </td>
                          <td className="oma-pa-num">{nf.format(c.current[metric])}</td>
                          <td className="oma-pa-num">
                            <Change n={diff} nf={nf} />
                          </td>
                          <td className="oma-pa-num">
                            <Delta d={c.delta[metric]} locale={locale} t={t} plain />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">{t(`analytics.total.${metric}`)}</th>
                      <td className="oma-pa-num">{nf.format(data.kpis[metric].value)}</td>
                      <td className="oma-pa-num">
                        <Change n={data.kpis[metric].value - data.kpis[metric].previous} nf={nf} />
                      </td>
                      <td className="oma-pa-num">
                        <Delta d={data.kpis[metric].delta} locale={locale} t={t} plain />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              <section
                className="oma-pa-card oma-pa-social"
                data-testid="analytics-social-note"
                aria-labelledby="oma-pa-social-title"
              >
                <header className="oma-pa-card__head">
                  <h2 className="oma-pa-card__title" id="oma-pa-social-title">
                    {t('analytics.social.title')}
                  </h2>
                  <span className="oma-pa-chip">{t('analytics.social.notConnected')}</span>
                </header>
                <p className="oma-pa-muted">{t('analytics.socialNotConnected')}</p>
                <div className="oma-pa-tiles">
                  {SOCIAL_METRICS.map((m) => (
                    <div key={m} className="oma-pa-tile" data-empty="true">
                      <span className="oma-pa-kpi__label">{t(`analytics.social.${m}`)}</span>
                      <strong className="oma-pa-tile__value">—</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="oma-pa-card" data-testid="analytics-top">
                <header className="oma-pa-card__head">
                  <h2 className="oma-pa-card__title">{t('analytics.top.title')}</h2>
                  <div className="oma-pa-seg" role="group">
                    {(['comments', 'approvals'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        data-active={topBy === s ? 'true' : 'false'}
                        aria-pressed={topBy === s}
                        onClick={() => setTopBy(s)}
                      >
                        {t(`analytics.metric.${s}`)}
                      </button>
                    ))}
                  </div>
                </header>
                {data.top_content[topBy].length === 0 ? (
                  <p className="oma-pa-empty">{t(`analytics.top.empty.${topBy}`)}</p>
                ) : (
                  <div className="oma-pa-topgrid">
                    {data.top_content[topBy].map((r) => (
                      <TopCard
                        key={r.id}
                        row={r}
                        locale={locale}
                        date={dayFmt.format(new Date(r.date))}
                        nf={nf}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="oma-pa-card" data-testid="analytics-content-table">
                <header className="oma-pa-card__head">
                  <h2 className="oma-pa-card__title">{t('analytics.table.title')}</h2>
                  <div className="oma-pa-card__tools">
                    <button
                      type="button"
                      className="oma-pa-iconbtn"
                      onClick={downloadCsv}
                      aria-label={t('analytics.table.csv')}
                      data-tooltip={t('analytics.table.csv')}
                      data-testid="analytics-csv"
                    >
                      <DownloadIcon />
                    </button>
                    <div className="oma-pa-seg" role="group">
                      {(['all', 'posts', 'videos', 'stories'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          data-active={filter === f ? 'true' : 'false'}
                          aria-pressed={filter === f}
                          onClick={() => setFilter(f)}
                        >
                          {t(`analytics.filter.${f}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </header>
                <ContentTable
                  rows={data.content.rows.filter((r) =>
                    matchesContentFilter(r.content_type, filter),
                  )}
                  range={`${fullFmt.format(new Date(data.range.from))} – ${fullFmt.format(new Date(data.range.to))}`}
                  locale={locale}
                  nf={nf}
                  t={t}
                  when={(iso) =>
                    new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(iso))
                  }
                />
              </section>

              {work ? <WorkflowCard work={work} locale={locale} nf={nf} t={t} /> : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

type T = (k: string) => string;

function pickText(v: { en: string; ar: string }, locale: string) {
  return (locale === 'ar' ? v.ar || v.en : v.en || v.ar) || '';
}

function Delta({
  d,
  locale,
  t,
  plain,
}: {
  d: number | null;
  locale: string;
  t: T;
  plain?: boolean;
}) {
  const tone = deltaTone(d);
  const arrow = tone === 'up' ? '↑' : tone === 'down' ? '↓' : '→';
  return (
    <span className="oma-pa-delta" data-tone={tone} data-plain={plain ? 'true' : 'false'}>
      {d === null ? t('analytics.delta.new') : `${arrow} ${formatRate(Math.abs(d), locale)}`}
    </span>
  );
}

function Change({ n, nf }: { n: number; nf: Intl.NumberFormat }) {
  const tone = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  return (
    <span className="oma-pa-delta" data-tone={tone} data-plain="true">
      {n > 0 ? '↑ ' : n < 0 ? '↓ ' : ''}
      {nf.format(Math.abs(n))}
    </span>
  );
}

function AreaChart({
  data,
  metric,
  split,
  rtl,
  label,
  fmt,
  seriesLabel,
  emptyLabel,
}: {
  data: ContentOverview;
  metric: OverviewMetric;
  split: 'total' | 'platform';
  rtl: boolean;
  label: (bucket: string) => string;
  fmt: (n: number) => string;
  seriesLabel: (channel: string | null) => string;
  emptyLabel: string;
}) {
  const W = 560;
  const H = 150;
  const lines =
    split === 'total'
      ? [{ key: null as string | null, values: data.series.map((s) => s.total[metric]) }]
      : data.channels.map((c) => ({
          key: c.channel as string | null,
          values: data.series.map((s) => s.by_channel[c.channel]?.[metric] ?? 0),
        }));
  const max = niceMax(lines.flatMap((l) => l.values));
  const empty = lines.every((l) => l.values.every((v) => v === 0));
  const n = data.series.length;
  const tickEvery = Math.max(1, Math.ceil(n / 8));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <figure className="oma-pa-chart" data-empty={empty ? 'true' : 'false'}>
      <div className="oma-pa-chart__plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={seriesLabel(null)}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            let x = (e.clientX - r.left) / r.width;
            if (rtl) x = 1 - x;
            setHover(Math.max(0, Math.min(n - 1, Math.round(x * (n - 1)))));
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} className="oma-pa-chart__grid" />
          ))}
          {lines.map((l, i) => {
            const pts = chartPoints(l.values, W, H, max, rtl);
            const d = pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x},${y}`).join(' ');
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            return (
              <g key={l.key ?? 'total'}>
                {split === 'total' && pts.length > 1 ? (
                  <path
                    d={`${d} L${pts[pts.length - 1]![0]},${H} L${pts[0]![0]},${H} Z`}
                    className="oma-pa-chart__area"
                  />
                ) : null}
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
                {n <= 45
                  ? pts.map(([x, y], j) => (
                      <circle
                        key={j}
                        cx={x}
                        cy={y}
                        r={hover === j ? 3.2 : 2}
                        fill={color}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))
                  : null}
              </g>
            );
          })}
          {hover !== null ? (
            <line
              x1={rtl ? W - (hover / Math.max(1, n - 1)) * W : (hover / Math.max(1, n - 1)) * W}
              x2={rtl ? W - (hover / Math.max(1, n - 1)) * W : (hover / Math.max(1, n - 1)) * W}
              y1={0}
              y2={H}
              className="oma-pa-chart__cursor"
            />
          ) : null}
        </svg>
        <div className="oma-pa-chart__y" aria-hidden>
          {[1, 0.75, 0.5, 0.25, 0].map((g) => (
            <span key={g} className="oma-ltr">
              {fmt(Math.round(max * g))}
            </span>
          ))}
        </div>
        {empty ? <div className="oma-pa-chart__empty">{emptyLabel}</div> : null}
        {hover !== null && !empty ? (
          <div
            className="oma-pa-chart__tip"
            style={{ insetInlineStart: `${(hover / Math.max(1, n - 1)) * 100}%` }}
          >
            <strong>{label(data.series[hover]!.bucket)}</strong>
            {lines.map((l, i) => (
              <span key={l.key ?? 'total'}>
                <i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                {seriesLabel(l.key)} <b className="oma-ltr">{fmt(l.values[hover] ?? 0)}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="oma-pa-chart__x" aria-hidden>
        {data.series.map((s, i) =>
          (i % tickEvery === 0 && (n - 1 - i >= tickEvery / 2 || i === 0)) || i === n - 1 ? (
            <span key={s.bucket} style={{ insetInlineStart: `${(i / Math.max(1, n - 1)) * 100}%` }}>
              {label(s.bucket)}
            </span>
          ) : null,
        )}
      </div>
      <figcaption className="oma-pa-chart__legend">
        {lines.map((l, i) => (
          <span key={l.key ?? 'total'}>
            <i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            {seriesLabel(l.key)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function TopCard({
  row,
  locale,
  date,
  nf,
  t,
}: {
  row: OverviewRow;
  locale: string;
  date: string;
  nf: Intl.NumberFormat;
  t: T;
}) {
  const text = pickText(row.caption, locale) || pickText(row.title, locale);
  return (
    <article className="oma-pa-topcard">
      <header className="oma-pa-topcard__head">
        <NetworkIcon channel={row.channel} size={14} />
        <span className="oma-pa-topcard__brand">{row.brand_name}</span>
        <span className="oma-pa-topcard__date">{date}</span>
      </header>
      <div className="oma-pa-topcard__media">
        {row.preview_asset_url ? (
          <img src={row.preview_asset_url} alt="" loading="lazy" />
        ) : (
          <span className="oma-pa-topcard__ph" aria-hidden />
        )}
      </div>
      <p className="oma-pa-topcard__text" dir="auto">
        {text || t('analytics.table.noText')}
      </p>
      <dl className="oma-pa-topcard__metrics">
        <div>
          <dt>{t('analytics.metric.comments')}</dt>
          <dd>{nf.format(row.comments)}</dd>
        </div>
        <div>
          <dt>{t('analytics.metric.approvals')}</dt>
          <dd>{nf.format(row.approvals)}</dd>
        </div>
      </dl>
    </article>
  );
}

function ContentTable({
  rows,
  range,
  locale,
  nf,
  t,
  when,
}: {
  rows: OverviewRow[];
  range: string;
  locale: string;
  nf: Intl.NumberFormat;
  t: T;
  when: (iso: string) => string;
}) {
  const totals = rows.reduce(
    (a, r) => ({
      comments: a.comments + r.comments,
      approvals: a.approvals + r.approvals,
      changes: a.changes + r.changes_requested,
    }),
    { comments: 0, approvals: 0, changes: 0 },
  );
  if (rows.length === 0) return <p className="oma-pa-empty">{t('analytics.table.empty')}</p>;
  return (
    <div className="oma-pa-tablewrap">
      <table className="oma-pa-table oma-pa-table--content">
        <thead>
          <tr>
            <th scope="col">
              <span className="oma-sr-only">{t('analytics.table.post')}</span>
            </th>
            <th scope="col">{t('analytics.table.status')}</th>
            <th scope="col" className="oma-pa-num">
              {t('analytics.metric.comments')}
            </th>
            <th scope="col" className="oma-pa-num">
              {t('analytics.metric.approvals')}
            </th>
            <th scope="col" className="oma-pa-num">
              {t('analytics.table.changes')}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="oma-pa-table__totals">
            <th scope="row">
              <strong>{t('analytics.table.count').replace('{n}', nf.format(rows.length))}</strong>
              <span className="oma-pa-muted">{range}</span>
            </th>
            <td />
            <td className="oma-pa-num">
              <strong>{nf.format(totals.comments)}</strong>
            </td>
            <td className="oma-pa-num">
              <strong>{nf.format(totals.approvals)}</strong>
            </td>
            <td className="oma-pa-num">
              <strong>{nf.format(totals.changes)}</strong>
            </td>
          </tr>
          {rows.map((r) => {
            const text = pickText(r.caption, locale) || pickText(r.title, locale);
            return (
              <tr key={r.id}>
                <td>
                  <a className="oma-pa-post" href={`/app/content?item=${encodeURIComponent(r.id)}`}>
                    <span className="oma-pa-post__thumb">
                      {r.preview_asset_url ? (
                        <img src={r.preview_asset_url} alt="" loading="lazy" />
                      ) : null}
                    </span>
                    <span className="oma-pa-post__body">
                      <span className="oma-pa-post__meta">
                        <NetworkIcon channel={r.channel} size={12} />
                        {r.brand_name}
                        <span className="oma-pa-muted">· {when(r.date)}</span>
                      </span>
                      <span className="oma-pa-post__text" dir="auto">
                        {text || t('analytics.table.noText')}
                      </span>
                    </span>
                  </a>
                </td>
                <td>
                  <span className="oma-pa-status" data-status={r.status}>
                    {t(`analytics.status.${r.status}`)}
                  </span>
                </td>
                <td className="oma-pa-num">{r.comments ? nf.format(r.comments) : '—'}</td>
                <td className="oma-pa-num">{r.approvals ? nf.format(r.approvals) : '—'}</td>
                <td className="oma-pa-num">
                  {r.changes_requested ? nf.format(r.changes_requested) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowCard({
  work,
  locale,
  nf,
  t,
}: {
  work: WorkAnalytics;
  locale: string;
  nf: Intl.NumberFormat;
  t: T;
}) {
  const a = work.approvals.content;
  const tiles: Array<[string, string]> = [
    [t('analytics.avgTimeToApproval'), formatHours(a.avg_hours_to_approval, locale)],
    [
      t('analytics.avgRevisionRounds'),
      a.avg_revision_rounds === null ? '—' : nf.format(a.avg_revision_rounds),
    ],
    [t('analytics.rejectionRate'), formatRate(a.rejection_rate, locale)],
    [t('analytics.taskOnTimeRate'), formatRate(work.on_time.task_on_time_rate, locale)],
    [t('analytics.overduePosts'), nf.format(work.on_time.overdue_posts)],
    [t('analytics.overdueTasks'), nf.format(work.on_time.overdue_tasks)],
  ];
  return (
    <section className="oma-pa-card" data-testid="analytics-workflow">
      <header className="oma-pa-card__head">
        <h2 className="oma-pa-card__title">{t('analytics.workflow.title')}</h2>
      </header>
      <div className="oma-pa-tiles oma-pa-tiles--3">
        {tiles.map(([l, v]) => (
          <div key={l} className="oma-pa-tile">
            <span className="oma-pa-kpi__label">{l}</span>
            <strong className="oma-pa-tile__value">{v}</strong>
          </div>
        ))}
      </div>
      {work.team.length > 0 ? (
        <table className="oma-pa-table">
          <thead>
            <tr>
              <th scope="col">{t('analytics.member')}</th>
              <th scope="col" className="oma-pa-num">
                {t('analytics.postsCreated')}
              </th>
              <th scope="col" className="oma-pa-num">
                {t('analytics.approvalsGiven')}
              </th>
              <th scope="col" className="oma-pa-num">
                {t('analytics.tasksCompleted')}
              </th>
            </tr>
          </thead>
          <tbody>
            {work.team.map((m) => (
              <tr key={m.user_id}>
                <td>{m.name}</td>
                <td className="oma-pa-num">{nf.format(m.posts_created)}</td>
                <td className="oma-pa-num">{nf.format(m.approvals_given)}</td>
                <td className="oma-pa-num">{nf.format(m.tasks_completed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="oma-pa-empty">{t('analytics.teamEmpty')}</p>
      )}
    </section>
  );
}

function AnalyticsSkeleton() {
  const t = useT();
  return (
    <div
      className="oma-pa-stackv"
      data-testid="analytics-skeleton"
      role="status"
      aria-label={t('analytics.loading')}
    >
      <div className="oma-pa-kpis">
        {OVERVIEW_METRICS.map((m) => (
          <div key={m} className="oma-pa-kpi">
            <span className="oma-skeleton oma-pa-skel oma-pa-skel--short" />
            <span className="oma-skeleton oma-pa-skel oma-pa-skel--value" />
          </div>
        ))}
      </div>
      <div className="oma-pa-card">
        <span className="oma-skeleton oma-pa-skel oma-pa-skel--short" />
        <span className="oma-skeleton oma-pa-skel oma-pa-skel--chart" />
      </div>
      <div className="oma-pa-card">
        <span className="oma-skeleton oma-pa-skel oma-pa-skel--short" />
        <span className="oma-skeleton oma-pa-skel oma-pa-skel--block" />
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
