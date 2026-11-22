/**
 * DEC-029 PR 4.10 — monthly strategy review.
 * Findings are computed deterministically from measured data; the AI only turns them into a
 * reviewable plan proposal on a NEW draft version. Nothing here invents numbers.
 */

export type MonthlyReviewSeverity = 'info' | 'warn' | 'critical';

export type MonthlyReviewFinding = {
  code:
    | 'KPI_BEHIND'
    | 'KPI_AT_RISK'
    | 'KPI_ON_TRACK'
    | 'KPI_NOT_RECORDED'
    | 'KPI_NO_DATA'
    | 'CADENCE_SHORTFALL'
    | 'CADENCE_MISSED'
    | 'CADENCE_AHEAD'
    | 'PILLAR_DRIFT'
    | 'FLIGHT_OVERSPENDING'
    | 'FLIGHT_UNDERSPENDING'
    | 'EXPERIMENT_WINNER'
    | 'EXPERIMENT_INCONCLUSIVE'
    | 'ALL_ON_TRACK';
  severity: MonthlyReviewSeverity;
  subject: string;
  /** Measured facts behind the finding (never AI-generated). */
  facts: Record<string, number | string | null>;
};

export type MonthlyReviewInput = {
  month: string;
  kpis: Array<{
    name: string;
    source: 'measured' | 'manual';
    status: string;
    actual: number | null;
    target_number: number | null;
    progress_pct: number | null;
  }>;
  /** Expected vs published posts per channel in the reviewed month. */
  channels: Array<{ channel: string; expected: number; published: number }>;
  pillars: Array<{
    key: string;
    share_target_pct: number | null;
    published_share_pct: number | null;
  }>;
  flights: Array<{ key: string; name: string; status: string; pacing_pct: number | null }>;
  experiments: Array<{ name: string; status: string; winner_variant_key: string | null }>;
};

const SEVERITY_ORDER: Record<MonthlyReviewSeverity, number> = { critical: 0, warn: 1, info: 2 };

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The last full calendar month before `now` (UTC). */
export function previousMonthKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthWindow(month: string): { from: Date; to: Date; days: number } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const from = new Date(Date.UTC(y, m - 1, 1));
  const next = new Date(Date.UTC(y, m, 1));
  return {
    from,
    to: new Date(next.getTime() - 1),
    days: Math.round((next.getTime() - from.getTime()) / 86_400_000),
  };
}

/** Posts expected in a month from a weekly cadence. */
export function expectedPostsInMonth(postsPerWeek: number, days: number): number {
  return Math.round((postsPerWeek * days) / 7);
}

export function monthlyReviewFindings(input: MonthlyReviewInput): MonthlyReviewFinding[] {
  const out: MonthlyReviewFinding[] = [];
  for (const k of input.kpis) {
    const facts = { actual: k.actual, target: k.target_number, progress_pct: k.progress_pct };
    if (k.status === 'behind')
      out.push({ code: 'KPI_BEHIND', severity: 'warn', subject: k.name, facts });
    else if (k.status === 'at_risk')
      out.push({ code: 'KPI_AT_RISK', severity: 'info', subject: k.name, facts });
    else if (k.status === 'on_track')
      out.push({ code: 'KPI_ON_TRACK', severity: 'info', subject: k.name, facts });
    else if (k.status === 'not_recorded')
      out.push({ code: 'KPI_NOT_RECORDED', severity: 'info', subject: k.name, facts });
    else if (k.status === 'no_data')
      out.push({ code: 'KPI_NO_DATA', severity: 'info', subject: k.name, facts });
  }
  for (const c of input.channels) {
    if (c.expected <= 0) continue;
    const pct = Math.round((c.published / c.expected) * 100);
    const facts = { expected: c.expected, published: c.published, delivery_pct: pct };
    if (c.published === 0)
      out.push({ code: 'CADENCE_MISSED', severity: 'critical', subject: c.channel, facts });
    else if (pct < 70)
      out.push({ code: 'CADENCE_SHORTFALL', severity: 'warn', subject: c.channel, facts });
    else if (pct > 130)
      out.push({ code: 'CADENCE_AHEAD', severity: 'info', subject: c.channel, facts });
  }
  for (const p of input.pillars) {
    if (p.share_target_pct == null || p.published_share_pct == null) continue;
    const drift = p.published_share_pct - p.share_target_pct;
    if (Math.abs(drift) > 15) {
      out.push({
        code: 'PILLAR_DRIFT',
        severity: 'info',
        subject: p.key,
        facts: {
          target_pct: p.share_target_pct,
          published_pct: p.published_share_pct,
          drift_pct: drift,
        },
      });
    }
  }
  for (const f of input.flights) {
    const facts = { pacing_pct: f.pacing_pct };
    if (f.status === 'overspending')
      out.push({
        code: 'FLIGHT_OVERSPENDING',
        severity: 'critical',
        subject: f.name || f.key,
        facts,
      });
    else if (f.status === 'underspending')
      out.push({ code: 'FLIGHT_UNDERSPENDING', severity: 'warn', subject: f.name || f.key, facts });
  }
  for (const e of input.experiments) {
    if (e.status !== 'COMPLETED') continue;
    if (e.winner_variant_key)
      out.push({
        code: 'EXPERIMENT_WINNER',
        severity: 'info',
        subject: e.name,
        facts: { winner: e.winner_variant_key },
      });
    else
      out.push({ code: 'EXPERIMENT_INCONCLUSIVE', severity: 'info', subject: e.name, facts: {} });
  }
  if (!out.some((f) => f.severity !== 'info' || f.code === 'KPI_AT_RISK')) {
    out.push({ code: 'ALL_ON_TRACK', severity: 'info', subject: input.month, facts: {} });
  }
  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Findings that justify changing the plan (everything else keeps the plan as is). */
export function actionableFindings(findings: MonthlyReviewFinding[]): MonthlyReviewFinding[] {
  return findings.filter((f) =>
    [
      'KPI_BEHIND',
      'KPI_AT_RISK',
      'CADENCE_SHORTFALL',
      'CADENCE_MISSED',
      'CADENCE_AHEAD',
      'PILLAR_DRIFT',
      'FLIGHT_OVERSPENDING',
      'FLIGHT_UNDERSPENDING',
      'EXPERIMENT_WINNER',
    ].includes(f.code),
  );
}
