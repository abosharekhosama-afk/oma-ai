import { getPrisma } from '@oma/db';
import { isValidTimezone } from './zoned-time';

/**
 * Timezone used to interpret calendar days for a brand.
 *
 * Choice: ContentPreferences.defaultTimezone (per brand). That is what scheduling actually
 * uses: new ContentItem rows default to it ('Asia/Dubai'), the composer/calendar convert wall
 * clock input with it (web WORKSPACE_TZ), and GET /content/preferences exposes it.
 * WorkspaceSetting.timezone is only a settings-page field and is not read by scheduling, so it
 * is deliberately not used here (unifying the two is out of scope; see the brand PR).
 *
 * Without a brand: the shared value when every live brand in the tenant uses the same zone,
 * otherwise the scheduling default.
 */
export const DEFAULT_SCHEDULE_TZ = 'Asia/Dubai';

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
