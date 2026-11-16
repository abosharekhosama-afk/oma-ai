import { describe, expect, it } from 'vitest';
import {
  LEGACY_BRIEF_DELIVERABLE_KEY,
  legacyBriefContent,
  planLegacyBrief,
  type LegacyBriefRequest,
} from './brief-legacy';
import { REQUEST_BRIEF_MARKER } from './brief-readiness';

function request(overrides: Partial<LegacyBriefRequest> = {}): LegacyBriefRequest {
  return {
    id: 'req_1',
    status: 'OPEN',
    titleEn: 'Ramadan launch reel',
    titleAr: 'ريل إطلاق رمضان',
    briefObjectiveEn: 'Drive pre-orders',
    briefObjectiveAr: '',
    briefAudienceEn: 'Families in Riyadh',
    briefAudienceAr: '',
    briefKeyMessageEn: '',
    briefKeyMessageAr: 'خصم الإطلاق',
    briefReadyAt: new Date('2026-11-01T10:00:00Z'),
    channels: ['INSTAGRAM', 'INSTAGRAM', 'TIKTOK'],
    formats: ['REEL'],
    dueAt: new Date('2026-12-01T00:00:00Z'),
    taskCount: 0,
    ...overrides,
  };
}

describe('planLegacyBrief', () => {
  it('puts a ready legacy brief in review, never approved', () => {
    const plan = planLegacyBrief(request());
    expect(plan).toMatchObject({
      action: 'create',
      status: 'IN_REVIEW',
      title: 'Ramadan launch reel',
    });
  });

  it('keeps a not-ready brief as DRAFT', () => {
    expect(planLegacyBrief(request({ briefReadyAt: null }))).toMatchObject({ status: 'DRAFT' });
    // briefReadyAt set but the brief is incomplete (no audience): still DRAFT.
    expect(planLegacyBrief(request({ briefAudienceEn: '', briefAudienceAr: '' }))).toMatchObject({
      status: 'DRAFT',
    });
  });

  it('skips closed requests, requests with tasks and requests without brief text', () => {
    expect(planLegacyBrief(request({ status: 'DONE' }))).toEqual({
      action: 'skip',
      reason: 'request_closed',
    });
    expect(planLegacyBrief(request({ status: 'CANCELLED' }))).toMatchObject({
      reason: 'request_closed',
    });
    expect(planLegacyBrief(request({ taskCount: 2 }))).toMatchObject({
      reason: 'request_has_tasks',
    });
    expect(
      planLegacyBrief(
        request({
          briefObjectiveEn: '',
          briefAudienceEn: '',
          briefKeyMessageAr: '',
          briefReadyAt: null,
        }),
      ),
    ).toMatchObject({ reason: 'no_brief_content' });
  });

  it('reads the pre-column description marker when columns are empty', () => {
    const payload = {
      objective: { en: 'Old objective' },
      audience: 'Old audience',
      keyMessage: 'Old msg',
    };
    const plan = planLegacyBrief(
      request({
        briefObjectiveEn: '',
        briefAudienceEn: '',
        briefKeyMessageAr: '',
        briefReadyAt: null,
        descriptionEn: `Notes\n${REQUEST_BRIEF_MARKER}${JSON.stringify(payload)}`,
      }),
    );
    expect(plan.action).toBe('create');
    if (plan.action !== 'create') return;
    expect(plan.content).toMatchObject({
      objective_en: 'Old objective',
      audience_en: 'Old audience',
      key_message_en: 'Old msg',
    });
  });
});

describe('legacyBriefContent', () => {
  it('copies text, dedupes channels and creates one deliverable from the request', () => {
    const content = legacyBriefContent(request());
    expect(content.objective_en).toBe('Drive pre-orders');
    expect(content.key_message_ar).toBe('خصم الإطلاق');
    expect(content.channels).toEqual(['INSTAGRAM', 'TIKTOK']);
    expect(content.due_at).toBe('2026-12-01T00:00:00.000Z');
    expect(content.deliverables).toEqual([
      expect.objectContaining({
        key: LEGACY_BRIEF_DELIVERABLE_KEY,
        title_en: 'Ramadan launch reel',
        title_ar: 'ريل إطلاق رمضان',
        format: 'REEL',
        channel: '',
      }),
    ]);
  });

  it('falls back across languages when a title is missing', () => {
    const content = legacyBriefContent(request({ titleAr: '  ', channels: ['FACEBOOK'] }));
    expect(content.deliverables[0]).toMatchObject({
      title_ar: 'Ramadan launch reel',
      channel: 'FACEBOOK',
    });
  });
});
