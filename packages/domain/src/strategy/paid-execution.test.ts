import { describe, expect, it } from 'vitest';
import {
  canMoveExperiment,
  experimentUpdateIssues,
  flightPacing,
  parsePaidSpendCsv,
} from './paid-execution';
import { paidPlanInputSchema, paidPlanIssues } from './tracks-v2';

describe('paid execution', () => {
  it('experiment transitions', () => {
    expect(canMoveExperiment('PLANNED', 'RUNNING')).toBe(true);
    expect(canMoveExperiment('PLANNED', 'CONCLUDED')).toBe(false);
    expect(canMoveExperiment('CONCLUDED', 'RUNNING')).toBe(false);
    expect(
      experimentUpdateIssues({ status: 'CONCLUDED', winner_variant_key: 'C' }, ['A', 'B']).map(
        (i) => i.code,
      ),
    ).toEqual(['UNKNOWN_VARIANT', 'RESULT_REQUIRED']);
  });

  it('parses ads-manager CSVs (aliases, quotes, dd/mm/yyyy, defaults)', () => {
    const { rows, errors } = parsePaidSpendCsv(
      '\uFEFFReporting starts;Amount spent (SAR);Impressions\n21/11/2026;"1,250.50";"3,000"\n2026/11/22;;10',
      { platform: 'META', currency: 'SAR' },
    );
    expect(errors).toEqual([{ line: 3, code: 'INVALID_AMOUNT', field: 'amount' }]);
    expect(rows).toEqual([
      expect.objectContaining({
        date: '2026-11-21',
        platform: 'META',
        amount: 1250.5,
        currency: 'SAR',
        impressions: 3000,
      }),
    ]);
    expect(parsePaidSpendCsv('foo,bar\n1,2').errors[0]!.code).toBe('HEADER_MISSING_DATE_OR_AMOUNT');
    expect(parsePaidSpendCsv('date,amount\n2026-11-01,5').errors[0]!.code).toBe('UNKNOWN_PLATFORM');
    expect(parsePaidSpendCsv('date,amount,platform\n2026-11-01,5,tiktok').errors[0]!.code).toBe(
      'INVALID_CURRENCY',
    );
  });

  it('paces flights linearly', () => {
    const f = { startDate: new Date('2026-11-01'), endDate: new Date('2026-11-30'), budget: 3000 };
    expect(flightPacing(f, 1000, new Date('2026-11-10T12:00:00Z'))).toMatchObject({
      days_total: 30,
      days_elapsed: 10,
      expected_spend: 1000,
      pacing_pct: 100,
      status: 'on_pace',
    });
    expect(flightPacing(f, 1300, new Date('2026-11-10')).status).toBe('overspending');
    expect(flightPacing(f, 0, new Date('2026-10-20')).status).toBe('not_started');
    expect(flightPacing(f, 2990, new Date('2026-12-05')).status).toBe('ended');
    expect(flightPacing({ ...f, budget: null }, 10, new Date('2026-11-10')).status).toBe(
      'no_budget',
    );
  });

  it('validates flights in the paid plan', () => {
    const plan = paidPlanInputSchema.parse({
      flights: [
        { key: 'a', name: 'A', platform: 'META', start_date: '2026-11-10', end_date: '2026-11-01' },
        {
          key: 'a',
          name: 'B',
          platform: 'META',
          start_date: '2026-11-01',
          end_date: '2026-11-02',
          audience_key: 'x',
        },
      ],
    });
    expect(
      paidPlanIssues(plan)
        .map((i) => i.code)
        .sort(),
    ).toEqual(['DUPLICATE_FLIGHT_KEY', 'FLIGHT_DATES_INVALID', 'UNKNOWN_AUDIENCE']);
    expect(paidPlanInputSchema.parse({}).flights).toBeUndefined();
  });
});
