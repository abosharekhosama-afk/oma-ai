/** Production calendar day keys use the workspace timezone, not a capture fixture. */
export const WORKSPACE_TZ = 'Asia/Dubai';

export function todayKey(timeZone = WORKSPACE_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function monthCursorFromKey(key: string): { year: number; monthIndex: number } {
  const [year, month] = key.split('-').map(Number);
  return { year: year || new Date().getUTCFullYear(), monthIndex: Math.max(0, (month || 1) - 1) };
}

export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const next = new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days));
  return next.toISOString().slice(0, 10);
}

/** Calendar day key N days after today in workspace TZ. */
export function daysFromToday(days: number, timeZone = WORKSPACE_TZ): string {
  return addDays(todayKey(timeZone), days);
}

export function formatCommentTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16).replace('T', ' ');
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: WORKSPACE_TZ,
  }).format(date);
}

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

/**
 * Convert a wall-clock value picked in the UI ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"/"YYYY-MM-DD HH:mm")
 * into a real ISO instant, interpreting it in the workspace timezone.
 * Day-only values default to `defaultTime` (HH:mm). Returns null for anything unparseable.
 */
export function wallTimeToIso(
  value: string | null | undefined,
  timeZone = WORKSPACE_TZ,
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
