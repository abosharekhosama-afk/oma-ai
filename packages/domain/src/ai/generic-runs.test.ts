import { describe, expect, it } from 'vitest';
import {
  GENERIC_AI_RUN_MAX_EVIDENCE_REFS,
  isGenericAiRunSourceType,
  isGenericAiRunUseCase,
  normalizeEvidenceRefs,
  readAiRunReview,
  writeAiRunReview,
} from './generic-runs';
import { isAiUseCase } from './use-cases';

describe('generic AI runs contract', () => {
  it('only allows use cases with a generic proposal contract', () => {
    expect(isGenericAiRunUseCase('brand_profile_synthesis')).toBe(true);
    expect(isGenericAiRunUseCase('evidence_summary')).toBe(true);
    expect(isGenericAiRunUseCase('contradiction_analysis')).toBe(true);
    expect(isGenericAiRunUseCase('caption_generation')).toBe(false);
    expect(isGenericAiRunUseCase('organic_strategy')).toBe(false);
    for (const u of ['brand_profile_synthesis', 'evidence_summary', 'contradiction_analysis'])
      expect(isAiUseCase(u)).toBe(true);
  });

  it('only allows brand_profile sources', () => {
    expect(isGenericAiRunSourceType('brand_profile')).toBe(true);
    expect(isGenericAiRunSourceType('approved_profile')).toBe(false);
    expect(isGenericAiRunSourceType(undefined)).toBe(false);
  });

  it('normalizes evidence refs', () => {
    expect(normalizeEvidenceRefs(undefined)).toEqual([]);
    expect(normalizeEvidenceRefs(['a', 'a', ' b '])).toEqual(['a', 'b']);
    expect(normalizeEvidenceRefs('a')).toBeNull();
    expect(normalizeEvidenceRefs(['a', 3])).toBeNull();
    expect(normalizeEvidenceRefs(['', 'a'])).toBeNull();
    const many = Array.from({ length: GENERIC_AI_RUN_MAX_EVIDENCE_REFS + 1 }, (_, i) => `e${i}`);
    expect(normalizeEvidenceRefs(many)).toBeNull();
  });

  it('round-trips the review decision and keeps other metadata', () => {
    const json = writeAiRunReview('{"kind":"x"}', {
      decision: 'rejected',
      by: 'u1',
      at: '2026-11-16T00:00:00.000Z',
      reason: null,
    });
    expect(JSON.parse(json).kind).toBe('x');
    expect(readAiRunReview(json)).toMatchObject({ decision: 'rejected', by: 'u1' });
    expect(readAiRunReview('not json')).toBeNull();
    expect(readAiRunReview(null)).toBeNull();
    expect(writeAiRunReview('[1]', { decision: 'accepted', by: 'u', at: 't', draftId: null })).toBe(
      '{"review":{"decision":"accepted","by":"u","at":"t","draftId":null}}',
    );
  });
});
