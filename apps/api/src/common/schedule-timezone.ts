import { getPrisma } from '@oma/db';
import { FALLBACK_SCHEDULE_TZ } from '@oma/domain';
import { isValidTimezone } from './zoned-time';

/**
 * Timezone used to interpret calendar days for a brand.
 * Source of truth: ContentPreferences.defaultTimezone (brand workspace timezone).
 * When no brand is selected, prefer the most common brand timezone, then
 * WorkspaceSetting.timezone (so Gaza brands are not reported as Asia/Dubai).
 */
export const DEFAULT_SCHEDULE_TZ = FALLBACK_SCHEDULE_TZ;

export async function resolveScheduleTimezone(tenantId: string, brandId?: string): Promise<string> {
  const prisma = getPrisma();
  if (brandId) {
    const row = await prisma.contentPreferences.findFirst({
      where: { tenantId, brandId },
      select: { defaultTimezone: true },
    });
    if (row?.defaultTimezone && isValidTimezone(row.defaultTimezone)) {
      return row.defaultTimezone;
    }
  }

  const [workspace, brands, prefs] = await Promise.all([
    prisma.workspaceSetting.findUnique({
      where: { tenantId },
      select: { timezone: true },
    }),
    prisma.brandWorkspace.findMany({ where: { tenantId, archivedAt: null }, select: { id: true } }),
    prisma.contentPreferences.findMany({
      where: { tenantId },
      select: { brandId: true, defaultTimezone: true },
    }),
  ]);

  const byBrand = new Map(
    prefs
      .filter((p) => isValidTimezone(p.defaultTimezone))
      .map((p) => [p.brandId, p.defaultTimezone as string]),
  );
  if (brandId && byBrand.has(brandId)) return byBrand.get(brandId)!;

  const zones = brands.map((b) => byBrand.get(b.id)).filter((z): z is string => Boolean(z));
  if (zones.length) {
    const unique = new Set(zones);
    if (unique.size === 1) return zones[0]!;
    const counts = new Map<string, number>();
    for (const z of zones) counts.set(z, (counts.get(z) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return ranked[0]![0];
  }

  if (workspace?.timezone && isValidTimezone(workspace.timezone)) return workspace.timezone;
  return DEFAULT_SCHEDULE_TZ;
}
