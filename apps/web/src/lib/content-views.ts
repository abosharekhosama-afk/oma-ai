/**
 * Pure helpers for the Planable-style Content views (calendar math, URL state,
 * drag-and-drop rules, keyboard stepping, calendar display settings).
 * Framework-free so they are unit-testable.
 */
import type { ContentViewMode } from './demo/stage3-content';

/* ── dates ─────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;

function keyToUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
}

export function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isDayKey(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(keyToUtc(v));
}

export function shiftDayKey(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

/** ISO-8601 week number (W44 for 2026-10-26). */
export function isoWeekNumber(key: string): number {
  const d = new Date(keyToUtc(key));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
}

/** First day of the week containing `key`, for a given start (0 Sun, 1 Mon, 6 Sat). */
export function weekStartKey(key: string, weekStartsOn: 0 | 1 | 6): string {
  const dow = new Date(keyToUtc(key)).getUTCDay();
  const back = (dow - weekStartsOn + 7) % 7;
  return shiftDayKey(key, -back);
}

export function weekKeys(key: string, weekStartsOn: 0 | 1 | 6): string[] {
  const start = weekStartKey(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(start, i));
}

export function isWeekendKey(key: string, weekend: number[] = [0, 6]): boolean {
  return weekend.includes(new Date(keyToUtc(key)).getUTCDay());
}

/** Calendar navigation: month span moves by month, week span by 7 days. */
export function stepCalendar(anchor: string, span: 'month' | 'week', delta: number): string {
  if (span === 'week') return shiftDayKey(anchor, delta * 7);
  const [y, m] = anchor.split('-').map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1 + delta, 1));
  return utcToKey(d.getTime());
}

/* ── URL state ─────────────────────────────────────────────── */

export type ContentUrlState = {
  view: ContentViewMode;
  item: string | null;
  span: 'month' | 'week';
  date: string | null;
  approvals: boolean;
};

const VIEWS: ContentViewMode[] = ['calendar', 'feed', 'grid', 'list'];

export function parseContentUrl(search: string | URLSearchParams): ContentUrlState {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const v = p.get('view') as ContentViewMode | null;
  const date = p.get('date');
  return {
    view: v && VIEWS.includes(v) ? v : 'calendar',
    item: p.get('item') || null,
    span: p.get('span') === 'week' ? 'week' : 'month',
    date: isDayKey(date) ? date : null,
    approvals: p.get('approvals') === 'mine',
  };
}

/** Writes the state into `params` (keeps unrelated params such as campaign). */
export function writeContentUrl(
  params: URLSearchParams,
  s: Partial<ContentUrlState>,
): URLSearchParams {
  const set = (k: string, v: string | null | undefined) =>
    v ? params.set(k, v) : params.delete(k);
  if (s.view !== undefined) set('view', s.view);
  if (s.item !== undefined) set('item', s.item);
  if (s.span !== undefined) set('span', s.span === 'week' ? 'week' : null);
  if (s.date !== undefined) set('date', s.date);
  if (s.approvals !== undefined) set('approvals', s.approvals ? 'mine' : null);
  return params;
}

/* ── drag & drop ───────────────────────────────────────────── */

export type DropRow = {
  scheduleState?: string | null;
  approvalState?: string | null;
  status?: string | null;
};

export type DropDecision =
  | { ok: true; mode: 'reschedule' | 'plan' }
  | { ok: false; reason: 'APPROVAL_REQUIRED' | 'PUBLISHED' | 'SAME_DAY' };

/**
 * Whether a post may be dropped onto `targetDay`. Scheduled posts are re-scheduled
 * (must stay approved when the policy requires it); unscheduled drafts only move
 * their planned date. Published posts never move.
 */
export function decideDrop(
  row: DropRow,
  fromDay: string | null,
  targetDay: string,
  policy: 'NONE' | 'OPTIONAL' | 'REQUIRED',
): DropDecision {
  if (fromDay === targetDay) return { ok: false, reason: 'SAME_DAY' };
  if (row.status === 'PUBLISHED_SAMPLE' || row.status === 'PUBLISHED')
    return { ok: false, reason: 'PUBLISHED' };
  if (row.scheduleState === 'SCHEDULED') {
    if (policy === 'REQUIRED' && row.approvalState !== 'APPROVED')
      return { ok: false, reason: 'APPROVAL_REQUIRED' };
    return { ok: true, mode: 'reschedule' };
  }
  return { ok: true, mode: 'plan' };
}

/* ── keyboard stepping in the preview modal ────────────────── */

/** -1 = previous post, +1 = next post, 0 = ignore. Left/right are mirrored in RTL. */
export function previewStep(key: string, dir: 'ltr' | 'rtl'): -1 | 0 | 1 {
  if (key === 'ArrowUp') return -1;
  if (key === 'ArrowDown') return 1;
  if (key === 'ArrowLeft') return dir === 'rtl' ? 1 : -1;
  if (key === 'ArrowRight') return dir === 'rtl' ? -1 : 1;
  return 0;
}

export function neighbourId(ids: string[], current: string | null, step: number): string | null {
  if (!current || ids.length === 0) return null;
  const i = ids.indexOf(current);
  if (i < 0) return null;
  const j = i + step;
  return j >= 0 && j < ids.length ? ids[j]! : null;
}

/* ── calendar display settings ─────────────────────────────── */

export type CalendarElement = 'approvals' | 'labels' | 'campaigns' | 'comments';

export type CalendarDisplay = {
  postSize: 'default' | 'compact';
  elements: CalendarElement[];
  showNotes: boolean;
  showCampaigns: boolean;
  showWeekends: boolean;
  fadePublished: boolean;
  weekStartsOn: 0 | 1 | 6;
};

export function defaultCalendarDisplay(locale: string): CalendarDisplay {
  return {
    postSize: 'default',
    elements: ['approvals', 'labels', 'campaigns', 'comments'],
    showNotes: true,
    showCampaigns: true,
    showWeekends: true,
    fadePublished: true,
    weekStartsOn: locale.toLowerCase().startsWith('ar') ? 6 : 1,
  };
}

export function sanitizeCalendarDisplay(raw: unknown, locale: string): CalendarDisplay {
  const d = defaultCalendarDisplay(locale);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<CalendarDisplay>;
  const all: CalendarElement[] = ['approvals', 'labels', 'campaigns', 'comments'];
  return {
    postSize: r.postSize === 'compact' ? 'compact' : 'default',
    elements: Array.isArray(r.elements) ? all.filter((e) => r.elements!.includes(e)) : d.elements,
    showNotes: typeof r.showNotes === 'boolean' ? r.showNotes : d.showNotes,
    showCampaigns: typeof r.showCampaigns === 'boolean' ? r.showCampaigns : d.showCampaigns,
    showWeekends: typeof r.showWeekends === 'boolean' ? r.showWeekends : d.showWeekends,
    fadePublished: typeof r.fadePublished === 'boolean' ? r.fadePublished : d.fadePublished,
    weekStartsOn:
      r.weekStartsOn === 0 || r.weekStartsOn === 1 || r.weekStartsOn === 6
        ? r.weekStartsOn
        : d.weekStartsOn,
  };
}

export const CAL_DISPLAY_KEY = 'oma.content.calendarDisplay.v1';
