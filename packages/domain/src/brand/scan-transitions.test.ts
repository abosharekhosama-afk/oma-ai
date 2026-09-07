import { describe, expect, it } from 'vitest';
import { canRetryScan, canTransitionScan } from './scan-transitions';

describe('scan-transitions', () => {
  it('allows queued to crawling', () => {
    expect(canTransitionScan('QUEUED', 'CRAWLING')).toBe(true);
  });

  it('blocks terminal transitions', () => {
    expect(canTransitionScan('SUCCEEDED', 'CRAWLING')).toBe(false);
  });

  it('allows retry from failed/partial/cancelled', () => {
    expect(canRetryScan('FAILED')).toBe(true);
    expect(canRetryScan('SUCCEEDED')).toBe(false);
  });
});
