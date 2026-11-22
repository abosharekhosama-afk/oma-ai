import { describe, expect, it } from 'vitest';
import {
  briefContentFromPlanDraft,
  countContent,
  emptyExecutionCounts,
  pillarKeyFromSourceKey,
} from './plan-brief';
import type { PlanWorkRequestDraft } from './plan-work-requests';

const draft: PlanWorkRequestDraft = {
  plan_source_key: 'organic:pillar:edu',
  pillar_key: 'edu',
  track: 'organic',
  title: { en: 'Q1 — Education', ar: 'Q1 — تثقيف' },
  description: { en: 'd', ar: 'd' },
  channels: ['Instagram'],
  formats: ['Reel'],
  brief: {
    objective: { en: 'Grow', ar: 'نمو' },
    audience: { en: 'Women', ar: 'نساء' },
    keyMessage: { en: 'Education', ar: 'تثقيف' },
  },
};

describe('plan → brief (DEC-029 4.3)', () => {
  it('turns slots into deliverables due a day before the post', () => {
    const content = briefContentFromPlanDraft(draft, {
      slots: [
        {
          slot_key: '0:instagram:0',
          week: 0,
          channel: 'Instagram',
          format: 'Reel',
          pillar_key: 'edu',
          planned_at: '2026-12-07T06:00:00.000Z',
        },
      ],
      dueAt: new Date('2026-12-05T06:00:00.000Z'),
      cta: 'Shop now',
    });
    expect(content).toMatchObject({
      objective_ar: 'نمو',
      key_message_ar: 'تثقيف',
      cta_en: 'Shop now',
      pillar_key: 'edu',
      due_at: '2026-12-05T06:00:00.000Z',
    });
    expect(content.deliverables).toEqual([
      expect.objectContaining({
        key: 'slot-1',
        channel: 'Instagram',
        format: 'Reel',
        due_at: '2026-12-06T06:00:00.000Z',
      }),
    ]);
  });

  it('falls back to one deliverable without slots', () => {
    const content = briefContentFromPlanDraft({ ...draft, pillar_key: null }, {});
    expect(content.deliverables).toHaveLength(1);
    expect(content.deliverables[0]!.key).toBe('content');
  });

  it('maps source keys to pillars including legacy index keys', () => {
    expect(pillarKeyFromSourceKey('organic:pillar:edu', ['edu'])).toBe('edu');
    expect(pillarKeyFromSourceKey('organic:pillar:0', ['legacy-1'])).toBe('legacy-1');
    expect(pillarKeyFromSourceKey('organic:pillar:0', ['edu'])).toBeNull();
    expect(pillarKeyFromSourceKey('paid:allocation:0:META:SALES', ['edu'])).toBeNull();
  });

  it('counts content by furthest state', () => {
    const c = emptyExecutionCounts();
    countContent(c, { status: 'DRAFT', plannedAt: new Date() });
    countContent(c, { status: 'APPROVED', scheduleState: 'SCHEDULED' });
    countContent(c, { status: 'APPROVED', publishedAt: new Date() });
    expect(c.content).toMatchObject({ planned: 1, draft: 1, scheduled: 1, published: 1 });
  });
});
