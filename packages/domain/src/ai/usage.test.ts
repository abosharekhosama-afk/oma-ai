import { describe, expect, it } from 'vitest';
import { aiUsageMonthRange, decodeAiRunCursor, encodeAiRunCursor, summarizeAiUsage } from './usage';

const row = (over: Partial<Parameters<typeof summarizeAiUsage>[0][number]> = {}) => ({
  useCase: 'caption_generation',
  status: 'SUCCEEDED',
  attemptCount: 1,
  settledCost: '0.01',
  refusalReason: null,
  schemaVersion: '2',
  ...over,
});

describe('summarizeAiUsage', () => {
  it('counts outcomes, repairs, human rejects and real cost per use case', () => {
    const s = summarizeAiUsage([
      row(),
      row({ attemptCount: 2, settledCost: '0.02' }),
      row({ status: 'SCHEMA_INVALID', attemptCount: 2, settledCost: '0.03' }),
      row({ useCase: 'inbox_reply', status: 'REFUSED', settledCost: null }),
      row({ useCase: 'inbox_reply', refusalReason: 'HUMAN_REJECTED', schemaVersion: '1' }),
    ]);
    expect(s.totals).toMatchObject({
      runs: 5,
      succeeded: 3,
      failed: 2,
      schema_invalid: 1,
      refused: 1,
      repaired: 2,
      human_rejected: 1,
      legacy_v1: 1,
      cost_usd: 0.07,
    });
    expect(s.by_use_case[0]).toMatchObject({ use_case: 'caption_generation', cost_usd: 0.06 });
  });
});

describe('aiUsageMonthRange and cursors', () => {
  it('parses months in UTC and falls back to the current month', () => {
    const r = aiUsageMonthRange('2026-02');
    expect(r.start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(aiUsageMonthRange('bad', new Date('2026-11-16T10:00:00Z')).month).toBe('2026-11');
  });

  it('round-trips a cursor and rejects junk', () => {
    const at = new Date('2026-11-16T10:00:00Z');
    expect(decodeAiRunCursor(encodeAiRunCursor(at, 'r1'))).toEqual({ createdAt: at, id: 'r1' });
    expect(decodeAiRunCursor('%%%')).toBeNull();
  });
});
