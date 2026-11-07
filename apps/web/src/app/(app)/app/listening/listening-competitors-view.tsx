'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CommentOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  RetweetOutlined,
} from '../../../../components/ui/lucide-icons';
import { NetworkIcon } from '../../../../components/content/network-icon';
import { ErrorState } from '../../../../components/ui/error-state';
import { ListeningCompetitorsShimmer } from '../../../../components/ui/screen-shimmer';
import { useActiveBrandId } from '../../../../lib/active-brand';
import {
  getListeningCompetitors,
  listListeningHits,
  type ListeningCompetitorDashboard,
  type ListeningHit,
} from '../../../../lib/listening-api';
import { useLocale, useT } from '../../../../lib/use-locale';
import { ListeningDateRange, resolveDateRange, type DateRangeValue } from './listening-date-range';
import { ListeningSourceMenu } from './listening-source-menu';
import {
  formatCount,
  highlightKeywords,
  hitEngagement,
  hitThumbnail,
  isNewHit,
  platformShort,
  relativeDay,
} from './listening-utils';

const PALETTE = ['#1570ef', '#ee46bc', '#f79009', '#0e9f95', '#7a5af8'];

function sourceIconChannel(platform: string): string {
  const p = platform.toUpperCase();
  if (p === 'X' || p.includes('TWITTER')) return 'x';
  if (p.includes('IG') || p.includes('INSTAGRAM')) return 'instagram';
  if (p.includes('FB') || p.includes('FACEBOOK')) return 'facebook';
  if (p.includes('TIKTOK')) return 'tiktok';
  if (p.includes('LINKEDIN')) return 'linkedin';
  if (p.includes('YOUTUBE')) return 'youtube';
  return 'generic';
}

function formatTrend(pct: number | null) {
  if (pct == null) return '—';
  const sign = pct >= 0 ? '↑' : '↓';
  return `${sign} ${Math.abs(pct)}%`;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
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
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeOpacity="0.65" />
    </svg>
  );
}

