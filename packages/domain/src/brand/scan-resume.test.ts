import { describe, expect, it } from 'vitest';
import { canResumeScan } from './scan-resume';

describe('canResumeScan', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);

  it('allows resume when heartbeat is stale', () => {
    expect(
      canResumeScan({
        status: 'CRAWLING',
        progressUpdatedAt: new Date(now - 120_000),
        stallSeconds: 90,
        nowMs: now,
        jobRunStatus: 'RUNNING',
      }),
    ).toBe(true);
  });

  it('denies resume for terminal or cancelled scans', () => {
    expect(
      canResumeScan({
        status: 'SUCCEEDED',
        jobRunStatus: 'SUCCEEDED',
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      canResumeScan({
        status: 'CRAWLING',
        cancelRequestedAt: new Date(now),
        jobRunStatus: 'RUNNING',
        nowMs: now,
      }),
    ).toBe(false);
  });

  it('allows resume when job run failed but scan is still active', () => {
    expect(
      canResumeScan({
        status: 'CRAWLING',
        progressUpdatedAt: new Date(now),
        jobRunStatus: 'FAILED',
        nowMs: now,
      }),
    ).toBe(true);
  });
});
