import { describe, expect, it } from 'vitest';
import { computePublishRollup } from './publish-rollup';

describe('computePublishRollup', () => {
  it('aggregates multi-channel outcomes', () => {
    expect(computePublishRollup(['PUBLISHED', 'PUBLISHED'])).toBe('ALL_SUCCEEDED');
    expect(computePublishRollup(['PUBLISHED', 'FAILED'])).toBe('PARTIAL');
    expect(computePublishRollup(['FAILED', 'FAILED'])).toBe('FAILED');
    expect(computePublishRollup(['QUEUED', 'PUBLISHED'])).toBe('PARTIAL');
    expect(computePublishRollup(['QUEUED'])).toBe('IN_PROGRESS');
    expect(computePublishRollup([])).toBe('NONE');
  });
});
