import { describe, expect, it } from 'vitest';
import {
  matchesReviewSearch,
  type DeliverableRow,
} from '../../apps/web/src/lib/demo/stage5-deliverables';

const row = {
  id: 'delivery-123',
  title: { en: 'Spring campaign video', ar: 'فيديو حملة الربيع' },
  owner: 'Maya Hassan',
  reviewer: 'Noor Ali',
  type: 'VIDEO',
  reviewStatus: 'AWAITING_REVIEW',
  dueAt: '2026-11-01',
  currentVersionId: 'v1',
  versions: [{ id: 'v1', label: 'Final cut' }],
} as unknown as DeliverableRow;

describe('review queue search', () => {
  it('matches title in English and Arabic after trimming/normalization', () => {
    expect(matchesReviewSearch(row, '  SPRING campaign ')).toBe(true);
    expect(matchesReviewSearch(row, 'فيديو حملة')).toBe(true);
  });

  it('matches owner, reviewer, deliverable ID, version, and status', () => {
    for (const query of ['maya hassan', 'noor', 'delivery-123', 'final cut', 'awaiting_review']) {
      expect(matchesReviewSearch(row, query)).toBe(true);
    }
  });

  it('treats an empty query as no filter and returns false for unknown text', () => {
    expect(matchesReviewSearch(row, '   ')).toBe(true);
    expect(matchesReviewSearch(row, 'unmatched phrase')).toBe(false);
  });
});
