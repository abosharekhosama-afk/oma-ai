import { DomainError } from '@oma/domain';

export const MAX_RANGE_DAYS = 366;
const DAY = 86400_000;

export type AnalyticsRange = { from: Date; to: Date; days: number; bucket: 'day' | 'week' };

/**
 * Resolve the period filter. `period` = 7|30|90 (days ending now) or explicit from/to (ISO dates).
 * `to` is inclusive to the end of that day. Buckets are daily up to 31 days, weekly beyond.
 */
export function resolveRange(
  q: { period?: string; from?: string; to?: string },
  now = new Date(),
): AnalyticsRange {
  let from: Date;
  let to: Date;
  if (q.from || q.to) {
    if (!q.from || !q.to) throw bad('from and to are both required for a custom range');
    from = parseDay(q.from, 'from');
    to = new Date(parseDay(q.to, 'to').getTime() + DAY - 1);
  } else {
    const days = q.period ? Number(q.period) : 30;
    if (![7, 30, 90].includes(days)) throw bad('period must be 7, 30 or 90');
    to = now;
    from = new Date(Math.floor((now.getTime() - (days - 1) * DAY) / DAY) * DAY);
  }
  if (from > to) throw bad('from must be before to');
  const days = Math.ceil((to.getTime() - from.getTime() + 1) / DAY);
  if (days > MAX_RANGE_DAYS) throw bad(`range must be at most ${MAX_RANGE_DAYS} days`);
  return { from, to, days, bucket: days <= 31 ? 'day' : 'week' };
}

function parseDay(v: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`${field} must be YYYY-MM-DD`);
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw bad(`${field} is not a valid date`);
  return d;
}

function bad(message: string) {
  return new DomainError('VALIDATION_FAILED', message, 400, 'errors.validation');
}

/** Bucket keys (YYYY-MM-DD, UTC; weeks start Monday) covering the range, for zero-filled series. */
export function bucketKeys(range: AnalyticsRange): string[] {
  const keys: string[] = [];
  let d = startOfBucket(range.from, range.bucket);
  while (d <= range.to) {
    keys.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + (range.bucket === 'day' ? DAY : 7 * DAY));
  }
  return keys;
}

export function startOfBucket(d: Date, bucket: 'day' | 'week'): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (bucket === 'day') return day;
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - dow * DAY);
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
