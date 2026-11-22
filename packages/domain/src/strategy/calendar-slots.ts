import { zonedWallInstant } from '../analytics/publish-queue';
import type { ChannelCadenceInput, ContentPillarInput } from './tracks-v2';

/** DEC-029 4.2: approved plan → dated calendar slots (cadence × pillar share). */
export const STRATEGY_CALENDAR_LIMITS = {
  minWeeks: 1,
  maxWeeks: 12,
  defaultWeeks: 4,
  maxSlots: 200,
} as const;

/**
 * Local publishing hours for posts on the same day. The counter is shared by every
 * channel on that day, so two channels never get the same date + time (the calendar
 * showed stacked duplicates at 10:00 when each channel restarted the list).
 */
export const SLOT_HOURS = ['10:00', '13:00', '17:00', '20:00', '11:30', '15:00', '18:30', '21:30'];
/** One-off items (catalog products/services) prefer the midday hours. */
export const ONE_OFF_HOURS = [
  '12:00',
  '14:00',
  '16:00',
  '19:00',
  '12:30',
  '14:30',
  '16:30',
  '19:30',
];

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * First free local time on `dateKey`: the preferred hours in order, then a 5-minute
 * grid from 08:00. `taken` holds ISO instants already used and is updated.
 */
export function nextFreeSlotTime(input: {
  dateKey: string;
  timezone: string;
  taken: Set<string>;
  preferred?: readonly string[];
}): Date {
  const candidates = [...(input.preferred ?? SLOT_HOURS)];
  for (let m = 8 * 60; m < 23 * 60 + 55; m += 5) candidates.push(hhmm(m));
  for (const time of candidates) {
    const at = zonedWallInstant(input.dateKey, time, input.timezone);
    const key = at.toISOString();
    if (!input.taken.has(key)) {
      input.taken.add(key);
      return at;
    }
  }
  // A day with more than ~200 posts: fall back to minute offsets after 23:55.
  let at = zonedWallInstant(input.dateKey, '23:55', input.timezone);
  while (input.taken.has(at.toISOString())) at = new Date(at.getTime() + 60_000);
  input.taken.add(at.toISOString());
  return at;
}

/** True when two items share the same planned instant (used by tests + UI checks). */
export function findSlotCollisions(plannedAt: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const at of plannedAt) {
    const key = new Date(at).toISOString();
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes];
}

export type CalendarSlot = {
  /** Stable within a version + start date: `<week>:<channel>:<n>`. */
  slot_key: string;
  week: number;
  channel: string;
  format: string | null;
  pillar_key: string | null;
  planned_at: string;
};

export type CalendarPlan = {
  slots: CalendarSlot[];
  truncated: boolean;
  start_date: string;
  weeks: number;
};

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * Pillar weights from `share_target_pct`. Pillars without a share split what is
 * left of 100; if nothing is set every pillar weighs the same.
 */
export function pillarWeights(
  pillars: Array<Pick<ContentPillarInput, 'key' | 'share_target_pct'>>,
): Map<string, number> {
  const weights = new Map<string, number>();
  if (!pillars.length) return weights;
  const set = pillars.filter((p) => (p.share_target_pct ?? 0) > 0);
  const unset = pillars.filter((p) => !((p.share_target_pct ?? 0) > 0));
  const used = set.reduce((sum, p) => sum + (p.share_target_pct ?? 0), 0);
  const rest = unset.length ? Math.max(0, 100 - used) / unset.length : 0;
  for (const p of set) weights.set(p.key, p.share_target_pct ?? 0);
  for (const p of unset) weights.set(p.key, rest);
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) for (const p of pillars) weights.set(p.key, 1);
  return weights;
}

/**
 * Deterministic calendar: each active cadence row is spread evenly over each
 * week, then slots are assigned to pillars by largest deficit against their
 * share, so a 60/40 split stays 60/40 at any horizon.
 */
export function buildCalendarSlots(input: {
  cadence: ChannelCadenceInput[];
  pillars: Array<Pick<ContentPillarInput, 'key' | 'share_target_pct'>>;
  startDate: string;
  weeks: number;
  timezone: string;
  maxSlots?: number;
}): CalendarPlan {
  const weeks = Math.max(
    STRATEGY_CALENDAR_LIMITS.minWeeks,
    Math.min(STRATEGY_CALENDAR_LIMITS.maxWeeks, Math.floor(input.weeks)),
  );
  const maxSlots = input.maxSlots ?? STRATEGY_CALENDAR_LIMITS.maxSlots;
  const raw: Array<Omit<CalendarSlot, 'pillar_key'> & { sort: number }> = [];
  const taken = new Set<string>();
  for (let w = 0; w < weeks; w += 1) {
    for (const row of input.cadence) {
      const n = Math.max(0, Math.min(28, Math.floor(row.posts_per_week)));
      for (let i = 0; i < n; i += 1) {
        const day = Math.floor((i * 7) / n);
        const dateKey = addDays(input.startDate, w * 7 + day);
        const at = nextFreeSlotTime({ dateKey, timezone: input.timezone, taken });
        raw.push({
          slot_key: `${w}:${row.channel.trim().toLowerCase()}:${i}`,
          week: w,
          channel: row.channel,
          format: row.formats.length ? row.formats[i % row.formats.length]! : null,
          planned_at: at.toISOString(),
          sort: at.getTime(),
        });
      }
    }
  }
  raw.sort((a, b) => a.sort - b.sort || a.channel.localeCompare(b.channel));
  const truncated = raw.length > maxSlots;
  const kept = raw.slice(0, maxSlots);

  const weights = pillarWeights(input.pillars);
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  const assigned = new Map<string, number>([...weights.keys()].map((k) => [k, 0]));
  const slots: CalendarSlot[] = kept.map(({ sort: _sort, ...slot }, index) => {
    let best: string | null = null;
    let bestDeficit = -Infinity;
    for (const [key, weight] of weights) {
      const deficit = ((index + 1) * weight) / total - (assigned.get(key) ?? 0);
      if (deficit > bestDeficit) {
        best = key;
        bestDeficit = deficit;
      }
    }
    if (best) assigned.set(best, (assigned.get(best) ?? 0) + 1);
    return { ...slot, pillar_key: best };
  });
  return { slots, truncated, start_date: input.startDate, weeks };
}

/** Evenly spaced dates for one-off items (catalog products/services) across the horizon. */
export function spreadPlannedDates(input: {
  count: number;
  startDate: string;
  weeks: number;
  timezone: string;
  /** Instants already used by cadence slots; one-off items never land on them. */
  taken?: Iterable<string>;
}): string[] {
  if (input.count <= 0) return [];
  const days = Math.max(1, input.weeks) * 7;
  const step = days / input.count;
  const taken = new Set([...(input.taken ?? [])].map((at) => new Date(at).toISOString()));
  return Array.from({ length: input.count }, (_, i) =>
    nextFreeSlotTime({
      dateKey: addDays(input.startDate, Math.floor(i * step)),
      timezone: input.timezone,
      taken,
      preferred: ONE_OFF_HOURS,
    }).toISOString(),
  );
}

/** Work is due two days before the first planned post (never before the start). */
export function dueBeforePlanned(plannedAt: string, startDate: string, leadDays = 2): Date {
  const due = new Date(Date.parse(plannedAt) - leadDays * 86_400_000);
  const start = new Date(`${startDate}T00:00:00.000Z`);
  return due < start ? start : due;
}
