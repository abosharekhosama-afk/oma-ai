/**
 * Calendar-day maths in an IANA timezone, without a date library.
 * A "day key" is YYYY-MM-DD in that zone; zonedMidnight() returns the instant that day starts,
 * which correctly handles DST days of 23 or 25 hours (e.g. Asia/Jerusalem on 2026-10-25).
 */
const DAY = 86400_000;
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    fmt(tz);
    return true;
  } catch {
    return false;
  }
}

function parts(d: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const x of fmt(tz).formatToParts(d)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return p as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

/** Offset (ms) of `tz` from UTC at instant `d`. */
export function tzOffsetMs(d: Date, tz: string): number {
  const p = parts(d, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** YYYY-MM-DD of instant `d` in `tz`. */
export function dayKey(d: Date, tz: string): string {
  const p = parts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Instant at which calendar day `key` begins in `tz`. */
export function zonedMidnight(key: string, tz: string): Date {
  const utc = Date.parse(`${key}T00:00:00.000Z`);
  let guess = utc - tzOffsetMs(new Date(utc), tz);
  // Re-evaluate at the guess in case the offset changed between UTC midnight and local midnight.
  guess = utc - tzOffsetMs(new Date(guess), tz);
  return new Date(guess);
}

/** Calendar arithmetic on day keys (timezone-free). */
export function addDays(key: string, n: number): string {
  return new Date(Date.parse(`${key}T00:00:00.000Z`) + n * DAY).toISOString().slice(0, 10);
}

/** Whole calendar days from key a to key b. */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/** Monday = 0 … Sunday = 6, for a day key. */
export function weekdayMon0(key: string): number {
  return (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Start instant of the local day containing `d`. */
export function startOfZonedDay(d: Date, tz: string): Date {
  return zonedMidnight(dayKey(d, tz), tz);
}
