import { describe, expect, it } from 'vitest';
import {
  allowedBriefActions,
  briefContentFromStrategy,
  briefContentIssues,
  briefContentSchema,
  briefEntityEnabled,
  briefSelfApprovalBlocked,
  briefSubmitReadiness,
  briefTransitionTarget,
  canBriefTransition,
} from './brief-entity';
import { SYSTEM_PROFILES } from '../authz/capabilities';
import { brandRoleAllows } from '../authz/brand-roles';

describe('brief lifecycle', () => {
  it('only converts from APPROVED and only approves from IN_REVIEW', () => {
    expect(canBriefTransition('APPROVED', 'convert')).toBe(true);
    for (const s of [
      'DRAFT',
      'IN_REVIEW',
      'CHANGES_REQUESTED',
      'CONVERTED',
      'CANCELLED',
    ] as const) {
      expect(canBriefTransition(s, 'convert')).toBe(false);
    }
    expect(canBriefTransition('DRAFT', 'approve')).toBe(false);
    expect(canBriefTransition('IN_REVIEW', 'approve')).toBe(true);
  });

  it('freezes reviewed/approved content and revises into a new draft', () => {
    expect(canBriefTransition('IN_REVIEW', 'edit')).toBe(false);
    expect(canBriefTransition('APPROVED', 'edit')).toBe(false);
    expect(briefTransitionTarget('APPROVED', 'revise')).toBe('DRAFT');
    expect(briefTransitionTarget('CHANGES_REQUESTED', 'edit')).toBe('CHANGES_REQUESTED');
    expect(briefTransitionTarget('CHANGES_REQUESTED', 'submit')).toBe('IN_REVIEW');
    expect(allowedBriefActions('CANCELLED')).toEqual([]);
    expect(allowedBriefActions('CONVERTED')).toEqual(['revise']);
  });
});

describe('brief content', () => {
  it('requires objective, audience, key message (either language) and a deliverable', () => {
    const empty = briefContentSchema.parse({});
    expect(briefSubmitReadiness(empty).missing).toEqual([
      'objective',
      'audience',
      'key_message',
      'deliverables',
    ]);
    const ready = briefContentSchema.parse({
      objective_ar: 'زيادة الوعي',
      audience_en: 'Gulf women',
      key_message_en: 'Glow daily',
      deliverables: [{ key: 'reel-1', title_en: 'Reel', title_ar: 'ريل' }],
    });
    expect(briefSubmitReadiness(ready)).toEqual({ ready: true, missing: [] });
  });

  it('rejects unknown keys and duplicate deliverable keys', () => {
    expect(briefContentSchema.safeParse({ approved: true }).success).toBe(false);
    const dup = briefContentSchema.parse({
      deliverables: [
        { key: 'a', title_en: 'A', title_ar: 'أ' },
        { key: 'a', title_en: 'B', title_ar: 'ب' },
      ],
    });
    expect(briefContentIssues(dup).map((i) => i.code)).toEqual(['DUPLICATE_DELIVERABLE']);
  });

  it('prefills from an approved strategy without inventing text', () => {
    const content = briefContentFromStrategy({
      goals: ['Grow reach'],
      keyMessages: [],
      positioning: 'Trusted partner',
      audiences: ['Gulf women'],
      channels: ['INSTAGRAM', 'INSTAGRAM', 'TIKTOK'],
      pillar: { key: 'education', name_en: 'Education', name_ar: 'التثقيف' },
    });
    expect(content.objective_en).toBe('Grow reach');
    expect(content.key_message_en).toBe('Trusted partner');
    expect(content.channels).toEqual(['INSTAGRAM', 'TIKTOK']);
    expect(content.deliverables[0]).toMatchObject({ key: 'education-content' });
  });
});

describe('brief rules and capabilities', () => {
  it('blocks self-approval only when another approver exists', () => {
    expect(
      briefSelfApprovalBlocked({ approverUserId: 'u', authorUserId: 'u', otherApproverCount: 1 }),
    ).toBe(true);
    expect(
      briefSelfApprovalBlocked({ approverUserId: 'u', authorUserId: 'u', otherApproverCount: 0 }),
    ).toBe(false);
    expect(
      briefSelfApprovalBlocked({ approverUserId: 'a', authorUserId: 'u', otherApproverCount: 3 }),
    ).toBe(false);
  });

  it('feature flag defaults on and turns off only with "false"', () => {
    expect(briefEntityEnabled({})).toBe(true);
    expect(briefEntityEnabled({ BRIEF_ENTITY_ENABLED: 'false' })).toBe(false);
  });

  it('grants brief caps per profile and brand role', () => {
    expect(SYSTEM_PROFILES.COMPANY_OWNER).toContain('brief.approve');
    expect(SYSTEM_PROFILES.WRITER).toContain('brief.convert');
    expect(SYSTEM_PROFILES.WRITER).not.toContain('brief.approve');
    expect(SYSTEM_PROFILES.APPROVER).toContain('brief.approve');
    expect(SYSTEM_PROFILES.MEMBER).not.toContain('brief.approve');
    expect(SYSTEM_PROFILES.VIEWER).toEqual(expect.arrayContaining(['brief.read']));
    expect(SYSTEM_PROFILES.VIEWER).not.toContain('brief.create');
    expect(brandRoleAllows('APPROVER', 'brief.approve')).toBe(true);
    expect(brandRoleAllows('APPROVER', 'brief.edit')).toBe(false);
    expect(brandRoleAllows('VIEWER', 'brief.create')).toBe(false);
  });
});
