import { describe, expect, it } from 'vitest';
import {
  AI_RESERVATION_STALE_MS,
  aiRunInBudgetMonth,
  aiRunLedgerEntry,
  snapshotAiRuns,
} from './ledger';
import { aiBudgetLimitsFromEnv } from './budget';

const now = new Date('2026-11-16T12:00:00.000Z');
const row = (status: string, settled: string, reserved = '0', createdAt = now) => ({
  status,
  settledCost: settled,
  reservedCost: reserved,
  createdAt,
});

describe('AI run ledger mapping', () => {
  it('counts failed runs that consumed tokens as spent', () => {
    expect(aiRunLedgerEntry('t', row('SCHEMA_INVALID', '0.02'), now)).toMatchObject({
      status: 'settled',
      settledUsd: 0.02,
    });
    expect(aiRunLedgerEntry('t', row('FAILED', '0'), now).status).toBe('released');
  });

  it('keeps fresh reservations and releases stale ones', () => {
    expect(aiRunLedgerEntry('t', row('RUNNING', '0', '0.3'), now)).toMatchObject({
      status: 'reserved',
      reservedUsd: 0.3,
    });
    const old = new Date(now.getTime() - AI_RESERVATION_STALE_MS - 1000);
    expect(aiRunLedgerEntry('t', row('RUNNING', '0', '0.3', old), now)).toMatchObject({
      status: 'released',
      reservedUsd: 0,
    });
  });

  it('only counts the current UTC month', () => {
    expect(aiRunInBudgetMonth(new Date('2026-11-01T00:00:00Z'), now)).toBe(true);
    expect(aiRunInBudgetMonth(new Date('2026-10-31T23:59:59Z'), now)).toBe(false);
    const snap = snapshotAiRuns(
      't',
      [
        row('SUCCEEDED', '1'),
        row('SUCCEEDED', '5', '0', new Date('2026-10-20T00:00:00Z')),
        row('RUNNING', '0', '0.5'),
      ],
      now,
    );
    expect(snap.monthlySpentUsd).toBe(1);
    expect(snap.dailySpentUsd).toBe(1);
    expect(snap.monthlyReservedUsd).toBe(0.5);
  });

  it('reads budget limits from env', () => {
    expect(
      aiBudgetLimitsFromEnv({ AI_MONTHLY_BUDGET_USD: '9', AI_MAX_OUTPUT_TOKENS: '100' }),
    ).toEqual({ monthlyUsd: 9, dailyUsd: 2, maxInputTokens: null, maxOutputTokens: 100 });
  });
});
