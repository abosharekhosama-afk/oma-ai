import { describe, expect, it } from 'vitest';
import { brandAiAvailabilityAfterScanComplete, scanAnalysisAutoEnqueueExpected } from '@oma/domain';

describe('brandAiAvailabilityAfterScanComplete', () => {
  it('returns SKIPPED when live AI is enabled with provider key', () => {
    expect(
      brandAiAvailabilityAfterScanComplete({
        AI_LIVE_ENABLED: 'true',
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-key',
      }),
    ).toBe('SKIPPED');
    expect(
      scanAnalysisAutoEnqueueExpected({
        AI_LIVE_ENABLED: 'true',
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-key',
      }),
    ).toBe(true);
  });

  it('returns NOT_CONFIGURED when live AI is off', () => {
    expect(brandAiAvailabilityAfterScanComplete({ AI_LIVE_ENABLED: 'false' })).toBe(
      'NOT_CONFIGURED',
    );
    expect(scanAnalysisAutoEnqueueExpected({ AI_LIVE_ENABLED: 'false' })).toBe(false);
  });
});
