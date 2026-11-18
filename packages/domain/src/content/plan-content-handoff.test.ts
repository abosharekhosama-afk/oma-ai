import { describe, expect, it } from 'vitest';
import { planDraftTrack, shouldCreatePlanContentDraft } from './plan-content-handoff';

describe('plan-content-handoff', () => {
  it('always materializes calendar drafts for plan rows', () => {
    expect(
      shouldCreatePlanContentDraft({
        plan_source_key: 'organic:pillar:0',
        track: 'organic',
        title: { en: 'T', ar: 'T' },
        description: { en: 'D', ar: 'D' },
        channels: ['Instagram'],
        formats: ['Post'],
        brief: {
          objective: { en: 'O', ar: 'O' },
          audience: { en: 'A', ar: 'A' },
          keyMessage: { en: 'K', ar: 'K' },
        },
      }),
    ).toBe(true);
  });

  it('maps organic vs paid track', () => {
    expect(
      planDraftTrack({
        plan_source_key: 'paid:objective:0',
        track: 'paid',
        title: { en: 'T', ar: 'T' },
        description: { en: 'D', ar: 'D' },
        channels: [],
        formats: [],
        brief: {
          objective: { en: 'O', ar: 'O' },
          audience: { en: 'A', ar: 'A' },
          keyMessage: { en: 'K', ar: 'K' },
        },
      }),
    ).toBe('PAID');
  });
});
