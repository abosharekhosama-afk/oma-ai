import { getPrisma, upsertPostMetricSnapshot } from '@oma/db';
import {
  computePageOptimalTimes,
  FALLBACK_SCHEDULE_TZ,
  fromSocialEnum,
  industryPrior,
  isUsableTimezone,
  newId,
  OPTIMAL_TIMES_WINDOW_DAYS,
  type HeatmapCell,
} from '@oma/domain';

const BACKFILL_BATCH = 200;

async function resolvePageTimezone(tenantId: string, brandId: string): Promise<string> {
  const prisma = getPrisma();
  const [pref, workspace] = await Promise.all([
    prisma.contentPreferences.findFirst({
      where: { tenantId, brandId },
      select: { defaultTimezone: true },
    }),
    prisma.workspaceSetting.findUnique({
      where: { tenantId },
      select: { timezone: true },
    }),
  ]);
  if (pref?.defaultTimezone && isUsableTimezone(pref.defaultTimezone)) return pref.defaultTimezone;
  if (workspace?.timezone && isUsableTimezone(workspace.timezone)) return workspace.timezone;
  return FALLBACK_SCHEDULE_TZ;
}

export async function backfillPostMetricSnapshots(limit = BACKFILL_BATCH): Promise<{
  scanned: number;
  upserted: number;
}> {
  const prisma = getPrisma();
  const targets = await prisma.contentPublishTarget.findMany({
    where: {
      publishState: 'PUBLISHED',
      insightsJson: { not: null },
    },
    include: {
      contentItem: { select: { brandId: true, publishedAt: true } },
    },
    take: limit,
    orderBy: { lastInsightsAt: 'desc' },
  });
  let upserted = 0;
  for (const target of targets) {
    const publishedAt = target.publishedAt ?? target.contentItem?.publishedAt;
    const ok = await upsertPostMetricSnapshot({
      tenantId: target.tenantId,
      brandId: target.contentItem?.brandId ?? '',
      socialPageId: target.socialPageId,
      publishTargetId: target.id,
      contentItemId: target.contentItemId,
      publishedAt,
      insightsJson: target.insightsJson,
      capturedAt: target.lastInsightsAt ?? new Date(),
    });
    if (ok) upserted += 1;
  }
  return { scanned: targets.length, upserted };
}

export async function persistComputedTimes(input: {
  tenantId: string;
  socialPageId: string;
  timezone: string;
  network: string;
  result: ReturnType<typeof computePageOptimalTimes>;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const cells = input.result.cells;

  await prisma.$transaction(async (tx) => {
    await tx.audienceActivityBucket.deleteMany({ where: { socialPageId: input.socialPageId } });
    await tx.optimalTimeSlot.deleteMany({ where: { socialPageId: input.socialPageId } });
    if (cells.length) {
      await tx.audienceActivityBucket.createMany({
        data: cells.map((c: HeatmapCell) => ({
          id: newId(),
          tenantId: input.tenantId,
          socialPageId: input.socialPageId,
          timezone: input.timezone,
          dayOfWeek: c.day_of_week,
          hourLocal: c.hour_local,
          postCount: c.n,
          weightedEr: c.weighted_er,
          weightSum: c.n,
          engagementSum: c.engagement_sum,
          priorScore: industryPrior(input.network, c.day_of_week, c.hour_local, input.timezone),
          score: c.score,
          confidence: c.confidence,
          computedAt: now,
        })),
      });
    }
    if (input.result.slots.length) {
      await tx.optimalTimeSlot.createMany({
        data: input.result.slots.map((s) => ({
          id: newId(),
          tenantId: input.tenantId,
          socialPageId: input.socialPageId,
          dayOfWeek: s.day_of_week,
          minuteOfDay: s.minute_of_day,
          rank: s.rank,
          score: s.score,
          confidence: s.confidence,
          source: s.source,
          computedAt: now,
        })),
      });
    }
  });
}

export async function recomputePageOptimalTimes(socialPageId: string, now = new Date()) {
  const prisma = getPrisma();
  const page = await prisma.socialPage.findUnique({
    where: { id: socialPageId },
    select: { id: true, tenantId: true, brandId: true, network: true },
  });
  if (!page) return null;
  const timezone = await resolvePageTimezone(page.tenantId, page.brandId);
  const windowStart = new Date(now.getTime() - OPTIMAL_TIMES_WINDOW_DAYS * 86_400_000);
  const snapshots = await prisma.postMetricSnapshot.findMany({
    where: {
      socialPageId,
      publishedAt: { gte: windowStart },
      excluded: false,
    },
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
  const network = fromSocialEnum(page.network);
  const result = computePageOptimalTimes({ snapshots, network, timezone, now });
  await persistComputedTimes({
    tenantId: page.tenantId,
    socialPageId: page.id,
    timezone,
    network,
    result,
    now,
  });
  return result;
}

export async function runOptimalTimesTick(deps: { now?: () => Date; backfillLimit?: number } = {}) {
  const now = deps.now?.() ?? new Date();
  const backfill = await backfillPostMetricSnapshots(deps.backfillLimit ?? BACKFILL_BATCH);
  const prisma = getPrisma();
  const pages = await prisma.socialPage.findMany({
    select: { id: true },
  });
  let recomputed = 0;
  for (const page of pages) {
    await recomputePageOptimalTimes(page.id, now);
    recomputed += 1;
  }
  return { ...backfill, recomputed, at: now.toISOString() };
}
