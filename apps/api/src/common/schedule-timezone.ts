import { getPrisma } from '@oma/db';
import { FALLBACK_SCHEDULE_TZ } from '@oma/domain';
import { isValidTimezone } from './zoned-time';

/**
 * Timezone used to interpret calendar days for a brand.
 * Source of truth: ContentPreferences.defaultTimezone (brand workspace timezone).
 */
export const DEFAULT_SCHEDULE_TZ = FALLBACK_SCHEDULE_TZ;

export async function resolveScheduleTimezone(tenantId: string, brandId?: string): Promise<string> {
  const prisma = getPrisma();
  if (brandId) {
    const row = await prisma.contentPreferences.findFirst({
      where: { tenantId, brandId },
      select: { defaultTimezone: true },
    });
    return pick(row?.defaultTimezone);
  }
  const [brands, prefs] = await Promise.all([
    prisma.brandWorkspace.findMany({ where: { tenantId, archivedAt: null }, select: { id: true } }),
    prisma.contentPreferences.findMany({
      where: { tenantId },
      select: { brandId: true, defaultTimezone: true },
    }),
  ]);
  const byBrand = new Map(prefs.map((p) => [p.brandId, pick(p.defaultTimezone)]));
  const zones = new Set(brands.map((b) => byBrand.get(b.id) ?? DEFAULT_SCHEDULE_TZ));
  return zones.size === 1 ? [...zones][0]! : DEFAULT_SCHEDULE_TZ;
}

function pick(tz: string | null | undefined) {
  return isValidTimezone(tz) ? tz : DEFAULT_SCHEDULE_TZ;
}
