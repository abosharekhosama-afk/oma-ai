'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@oma/ui/controls';
import {
  AtSignOutlined,
  BarChartOutlined,
  CommentOutlined,
  DownOutlined,
  DownloadOutlined,
  FilterOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
  SmileOutlined,
  ZapOutlined,
} from '../../../../components/ui/lucide-icons';
import {
  listListeningHits,
  listListeningRules,
  type ListeningHit,
  type ListeningRule,
} from '../../../../lib/listening-api';
import { resolveActiveBrand, useActiveBrandId } from '../../../../lib/active-brand';
import { listScopedBrands } from '../../../../lib/campaign-api';
import { useT } from '../../../../lib/use-locale';
import { ListeningDateRange, resolveDateRange, type DateRangeValue } from './listening-date-range';
import { ListeningSourceMenu } from './listening-source-menu';
import { ListeningVolumeChart } from './listening-volume-chart';
import {
  exportHitsCsv,
  formatCount,
  highlightKeywords,
  hitEngagement,
  hitInDateRange,
  hitThumbnail,
  isNewHit,
  platformLabel,
  platformShort,
  relativeDay,
  sentimentTotals,
  totalEngagement,
  volumeByDateRange,
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

function SentimentPill({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (s: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE') => void;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const label =
    value === 'POSITIVE'
      ? t('listening.sentiment.positive') || 'Positive'
      : value === 'NEGATIVE'
        ? t('listening.sentiment.negative') || 'Negative'
        : t('listening.sentiment.neutral') || 'Neutral';
  return (
    <div className="oma-plx-listening-sentiment-dd">
      <button
        type="button"
        className={`oma-plx-listening-sent-pill sent--${value.toLowerCase()}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
        <DownOutlined />
      </button>
      {open ? (
        <div className="oma-plx-listening-sentiment-dd__menu" role="menu">
          {(['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              <i className={`dot dot--${s === 'POSITIVE' ? 'pos' : s === 'NEGATIVE' ? 'neg' : 'neu'}`} />
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      ) : null}
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
  const [platforms, setPlatforms] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<SortKey>('relevance');
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [chartMode, setChartMode] = useState<'total' | 'sentiment'>('sentiment');
  const [filterOpen, setFilterOpen] = useState(false);
  const [contextDismissed, setContextDismissed] = useState(false);
  const [localSentiment, setLocalSentiment] = useState<Record<string, string>>({});
  const [chartDayIndex, setChartDayIndex] = useState<number | null>(null);
  const [hideOwnMentions, setHideOwnMentions] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => resolveDateRange('7'));

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
    list = list.filter((h) => hitInDateRange(h, dateRange.start, dateRange.end));
    if (platforms.size > 0) list = list.filter((h) => platforms.has(h.platform));
    if (sentimentFilter !== 'all') list = list.filter((h) => h.sentiment === sentimentFilter);
    if (hideOwnMentions) list = list.filter((h) => !/^(oma|team|brand)/i.test(h.authorHandle || ''));
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
  }, [
    hits,
    platforms,
    sentimentFilter,
    sort,
    localSentiment,
    dateRange,
    hideOwnMentions,
    showHidden,
    showExcluded,
  ]);

  const series = useMemo(
    () => volumeByDateRange(filteredHits, dateRange.start, dateRange.end),
    [filteredHits, dateRange],
  );
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
        <ListeningDateRange value={dateRange} onChange={setDateRange} />
        <Button
          type="primary"
          size="small"
          className="oma-plx-listening__export"
          onClick={() => exportHitsCsv(filteredHits)}
        >
          <DownloadOutlined />
          {t('listening.exportCsv') || 'Export CSV'}
        </Button>
      </header>

      <div className="oma-plx-listening__intro">
        <div>
          <h1 className="oma-plx-listening__title">{pageTitle}</h1>
          {activeRule ? <ListeningSourceMenu selected={platforms} onChange={setPlatforms} /> : null}
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
                  <AtSignOutlined />
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
                  <ZapOutlined />
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
                  <SmileOutlined />
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
                  <InfoCircleOutlined />
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
            <ListeningVolumeChart
              series={series}
              mode={chartMode}
              selectedIndex={chartDayIndex}
              onSelectIndex={setChartDayIndex}
            />
          </section>
        </>
      ) : null}

      <section className="oma-plx-listening-panel oma-plx-listening-mentions">
        <header className="oma-plx-listening-panel__head">
          <h2>
            {t('listening.mentions') || 'Mentions'}{' '}
            <button type="button" className="oma-plx-listening-info" aria-label="Info">
              <InfoCircleOutlined />
            </button>
          </h2>
          <div className="oma-plx-listening-mentions__actions">
            <button
              type="button"
              className="oma-plx-listening-icon-btn"
              aria-label="Download"
              onClick={() => exportHitsCsv(filteredHits)}
            >
              <DownloadOutlined />
            </button>
            <button type="button" className="oma-plx-listening-icon-btn" aria-label="Hide">
              <MinusCircleOutlined />
            </button>
            <div className="oma-plx-listening-filter">
              <button
                type="button"
                className="oma-plx-listening-filter__trigger"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
              >
                <FilterOutlined />
                {sort === 'relevance'
                  ? t('listening.sort.relevance') || 'By relevance'
                  : sort === 'engagement'
                    ? t('listening.sort.engagement') || 'By engagement'
                    : t('listening.sort.recency') || 'By recency'}
                <DownOutlined />
              </button>
              {filterOpen ? (
                <div className="oma-plx-listening-filter__menu" role="dialog">
                  <p className="oma-plx-listening-filter__label">{t('listening.sorting') || 'Sorting'}</p>
                  {(['relevance', 'engagement', 'recency'] as SortKey[]).map((k) => (
                    <label key={k} className="oma-plx-listening-filter__row">
                      <input type="radio" name="sort" checked={sort === k} onChange={() => setSort(k)} />
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
                  <p className="oma-plx-listening-filter__label">{t('listening.options') || 'Options'}</p>
                  <label className="oma-plx-listening-filter__row">
                    <input type="checkbox" checked={hideOwnMentions} onChange={(e) => setHideOwnMentions(e.target.checked)} />
                    {t('listening.opt.hideOwn') || 'Hide own mentions'}
                  </label>
                  <label className="oma-plx-listening-filter__row">
                    <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                    {t('listening.opt.showHidden') || 'Show hidden mentions'}
                  </label>
                  <label className="oma-plx-listening-filter__row">
                    <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
                    {t('listening.opt.showExcluded') || 'Show excluded sources'}
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {!contextDismissed && view === 'brand' ? (
          <div className="oma-plx-listening-context">
            <InfoCircleOutlined className="oma-plx-listening-context__icon" aria-hidden />
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
            const sentLabel = (h.sentiment ?? 'NEUTRAL') as string;
            const parts = highlightKeywords(h.content, keywords.length ? keywords : h.matchedKeywords);
            const thumb = hitThumbnail(h);
            return (
              <li key={h.id} className="oma-plx-listening-card" data-testid={`listening-hit-${h.id}`}>
                <div className="oma-plx-listening-card__top">
                  <div className="oma-plx-listening-card__author">
                    <span className="oma-plx-listening-card__avatar" aria-hidden>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb} alt="" />
                      <span className={`plat plat--${h.platform}`}>{platformShort(h.platform)}</span>
                    </span>
                    <div className="oma-plx-listening-card__author-text">
                      <div className="oma-plx-listening-card__name-row">
                        <strong>{h.authorName || 'Unknown'}</strong>
                        {isNewHit(h) ? <span className="oma-plx-listening-card__new">New</span> : null}
                      </div>
                      <span className="oma-plx-listening-card__handle">
                        {h.authorHandle ? `@${h.authorHandle.replace(/^@/, '')}` : platformLabel(h.platform)} ·{' '}
                        {relativeDay(h.capturedAt)}
                      </span>
                    </div>
                  </div>
                  <SentimentPill
                    value={sentLabel}
                    t={t}
                    onChange={(s) => setLocalSentiment((prev) => ({ ...prev, [h.id]: s }))}
                  />
                </div>
                <div className="oma-plx-listening-card__body">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="oma-plx-listening-card__media" src={thumb} alt="" />
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
                  <span>
                    <HeartOutlined /> {formatCount(eng.likes)}
                  </span>
                  <span>
                    <CommentOutlined /> {eng.comments}
                  </span>
                  <span>
                    <BarChartOutlined /> {formatCount(eng.likes + eng.comments * 3)}
                  </span>
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
