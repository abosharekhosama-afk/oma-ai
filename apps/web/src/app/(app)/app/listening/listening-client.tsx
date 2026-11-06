'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  getListeningStats,
  listListeningHits,
  listListeningRules,
  patchListeningHit,
  syncListening,
  updateListeningRule,
  type ListeningHit,
  type ListeningRule,
  type ListeningStats,
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
  hitThumbnail,
  isNewHit,
  platformLabel,
  platformShort,
  relativeDay,
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

function formatTrend(pct: number | null | undefined) {
  if (pct == null) return null;
  const sign = pct >= 0 ? '↑' : '↓';
  return `${sign} ${Math.abs(pct)}%`;
}

function formatNextCheck(iso: string | null | undefined, t: (k: string) => string) {
  if (!iso) return t('listening.nextCheck') || 'Next check in 2 days';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t('listening.pollSoon') || 'Checking soon…';
  const mins = Math.ceil(ms / 60_000);
  if (mins < 120)
    return (t('listening.nextCheckMinutes') || 'Next check in {n} min').replace(
      '{n}',
      String(mins),
    );
  const hours = Math.ceil(mins / 60);
  return (t('listening.nextCheckHours') || 'Next check in {n} h').replace('{n}', String(hours));
}

function SentimentBar({
  positive,
  neutral,
  negative,
  total,
}: {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}) {
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
              <i
                className={`dot dot--${s === 'POSITIVE' ? 'pos' : s === 'NEGATIVE' ? 'neg' : 'neu'}`}
              />
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
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [chartDayIndex, setChartDayIndex] = useState<number | null>(null);
  const [hideOwnMentions, setHideOwnMentions] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => resolveDateRange('7'));
  const [syncing, setSyncing] = useState(false);
  const initialSync = useRef(false);

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
      const r = await listListeningRules(activeBrandId || undefined);
      setRules(r.items);
      const rule = ruleForView(r.items, view);
      const platformCsv = platforms.size ? [...platforms].join(',') : undefined;
      const hitParams: Record<string, string | number | boolean | undefined> = {
        limit: 100,
        from: dateRange.start.toISOString(),
        to: dateRange.end.toISOString(),
        sort,
        includeHidden: showHidden,
        includeExcluded: showExcluded,
      };
      if (activeBrandId) hitParams.brandId = activeBrandId;
      if (platformCsv) hitParams.platforms = platformCsv;
      if (sentimentFilter !== 'all') hitParams.sentiment = sentimentFilter;
      if (view === 'alerts') hitParams.highPriorityOnly = true;
      else if (rule) hitParams.ruleId = rule.id;

      const statParams: Record<string, string | undefined> = {
        from: dateRange.start.toISOString(),
        to: dateRange.end.toISOString(),
      };
      if (activeBrandId) statParams.brandId = activeBrandId;
      if (platformCsv) statParams.platforms = platformCsv;
      if (rule && view !== 'alerts') statParams.ruleId = rule.id;

      const [h, s] = await Promise.all([
        listListeningHits(hitParams),
        getListeningStats(statParams).catch(() => null),
      ]);
      setHits(h.items);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load listening');
      setHits([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [view, activeBrandId, dateRange, platforms, sort, sentimentFilter, showHidden, showExcluded]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      const rule = ruleForView(rules, view);
      try {
        await syncListening({
          brandId: activeBrandId || undefined,
          ruleId: rule?.id,
        });
        await new Promise((r) => setTimeout(r, 1200));
      } catch {
        /* no live rules or queue unavailable */
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [rules, view, activeBrandId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialSync.current) return;
    initialSync.current = true;
    void runSync();
  }, [runSync]);

  const keywords = useMemo(() => {
    const fromRule = activeRule?.keywords ?? [];
    const fromHits = hits.flatMap((h) => h.matchedKeywords);
    return [...new Set([...fromRule, ...fromHits])].slice(0, 8);
  }, [activeRule, hits]);

  const filteredHits = useMemo(() => {
    if (!hideOwnMentions) return hits;
    return hits.filter((h) => !/^(oma|team|brand)/i.test(h.authorHandle || ''));
  }, [hits, hideOwnMentions]);

  const series = stats?.volume ?? [];
  const mentionCount = stats?.mentions ?? filteredHits.length;
  const engagementTotal = stats?.engagement ?? 0;
  const sent = stats?.sentiment ?? {
    positive: 0,
    neutral: 0,
    negative: 0,
    total: 1,
  };

  const onSentimentChange = async (
    hitId: string,
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE',
  ) => {
    try {
      const updated = await patchListeningHit(hitId, { sentiment });
      setHits((prev) => prev.map((h) => (h.id === hitId ? updated : h)));
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const onHideHit = async (hitId: string) => {
    try {
      await patchListeningHit(hitId, { isHidden: true });
      setHits((prev) => prev.filter((h) => h.id !== hitId));
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hide failed');
    }
  };

  const onAddContext = async () => {
    if (!activeRule) return;
    const text = window.prompt(
      t('listening.contextPrompt') || 'Describe your brand for relevance scoring:',
      activeRule.contextJson ?? '',
    );
    if (text === null) return;
    try {
      await updateListeningRule(activeRule.id, { contextJson: text.trim() || null });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save context');
    }
  };

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
        <p className="oma-plx-listening__next-check">
          {formatNextCheck(stats?.nextPollAt, t)}
          {syncing ? ` · ${t('listening.syncing') || 'Syncing…'}` : ''}
        </p>
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
              <p
                className={`oma-plx-listening-kpi__trend ${
                  (stats?.mentionsTrendPct ?? 0) >= 0 ? 'trend--up' : 'trend--down'
                }`}
              >
                {formatTrend(stats?.mentionsTrendPct) ?? '—'}{' '}
                {t('listening.vsPrevious') || 'vs previous period'}
              </p>
            </article>
            <article className="oma-plx-listening-kpi">
              <div className="oma-plx-listening-kpi__head">
                <span>{t('listening.kpi.engagement') || 'Engagement'}</span>
                <span className="oma-plx-listening-kpi__icon" aria-hidden>
                  <ZapOutlined />
                </span>
              </div>
              <strong className="oma-plx-listening-kpi__value">
                {formatCount(engagementTotal)}
              </strong>
              <p
                className={`oma-plx-listening-kpi__trend ${
                  (stats?.engagementTrendPct ?? 0) >= 0 ? 'trend--up' : 'trend--down'
                }`}
              >
                {formatTrend(stats?.engagementTrendPct) ?? '—'}{' '}
                {t('listening.vsPrevious') || 'vs previous period'}
              </p>
            </article>
            <article className="oma-plx-listening-kpi oma-plx-listening-kpi--sentiment">
              <div className="oma-plx-listening-kpi__head">
                <span>{t('listening.kpi.sentiment') || 'Sentiment'}</span>
                <span className="oma-plx-listening-kpi__icon" aria-hidden>
                  <SmileOutlined />
                </span>
              </div>
              <SentimentBar
                positive={sent.positive}
                neutral={sent.neutral}
                negative={sent.negative}
                total={sent.total || 1}
              />
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
            <button
              type="button"
              className="oma-plx-listening-icon-btn"
              aria-label="Hide"
              disabled={!filteredHits.length}
              onClick={() => {
                const first = filteredHits[0];
                if (first) void onHideHit(first.id);
              }}
            >
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
                  <p className="oma-plx-listening-filter__label">
                    {t('listening.sorting') || 'Sorting'}
                  </p>
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
                  <p className="oma-plx-listening-filter__label">
                    {t('listening.sentiment') || 'Sentiment'}
                  </p>
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
                  <p className="oma-plx-listening-filter__label">
                    {t('listening.options') || 'Options'}
                  </p>
                  <label className="oma-plx-listening-filter__row">
                    <input
                      type="checkbox"
                      checked={hideOwnMentions}
                      onChange={(e) => setHideOwnMentions(e.target.checked)}
                    />
                    {t('listening.opt.hideOwn') || 'Hide own mentions'}
                  </label>
                  <label className="oma-plx-listening-filter__row">
                    <input
                      type="checkbox"
                      checked={showHidden}
                      onChange={(e) => setShowHidden(e.target.checked)}
                    />
                    {t('listening.opt.showHidden') || 'Show hidden mentions'}
                  </label>
                  <label className="oma-plx-listening-filter__row">
                    <input
                      type="checkbox"
                      checked={showExcluded}
                      onChange={(e) => setShowExcluded(e.target.checked)}
                    />
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
              <strong>
                {t('listening.contextTitle') || 'Add brand context for better relevance scores'}
              </strong>
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
              <Button type="primary" size="small" onClick={() => void onAddContext()}>
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
            const parts = highlightKeywords(
              h.content,
              keywords.length ? keywords : h.matchedKeywords,
            );
            const thumb = hitThumbnail(h);
            return (
              <li
                key={h.id}
                className="oma-plx-listening-card"
                data-testid={`listening-hit-${h.id}`}
              >
                <div className="oma-plx-listening-card__top">
                  <div className="oma-plx-listening-card__author">
                    <span className="oma-plx-listening-card__avatar" aria-hidden>
                      <img src={thumb} alt="" />
                      <span className={`plat plat--${h.platform}`}>
                        {platformShort(h.platform)}
                      </span>
                    </span>
                    <div className="oma-plx-listening-card__author-text">
                      <div className="oma-plx-listening-card__name-row">
                        <strong>{h.authorName || 'Unknown'}</strong>
                        {isNewHit(h) ? (
                          <span className="oma-plx-listening-card__new">New</span>
                        ) : null}
                      </div>
                      <span className="oma-plx-listening-card__handle">
                        {h.authorHandle
                          ? `@${h.authorHandle.replace(/^@/, '')}`
                          : platformLabel(h.platform)}{' '}
                        · {relativeDay(h.capturedAt)}
                      </span>
                    </div>
                  </div>
                  <SentimentPill
                    value={sentLabel}
                    t={t}
                    onChange={(s) => void onSentimentChange(h.id, s)}
                  />
                </div>
                <div className="oma-plx-listening-card__body">
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
                    <BarChartOutlined /> {formatCount(eng.total)}
                  </span>
                  <button
                    type="button"
                    className="oma-plx-listening-link"
                    onClick={() => void onHideHit(h.id)}
                  >
                    {t('listening.hideMention') || 'Hide'}
                  </button>
                  {h.url ? (
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noreferrer"
                      className="oma-plx-listening-card__link"
                    >
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
