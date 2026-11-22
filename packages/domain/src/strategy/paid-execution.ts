import { z } from 'zod';
import {
  STRATEGY_PAID_PLATFORMS,
  type StrategyExperimentStatus,
  type StrategyPaidPlatform,
} from './tracks-v2';

/**
 * DEC-029 4.7: paid execution — experiment status/results after approval,
 * manual/CSV spend entries, and flight pacing (planned vs actual spend).
 */

const EXPERIMENT_TRANSITIONS: Record<StrategyExperimentStatus, StrategyExperimentStatus[]> = {
  PLANNED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['CONCLUDED', 'CANCELLED'],
  CONCLUDED: [],
  CANCELLED: [],
};

export function canMoveExperiment(from: StrategyExperimentStatus, to: StrategyExperimentStatus) {
  return from === to || EXPERIMENT_TRANSITIONS[from].includes(to);
}

export const experimentUpdateSchema = z.strictObject({
  status: z.enum(['PLANNED', 'RUNNING', 'CONCLUDED', 'CANCELLED']),
  result_summary: z.string().trim().max(2000).nullish(),
  winner_variant_key: z
    .string()
    .trim()
    .regex(/^[A-Z]$/)
    .nullish(),
  results: z
    .array(
      z.strictObject({
        variant_key: z
          .string()
          .trim()
          .regex(/^[A-Z]$/),
        value: z.number().finite(),
        sample_size: z.number().int().min(0).nullish(),
      }),
    )
    .max(5)
    .nullish(),
});
export type ExperimentUpdate = z.infer<typeof experimentUpdateSchema>;

/** Field-level problems for an experiment update, given its variants. */
export function experimentUpdateIssues(
  update: ExperimentUpdate,
  variantKeys: string[],
): Array<{ field: string; code: string }> {
  const issues: Array<{ field: string; code: string }> = [];
  if (update.winner_variant_key && !variantKeys.includes(update.winner_variant_key)) {
    issues.push({ field: 'winner_variant_key', code: 'UNKNOWN_VARIANT' });
  }
  for (const r of update.results ?? []) {
    if (!variantKeys.includes(r.variant_key))
      issues.push({ field: 'results', code: 'UNKNOWN_VARIANT' });
  }
  if (update.status === 'CONCLUDED' && !update.result_summary?.trim()) {
    issues.push({ field: 'result_summary', code: 'RESULT_REQUIRED' });
  }
  return issues;
}

export const paidSpendEntrySchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(STRATEGY_PAID_PLATFORMS),
  amount: z.number().finite().min(0).max(1_000_000_000),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/),
  impressions: z.number().int().min(0).nullish(),
  clicks: z.number().int().min(0).nullish(),
  conversions: z.number().int().min(0).nullish(),
  flight_key: z
    .string()
    .trim()
    .max(48)
    .regex(/^([a-z0-9][a-z0-9-]*)?$/)
    .nullish(),
});
export type PaidSpendEntryInput = z.infer<typeof paidSpendEntrySchema>;

const PLATFORM_ALIASES: Record<string, StrategyPaidPlatform> = {
  meta: 'META',
  facebook: 'FACEBOOK',
  fb: 'FACEBOOK',
  instagram: 'INSTAGRAM',
  ig: 'INSTAGRAM',
  tiktok: 'TIKTOK',
  snapchat: 'SNAPCHAT',
  snap: 'SNAPCHAT',
  x: 'X',
  twitter: 'X',
  linkedin: 'LINKEDIN',
  youtube: 'YOUTUBE',
  google: 'GOOGLE_SEARCH',
  google_search: 'GOOGLE_SEARCH',
  'google ads': 'GOOGLE_SEARCH',
  google_ads: 'GOOGLE_SEARCH',
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';' || ch === '\t') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const HEADER_ALIASES: Record<string, string> = {
  date: 'date',
  day: 'date',
  reporting_starts: 'date',
  platform: 'platform',
  channel: 'platform',
  amount: 'amount',
  spend: 'amount',
  amount_spent: 'amount',
  cost: 'amount',
  currency: 'currency',
  impressions: 'impressions',
  clicks: 'clicks',
  link_clicks: 'clicks',
  conversions: 'conversions',
  results: 'conversions',
  flight: 'flight_key',
  flight_key: 'flight_key',
};

/** Normalise a date cell (YYYY-MM-DD, YYYY/MM/DD or DD/MM/YYYY) to YYYY-MM-DD. */
function normDate(raw: string): string | null {
  const v = raw.trim();
  let m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return null;
}

const intOrNull = (v: string | undefined) => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

export type CsvRowError = { line: number; code: string; field?: string };

/**
 * Parse an ads-manager style CSV export. Header row required; columns are matched by
 * name (date, platform, amount/spend/cost, currency, impressions, clicks, conversions, flight).
 * Missing platform/currency columns fall back to the defaults. Never guesses an amount.
 */