function ShareDonut({
  entities,
  total,
  ar,
}: {
  entities: ListeningCompetitorDashboard['entities'];
  total: number;
  ar: boolean;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="oma-plx-listening-comp__donut-wrap">
      <svg viewBox="0 0 120 120" className="oma-plx-listening-comp__donut" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--oma-home-track)" strokeWidth="14" />
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
        <span>{ar ? 'إشارات' : 'Mentions'}</span>
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
  const [hits, setHits] = useState<ListeningHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricTab, setMetricTab] = useState<'mentions' | 'engagement'>('mentions');
  const [activeCompetitorRuleId, setActiveCompetitorRuleId] = useState<string>('all');
  const [mentionSort, setMentionSort] = useState<'engagement' | 'recency' | 'relevance'>(
    'engagement',
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const platformCsv = platforms.size ? [...platforms].join(',') : undefined;
      const [res, hitRes] = await Promise.all([
        getListeningCompetitors({
          brandId: brandId || undefined,
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString(),
          platforms: platformCsv,
        }),
        listListeningHits({
          brandId: brandId || undefined,
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString(),
          platforms: platformCsv,
          sort: mentionSort,
          limit: 60,
        }).catch(() => ({ items: [] as ListeningHit[], total: 0, page: 1, limit: 60 })),
      ]);
      setData(res);
      setHits(hitRes.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load competitors');
      setData(null);
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, [brandId, dateRange, platforms, mentionSort]);

  useEffect(() => {
    void load();
  }, [load]);

  const entities = data?.entities ?? [];
  const youEntity = entities.find((e) => e.isYou) ?? entities[0] ?? null;
  const competitorEntities = useMemo(() => entities.filter((e) => !e.isYou), [entities]);
  const totalMentions = data?.totals.mentions ?? 0;

  const competitorRuleIds = useMemo(
    () => new Set(competitorEntities.map((c) => c.ruleId)),
    [competitorEntities],
  );

  const competitorHits = useMemo(() => {
    const base = hits.filter((h) =>
      competitorRuleIds.size > 0 && h.ruleId ? competitorRuleIds.has(h.ruleId) : true,
    );
    const pool = base.length > 0 ? base : hits;
    if (activeCompetitorRuleId === 'all') return pool;
    return pool.filter((h) => h.ruleId === activeCompetitorRuleId);
  }, [hits, competitorRuleIds, activeCompetitorRuleId]);

  return (
    <div
      className="oma-plx-listening oma-plx-listening-comp"
      data-testid="listening-competitors-page"
    >
      <header className="oma-plx-listening__toolbar">
        <div className="oma-plx-listening__toolbar-spacer" />
        <ListeningDateRange value={dateRange} onChange={setDateRange} />
      </header>

      <div className="oma-plx-listening-comp__vs-bar">
        <div className="oma-plx-listening-comp__vs-pills">
          {youEntity ? (
            <>
              <strong className="oma-plx-listening-comp__you-name">{youEntity.name}</strong>
              <span className="oma-plx-listening-comp__vs-word">vs.</span>
            </>
          ) : (
            <h1 className="oma-plx-listening__title">
              {t('listening.nav.competitors') || (ar ? 'المنافسون' : 'Competitors')}
            </h1>
          )}
          {competitorEntities.map((comp) => (
            <button
              key={comp.ruleId}
              type="button"
              className="oma-plx-listening-comp__pill"
              data-active={activeCompetitorRuleId === comp.ruleId ? 'true' : 'false'}
              onClick={() =>
                setActiveCompetitorRuleId((prev) => (prev === comp.ruleId ? 'all' : comp.ruleId))
              }
            >
              {comp.name}
            </button>
          ))}
        </div>
        <ListeningSourceMenu selected={platforms} onChange={setPlatforms} />
      </div>

      {error ? (
        <ErrorState compact kind="generic" body={error} onRetry={() => void load()} />
      ) : null}

      {loading && !data ? <ListeningCompetitorsShimmer embedded /> : null}

      {data ? (
        <>
          {/* 1. Mention volume */}
          <section className="oma-plx-listening-panel oma-plx-listening-comp__volume">
            <header className="oma-plx-listening-panel__head">
              <h2>
                {ar ? 'حجم الإشارات' : 'Mention volume'}{' '}
                <InfoCircleOutlined className="oma-plx-listening-comp__info" aria-hidden />
              </h2>
              <div className="oma-plx-listening-segment">
                <button
                  type="button"
                  className={metricTab === 'mentions' ? 'is-active' : ''}
                  onClick={() => setMetricTab('mentions')}
                >
                  {ar ? 'الإشارات' : 'Mentions'}
                </button>
                <button
                  type="button"
                  className={metricTab === 'engagement' ? 'is-active' : ''}
                  onClick={() => setMetricTab('engagement')}
                >
                  {ar ? 'التفاعل' : 'Engagement'}
                </button>
              </div>
            </header>
            <div className="oma-plx-listening-comp__entity-row">
              {entities.map((e, i) => {
                const color = PALETTE[i % PALETTE.length]!;
                return (
                  <article key={e.ruleId} className="oma-plx-listening-comp__entity">
                    <div className="oma-plx-listening-comp__entity-title">
                      <span
                        className="oma-plx-listening-comp__dot"
                        style={{ background: color }}
                        aria-hidden
                      />
                      <h3>{e.name}</h3>
                      {e.isYou ? (
                        <span className="oma-plx-listening-comp__you-badge">
                          {ar ? 'أنت' : 'You'}
                        </span>
                      ) : null}
                    </div>
                    <div className="oma-plx-listening-comp__entity-stat">
                      <strong className="oma-ltr">
                        {formatCount(metricTab === 'mentions' ? e.mentions : e.engagement)}
                      </strong>
                      <span
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
                      </span>
                    </div>
                    <Sparkline values={e.sparkline} color={color} />
                  </article>
                );
              })}
            </div>
          </section>

          {/* 2. Where you stand */}
          <section className="oma-plx-listening-panel oma-plx-listening-comp__quadrant">
            <header className="oma-plx-listening-panel__head">
              <h2>
                {ar ? 'موقعك التنافسي' : 'Where you stand'}{' '}
                <InfoCircleOutlined className="oma-plx-listening-comp__info" aria-hidden />
              </h2>
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
              <span className="oma-plx-listening-comp__axis-x">
                {ar ? 'صافي المشاعر ←' : 'Net sentiment →'}
              </span>
            </div>
          </section>

          {/* 3. Share of voice */}
          <section className="oma-plx-listening-panel oma-plx-listening-comp__sov">
            <header className="oma-plx-listening-panel__head">
              <h2>
                {ar ? 'حصة الصوت' : 'Share of voice'}{' '}
                <InfoCircleOutlined className="oma-plx-listening-comp__info" aria-hidden />
              </h2>
            </header>
            <div className="oma-plx-listening-comp__sov-body">
              <ShareDonut entities={entities} total={totalMentions} ar={ar} />
              <table className="oma-plx-listening-comp__sent-table">
                <thead>
                  <tr>
                    <th>{ar ? 'العلامة' : 'Brand'}</th>
                    <th>{ar ? 'الحصة' : 'Share'}</th>
                    <th>{ar ? 'التغير' : 'Change'}</th>
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
                        <strong>{e.name}</strong>
                        {e.isYou ? (
                          <span className="oma-plx-listening-comp__you-badge">
                            {ar ? 'أنت' : 'You'}
                          </span>
                        ) : null}
                      </td>
                      <td className="oma-ltr">{e.sharePct}%</td>
                      <td
                        className={`oma-ltr ${
                          e.shareChangePts >= 0
                            ? 'oma-plx-listening-comp__pts--up'
                            : 'oma-plx-listening-comp__pts--down'
                        }`}
                      >
                        {e.shareChangePts >= 0 ? '↑ ' : '↓ '}
                        {Math.abs(e.shareChangePts)} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Sentiment */}
          <section className="oma-plx-listening-panel oma-plx-listening-comp__sentiment">
            <header className="oma-plx-listening-panel__head">
              <h2>
                {ar ? 'المشاعر' : 'Sentiment'}{' '}
                <InfoCircleOutlined className="oma-plx-listening-comp__info" aria-hidden />
              </h2>
            </header>
            <table className="oma-plx-listening-comp__sent-table">
              <thead>
                <tr>
                  <th>{ar ? 'العلامة' : 'Brand'}</th>
                  <th>{ar ? 'المشاعر' : 'Sentiment'}</th>
                  <th>{ar ? 'الإشارات' : 'Mentions'}</th>
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
                      <strong>{e.name}</strong>
                      {e.isYou ? (
                        <span className="oma-plx-listening-comp__you-badge">
                          {ar ? 'أنت' : 'You'}
                        </span>
                      ) : null}
                    </td>
                    <td className="oma-plx-listening-comp__bar-cell">
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
            <div className="oma-plx-listening-comp__legend">
              <span>
                <i className="dot dot--pos" /> {ar ? 'إيجابي' : 'Positive'}
              </span>
              <span>
                <i className="dot dot--neu" /> {ar ? 'محايد' : 'Neutral'}
              </span>
              <span>
                <i className="dot dot--neg" /> {ar ? 'سلبي' : 'Negative'}
              </span>
            </div>
          </section>

          {/* 5. Share by source */}
          <section className="oma-plx-listening-panel oma-plx-listening-comp__source">
            <header className="oma-plx-listening-panel__head">
              <h2>
                {ar ? 'الحصة حسب المصدر' : 'Share by source'}{' '}
                <InfoCircleOutlined className="oma-plx-listening-comp__info" aria-hidden />
              </h2>
            </header>
            <table className="oma-plx-listening-comp__source-table">
              <thead>
                <tr>
                  <th>{ar ? 'المصدر' : 'Source'}</th>
                  <th>{ar ? 'توزيع العلامات' : 'Brand split'}</th>
                  <th>{ar ? 'الإشارات' : 'Mentions'}</th>
                  <th>{ar ? 'حصتك' : 'Your share'}</th>
                </tr>
              </thead>
              <tbody>
                {(data.bySource ?? []).map((row) => (
                  <tr key={row.platform}>
                    <td>
                      <span className="oma-plx-listening-comp__src-cell">
                        <NetworkIcon channel={sourceIconChannel(row.platform)} size={15} />
                        <strong>{row.label}</strong>
                      </span>
                    </td>
                    <td className="oma-plx-listening-comp__bar-cell">
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
                                title={`${s.name}: ${s.mentions}`}
                              />
                            );
                          })}
                      </div>
                    </td>
                    <td className="oma-ltr">{row.mentions}</td>
                    <td className="oma-ltr">{row.yourSharePct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="oma-plx-listening-comp__legend">
              {entities.map((e, i) => (
                <span key={e.ruleId}>
                  <i className="dot" style={{ background: PALETTE[i % PALETTE.length] }} /> {e.name}
                </span>
              ))}
            </div>
          </section>

          {/* 6. Competitor mentions feed (Planable Image 8) */}
          <section
            className="oma-plx-listening-comp__mentions-sec"
            data-testid="listening-competitor-mentions"
          >
            <header className="oma-plx-listening-comp__mentions-head">
              <div>
                <h2>{ar ? 'إشارات المنافسين' : 'Competitor mentions'}</h2>
                <div className="oma-plx-listening-comp__filter-pills">
                  {competitorEntities.map((comp, idx) => {
                    const entityIdx = entities.findIndex((e) => e.ruleId === comp.ruleId);
                    const dotColor =
                      PALETTE[(entityIdx >= 0 ? entityIdx : idx + 1) % PALETTE.length];
                    const isOn =
                      activeCompetitorRuleId === 'all' || activeCompetitorRuleId === comp.ruleId;
                    return (
                      <button
                        key={comp.ruleId}
                        type="button"
                        className="oma-plx-listening-comp__pill"
                        data-active={isOn ? 'true' : 'false'}
                        onClick={() =>
                          setActiveCompetitorRuleId((prev) =>
                            prev === comp.ruleId ? 'all' : comp.ruleId,
                          )
                        }
                      >
                        <span
                          className="oma-plx-listening-comp__dot"
                          style={{ background: dotColor }}
                          aria-hidden
                        />
                        <span>{comp.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <select
                className="oma-plx-listening-comp__sort-select"
                value={mentionSort}
                onChange={(e) =>
                  setMentionSort(e.target.value as 'engagement' | 'recency' | 'relevance')
                }
                aria-label={t('listening.sorting') || 'Sorting'}
              >
                <option value="engagement">
                  {t('listening.sort.engagement') || (ar ? 'حسب التفاعل' : 'By engagement')}
                </option>
                <option value="recency">
                  {t('listening.sort.recency') || (ar ? 'حسب الحداثة' : 'By recency')}
                </option>
                <option value="relevance">
                  {t('listening.sort.relevance') || (ar ? 'حسب الصلة' : 'By relevance')}
                </option>
              </select>
            </header>

            {competitorHits.length === 0 ? (
              <div className="oma-inbox-empty">
                <strong>{t('listening.emptyTitle') || 'No mentions yet'}</strong>
              </div>
            ) : (
              <ul className="oma-plx-listening-feed">
                {competitorHits.map((h) => {
                  const eng = hitEngagement(h);
                  const sent = (h.sentiment ?? 'NEUTRAL').toUpperCase();
                  const thumb = hitThumbnail(h);
                  const parts = highlightKeywords(h.content, h.matchedKeywords);
                  return (
                    <li
                      key={h.id}
                      className="oma-plx-listening-card"
                      data-testid={`competitor-hit-${h.id}`}
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
                              <span className="oma-plx-listening-card__date">
                                · {relativeDay(h.capturedAt)}
                              </span>
                              {isNewHit(h) ? (
                                <span className="oma-plx-listening-card__new">New</span>
                              ) : null}
                            </div>
                            <span className="oma-plx-listening-card__handle">
                              {h.authorHandle
                                ? `@${h.authorHandle.replace(/^@/, '')}`
                                : `@${(h.authorName || 'user').toLowerCase().replace(/\s+/g, '')}`}
                            </span>
                          </div>
                        </div>

                        <span className={`oma-plx-listening-sent-pill sent--${sent.toLowerCase()}`}>
                          {sent === 'POSITIVE'
                            ? ar
                              ? 'إيجابي'
                              : 'Positive'
                            : sent === 'NEGATIVE'
                              ? ar
                                ? 'سلبي'
                                : 'Negative'
                              : ar
                                ? 'محايد'
                                : 'Neutral'}
                        </span>
                      </div>

                      <div className="oma-plx-listening-card__body">
                        <p>
                          {parts.map((p, idx) =>
                            p.highlight ? (
                              <mark key={idx} className="oma-plx-listening-kw">
                                {p.text}
                              </mark>
                            ) : (
                              <span key={idx}>{p.text}</span>
                            ),
                          )}
                        </p>
                      </div>

                      <footer className="oma-plx-listening-card__foot">
                        <span>
                          <HeartOutlined /> {formatCount(eng.likes)}
                        </span>
                        <span>
                          <CommentOutlined /> {formatCount(eng.comments)}
                        </span>
                        {eng.shares > 0 ? (
                          <span>
                            <RetweetOutlined /> {formatCount(eng.shares)}
                          </span>
                        ) : null}
                      </footer>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
