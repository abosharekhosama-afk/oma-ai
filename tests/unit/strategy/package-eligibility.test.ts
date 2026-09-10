import { describe, expect, it } from 'vitest';
import {
  draftAidNeverSatisfiesGate,
  draftAllowsMissingApprovedProfile,
  evaluatePackageEligibility,
} from '@oma/domain';

describe('strategy package eligibility', () => {
  it('allows draft without approved profile', () => {
    expect(draftAllowsMissingApprovedProfile()).toBe(true);
  });

  it('never treats draft_aid as package gate satisfaction', () => {
    expect(draftAidNeverSatisfiesGate()).toBe(true);
  });

  it('blocks submit without approved profile link', () => {
    const result = evaluatePackageEligibility({
      linkedApprovedProfileVersionId: null,
      linkedProfileStatus: null,
      organicEnabled: true,
      paidEnabled: false,
      organicDisabledRationale: null,
      paidDisabledRationale: 'later',
      requiredFoundationPresent: true,
      unknownsAcknowledged: true,
      forAction: 'submit',
    });
    expect(result.eligible).toBe(false);
  });

  it('allows submit with approved profile and foundation', () => {
    const result = evaluatePackageEligibility({
      linkedApprovedProfileVersionId: 'pv1',
      linkedProfileStatus: 'APPROVED',
      organicEnabled: true,
      paidEnabled: false,
      organicDisabledRationale: null,
      paidDisabledRationale: 'later',
      requiredFoundationPresent: true,
      unknownsAcknowledged: true,
      forAction: 'submit',
    });
    expect(result.eligible).toBe(true);
  });
});
