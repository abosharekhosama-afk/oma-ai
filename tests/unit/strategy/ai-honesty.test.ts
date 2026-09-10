import { describe, expect, it } from 'vitest';
import {
  canArchiveStrategy,
  canPatchVersionContent,
  canToggleTracks,
  canTransitionVersion,
  draftAidNeverSatisfiesGate,
  draftAllowsMissingApprovedProfile,
  evaluatePackageEligibility,
  evaluateSetCurrentEligibility,
  isValidInfoClass,
  mustRefuseAiPropose,
  neverAutoSelectCurrentOnApprove,
  nextVersionStatus,
  shouldClearCurrentOnArchive,
  validateTrackEnablementForSubmit,
} from '@oma/domain';

describe('strategy states & transitions', () => {
  it('archives only ACTIVE strategies', () => {
    expect(canArchiveStrategy('ACTIVE')).toBe(true);
    expect(canArchiveStrategy('ARCHIVED')).toBe(false);
  });

  it('transitions draft through review and approve', () => {
    expect(canTransitionVersion(null, 'create')).toBe(true);
    expect(nextVersionStatus(null, 'create')).toBe('DRAFT');
    expect(nextVersionStatus('DRAFT', 'submit')).toBe('IN_REVIEW');
    expect(nextVersionStatus('IN_REVIEW', 'approve')).toBe('APPROVED');
    expect(nextVersionStatus('IN_REVIEW', 'reject')).toBe('REJECTED');
    expect(nextVersionStatus('IN_REVIEW', 'request_changes')).toBe('CHANGES_REQUESTED');
    expect(nextVersionStatus('APPROVED', 'revise')).toBe('DRAFT');
  });

  it('freezes non-draft content', () => {
    expect(canPatchVersionContent('DRAFT')).toBe(true);
    expect(canPatchVersionContent('IN_REVIEW')).toBe(false);
    expect(canPatchVersionContent('APPROVED')).toBe(false);
    expect(canToggleTracks('DRAFT')).toBe(true);
    expect(canToggleTracks('IN_REVIEW')).toBe(false);
  });
});

describe('package eligibility', () => {
  it('allows draft without approved profile', () => {
    expect(draftAllowsMissingApprovedProfile()).toBe(true);
    expect(draftAidNeverSatisfiesGate()).toBe(true);
  });

  it('blocks submit without approved profile and track rules', () => {
    const result = evaluatePackageEligibility({
      linkedApprovedProfileVersionId: null,
      organicEnabled: false,
      paidEnabled: false,
      requiredFoundationPresent: false,
      unknownsAcknowledged: false,
      forAction: 'submit',
    });
    expect(result.eligible).toBe(false);
    expect(result.missingSource).toBe(true);
    expect(result.blockingReasons).toContain('APPROVED_PROFILE_REQUIRED');
    expect(result.blockingReasons).toContain('NO_TRACK_ENABLED');
  });

  it('accepts package when profile linked and one track enabled', () => {
    const result = evaluatePackageEligibility({
      linkedApprovedProfileVersionId: 'pv1',
      linkedProfileStatus: 'APPROVED',
      organicEnabled: true,
      paidEnabled: false,
      paidDisabledRationale: 'Not launching paid this quarter',
      requiredFoundationPresent: true,
      unknownsAcknowledged: true,
      forAction: 'approve',
    });
    expect(result.eligible).toBe(true);
    expect(result.evidenceBacked).toBe(true);
  });
});

describe('track enablement', () => {
  it('requires disabled rationales at submit', () => {
    const bad = validateTrackEnablementForSubmit({
      organicEnabled: true,
      paidEnabled: false,
      paidDisabledRationale: '',
    });
    expect(bad.ok).toBe(false);
    expect(bad.blockingReasons).toContain('PAID_DISABLED_RATIONALE_REQUIRED');
  });
});

describe('current pointer', () => {
  it('never auto-selects on approve and clears on archive match', () => {
    expect(neverAutoSelectCurrentOnApprove()).toBe(true);
    expect(shouldClearCurrentOnArchive('s1', 's1')).toBe(true);
    expect(shouldClearCurrentOnArchive('s1', 's2')).toBe(false);
  });

  it('requires approved active strategy same brand', () => {
    const ok = evaluateSetCurrentEligibility({
      strategyTenantId: 't1',
      brandTenantId: 't1',
      strategyBrandId: 'b1',
      brandId: 'b1',
      strategyStatus: 'ACTIVE',
      hasNonSupersededApprovedVersion: true,
      approvedVersionStatus: 'APPROVED',
    });
    expect(ok.eligible).toBe(true);
    const bad = evaluateSetCurrentEligibility({
      strategyTenantId: 't1',
      brandTenantId: 't1',
      strategyBrandId: 'b1',
      brandId: 'b1',
      strategyStatus: 'ARCHIVED',
      hasNonSupersededApprovedVersion: false,
    });
    expect(bad.eligible).toBe(false);
  });
});

describe('info class & AI honesty', () => {
  it('validates infoClass and refuses AI propose', () => {
    expect(isValidInfoClass('USER_AUTHORED')).toBe(true);
    expect(isValidInfoClass('NOPE')).toBe(false);
    expect(mustRefuseAiPropose()).toBe(true);
  });
});
