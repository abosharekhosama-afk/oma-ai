import { isUsableTimezone, localWeekdayHour } from './optimal-send-times';

export const QUEUE_DEFAULT_SLOTS_PER_DAY = 3;
export const QUEUE_MAX_SLOTS_PER_DAY = 10;
export const QUEUE_HORIZON_DAYS = 21;

export type QueueSlotCandidate = {
  dayOfWeek: number;
  timeLocal: string;
  origin: 'optimal' | 'manual';
  enabled?: boolean;
};

export type OccupiedSlot = { at: Date };

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

function offsetMs(instant: Date, tz: string): number {
  const parts: Record<string, number> = {};
  for (const x of fmt(tz).formatToParts(instant)) {
    if (x.type !== 'literal') parts[x.type] = Number(x.value);
  }
  const asUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function addUtcDays(dateKey: string, n: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function padTime(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function minuteOfDayToTime(minuteOfDay: number): string {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minuteOfDay)));
  return padTime(Math.floor(safe / 60), safe % 60);
}

/** Instant of a local wall clock `YYYY-MM-DD` + `HH:mm` in `tz`. */
export function zonedWallInstant(dateKey: string, timeLocal: string, tz: string): Date {
  const zone = isUsableTimezone(tz) ? tz : 'UTC';
  const [hRaw, mRaw] = timeLocal.split(':');
  const hh = String(Number(hRaw) || 0).padStart(2, '0');
  const mm = String(Number(mRaw) || 0).padStart(2, '0');
  const utc = Date.parse(`${dateKey}T${hh}:${mm}:00.000Z`);
  let guess = utc - offsetMs(new Date(utc), zone);
  guess = utc - offsetMs(new Date(guess), zone);
  return new Date(guess);
}

export function normalizeTimeLocal(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return padTime(hh, mm);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayNameToDow(name: string): number {
  const i = DAY_NAMES.findIndex((d) => d.toLowerCase() === name.trim().toLowerCase());
  return i >= 0 ? i : 0;
}

export function dowToDayName(dow: number): string {
  return DAY_NAMES[((dow % 7) + 7) % 7]!;
}

export function clampSlotsPerDay(n: number): number {
  if (!Number.isFinite(n)) return QUEUE_DEFAULT_SLOTS_PER_DAY;
  return Math.min(QUEUE_MAX_SLOTS_PER_DAY, Math.max(1, Math.floor(n)));
}

/**
 * Merge suggested (optimal) times with manual overrides. A disabled manual row
 * hides a suggested slot at the same weekday/time. Enabled manuals are kept
 * even when suggestions are off.
 */
export function resolveQueueSlots(input: {
  useSuggested: boolean;
  suggested: QueueSlotCandidate[];
  manual: QueueSlotCandidate[];
}): QueueSlotCandidate[] {
  const manuals = input.manual.filter((s) => normalizeTimeLocal(s.timeLocal));
  const disabled = new Set(
    manuals
      .filter((s) => s.enabled === false)
      .map((s) => `${s.dayOfWeek}:${normalizeTimeLocal(s.timeLocal)}`),
  );
  const out: QueueSlotCandidate[] = [];
  const seen = new Set<string>();
  const push = (slot: QueueSlotCandidate) => {
    const time = normalizeTimeLocal(slot.timeLocal);
    if (!time) return;
    const key = `${slot.dayOfWeek}:${time}`;
    if (seen.has(key) || disabled.has(key)) return;
    seen.add(key);
    out.push({ ...slot, timeLocal: time, enabled: slot.enabled !== false });
  };
  if (input.useSuggested) {
    for (const s of input.suggested) push({ ...s, origin: 'optimal', enabled: true });
  }
  for (const s of manuals.filter((m) => m.enabled !== false)) push({ ...s, origin: 'manual' });
  return out.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.timeLocal.localeCompare(b.timeLocal));
}

export function nextFreeQueueSlot(input: {
  now: Date;
  timezone: string;
  slots: QueueSlotCandidate[];
  slotsPerDay?: number;
  occupied?: Date[];
  horizonDays?: number;
  windowStart?: string | null;
  windowEnd?: string | null;
}): { at: Date; dayOfWeek: number; timeLocal: string; origin: 'optimal' | 'manual' } | null {
  const tz = isUsableTimezone(input.timezone) ? input.timezone : 'UTC';
  const perDay = clampSlotsPerDay(input.slotsPerDay ?? QUEUE_DEFAULT_SLOTS_PER_DAY);
  const horizon = input.horizonDays ?? QUEUE_HORIZON_DAYS;
  const today = localWeekdayHour(input.now, tz);
  const occupied = new Set(
    (input.occupied ?? []).map((d) => {
      const p = localWeekdayHour(d, tz);
      return `${p.dayKey}:${String(p.hourLocal).padStart(2, '0')}`;
    }),
  );
  const windowStart = input.windowStart ? normalizeTimeLocal(input.windowStart) : null;
  const windowEnd = input.windowEnd ? normalizeTimeLocal(input.windowEnd) : null;

  for (let i = 0; i < horizon; i += 1) {
    const dateKey = addUtcDays(today.dayKey, i);
    const dow = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
    const daySlots = input.slots
      .filter((s) => s.dayOfWeek === dow && s.enabled !== false)
      .filter((s) => {
        const time = normalizeTimeLocal(s.timeLocal);
        if (!time) return false;
        if (windowStart && time < windowStart) return false;
        if (windowEnd && time > windowEnd) return false;
        return true;
      })
      .sort((a, b) => a.timeLocal.localeCompare(b.timeLocal))
      .slice(0, perDay);
    for (const slot of daySlots) {
      const time = normalizeTimeLocal(slot.timeLocal)!;
      const at = zonedWallInstant(dateKey, time, tz);
      if (at.getTime() <= input.now.getTime()) continue;
      const hourKey = `${dateKey}:${time.slice(0, 2)}`;
      if (occupied.has(hourKey)) continue;
      return { at, dayOfWeek: dow, timeLocal: time, origin: slot.origin };
    }
  }
  return null;
}
