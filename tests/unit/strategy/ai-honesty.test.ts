import { describe, expect, it } from 'vitest';
import {
  AI_HONESTY_CODES,
  aiAvailabilityToErrorCode,
  aiProposeHonestyMessage,
  mustRefuseAiPropose,
} from '@oma/domain';

describe('strategy AI honesty', () => {
  it('always refuses propose under DEC-016', () => {
    expect(mustRefuseAiPropose()).toBe(true);
    expect(mustRefuseAiPropose('NOT_CONFIGURED')).toBe(true);
  });

  it('maps availability to honesty codes', () => {
    expect(AI_HONESTY_CODES).toContain('AI_NOT_CONFIGURED');
    expect(aiAvailabilityToErrorCode('NOT_CONFIGURED')).toBe('AI_NOT_CONFIGURED');
    expect(aiProposeHonestyMessage('AI_NOT_CONFIGURED')).toMatch(/not configured|AI/i);
  });
});
