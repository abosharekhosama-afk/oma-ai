import { FALLBACK_SCHEDULE_TZ, isValidIanaTimezone } from '@oma/domain';

export type BrandTimezoneRow = { id: string; timezone?: string | null };

/** Brand workspace timezone (ContentPreferences.defaultTimezone) for scheduling UI. */
export function brandScheduleTimezone(
  brandId: string | null | undefined,
  brands: BrandTimezoneRow[],
  contentTimezone?: string | null,
): string {
  if (isValidIanaTimezone(contentTimezone)) return contentTimezone.trim();
  if (brandId) {
    const hit = brands.find((b) => b.id === brandId);
    if (isValidIanaTimezone(hit?.timezone)) return hit!.timezone!.trim();
  }
  if (brands.length === 1 && isValidIanaTimezone(brands[0]?.timezone)) {
    return brands[0]!.timezone!.trim();
  }
  return FALLBACK_SCHEDULE_TZ;
}
