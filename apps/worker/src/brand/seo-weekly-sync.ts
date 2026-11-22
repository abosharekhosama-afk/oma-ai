import { getPrisma, syncBrandSearchConsole } from '@oma/db';
import { gscModeFromEnv } from '@oma/domain';

const WEEK_MS = 7 * 86_400_000;

export function seoWeeklySyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.SEO_WEEKLY_SYNC ?? 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0' && gscModeFromEnv(env) === 'live';
}

/**
 * DEC-029 4.6: weekly rank snapshot. Syncs every CONNECTED live Search Console link
 * whose last sync is older than a week. Each sync stores a dated observation per query,
 * which the rank-tracking endpoint groups by ISO week.
 */
export async function runSeoWeeklySync(now: Date = new Date(), limit = 50) {
  if (!seoWeeklySyncEnabled()) return { skipped: true, synced: 0, failed: 0 };
  const prisma = getPrisma();
  const due = await prisma.brandSearchConsoleLink.findMany({
    where: {
      status: 'CONNECTED',
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(now.getTime() - WEEK_MS) } }],
    },
    orderBy: { lastSyncAt: { sort: 'asc', nulls: 'first' } },
    take: limit,
    select: { tenantId: true, brandId: true },
  });
  let synced = 0;
  let failed = 0;
  for (const link of due) {
    const res = await syncBrandSearchConsole(link.tenantId, link.brandId, { now }).catch(
      () => null,
    );
    if (res?.ok) synced += 1;
    else failed += 1;
  }
  return { skipped: false, synced, failed };
}
