import { DomainError } from '@oma/domain';
import { addDays, dayKey, diffDays, weekdayMon0, zonedMidnight } from '../common/zoned-time';

export const MAX_RANGE_DAYS = 366;

/**
 * `tz` is the IANA zone the range and its buckets are computed in: the brand's scheduling
 * timezone (ContentPreferences.defaultTimezone), see resolveAnalyticsTimezone().
 */
export type AnalyticsRange = {
  from: Date;
  to: Date;
  days: number;
  bucket: 'day' | 'week';
  tz?: string;
};

/**
 * Resolve the period filter. `period` = 7|30|90 (calendar days ending today) or explicit
 * from/to (YYYY-MM-DD). Day boundaries are local midnights in `tz`; `to` is inclusive to the
 * end of that local day. Buckets are daily up to 31 days, weekly beyond.
 */
export function resolveRange(
  q: { period?: string; from?: string; to?: string },
  now = new Date(),
  tz = 'UTC',
): AnalyticsRange {
  let from: Date;
  let to: Date;
  let days: number;
  if (q.from || q.to) {
    if (!q.from || !q.to) throw bad('from and to are both required for a custom range');
    checkDay(q.from, 'from');
    checkDay(q.to, 'to');
    days = diffDays(q.from, q.to) + 1;
    if (days < 1) throw bad('from must be before to');
    from = zonedMidnight(q.from, tz);
    to = new Date(zonedMidnight(addDays(q.to, 1), tz).getTime() - 1);
  } else {
    days = q.period ? Number(q.period) : 30;
    if (![7, 30, 90].includes(days)) throw bad('period must be 7, 30 or 90');
    to = now;
    from = zonedMidnight(addDays(dayKey(now, tz), -(days - 1)), tz);
  }
  if (from > to) throw bad('from must be before to');
  if (days > MAX_RANGE_DAYS) throw bad(`range must be at most ${MAX_RANGE_DAYS} days`);
  return { from, to, days, bucket: days <= 31 ? 'day' : 'week', tz };
}

function checkDay(v: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`${field} must be YYYY-MM-DD`);
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    throw bad(`${field} is not a valid date`);
  }
}

function bad(message: string) {
  return new DomainError('VALIDATION_FAILED', message, 400, 'errors.validation');
}

/** Bucket key (local YYYY-MM-DD of the day / Monday of the week in `tz`) for an instant. */
export function bucketKey(d: Date, bucket: 'day' | 'week', tz = 'UTC'): string {
  const key = dayKey(d, tz);
  return bucket === 'day' ? key : addDays(key, -weekdayMon0(key));
}

/** Bucket keys covering the range (local days, weeks start Monday), for zero-filled series. */
export function bucketKeys(range: AnalyticsRange): string[] {
  const tz = range.tz ?? 'UTC';
  const keys: string[] = [];
  let k = bucketKey(range.from, range.bucket, tz);
  const step = range.bucket === 'day' ? 1 : 7;
  while (zonedMidnight(k, tz) <= range.to) {
    keys.push(k);
    k = addDays(k, step);
  }
  return keys;
}

/** Start instant of the bucket containing `d` (local midnight in `tz`). */
export function startOfBucket(d: Date, bucket: 'day' | 'week', tz = 'UTC'): Date {
  return zonedMidnight(bucketKey(d, bucket, tz), tz);
}

export function rate(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

export function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * Approval cycle stats from an ordered event stream per item.
 * Events: REQUEST | APPROVE | REQUEST_CHANGES | REJECT. Time-to-approval = first REQUEST → first APPROVE after it.
 */
export function approvalStats(
  events: Array<{ itemId: string; action: string; at: Date }>,
  range: { from: Date; to: Date },
) {
  const byItem = new Map<string, Array<{ action: string; at: Date }>>();
  for (const e of events) {
    const list = byItem.get(e.itemId) ?? [];
    list.push(e);
    byItem.set(e.itemId, list);
  }
  const hours: number[] = [];
  let approved = 0;
  let rejected = 0;
  let changes = 0;
  let submitted = 0;
  const roundsPerItem: number[] = [];
  const inRange = (d: Date) => d >= range.from && d <= range.to;
  for (const list of byItem.values()) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    let firstRequest: Date | null = null;
    let itemChanges = 0;
    let decided = false;
    for (const e of list) {
      if (e.action === 'REQUEST') {
        firstRequest ??= e.at;
        if (inRange(e.at)) submitted++;
      } else if (e.action === 'REQUEST_CHANGES') {
        itemChanges++;
        if (inRange(e.at)) changes++;
      } else if (e.action === 'APPROVE' && inRange(e.at)) {
        approved++;
        decided = true;
        if (firstRequest) hours.push((e.at.getTime() - firstRequest.getTime()) / 3600_000);
      } else if (e.action === 'REJECT' && inRange(e.at)) {
        rejected++;
        decided = true;
      }
    }
    if (decided) roundsPerItem.push(itemChanges);
  }
  return {
    submitted,
    approved,
    rejected,
    changes_requested: changes,
    avg_hours_to_approval: avg(hours),
    avg_revision_rounds: avg(roundsPerItem),
    rejection_rate: rate(rejected, approved + rejected),
  };
}
