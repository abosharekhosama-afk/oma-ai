'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@oma/ui/controls';
import {
  listListeningHits,
  listListeningRules,
  type ListeningHit,
  type ListeningRule,
} from '../../../../lib/listening-api';
import { resolveActiveBrand, useActiveBrandId } from '../../../../lib/active-brand';
import { listScopedBrands } from '../../../../lib/campaign-api';
import { useT } from '../../../../lib/use-locale';
import {
  exportHitsCsv,
  formatCount,
  highlightKeywords,
  hitEngagement,
  platformLabel,
  platformShort,
  relativeDay,
  sentimentTotals,
  totalEngagement,
  volumeByDay,
  type ListeningView,
} from './listening-utils';

type SortKey = 'relevance' | 'engagement' | 'recency';
type SentimentFilter = 'all' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

function ruleForView(rules: ListeningRule[], view: ListeningView): ListeningRule | null {
  if (view === 'competitors') {
    return rules.find((r) => /competitor/i.test(r.name)) ?? rules[1] ?? rules[0] ?? null;
  }
  if (view === 'topic') {
    return rules.find((r) => /topic|hashtag/i.test(r.name)) ?? rules[0] ?? null;
  }
  return rules.find((r) => /brand/i.test(r.name)) ?? rules[0] ?? null;
}

