import { describe, expect, it } from 'vitest';
import { nextOutboxStatus } from './outbox';

describe('outbox', () => {
  it('transitions pending to published/failed', () => {
    expect(nextOutboxStatus('PENDING', true)).toBe('PUBLISHED');
    expect(nextOutboxStatus('PENDING', false)).toBe('FAILED');
    expect(nextOutboxStatus('PUBLISHED', false)).toBe('PUBLISHED');
  });
});
