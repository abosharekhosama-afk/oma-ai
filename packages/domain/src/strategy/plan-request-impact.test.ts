import { describe, expect, it } from 'vitest';
import {
  assessPlanRequestImpact,
  buildPlanRequestImpactReport,
  comparableFromDraft,
  comparableFromStored,
} from './plan-request-impact';
import type { PlanWorkRequestDraft } from './plan-work-requests';

const baseDraft = (): PlanWorkRequestDraft => ({
  plan_source_key: 'organic:pillar:0',
  track: 'organic',
  title: { en: 'Title A', ar: 'Title A' },
  description: { en: 'Desc', ar: 'Desc' },
  channels: ['Instagram'],
  formats: ['Reel'],
  brief: {
    objective: { en: 'Obj', ar: 'Obj' },
    audience: { en: 'Aud', ar: 'Aud' },
    keyMessage: { en: 'Msg', ar: 'Msg' },
  },
});

describe('plan-request-impact', () => {
  it('marks aligned when stored matches draft', () => {
    const draft = baseDraft();
    const stored = comparableFromDraft(draft);
    expect(assessPlanRequestImpact(stored, draft).status).toBe('aligned');
  });

  it('marks drifted when brief changes', () => {
    const draft = baseDraft();
    const stored = comparableFromStored({
      planSourceKey: draft.plan_source_key,
      titleEn: draft.title.en,
      titleAr: draft.title.ar,
      descriptionEn: draft.description.en,
      descriptionAr: draft.description.ar,
      channels: draft.channels,
      formats: draft.formats,
      briefObjectiveEn: 'Old objective',
      briefAudienceEn: draft.brief.audience.en,
      briefKeyMessageEn: draft.brief.keyMessage.en,
    });
    const result = assessPlanRequestImpact(stored, draft);
    expect(result.status).toBe('drifted');
    expect(result.changed_fields).toContain('brief_objective');
  });

  it('marks orphaned when plan line removed', () => {
    const stored = comparableFromDraft(baseDraft());
    const result = assessPlanRequestImpact(stored, undefined);
    expect(result.status).toBe('orphaned');
  });

  it('builds impact report for prior requests', () => {
    const draft = baseDraft();
    const stored = comparableFromDraft(draft);
    const report = buildPlanRequestImpactReport({
      drafts: [draft],
      prior_requests: [
        {
          id: 'req-1',
          strategy_version_id: 'ver-old',
          plan_source_key: draft.plan_source_key,
          comparable: stored,
          has_open_task: false,
        },
      ],
    });
    expect(report).toHaveLength(1);
    expect(report[0]?.status).toBe('aligned');
  });
});
