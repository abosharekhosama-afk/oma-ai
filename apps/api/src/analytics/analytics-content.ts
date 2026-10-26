import { DomainError } from '@oma/domain';
import { bucketKey, bucketKeys, rate, type AnalyticsRange } from './analytics-range';

/**
 * Planable-style "Overview" analytics computed only from OMA's own data
 * (no social network numbers exist yet, so followers/impressions/engagement are never returned).
 */
export const CONTENT_METRICS = [
  'posts',
  'published',
  'scheduled',
  'approvals',
  'comments',
] as const;
export type ContentMetric = (typeof CONTENT_METRICS)[number];
export type MetricCounts = Record<ContentMetric, number>;

export type OverviewContentRow = {
  id: string;
  brandId: string;
  channel: string;
  contentType: string;
  status: string;
  titleEn: string;
  titleAr: string;
  captionEn: string | null;
  captionAr: string | null;
  previewAssetUrl: string | null;
  plannedAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
};
/** `channel` lets events/comments count even when their post is dated outside the range. */
export type OverviewEvent = { contentId: string; action: string; at: Date; channel?: string };
export type OverviewComment = { contentId: string; createdAt: Date; channel?: string };

/** The period of equal length immediately before `range`. */
export function previousRange(range: AnalyticsRange): AnalyticsRange {
  const len = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  return {
    from: new Date(to.getTime() - len),
    to,
    days: range.days,
    bucket: range.bucket,
    tz: range.tz,
  };
}

export function parseGranularity(v: string | undefined, range: AnalyticsRange): 'day' | 'week' {
  if (v === undefined || v === '') return range.bucket;
  if (v === 'day' || v === 'week') return v;
  throw new DomainError(
    'VALIDATION_FAILED',
    'granularity must be day or week',
    400,
    'errors.validation',
  );
}

export function parseChannels(v: string | undefined): string[] | null {
  if (!v) return null;
  const list = v
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 20 || list.some((c) => !/^[a-z0-9_-]{1,32}$/.test(c))) {
    throw new DomainError('VALIDATION_FAILED', 'channels is invalid', 400, 'errors.validation');
  }
  return list.length ? list : null;
}

