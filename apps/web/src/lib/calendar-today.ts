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
