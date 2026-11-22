import { getPrisma, syncBrandMetaAds } from '@oma/db';
import { metaAdsModeFromEnv } from '@oma/domain';

/** DEC-029 4.8: daily read-only Meta Ads insights sync (last 7 days, restatements included). */
export async function runMetaAdsDailySync(now: Date = new Date(), limit = 100) {
  if (metaAdsModeFromEnv() !== 'live') return { skipped: true, synced: 0, failed: 0 };
  const due = await getPrisma().metaAdsLink.findMany({
    where: {
      status: 'CONNECTED',
      adAccountId: { not: null },
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(now.getTime() - 20 * 3_600_000) } }],
    },
    orderBy: { lastSyncAt: { sort: 'asc', nulls: 'first' } },
    take: limit,
    select: { tenantId: true, brandId: true },
  });
  let synced = 0;
  let failed = 0;
  for (const link of due) {
    const res = await syncBrandMetaAds(link.tenantId, link.brandId, { now, days: 7 }).catch(
      () => null,
    );
    if (res?.ok) synced += 1;
    else failed += 1;
  }
  return { skipped: false, synced, failed };
}
