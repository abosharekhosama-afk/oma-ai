import { describe, expect, it } from 'vitest';
import {
  AI_RUN_IDS_LIMIT,
  aiProvenanceForCopy,
  aiReviewRequired,
  applyAiOutput,
  parseAiRunIds,
} from './ai-review';
import { evaluateScheduleReadiness } from './schedule-readiness';

describe('AI provenance (DEC-024)', () => {
  it('requires review only for unreviewed AI-assisted posts', () => {
    expect(aiReviewRequired({ aiAssisted: true, aiReviewedAt: null })).toBe(true);
    expect(aiReviewRequired({ aiAssisted: true, aiReviewedAt: new Date() })).toBe(false);
    expect(aiReviewRequired({ aiAssisted: false, aiReviewedAt: null })).toBe(false);
  });

  it('parses ai_run_ids strictly', () => {
    expect(parseAiRunIds(undefined)).toBeUndefined();
    expect(parseAiRunIds([])).toBeUndefined();
    expect(parseAiRunIds([' a ', 'a', 'b'])).toEqual(['a', 'b']);
    expect(() => parseAiRunIds('a')).toThrow(/ai_run_ids/);
    expect(() => parseAiRunIds([''])).toThrow(/ai_run_ids/);
    expect(() =>
      parseAiRunIds(Array.from({ length: AI_RUN_IDS_LIMIT + 1 }, (_, i) => `r${i}`)),
    ).toThrow(/at most/);
  });

  it('applying AI output clears the review and keeps the latest run ids', () => {
    expect(applyAiOutput({ aiRunIds: ['r1', 'r2'] }, ['r2', 'r3'])).toEqual({
      aiAssisted: true,
      aiRunIds: ['r1', 'r2', 'r3'],
      aiReviewedAt: null,
      aiReviewedBy: null,
    });
    const many = Array.from({ length: AI_RUN_IDS_LIMIT }, (_, i) => `old${i}`);
    expect(applyAiOutput({ aiRunIds: many }, ['new']).aiRunIds).toHaveLength(AI_RUN_IDS_LIMIT);
    expect(applyAiOutput({ aiRunIds: many }, ['new']).aiRunIds.at(-1)).toBe('new');
  });

  it('copies stay AI-assisted but need their own review', () => {
    expect(aiProvenanceForCopy({ aiAssisted: true, aiRunIds: ['r1'] })).toEqual({
      aiAssisted: true,
      aiRunIds: ['r1'],
      aiReviewedAt: null,
      aiReviewedBy: null,
    });
  });

  it('blocks scheduling under policy NONE until reviewed', () => {
    const input = {
      workflow: { status: 'DRAFT', scheduledAt: null },
      policy: 'NONE' as const,
      channel: 'instagram',
      targets: [{ socialPageId: 'p', network: 'INSTAGRAM', status: 'CONNECTED' }],
      requireConnectedAccount: true,
    };
    expect(
      evaluateScheduleReadiness({ ...input, ai: { assisted: true, reviewed: false } }).blockers,
    ).toEqual([{ code: 'AI_REVIEW_REQUIRED' }]);
    expect(
      evaluateScheduleReadiness({ ...input, ai: { assisted: true, reviewed: true } }).ready,
    ).toBe(true);
  });
});
