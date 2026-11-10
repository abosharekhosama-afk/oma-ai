import { describe, expect, it } from 'vitest';
import {
  AI_HONESTY_CODES,
  aiAvailabilityToErrorCode,
  aiProposeHonestyMessage,
  mustRefuseAiPropose,
} from '@oma/domain';

describe('strategy AI honesty', () => {
  it('refuses propose when AI is not available or mode is refuse', () => {
    expect(mustRefuseAiPropose()).toBe(true);
    expect(mustRefuseAiPropose('NOT_CONFIGURED')).toBe(true);
    expect(mustRefuseAiPropose('USED', { mode: 'refuse', aiAvailable: true })).toBe(true);
  });

  it('allows propose when mode is live and AI is available', () => {
    expect(mustRefuseAiPropose('NOT_CONFIGURED', { mode: 'live', aiAvailable: true })).toBe(false);
  });

  it('maps availability to honesty codes', () => {
    expect(AI_HONESTY_CODES).toContain('AI_NOT_CONFIGURED');
    expect(aiAvailabilityToErrorCode('NOT_CONFIGURED')).toBe('AI_NOT_CONFIGURED');
    expect(aiProposeHonestyMessage('AI_NOT_CONFIGURED')).toMatch(/not configured|AI/i);
  });
});
