import { describe, expect, it } from 'vitest';
import {
  STRATEGY_STATUSES,
  STRATEGY_VERSION_STATUSES,
  canArchiveStrategy,
  assertStrategyStatus,
  assertStrategyVersionStatus,
} from '@oma/domain';

describe('strategy states', () => {
  it('lists ACTIVE and ARCHIVED workspace statuses', () => {
    expect(STRATEGY_STATUSES).toEqual(['ACTIVE', 'ARCHIVED']);
  });

  it('lists version statuses including review outcomes', () => {
    expect(STRATEGY_VERSION_STATUSES).toContain('DRAFT');
    expect(STRATEGY_VERSION_STATUSES).toContain('IN_REVIEW');
    expect(STRATEGY_VERSION_STATUSES).toContain('APPROVED');
    expect(STRATEGY_VERSION_STATUSES).toContain('REJECTED');
    expect(STRATEGY_VERSION_STATUSES).toContain('CHANGES_REQUESTED');
  });

  it('archives only ACTIVE strategies', () => {
    expect(canArchiveStrategy('ACTIVE')).toBe(true);
    expect(canArchiveStrategy('ARCHIVED')).toBe(false);
  });

  it('asserts known statuses', () => {
    expect(() => assertStrategyStatus('ACTIVE')).not.toThrow();
    expect(() => assertStrategyStatus('NOPE')).toThrow();
    expect(() => assertStrategyVersionStatus('DRAFT')).not.toThrow();
    expect(() => assertStrategyVersionStatus('NOPE')).toThrow();
  });
});
