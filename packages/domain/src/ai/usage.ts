/** Admin AI usage summary (DEC-027, PR 3.8). Pure: callers pass rows of one month. */

export type AiUsageRow = {
  useCase: string;
  status: string;
  attemptCount: number;
  settledCost: string | number | null;
  refusalReason: string | null;
  schemaVersion: string;
};

export type AiUsageBucket = {
  use_case: string;
  runs: number;
  succeeded: number;
  failed: number;
  schema_invalid: number;
  refused: number;
  repaired: number;
  human_rejected: number;
  legacy_v1: number;
  cost_usd: number;
};

const FAILED = new Set(['FAILED', 'SCHEMA_INVALID', 'REFUSED', 'CANCELLED']);

function emptyBucket(useCase: string): AiUsageBucket {
  return {
    use_case: useCase,
    runs: 0,
    succeeded: 0,
    failed: 0,
    schema_invalid: 0,
    refused: 0,
    repaired: 0,
    human_rejected: 0,
    legacy_v1: 0,
    cost_usd: 0,
  };
}

function add(bucket: AiUsageBucket, row: AiUsageRow) {
  bucket.runs += 1;
  if (row.status === 'SUCCEEDED') bucket.succeeded += 1;
  if (FAILED.has(row.status)) bucket.failed += 1;
  if (row.status === 'SCHEMA_INVALID') bucket.schema_invalid += 1;
  if (row.status === 'REFUSED') bucket.refused += 1;
  if (row.attemptCount > 1) bucket.repaired += 1;
  if (row.refusalReason === 'HUMAN_REJECTED') bucket.human_rejected += 1;
  if (row.schemaVersion === '1') bucket.legacy_v1 += 1;
  const cost = Number(row.settledCost ?? 0);
  bucket.cost_usd += Number.isFinite(cost) ? cost : 0;
}

export function summarizeAiUsage(rows: readonly AiUsageRow[]): {
  totals: AiUsageBucket;
  by_use_case: AiUsageBucket[];
} {
  const totals = emptyBucket('all');
  const map = new Map<string, AiUsageBucket>();
  for (const row of rows) {
    add(totals, row);
    const bucket = map.get(row.useCase) ?? emptyBucket(row.useCase);
    add(bucket, row);
    map.set(row.useCase, bucket);
  }
  const round = (b: AiUsageBucket) => ({ ...b, cost_usd: Math.round(b.cost_usd * 1e6) / 1e6 });
  return {
    totals: round(totals),
    by_use_case: [...map.values()]
      .map(round)
      .sort((a, b) => b.cost_usd - a.cost_usd || b.runs - a.runs),
  };
}

/** Parse YYYY-MM (UTC) into [start, end); defaults to the current UTC month. */
export function aiUsageMonthRange(month?: string | null, now = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? '');
  const year = m ? Number(m[1]) : now.getUTCFullYear();
  const mon = m ? Number(m[2]) - 1 : now.getUTCMonth();
  if (mon < 0 || mon > 11) return aiUsageMonthRange(null, now);
  const start = new Date(Date.UTC(year, mon, 1));
  const end = new Date(Date.UTC(year, mon + 1, 1));
  return { start, end, month: `${year}-${String(mon + 1).padStart(2, '0')}` };
}

export const AI_RUNS_PAGE_MAX = 100;

/** Opaque cursor for createdAt/id keyset pagination. */
export function encodeAiRunCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeAiRunCursor(cursor?: string | null): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const createdAt = new Date(iso ?? '');
    if (!id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
