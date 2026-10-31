import { FALLBACK_SCHEDULE_TZ, wallTimeToIso } from '@oma/domain/browser';

export { wallTimeToIso, FALLBACK_SCHEDULE_TZ };

/** Production calendar day keys use the brand timezone, not UTC midnight. */
export function todayKey(timeZone: string = FALLBACK_SCHEDULE_TZ): string {
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

/** Calendar day key N days after today in the given IANA timezone. */
export function daysFromToday(days: number, timeZone: string = FALLBACK_SCHEDULE_TZ): string {
  return addDays(todayKey(timeZone), days);
}

export function formatCommentTime(
  iso: string,
  locale: string,
  timeZone: string = FALLBACK_SCHEDULE_TZ,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16).replace('T', ' ');
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date);
}
