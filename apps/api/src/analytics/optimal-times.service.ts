import { getPrisma, tenantWhere } from '@oma/db';
import {
  computePageOptimalTimes,
  dateKeyWeekday,
  DomainError,
  excludeElapsedHours,
  formatSlotLabel,
  fromSocialEnum,
  heatmapMatrix,
  isUsableTimezone,
  slotsForDay,
  type HeatmapCell,
  type OptimalTimesStatus,
  type RankedSlot,
} from '@oma/domain';
import { resolveScheduleTimezone } from '../common/schedule-timezone';

export type OptimalTimesQuery = {
  brandId?: string;
  socialPageId?: string;
  network?: string;
  metric?: string;
  date?: string;
  socialPageIds?: string;
};

function parseIds(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function assertBrand(tenantId: string, brandId?: string) {
  if (!brandId) return;
  const prisma = getPrisma();
  const brand = await prisma.brandWorkspace.findFirst({
    where: tenantWhere(tenantId, { id: brandId, archivedAt: null }),
    select: { id: true },
  });
  if (!brand) throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
}

async function loadPages(tenantId: string, q: OptimalTimesQuery) {
  const prisma = getPrisma();
  const ids = [q.socialPageId, ...parseIds(q.socialPageIds)].filter((id): id is string =>
    Boolean(id),
  );
  const network = q.network?.trim().toUpperCase();
  const pages = await prisma.socialPage.findMany({
    where: {
      tenantId,
      ...(q.brandId ? { brandId: q.brandId } : {}),
      ...(ids.length ? { id: { in: ids } } : {}),
      ...(network ? { network: network as never } : {}),
    },
    select: { id: true, name: true, network: true, brandId: true, tenantId: true, status: true },
    orderBy: { name: 'asc' },
  });
  if (ids.length && pages.length === 0) {
    throw new DomainError('NOT_FOUND', 'Social page not found', 404, 'errors.not_found');
  }
  return pages;
}

function cellsFromBuckets(
  buckets: Array<{
    dayOfWeek: number;
    hourLocal: number;
    score: number;
    postCount: number;
    confidence: number;
    weightedEr: number;
    engagementSum: number;
  }>,
): HeatmapCell[] {
  return buckets.map((b) => ({
    day_of_week: b.dayOfWeek,
    hour_local: b.hourLocal,
    score: b.score,
    n: b.postCount,
    confidence: b.confidence,
    weighted_er: b.weightedEr,
    engagement_sum: b.engagementSum,
  }));
}

function slotsFromRows(
  rows: Array<{
    dayOfWeek: number;
    minuteOfDay: number;
    rank: number;
    score: number;
    confidence: number;
    source: string;
  }>,
): RankedSlot[] {
  return rows.map((r) => ({
    day_of_week: r.dayOfWeek,
    hour_local: Math.floor(r.minuteOfDay / 60),
    minute_of_day: r.minuteOfDay,
    rank: r.rank,
    score: r.score,
    confidence: r.confidence,
    n: 0,
    source: r.source === 'manual' ? 'model' : (r.source as RankedSlot['source']),
    label: r.confidence >= 0.6 ? 'high' : r.confidence >= 0.3 ? 'medium' : 'low',
  }));
}

async function computedOrLive(
  page: { id: string; network: string; brandId: string },
  tenantId: string,
  timezone: string,
) {
  const prisma = getPrisma();
  const [buckets, slotRows] = await Promise.all([
    prisma.audienceActivityBucket.findMany({
      where: { tenantId, socialPageId: page.id },
    }),
    prisma.optimalTimeSlot.findMany({
      where: { tenantId, socialPageId: page.id },
      orderBy: [{ dayOfWeek: 'asc' }, { rank: 'asc' }],
    }),
  ]);
  if (buckets.length === 168) {
    const sample = buckets.reduce((n, b) => n + b.postCount, 0);
    const status: OptimalTimesStatus = sample <= 0 ? 'no_data' : sample < 20 ? 'low_data' : 'ready';
    return {
      status,
      sample_size: sample,
      cells: cellsFromBuckets(buckets),
      slots: slotsFromRows(slotRows),
      generated_at: buckets[0]?.computedAt.toISOString() ?? new Date().toISOString(),
    };
  }
  const snapshots = await prisma.postMetricSnapshot.findMany({
    where: { tenantId, socialPageId: page.id, excluded: false },
    select: {
      publishedAt: true,
      impressions: true,
      reach: true,
      likes: true,
      comments: true,
      shares: true,
      views: true,
      engagementRate: true,
      excluded: true,
    },
  });
  const live = computePageOptimalTimes({
    snapshots,
    network: fromSocialEnum(page.network),
    timezone,
  });
  return {
    status: live.status,
    sample_size: live.sample_size,
    cells: live.cells,
    slots: live.slots,
    generated_at: new Date().toISOString(),
  };
}

export class OptimalTimesService {
  async list(tenantId: string, q: OptimalTimesQuery) {
    await assertBrand(tenantId, q.brandId);
    const pages = await loadPages(tenantId, q);
    const timezone = await resolveScheduleTimezone(tenantId, q.brandId || pages[0]?.brandId);
    const pageSummaries = [];
    for (const page of pages) {
      const computed = await computedOrLive(page, tenantId, timezone);
      pageSummaries.push({
        social_page_id: page.id,
        name: page.name,
        network: fromSocialEnum(page.network),
        status: computed.status,
        sample_size: computed.sample_size,
        slots: computed.slots.map((s) => ({
          day_of_week: s.day_of_week,
          minute_of_day: s.minute_of_day,
          rank: s.rank,
          score: Number(s.score.toFixed(4)),
          confidence: Number(s.confidence.toFixed(4)),
          label: s.label,
          time_label: formatSlotLabel(s.hour_local),
        })),
        generated_at: computed.generated_at,
      });
    }
    const primary =
      [...pageSummaries].sort(
        (a, b) =>
          (b.status === 'ready' ? 1 : 0) - (a.status === 'ready' ? 1 : 0) ||
          b.sample_size - a.sample_size,
      )[0] ?? null;
    return {
      timezone,
      status: primary?.status ?? 'no_data',
      sample_size: primary?.sample_size ?? 0,
      social_page_id: primary?.social_page_id ?? null,
      network: primary?.network ?? null,
      slots: primary?.slots ?? [],
      pages: pageSummaries,
      generated_at: primary?.generated_at ?? new Date().toISOString(),
    };
  }

  async heatmap(tenantId: string, q: OptimalTimesQuery) {
    await assertBrand(tenantId, q.brandId);
    // Catalog every connected page for the workspace/brand. Do not constrain the
    // list to `socialPageId` — that field only selects which page's heatmap to compute.
    // Filtering the catalog by the selected page made the UI look as if only one
    // account (often Instagram) was connected.
    const pages = (await loadPages(tenantId, { brandId: q.brandId })).filter(
      (p) => p.status !== 'DISCONNECTED',
    );
    const timezone = await resolveScheduleTimezone(tenantId, q.brandId || pages[0]?.brandId);
    const metric = q.metric === 'engagements' ? 'engagements' : 'rate';
    const counts = pages.length
      ? await getPrisma().postMetricSnapshot.groupBy({
          by: ['socialPageId'],
          where: { tenantId, socialPageId: { in: pages.map((p) => p.id) }, excluded: false },
          _count: { _all: true },
        })
      : [];
    const countByPage = new Map(counts.map((row) => [row.socialPageId, row._count._all]));
    const pageSummaries = pages.map((p) => ({
      id: p.id,
      name: p.name,
      network: fromSocialEnum(p.network),
      sample_size: countByPage.get(p.id) ?? 0,
      status: ((): OptimalTimesStatus => {
        const n = countByPage.get(p.id) ?? 0;
        return n <= 0 ? 'no_data' : n < 20 ? 'low_data' : 'ready';
      })(),
    }));
    if (pages.length === 0) {
      return {
        timezone,
        status: 'no_data' as const,
        sample_size: 0,
        metric,
        social_page_id: null,
        network: q.network?.toLowerCase() ?? null,
        cells: heatmapMatrix([], metric),
        slots: [],
        pages: pageSummaries,
        generated_at: new Date().toISOString(),
      };
    }
    const requestedNetwork = q.network?.trim().toLowerCase();
    const pool = requestedNetwork
      ? pages.filter((p) => fromSocialEnum(p.network) === requestedNetwork)
      : pages;
    const chosen =
      pool.find((p) => p.id === q.socialPageId) ??
      pages.find((p) => p.id === q.socialPageId) ??
      pool[0] ??
      pages[0]!;
    const computed = await computedOrLive(chosen, tenantId, timezone);
    return {
      timezone,
      status: computed.status,
      sample_size: computed.sample_size,
      metric,
      social_page_id: chosen.id,
      network: fromSocialEnum(chosen.network),
      cells: heatmapMatrix(computed.cells, metric),
      slots: computed.slots.map((s) => ({
        day_of_week: s.day_of_week,
        minute_of_day: s.minute_of_day,
        rank: s.rank,
        score: Number(s.score.toFixed(4)),
        confidence: Number(s.confidence.toFixed(4)),
        label: s.label,
        time_label: formatSlotLabel(s.hour_local),
        source: s.source,
      })),
      pages: pageSummaries,
      generated_at: computed.generated_at,
    };
  }

  async suggest(tenantId: string, q: OptimalTimesQuery, now = new Date()) {
    await assertBrand(tenantId, q.brandId);
    const pages = await loadPages(tenantId, q);
    const timezone = await resolveScheduleTimezone(tenantId, q.brandId || pages[0]?.brandId);
    const tz = isUsableTimezone(timezone) ? timezone : 'UTC';
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(q.date ?? '')
      ? q.date!
      : new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(now);
    const dow = dateKeyWeekday(dateKey);
    const perPage = [];
    for (const page of pages) {
      const computed = await computedOrLive(page, tenantId, tz);
      const daySlots = excludeElapsedHours(slotsForDay(computed.slots, dow), {
        dateKey,
        now,
        timezone: tz,
      });
      perPage.push({
        social_page_id: page.id,
        name: page.name,
        network: fromSocialEnum(page.network),
        status: computed.status,
        sample_size: computed.sample_size,
        slots: daySlots.map((s) => ({
          day_of_week: s.day_of_week,
          minute_of_day: s.minute_of_day,
          rank: s.rank,
          score: Number(s.score.toFixed(4)),
          confidence: Number(s.confidence.toFixed(4)),
          label: s.label,
          time_label: formatSlotLabel(s.hour_local),
        })),
      });
    }
    const keyOf = (s: { day_of_week: number; minute_of_day: number }) =>
      `${s.day_of_week}:${s.minute_of_day}`;
    let conflict = false;
    if (perPage.length > 1) {
      const first = new Set(perPage[0]!.slots.slice(0, 3).map(keyOf));
      conflict = perPage.some((p) => p.slots.slice(0, 3).some((s) => !first.has(keyOf(s))));
    }
    const merged = new Map<string, { slot: (typeof perPage)[0]['slots'][0]; score: number }>();
    for (const page of perPage) {
      for (const slot of page.slots) {
        const key = keyOf(slot);
        const cur = merged.get(key);
        if (!cur || slot.score > cur.score) merged.set(key, { slot, score: slot.score });
      }
    }
    const slots = [...merged.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((x, i) => ({ ...x.slot, rank: i + 1 }));

    return {
      timezone: tz,
      date: dateKey,
      day_of_week: dow,
      status: perPage.some((p) => p.status === 'ready')
        ? 'ready'
        : perPage.some((p) => p.status === 'low_data')
          ? 'low_data'
          : 'no_data',
      conflict,
      slots,
      pages: perPage,
    };
  }
}

export const optimalTimesService = new OptimalTimesService();
