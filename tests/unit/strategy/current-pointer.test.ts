import { describe, expect, it } from 'vitest';
import {
  evaluateSetCurrentEligibility,
  neverAutoPickReplacement,
  neverAutoSelectCurrentOnApprove,
  shouldClearCurrentOnArchive,
} from '@oma/domain';

describe('strategy current pointer', () => {
  it('never auto-selects current on approve', () => {
    expect(neverAutoSelectCurrentOnApprove()).toBe(true);
    expect(neverAutoPickReplacement()).toBe(true);
  });

  it('requires approved strategy for set current', () => {
    expect(
      evaluateSetCurrentEligibility({
        strategyTenantId: 't1',
        brandTenantId: 't1',
        strategyBrandId: 'b1',
        brandId: 'b1',
        strategyStatus: 'ACTIVE',
        hasNonSupersededApprovedVersion: true,
        approvedVersionStatus: 'APPROVED',
      }).eligible,
    ).toBe(true);
    expect(
      evaluateSetCurrentEligibility({
        strategyTenantId: 't1',
        brandTenantId: 't1',
        strategyBrandId: 'b1',
        brandId: 'b1',
        strategyStatus: 'ACTIVE',
        hasNonSupersededApprovedVersion: false,
      }).eligible,
    ).toBe(false);
  });

  it('clears pointer when archived strategy is current', () => {
    expect(shouldClearCurrentOnArchive('s1', 's1')).toBe(true);
    expect(shouldClearCurrentOnArchive('s1', 's2')).toBe(false);
    expect(shouldClearCurrentOnArchive(null, 's1')).toBe(false);
  });
});
