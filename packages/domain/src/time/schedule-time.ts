/** Used only when a brand has no valid IANA timezone configured. */
export const FALLBACK_SCHEDULE_TZ = 'Asia/Dubai';

function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return asUtc - (at.getTime() - at.getMilliseconds());
}

export function isValidIanaTimezone(tz: string | null | undefined): tz is string {
  if (!tz?.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wall-clock UI value → UTC ISO instant, interpreted in the brand timezone.
 * Accepts "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" / space-separated time.
 */
export function wallTimeToIso(
  value: string | null | undefined,
  timeZone: string,
  defaultTime = '10:00',
): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const [dh, dm] = defaultTime.split(':');
  const h = Number(m[4] ?? dh);
  const mi = Number(m[5] ?? dm);
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), h, mi);
  if (Number.isNaN(guess)) return null;
  const check = new Date(guess);
  if (check.getUTCDate() !== Number(d) || check.getUTCMonth() !== Number(mo) - 1) return null;
  let t = guess - tzOffsetMs(new Date(guess), timeZone);
  const off2 = tzOffsetMs(new Date(t), timeZone);
  if (guess - off2 !== t) t = guess - off2;
  return new Date(t).toISOString();
}

/** Parse schedule input: absolute ISO (Z/offset) or wall time in brand TZ. */
export function parseScheduleInstant(raw: string, timeZone: string): Date | null {
  const value = raw.trim();
  if (!value) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = wallTimeToIso(value, timeZone);
  return iso ? new Date(iso) : null;
}