/** Percent change vs previous; null when there is no baseline. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const zero = (): MetricCounts => ({
  posts: 0,
  published: 0,
  scheduled: 0,
  approvals: 0,
  comments: 0,
});
const dateOf = (c: OverviewContentRow) => c.scheduledAt ?? c.plannedAt ?? c.createdAt;

type Hit = { metric: ContentMetric; contentId: string; channel: string; at: Date };

function hits(
  content: OverviewContentRow[],
  events: OverviewEvent[],
  comments: OverviewComment[],
): Hit[] {
  const byId = new Map(content.map((c) => [c.id, c]));
  const out: Hit[] = [];
  for (const c of content) {
    out.push({ metric: 'posts', contentId: c.id, channel: c.channel, at: dateOf(c) });
    if (c.scheduledAt && (c.status === 'SCHEDULED' || c.status === 'PUBLISHED_SAMPLE')) {
      out.push({ metric: 'scheduled', contentId: c.id, channel: c.channel, at: c.scheduledAt });
    }
  }
  for (const e of events) {
    const channel = byId.get(e.contentId)?.channel ?? e.channel;
    if (!channel) continue;
    if (e.action === 'PUBLISH_SAMPLE')
      out.push({ metric: 'published', contentId: e.contentId, channel, at: e.at });
    else if (e.action === 'APPROVE')
      out.push({ metric: 'approvals', contentId: e.contentId, channel, at: e.at });
  }
  for (const m of comments) {
    const channel = byId.get(m.contentId)?.channel ?? m.channel;
    if (channel) out.push({ metric: 'comments', contentId: m.contentId, channel, at: m.createdAt });
  }
  return out;
}

export function buildContentOverview(input: {
  range: AnalyticsRange;
  granularity: 'day' | 'week';
  content: OverviewContentRow[];
  events: OverviewEvent[];
  comments: OverviewComment[];
  brandName: (id: string) => string;
}) {
  const { range, granularity } = input;
  const prev = previousRange(range);
  const all = hits(input.content, input.events, input.comments);
  const within = (r: { from: Date; to: Date }) => (h: Hit) => h.at >= r.from && h.at <= r.to;
  const cur = all.filter(within(range));
  const old = all.filter(within(prev));

  const totals = (list: Hit[]) => {
    const t = zero();
    for (const h of list) t[h.metric]++;
    return t;
  };
  const curT = totals(cur);
  const oldT = totals(old);
  const kpis = Object.fromEntries(
    CONTENT_METRICS.map((m) => [
      m,
      { value: curT[m], previous: oldT[m], delta: delta(curT[m], oldT[m]) },
    ]),
  ) as Record<ContentMetric, { value: number; previous: number; delta: number | null }>;
  const approvalRate = rate(curT.approvals, curT.posts);

  // Zero-filled series per bucket: totals plus a split by channel.
  const keys = bucketKeys({ ...range, bucket: granularity });
  const series = new Map(
    keys.map((k) => [k, { total: zero(), by_channel: {} as Record<string, MetricCounts> }]),
  );
  for (const h of cur) {
    const key = bucketKey(h.at, granularity, range.tz);
    const b = series.get(key);
    if (!b) continue;
    b.total[h.metric]++;
    (b.by_channel[h.channel] ??= zero())[h.metric]++;
  }

  // Per-channel table (current vs previous).
  const channelSet = new Set([
    ...input.content.map((c) => c.channel),
    ...all.map((h) => h.channel),
  ]);
  const channels = [...channelSet]
    .map((ch) => {
      const c = totals(cur.filter((h) => h.channel === ch));
      const p = totals(old.filter((h) => h.channel === ch));
      return {
        channel: ch,
        current: c,
        previous: p,
        delta: Object.fromEntries(CONTENT_METRICS.map((m) => [m, delta(c[m], p[m])])) as Record<
          ContentMetric,
          number | null
        >,
      };
    })
    .sort((a, b) => b.current.posts - a.current.posts || a.channel.localeCompare(b.channel));

  // Content table: every post dated in range, with its activity in range.
  const perItem = new Map<string, MetricCounts>();
  for (const h of cur)
    (perItem.get(h.contentId) ?? perItem.set(h.contentId, zero()).get(h.contentId)!)[h.metric]++;
  const changes = new Map<string, number>();
  for (const e of input.events) {
    if (e.action === 'REQUEST_CHANGES' && e.at >= range.from && e.at <= range.to)
      changes.set(e.contentId, (changes.get(e.contentId) ?? 0) + 1);
  }
  const rows = input.content
    .filter((c) => {
      const d = dateOf(c);
      return d >= range.from && d <= range.to;
    })
    .map((c) => {
      const m = perItem.get(c.id) ?? zero();
      return {
        id: c.id,
        brand_id: c.brandId,
        brand_name: input.brandName(c.brandId),
        channel: c.channel,
        content_type: c.contentType,
        status: c.status,
        title: { en: c.titleEn, ar: c.titleAr },
        caption: { en: c.captionEn ?? '', ar: c.captionAr ?? '' },
        preview_asset_url: c.previewAssetUrl,
        date: dateOf(c).toISOString(),
        comments: m.comments,
        approvals: m.approvals,
        changes_requested: changes.get(c.id) ?? 0,
        published: m.published > 0 || c.status === 'PUBLISHED_SAMPLE',
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const top = (key: 'comments' | 'approvals') =>
    [...rows]
      .filter((r) => r[key] > 0)
      .sort((a, b) => b[key] - a[key] || b.date.localeCompare(a.date))
      .slice(0, 3);

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      days: range.days,
      timezone: range.tz ?? 'UTC',
    },
    previous: { from: prev.from.toISOString(), to: prev.to.toISOString() },
    granularity,
    kpis,
    approval_rate: approvalRate,
    series: keys.map((k) => ({ bucket: k, ...series.get(k)! })),
    channels,
    top_content: { comments: top('comments'), approvals: top('approvals') },
    content: {
      rows: rows.slice(0, 500),
      total_rows: rows.length,
      totals: rows.reduce(
        (t, r) => ({
          comments: t.comments + r.comments,
          approvals: t.approvals + r.approvals,
          changes_requested: t.changes_requested + r.changes_requested,
        }),
        { comments: 0, approvals: 0, changes_requested: 0 },
      ),
    },
    // Network metrics need channel connections OMA doesn't have yet.
    social: {
      connected: false,
      unavailable: ['followers', 'impressions', 'engagements', 'engagement_rate'],
    },
  };
}