export function parsePaidSpendCsv(
  csv: string,
  defaults: { platform?: StrategyPaidPlatform | null; currency?: string | null } = {},
  maxRows = 2000,
): { rows: PaidSpendEntryInput[]; errors: CsvRowError[] } {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (!lines.length) return { rows: [], errors: [{ line: 1, code: 'EMPTY' }] };
  const header = splitCsvLine(lines[0]!).map(
    (h) =>
      HEADER_ALIASES[
        h
          .toLowerCase()
          .replace(/\(.*?\)/g, '')
          .replace(/[^a-z_ ]/g, '')
          .trim()
          .replace(/\s+/g, '_')
      ] ?? '',
  );
  if (!header.includes('date') || !header.includes('amount')) {
    return { rows: [], errors: [{ line: 1, code: 'HEADER_MISSING_DATE_OR_AMOUNT' }] };
  }
  const rows: PaidSpendEntryInput[] = [];
  const errors: CsvRowError[] = [];
  lines.slice(1, maxRows + 1).forEach((line, i) => {
    const lineNo = i + 2;
    const cells = splitCsvLine(line);
    const get = (k: string) => {
      const idx = header.indexOf(k);
      return idx >= 0 ? cells[idx] : undefined;
    };
    const date = normDate(get('date') ?? '');
    if (!date) return errors.push({ line: lineNo, code: 'INVALID_DATE', field: 'date' });
    const rawPlatform = (get('platform') ?? '').trim();
    const platform =
      (rawPlatform &&
        (PLATFORM_ALIASES[rawPlatform.toLowerCase()] ??
          (STRATEGY_PAID_PLATFORMS as readonly string[]).find(
            (p) => p === rawPlatform.toUpperCase(),
          ))) ||
      (!rawPlatform ? defaults.platform : null);
    if (!platform)
      return errors.push({ line: lineNo, code: 'UNKNOWN_PLATFORM', field: 'platform' });
    const rawAmount = (get('amount') ?? '').replace(/[^\d.-]/g, '');
    const amount = Number(rawAmount);
    if (!/\d/.test(rawAmount) || !Number.isFinite(amount) || amount < 0) {
      return errors.push({ line: lineNo, code: 'INVALID_AMOUNT', field: 'amount' });
    }
    const currency = (
      (get('currency') ?? '').trim().toUpperCase() ||
      defaults.currency ||
      ''
    ).toUpperCase();
    const parsed = paidSpendEntrySchema.safeParse({
      date,
      platform,
      amount: Math.round(amount * 100) / 100,
      currency,
      impressions: intOrNull(get('impressions')),
      clicks: intOrNull(get('clicks')),
      conversions: intOrNull(get('conversions')),
      flight_key: (get('flight_key') ?? '').trim().toLowerCase() || null,
    });
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      return errors.push({
        line: lineNo,
        code: field === 'currency' ? 'INVALID_CURRENCY' : 'INVALID_ROW',
        field,
      });
    }
    rows.push(parsed.data);
  });
  if (lines.length - 1 > maxRows) errors.push({ line: maxRows + 2, code: 'TOO_MANY_ROWS' });
  return { rows, errors };
}

const DAY = 86_400_000;
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export type FlightPacing = {
  days_total: number;
  days_elapsed: number;
  expected_spend: number | null;
  actual_spend: number;
  pacing_pct: number | null;
  status: 'not_started' | 'on_pace' | 'underspending' | 'overspending' | 'ended' | 'no_budget';
};

/** Linear pacing: expected spend to date = budget × elapsed/total days. ±15% is on pace. */
export function flightPacing(
  flight: { startDate: Date; endDate: Date; budget: number | null },
  actualSpend: number,
  now: Date,
): FlightPacing {
  const start = utcDay(flight.startDate);
  const end = utcDay(flight.endDate);
  const today = utcDay(now);
  const daysTotal = Math.max(1, Math.round((end - start) / DAY) + 1);
  const daysElapsed =
    today < start ? 0 : Math.min(daysTotal, Math.round((today - start) / DAY) + 1);
  const actual = Math.round(actualSpend * 100) / 100;
  if (flight.budget == null || flight.budget <= 0) {
    return {
      days_total: daysTotal,
      days_elapsed: daysElapsed,
      expected_spend: null,
      actual_spend: actual,
      pacing_pct: null,
      status: 'no_budget',
    };
  }
  const expected = Math.round(((flight.budget * daysElapsed) / daysTotal) * 100) / 100;
  const pct = expected > 0 ? Math.round((actual / expected) * 100) : null;
  let status: FlightPacing['status'];
  if (daysElapsed === 0) status = actual > 0 ? 'overspending' : 'not_started';
  else if (pct != null && pct > 115) status = 'overspending';
  else if (today > end) status = 'ended';
  else if (pct != null && pct < 85) status = 'underspending';
  else status = 'on_pace';
  return {
    days_total: daysTotal,
    days_elapsed: daysElapsed,
    expected_spend: expected,
    actual_spend: actual,
    pacing_pct: pct,
    status,
  };
}
