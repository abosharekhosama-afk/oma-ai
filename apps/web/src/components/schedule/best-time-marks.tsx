'use client';

import type { OptimalSlot } from '../../lib/optimal-times-api';

function dateKeyDow(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function slotsForDateKey(slots: OptimalSlot[] | undefined, dateKey: string): OptimalSlot[] {
  const dow = dateKeyDow(dateKey);
  return (slots ?? [])
    .filter((s) => s.day_of_week === dow)
    .sort((a, b) => a.rank - b.rank || a.minute_of_day - b.minute_of_day);
}

export function isBestScheduledTime(
  iso: string | null | undefined,
  timezone: string,
  slots: OptimalSlot[] | undefined,
): boolean {
  if (!iso || !slots?.length) return false;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return false;
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = dowMap[parts.weekday ?? ''] ?? -1;
  const hour = Number(parts.hour);
  return slots.some((s) => s.day_of_week === dow && Math.floor(s.minute_of_day / 60) === hour);
}

export function BestTimeMarks({
  dateKey,
  slots,
  tooltip,
}: {
  dateKey: string;
  slots?: OptimalSlot[];
  tooltip: (time: string) => string;
}) {
  const daySlots = slotsForDateKey(slots, dateKey).slice(0, 4);
  if (!daySlots.length) return null;
  return (
    <div className="oma-sched-best-times" data-testid={`sched-best-times-${dateKey}`}>
      {daySlots.map((slot) => {
        const time =
          slot.time_label || `${String(Math.floor(slot.minute_of_day / 60)).padStart(2, '0')}:00`;
        return (
          <span
            key={`${slot.day_of_week}-${slot.minute_of_day}-${slot.rank}`}
            className={`oma-sched-best-dot oma-sched-best-dot--${slot.label}`}
            title={tooltip(time)}
            aria-label={tooltip(time)}
          />
        );
      })}
    </div>
  );
}

export function BestTimeInlineMark({ active, label }: { active: boolean; label: string }) {
  if (!active) return null;
  return <span className="oma-sched-best-inline" title={label} aria-label={label} />;
}
