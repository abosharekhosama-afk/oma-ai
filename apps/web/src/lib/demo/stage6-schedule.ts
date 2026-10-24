import type { DemoGraph, PublishDisplay } from '@oma/demo';
import { todayKey } from '../calendar-today';

export type ScheduleRow = DemoGraph['scheduledPosts'][number];

export type ScheduleView = 'calendar' | 'agenda' | 'queue';

export type ScheduleFilters = {
  q: string;
  brandId: string;
  campaignId: string;
  channel: string;
  owner: string;
  state: string;
  readiness: 'all' | 'ready' | 'blocked' | 'integration';
  track: string;
};

export const EMPTY_SCHEDULE_FILTERS: ScheduleFilters = {
  q: '',
  brandId: 'all',
  campaignId: 'all',
  channel: 'all',
  owner: 'all',
  state: 'all',
  readiness: 'all',
  track: 'all',
};

export type ScheduleBucket =
  'saved' | 'planned' | 'approval_blocked' | 'ready' | 'scheduled' | 'publishing_not_connected';

export function bucketForScheduleRow(row: ScheduleRow): ScheduleBucket {
  if (!row.plannedAt) return 'saved';
  if (row.state === 'SCHEDULED_PREVIEW') return 'scheduled';
  if (row.state === 'PUBLISHED_SAMPLE') return 'publishing_not_connected';
  if (row.state === 'READY') return 'ready';
  if (row.state === 'BLOCKED') {
    const approvalOpen = row.readiness?.some((check) => check.kind === 'approval' && !check.ok);
    return approvalOpen ? 'approval_blocked' : 'planned';
  }
  return 'planned';
}

export function displayForScheduleBucket(bucket: ScheduleBucket): PublishDisplay {
  if (bucket === 'saved') return 'DRAFT';
  if (bucket === 'approval_blocked') return 'PARTIALLY_APPROVED';
  if (bucket === 'ready') return 'APPROVED';
  if (bucket === 'scheduled') return 'SCHEDULED_LOCAL';
  if (bucket === 'publishing_not_connected') return 'PUBLISHING_NOT_CONNECTED';
  return 'PLANNED_DATE';
}

export function scheduleDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function internalReady(row: ScheduleRow): boolean {
  return row.readiness.filter((r) => r.kind !== 'integration').every((r) => r.ok);
}

export function hasIntegrationBlocker(row: ScheduleRow): boolean {
  return row.readiness.some((r) => r.kind === 'integration' && !r.ok);
}

export function filterSchedule(
  rows: ScheduleRow[],
  filters: ScheduleFilters,
  locale: 'en' | 'ar',
): ScheduleRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.brandId !== 'all' && row.brandId !== filters.brandId) return false;
    if (filters.campaignId !== 'all' && row.campaignId !== filters.campaignId) return false;
    if (filters.channel !== 'all' && !row.channels.includes(filters.channel)) return false;
    if (filters.owner !== 'all' && row.owner !== filters.owner) return false;
    if (filters.state !== 'all' && row.state !== filters.state) return false;
    if (filters.track !== 'all' && row.track !== filters.track) return false;
    if (filters.readiness === 'ready' && !internalReady(row)) return false;
    if (filters.readiness === 'blocked' && row.state !== 'BLOCKED' && internalReady(row))
      return false;
    if (filters.readiness === 'integration' && !hasIntegrationBlocker(row)) return false;
    if (!q) return true;
    const hay = [
      row.title[locale],
      row.title.en,
      row.caption.en,
      row.owner,
      row.channels.join(' '),
      row.state,
      row.contentId,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function activeScheduleFilterCount(filters: ScheduleFilters): number {
  let n = 0;
  if (filters.q.trim()) n += 1;
  if (filters.brandId !== 'all') n += 1;
  if (filters.campaignId !== 'all') n += 1;
  if (filters.channel !== 'all') n += 1;
  if (filters.owner !== 'all') n += 1;
  if (filters.state !== 'all') n += 1;
  if (filters.readiness !== 'all') n += 1;
  if (filters.track !== 'all') n += 1;
  return n;
}

export function groupScheduleByDay(rows: ScheduleRow[]): Map<string, ScheduleRow[]> {
  const map = new Map<string, ScheduleRow[]>();
  for (const row of [...rows].sort((a, b) => a.plannedAt.localeCompare(b.plannedAt))) {
    const key = scheduleDayKey(row.plannedAt);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

/** Build 7-day window starting Monday of the week containing `anchor`. */
export function weekDays(anchor = todayKey()): string[] {
  const d = new Date(`${anchor}T12:00:00+03:00`);
  const day = d.getUTCDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  const out: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() + i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export function shiftWeek(anchor: string, deltaWeeks: number): string {
  const d = new Date(`${anchor}T12:00:00+03:00`);
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

export function isValidPlannedAt(value: string): boolean {
  if (!value.trim()) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export function readinessScore(row: ScheduleRow): { ok: number; total: number; pct: number } {
  const internal = row.readiness.filter((r) => r.kind !== 'integration');
  const ok = internal.filter((r) => r.ok).length;
  const total = internal.length || 1;
  return { ok, total, pct: Math.round((ok / total) * 100) };
}
