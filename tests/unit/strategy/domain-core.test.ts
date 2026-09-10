import { describe, expect, it } from 'vitest';
import { STRATEGY_GAP_KINDS, STRATEGY_KPI_APPLIES_TO, STRATEGY_REVIEW_ACTIONS } from '@oma/domain';

describe('strategy domain core constants', () => {
  it('exposes KPI applies_to values', () => {
    expect(STRATEGY_KPI_APPLIES_TO).toEqual(['STRATEGY', 'ORGANIC', 'PAID']);
  });

  it('exposes gap kinds including UNKNOWN', () => {
    expect(STRATEGY_GAP_KINDS).toContain('UNKNOWN');
    expect(STRATEGY_GAP_KINDS).toContain('RISK');
  });

  it('exposes review actions', () => {
    expect(STRATEGY_REVIEW_ACTIONS).toContain('SUBMIT');
    expect(STRATEGY_REVIEW_ACTIONS).toContain('APPROVE_PACKAGE');
  });
});
