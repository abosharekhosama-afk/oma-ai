import { describe, expect, it } from 'vitest';
import { SCAN_ATTEMPT_STATUSES, isTerminalScanStatus } from '@oma/domain';

describe('scan status contract (005 T013)', () => {
  it('declares progressive crawl stages before terminal outcomes', () => {
    expect(SCAN_ATTEMPT_STATUSES.slice(0, 4)).toEqual([
      'QUEUED',
      'CRAWLING',
      'EXTRACTING',
      'ANALYZING',
    ]);
    const terminals = SCAN_ATTEMPT_STATUSES.filter((s) => isTerminalScanStatus(s));
    expect(terminals.sort()).toEqual(['CANCELLED', 'FAILED', 'PARTIAL', 'SUCCEEDED']);
  });
});
