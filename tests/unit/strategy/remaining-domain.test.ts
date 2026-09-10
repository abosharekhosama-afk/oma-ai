import { describe, expect, it } from 'vitest';
import { STRATEGY_AI_AVAILABILITIES, mustRefuseAiPropose } from '@oma/domain';

describe('remaining strategy domain', () => {
  it('lists AI availability states used for honesty', () => {
    expect(STRATEGY_AI_AVAILABILITIES).toContain('NOT_CONFIGURED');
    expect(STRATEGY_AI_AVAILABILITIES).toContain('REFUSED');
    expect(mustRefuseAiPropose('UNAVAILABLE')).toBe(true);
  });
});