function MentionVolumeChart({
  series,
  mode,
}: {
  series: ReturnType<typeof volumeByDay>;
  mode: 'total' | 'sentiment';
}) {
  const max = Math.max(1, ...series.map((d) => (mode === 'total' ? d.total : d.positive + d.neutral + d.negative)));
  const w = 640;
  const h = 160;
  const pad = 8;
  const step = (w - pad * 2) / Math.max(1, series.length - 1);

  const line = (key: 'positive' | 'neutral' | 'negative' | 'total', color: string) => {
    const pts = series.map((d, i) => {
      const v = mode === 'total' ? d.total : d[key as 'positive' | 'neutral' | 'negative'];
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    });
    return (
      <polyline
        key={key}
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={pts.join(' ')}
      />
    );
  };

  return (
    <div className="oma-plx-listening-chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Mention volume">
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={pad}
            x2={w - pad}
            y1={h - pad - p * (h - pad * 2)}
            y2={h - pad - p * (h - pad * 2)}
            className="oma-plx-listening-chart__grid"
          />
        ))}
        {mode === 'total' ? line('total', '#2563eb') : (
          <>
            {line('positive', '#22c55e')}
            {line('neutral', '#eab308')}
            {line('negative', '#ef4444')}
          </>
        )}
      </svg>
      <div className="oma-plx-listening-chart__x">
        {series.map((d) => (
          <span key={d.key}>{d.label}</span>
        ))}
      </div>
      {mode === 'sentiment' ? (
        <div className="oma-plx-listening-chart__legend">
          <span>
            <i className="dot dot--pos" /> Positive
          </span>
          <span>
            <i className="dot dot--neu" /> Neutral
          </span>
          <span>
            <i className="dot dot--neg" /> Negative
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SentimentBar({ positive, neutral, negative, total }: ReturnType<typeof sentimentTotals>) {
  const p = (positive / total) * 100;
  const n = (neutral / total) * 100;
  const neg = (negative / total) * 100;
  return (
    <div className="oma-plx-listening-sent-bar">
      <div className="oma-plx-listening-sent-bar__track">
        <span style={{ width: `${p}%` }} className="seg seg--pos" />
        <span style={{ width: `${n}%` }} className="seg seg--neu" />
        <span style={{ width: `${neg}%` }} className="seg seg--neg" />
      </div>
      <div className="oma-plx-listening-sent-bar__legend">
        <span>
          <i className="dot dot--pos" /> Positive
        </span>
        <span>
          <i className="dot dot--neu" /> Neutral
        </span>
        <span>
          <i className="dot dot--neg" /> Negative
        </span>
      </div>
    </div>
  );
}

export function ListeningClient({ view }: { view: ListeningView }) {
  const t = useT();
  const activeBrandId = useActiveBrandId();
  const [brandTitle, setBrandTitle] = useState('Brand');
  const [rules, setRules] = useState<ListeningRule[]>([]);
  const [hits, setHits] = useState<ListeningHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('relevance');
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [chartMode, setChartMode] = useState<'total' | 'sentiment'>('sentiment');
  const [filterOpen, setFilterOpen] = useState(false);
  const [contextDismissed, setContextDismissed] = useState(false);
  const [localSentiment, setLocalSentiment] = useState<Record<string, string>>({});
  const [dateRange] = useState('7');

  const activeRule = useMemo(() => ruleForView(rules, view), [rules, view]);

  useEffect(() => {
    void listScopedBrands()
      .then((rows) => {
        const hit = resolveActiveBrand(rows, activeBrandId);
        if (hit?.name) setBrandTitle(hit.name);
      })
      .catch(() => undefined);
  }, [activeBrandId]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('oma.listening.contextDismissed') === '1') {
        setContextDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listListeningRules();
      setRules(r.items);
      const rule = ruleForView(r.items, view);
      const params: Record<string, string | number | boolean | undefined> = { limit: 100 };
      if (view === 'alerts') params.highPriorityOnly = true;
      else if (rule) params.ruleId = rule.id;
      const h = await listListeningHits(params);
      setHits(h.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load listening');
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  const keywords = useMemo(() => {
    const fromRule = activeRule?.keywords ?? [];
    const fromHits = hits.flatMap((h) => h.matchedKeywords);
    return [...new Set([...fromRule, ...fromHits])].slice(0, 8);
  }, [activeRule, hits]);

  const filteredHits = useMemo(() => {
    let list = hits.map((h) => ({
      ...h,
      sentiment: (localSentiment[h.id] ?? h.sentiment) as ListeningHit['sentiment'],
    }));
    if (platform !== 'all') list = list.filter((h) => h.platform === platform);
    if (sentimentFilter !== 'all') list = list.filter((h) => h.sentiment === sentimentFilter);
    if (sort === 'recency') {
      list = [...list].sort(
        (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
      );
    } else if (sort === 'engagement') {
      list = [...list].sort(
        (a, b) =>
          hitEngagement(b).likes +
          hitEngagement(b).comments -
          (hitEngagement(a).likes + hitEngagement(a).comments),
      );
    } else {
      list = [...list].sort((a, b) => Number(b.isHighPriority) - Number(a.isHighPriority));
    }
    return list;
  }, [hits, platform, sentimentFilter, sort, localSentiment]);

  const series = useMemo(() => volumeByDay(filteredHits, Number(dateRange) || 7), [filteredHits, dateRange]);
  const sent = useMemo(() => sentimentTotals(filteredHits), [filteredHits]);
  const mentionCount = filteredHits.length;
  const engagementTotal = useMemo(() => totalEngagement(filteredHits), [filteredHits]);

  const pageTitle =
    view === 'brand'
      ? brandTitle
      : view === 'topic'
        ? t('listening.nav.topic') || 'Topic'
        : view === 'competitors'
          ? t('listening.nav.competitors') || 'Competitors'
          : t('listening.nav.alerts') || 'Alerts';

  const showDashboard = view === 'brand' || view === 'topic' || view === 'competitors';

  return (
    <div className="oma-plx-listening" data-testid="listening-page" data-listening-view={view}>
      <header className="oma-plx-listening__toolbar">
        <div className="oma-plx-listening__toolbar-spacer" />
        <button type="button" className="oma-plx-listening__range">
          📅 {t('listening.range7') || 'Last 7 days'}
        </button>
        <Button
          type="primary"
          size="small"
          className="oma-plx-listening__export"
          onClick={() => exportHitsCsv(filteredHits)}
        >
          ↓ {t('listening.exportCsv') || 'Export CSV'}
        </Button>
      </header>

      <div className="oma-plx-listening__intro">
        <div>
          <h1 className="oma-plx-listening__title">{pageTitle}</h1>
          {activeRule ? (
            <label className="oma-plx-listening__source">
              <span>{t('listening.source') || 'Source'}:</span>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="all">{t('listening.allPlatforms') || 'All platforms'}</option>
                <option value="META_IG">Instagram</option>
                <option value="META_FB">Facebook</option>
                <option value="TIKTOK">TikTok</option>
                <option value="LINKEDIN">LinkedIn</option>
              </select>
            </label>
          ) : null}
        </div>
        <p className="oma-plx-listening__next-check">{t('listening.nextCheck') || 'Next check in 2 days'}</p>
      </div>

      {error ? (
        <p className="oma-inbox-error" role="alert">
          {error}
        </p>
      ) : null}

      {showDashboard ? (
        <>
          <div className="oma-plx-listening-kpis">
            <article className="oma-plx-listening-kpi">
              <div className="oma-plx-listening-kpi__head">
                <span>{t('listening.kpi.mentions') || 'Mentions'}</span>
                <span className="oma-plx-listening-kpi__icon" aria-hidden>
                  @
                </span>
              </div>
              <strong className="oma-plx-listening-kpi__value">{mentionCount}</strong>
              <p className="oma-plx-listening-kpi__trend trend--up">
                ↑ 43% {t('listening.vsPrevious') || 'vs previous period'}
              </p>
            </article>
            <article className="oma-plx-listening-kpi">
              <div className="oma-plx-listening-kpi__head">
                <span>{t('listening.kpi.engagement') || 'Engagement'}</span>
                <span className="oma-plx-listening-kpi__icon" aria-hidden>
                  ⚡
                </span>
              </div>
              <strong className="oma-plx-listening-kpi__value">{formatCount(engagementTotal)}</strong>
              <p className="oma-plx-listening-kpi__trend trend--up">
                ↑ 49% {t('listening.vsPrevious') || 'vs previous period'}
              </p>
            </article>
            <article className="oma-plx-listening-kpi oma-plx-listening-kpi--sentiment">
              <div className="oma-plx-listening-kpi__head">
                <span>{t('listening.kpi.sentiment') || 'Sentiment'}</span>
                <span className="oma-plx-listening-kpi__icon" aria-hidden>
                  ☺
                </span>
              </div>
              <SentimentBar {...sent} />
            </article>
          </div>

          <section className="oma-plx-listening-panel">
            <header className="oma-plx-listening-panel__head">
              <h2>
                {t('listening.volume') || 'Mention volume'}{' '}
                <button type="button" className="oma-plx-listening-info" aria-label="Info">
                  ⓘ
                </button>
              </h2>
              <div className="oma-plx-listening-segment">
                <button
                  type="button"
                  className={chartMode === 'total' ? 'is-active' : ''}
                  onClick={() => setChartMode('total')}
                >
                  {t('listening.total') || 'Total'}
                </button>
                <button
                  type="button"
                  className={chartMode === 'sentiment' ? 'is-active' : ''}
                  onClick={() => setChartMode('sentiment')}
                >
                  {t('listening.bySentiment') || 'By sentiment'}
                </button>
              </div>
            </header>
            <MentionVolumeChart series={series} mode={chartMode} />
          </section>
        </>
      ) : null}

      <section className="oma-plx-listening-panel oma-plx-listening-mentions">
        <header className="oma-plx-listening-panel__head">
          <h2>
            {t('listening.mentions') || 'Mentions'}{' '}
            <button type="button" className="oma-plx-listening-info" aria-label="Info">
              ⓘ
            </button>
          </h2>
          <div className="oma-plx-listening-mentions__actions">
            <button type="button" className="oma-plx-listening-icon-btn" aria-label="Download" onClick={() => exportHitsCsv(filteredHits)}>
              ↓
            </button>
            <div className="oma-plx-listening-filter">
              <button
                type="button"
                className="oma-plx-listening-filter__trigger"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
              >
                {sort === 'relevance'
                  ? t('listening.sort.relevance') || 'By relevance'
                  : sort === 'engagement'
                    ? t('listening.sort.engagement') || 'By engagement'
                    : t('listening.sort.recency') || 'By recency'}
              </button>
              {filterOpen ? (
                <div className="oma-plx-listening-filter__menu" role="dialog">
                  <p className="oma-plx-listening-filter__label">{t('listening.sorting') || 'Sorting'}</p>
                  {(['relevance', 'engagement', 'recency'] as SortKey[]).map((k) => (
                    <label key={k} className="oma-plx-listening-filter__row">
                      <input
                        type="radio"
                        name="sort"
                        checked={sort === k}
                        onChange={() => setSort(k)}
                      />
                      {k === 'relevance'
                        ? t('listening.sort.relevance') || 'By relevance'
                        : k === 'engagement'
                          ? t('listening.sort.engagement') || 'By engagement'
                          : t('listening.sort.recency') || 'By recency'}
                    </label>
                  ))}
                  <p className="oma-plx-listening-filter__label">{t('listening.sentiment') || 'Sentiment'}</p>
                  {(
                    [
                      ['all', t('listening.sentiment.all') || 'All'],
                      ['POSITIVE', t('listening.sentiment.positive') || 'Positive'],
                      ['NEUTRAL', t('listening.sentiment.neutral') || 'Neutral'],
                      ['NEGATIVE', t('listening.sentiment.negative') || 'Negative'],
                    ] as const
                  ).map(([val, label]) => (
                    <label key={val} className="oma-plx-listening-filter__row">
                      <input
                        type="radio"
                        name="sentiment"
                        checked={sentimentFilter === val}
                        onChange={() => setSentimentFilter(val)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {!contextDismissed && view === 'brand' ? (
          <div className="oma-plx-listening-context">
            <div>
              <strong>{t('listening.contextTitle') || 'Add brand context for better relevance scores'}</strong>
              <p>
                {t('listening.contextBody') ||
                  'Tell us about your brand so we can rank mentions that matter most to your team.'}
              </p>
            </div>
            <div className="oma-plx-listening-context__actions">
              <button
                type="button"
                className="oma-plx-listening-link"
                onClick={() => {
                  setContextDismissed(true);
                  window.localStorage.setItem('oma.listening.contextDismissed', '1');
                }}
              >
                {t('listening.dismiss') || 'Dismiss'}
              </button>
              <Button type="primary" size="small">
                + {t('listening.addContext') || 'Add context'}
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? <div className="oma-inbox-empty">Loading…</div> : null}
        {!loading && filteredHits.length === 0 ? (
          <div className="oma-inbox-empty">
            <strong>{t('listening.emptyTitle') || 'No mentions yet'}</strong>
            <p>
              {t('listening.emptyBody') ||
                'Live rules poll platform search when credentials are configured, or run inbox demo seed.'}
            </p>
          </div>
        ) : null}

        <ul className="oma-plx-listening-feed">
          {filteredHits.map((h) => {
            const eng = hitEngagement(h);
            const sentLabel = h.sentiment ?? 'NEUTRAL';
            const parts = highlightKeywords(h.content, keywords.length ? keywords : h.matchedKeywords);
            return (
              <li key={h.id} className="oma-plx-listening-card" data-testid={`listening-hit-${h.id}`}>
                <div className="oma-plx-listening-card__top">
                  <div className="oma-plx-listening-card__author">
                    <span className="oma-plx-listening-card__avatar" aria-hidden>
                      {(h.authorName || '?').slice(0, 1).toUpperCase()}
                      <span className={`plat plat--${h.platform}`}>{platformShort(h.platform)}</span>
                    </span>
                    <div>
                      <strong>{h.authorName || 'Unknown'}</strong>
                      <span className="oma-plx-listening-card__handle">
                        {h.authorHandle || platformLabel(h.platform)} · {relativeDay(h.capturedAt)}
                      </span>
                    </div>
                  </div>
                  <details className="oma-plx-listening-sentiment-dd">
                    <summary className={`oma-plx-listening-sent-pill sent--${sentLabel.toLowerCase()}`}>
                      {sentLabel.charAt(0) + sentLabel.slice(1).toLowerCase()}
                    </summary>
                    <div className="oma-plx-listening-sentiment-dd__menu">
                      {(['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setLocalSentiment((prev) => ({ ...prev, [h.id]: s }))}
                        >
                          <i className={`dot dot--${s === 'POSITIVE' ? 'pos' : s === 'NEGATIVE' ? 'neg' : 'neu'}`} />
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
                <div className="oma-plx-listening-card__body">
                  <span className="oma-plx-listening-card__media" aria-hidden />
                  <p>
                    {parts.map((p, i) =>
                      p.highlight ? (
                        <mark key={i} className="oma-plx-listening-kw">
                          {p.text}
                        </mark>
                      ) : (
                        <span key={i}>{p.text}</span>
                      ),
                    )}
                  </p>
                </div>
                <footer className="oma-plx-listening-card__foot">
                  <span>♥ {formatCount(eng.likes)}</span>
                  <span>💬 {eng.comments}</span>
                  {h.url ? (
                    <a href={h.url} target="_blank" rel="noreferrer" className="oma-plx-listening-card__link">
                      Open
                    </a>
                  ) : null}
                </footer>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
