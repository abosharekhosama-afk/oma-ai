/**
 * DEC-029 4.6: weekly rank tracking and SEO gaps from Search Console observations.
 * Pure helpers; the API/worker read rows from the database.
 */
export type RankObservation = {
  keyword: string;
  position: number | null;
  impressions: number | null;
  clicks: number | null;
  pageUrl?: string | null;
  capturedAt: Date;
  source: string;
};

export type TrackedKeyword = {
  keyword: string;
  locale: string;
  pillar_key: string | null;
  priority: number;
};

/** ISO-8601 week key, e.g. 2026-W47 (UTC). */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const normalizeSeoKeyword = (k: string) => k.trim().toLowerCase().replace(/\s+/g, ' ');

/** Arabic script → ar, otherwise en (GSC returns no language per query). */
export function guessQueryLocale(query: string): 'ar' | 'en' {
  return /[\u0600-\u06FF]/.test(query) ? 'ar' : 'en';
}

/** Prefer the verified property that matches the brand website over the first one returned. */
export function pickSearchConsoleSite(sites: string[], websiteUrl?: string | null): string | null {
  if (!sites.length) return null;
  const host = (() => {
    try {
      return websiteUrl ? new URL(websiteUrl).host.replace(/^www\./, '') : null;
    } catch {
      return null;
    }
  })();
  if (host) {
    const exact = sites.find((s) => {
      try {
        return new URL(s).host.replace(/^www\./, '') === host;
      } catch {
        return false;
      }
    });
    if (exact) return exact;
    const domain = sites.find((s) => s === `sc-domain:${host}`);
    if (domain) return domain;
  }
  return sites[0]!;
}

export type WeeklyRankPoint = {
  week: string;
  position: number | null;
  impressions: number | null;
  clicks: number | null;
};

/** Latest observation per keyword per ISO week, oldest week first. */
export function weeklyRankSeries(observations: RankObservation[], weeks: number, now: Date) {
  const keys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--)
    keys.push(isoWeekKey(new Date(now.getTime() - i * 7 * 86_400_000)));
  const byKeyword = new Map<string, Map<string, RankObservation>>();
  for (const o of observations) {
    const k = normalizeSeoKeyword(o.keyword);
    const week = isoWeekKey(o.capturedAt);
    if (!keys.includes(week)) continue;
    const m = byKeyword.get(k) ?? new Map<string, RankObservation>();
    const prev = m.get(week);
    if (!prev || prev.capturedAt < o.capturedAt) m.set(week, o);
    byKeyword.set(k, m);
  }
  return {
    weeks: keys,
    series: (keyword: string): WeeklyRankPoint[] => {
      const m = byKeyword.get(normalizeSeoKeyword(keyword));
      return keys.map((week) => {
        const o = m?.get(week);
        return {
          week,
          position: o?.position != null ? Math.round(o.position * 10) / 10 : null,
          impressions: o?.impressions ?? null,
          clicks: o?.clicks ?? null,
        };
      });
    },
    keywords: () => [...byKeyword.keys()],
  };
}

export type RankStatus = 'top3' | 'top10' | 'striking' | 'deep' | 'not_ranking';

export function rankStatus(position: number | null): RankStatus {
  if (position == null) return 'not_ranking';
  if (position <= 3) return 'top3';
  if (position <= 10) return 'top10';
  if (position <= 30) return 'striking';
  return 'deep';
}

export type SeoGap = {
  kind: 'not_ranking' | 'striking_distance' | 'unplanned_demand';
  keyword: string;
  locale: string;
  pillar_key: string | null;
  position: number | null;
  impressions: number | null;
  page_url: string | null;
  priority: number;
};

/**
 * Gaps the plan can act on:
 * - planned keywords with no Search Console impressions (not_ranking);
 * - planned or unplanned queries on positions 11–30 (striking_distance);
 * - unplanned queries with real demand (≥ minImpressions) the plan does not cover.
 */
export function seoKeywordGaps(
  tracked: TrackedKeyword[],
  latest: RankObservation[],
  opts: { minImpressions?: number; limit?: number } = {},
): SeoGap[] {
  const minImpressions = opts.minImpressions ?? 50;
  const best = new Map<string, RankObservation>();
  for (const o of latest) {
    const k = normalizeSeoKeyword(o.keyword);
    const prev = best.get(k);
    if (!prev || (o.impressions ?? 0) > (prev.impressions ?? 0)) best.set(k, o);
  }
  const planned = new Set(tracked.map((t) => normalizeSeoKeyword(t.keyword)));
  const gaps: SeoGap[] = [];
  for (const t of tracked) {
    const o = best.get(normalizeSeoKeyword(t.keyword));
    if (!o || o.position == null) {
      gaps.push({
        kind: 'not_ranking',
        keyword: t.keyword,
        locale: t.locale,
        pillar_key: t.pillar_key,
        position: null,
        impressions: null,
        page_url: null,
        priority: t.priority,
      });
    } else if (o.position > 10 && o.position <= 30) {
      gaps.push({
        kind: 'striking_distance',
        keyword: t.keyword,
        locale: t.locale,
        pillar_key: t.pillar_key,
        position: o.position,
        impressions: o.impressions,
        page_url: o.pageUrl ?? null,
        priority: t.priority,
      });
    }
  }
  for (const [k, o] of best) {
    if (planned.has(k) || (o.impressions ?? 0) < minImpressions) continue;
    if (o.position != null && o.position <= 10) continue;
    gaps.push({
      kind: o.position != null && o.position <= 30 ? 'striking_distance' : 'unplanned_demand',
      keyword: o.keyword,
      locale: guessQueryLocale(o.keyword),
      pillar_key: null,
      position: o.position,
      impressions: o.impressions,
      page_url: o.pageUrl ?? null,
      priority: 9,
    });
  }
  const order = { striking_distance: 0, not_ranking: 1, unplanned_demand: 2 } as const;
  return gaps
    .sort(
      (a, b) =>
        order[a.kind] - order[b.kind] ||
        a.priority - b.priority ||
        (b.impressions ?? 0) - (a.impressions ?? 0),
    )
    .slice(0, opts.limit ?? 50);
}

/** Brief content for a set of SEO gaps (draft only; a person approves it). */
export function briefContentFromSeoGaps(gaps: SeoGap[], now: Date = new Date()) {
  const keywords = gaps.map((g) => g.keyword);
  const due = new Date(now.getTime() + 14 * 86_400_000).toISOString();
  return {
    objective_en: `Win search visibility for: ${keywords.join(', ')}`.slice(0, 1000),
    objective_ar: `تحسين الظهور في البحث للكلمات: ${keywords.join('، ')}`.slice(0, 1000),
    channels: ['Website'],
    references: gaps
      .filter((g) => g.page_url)
      .map((g) => g.page_url!)
      .slice(0, 20),
    mandatories: gaps
      .map((g) =>
        g.kind === 'striking_distance'
          ? `Improve "${g.keyword}" (now #${Math.round(g.position ?? 0)}): refresh ${g.page_url ?? 'the page'}`
          : g.kind === 'not_ranking'
            ? `Create a page/article targeting "${g.keyword}"`
            : `Cover unplanned demand "${g.keyword}" (${g.impressions ?? 0} impressions)`,
      )
      .map((m) => m.slice(0, 300))
      .slice(0, 20),
    due_at: due,
    pillar_key: gaps.find((g) => g.pillar_key)?.pillar_key ?? null,
    deliverables: gaps.slice(0, 30).map((g, i) => ({
      key: `seo-${i + 1}`,
      title_en: `SEO: ${g.keyword}`.slice(0, 160),
      title_ar: `سيو: ${g.keyword}`.slice(0, 160),
      format: g.kind === 'striking_distance' ? 'page_refresh' : 'article',
      channel: 'Website',
      department: 'SEO',
      due_at: due,
      notes:
        `${g.kind}${g.position != null ? ` · position ${Math.round(g.position)}` : ''}${g.page_url ? ` · ${g.page_url}` : ''}`.slice(
          0,
          1000,
        ),
    })),
  };
}
