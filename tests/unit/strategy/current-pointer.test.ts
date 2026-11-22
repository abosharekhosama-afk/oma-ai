import { describe, expect, it } from 'vitest';
import {
  evaluateSetCurrentEligibility,
  effectiveCurrentStrategy,
  neverAutoPickReplacement,
  shouldAutoSetCurrentOnApprove,
  shouldClearCurrentOnArchive,
  strategyDisplayStatus,
} from '@oma/domain';

describe('strategy current pointer', () => {
  it('DEC-030: approve sets current only for an approver who may set current', () => {
    expect(shouldAutoSetCurrentOnApprove({ actorCanSetCurrent: true })).toBe(true);
    expect(shouldAutoSetCurrentOnApprove({ actorCanSetCurrent: false })).toBe(false);
    expect(neverAutoPickReplacement()).toBe(true);
  });

  it('effective current: explicit pointer wins when usable', () => {
    const candidates = [
      { id: 'a', status: 'ACTIVE', approvedAt: '2026-11-01T00:00:00Z' },
      { id: 'b', status: 'ACTIVE', approvedAt: '2026-11-20T00:00:00Z' },
    ];
    expect(effectiveCurrentStrategy({ pointerId: 'a', candidates })).toEqual({
      id: 'a',
      inferred: false,
    });
  });

  it('effective current: infers the latest approved ACTIVE strategy without a pointer', () => {
    const candidates = [
      { id: 'a', status: 'ACTIVE', approvedAt: '2026-11-01T00:00:00Z' },
      { id: 'b', status: 'ACTIVE', approvedAt: '2026-11-20T00:00:00Z' },
      { id: 'c', status: 'ARCHIVED', approvedAt: '2026-11-21T00:00:00Z' },
      { id: 'd', status: 'ACTIVE', approvedAt: null },
    ];
    expect(effectiveCurrentStrategy({ pointerId: null, candidates })).toEqual({
      id: 'b',
      inferred: true,
    });
    // A stale pointer (archived strategy) also falls back.
    expect(effectiveCurrentStrategy({ pointerId: 'c', candidates })).toEqual({
      id: 'b',
      inferred: true,
    });
    expect(effectiveCurrentStrategy({ pointerId: null, candidates: [] })).toEqual({
      id: null,
      inferred: false,
    });
  });

  it('display status never shows the ACTIVE lifecycle flag', () => {
    const base = { strategyStatus: 'ACTIVE', isCurrent: false, hasApprovedVersion: false };
    expect(strategyDisplayStatus({ ...base, latestVersionStatus: 'DRAFT' })).toBe('DRAFT');
    expect(strategyDisplayStatus({ ...base, latestVersionStatus: null })).toBe('DRAFT');
    expect(strategyDisplayStatus({ ...base, latestVersionStatus: 'IN_REVIEW' })).toBe('IN_REVIEW');
    expect(strategyDisplayStatus({ ...base, latestVersionStatus: 'REJECTED' })).toBe(
      'CHANGES_REQUESTED',
    );
    expect(
      strategyDisplayStatus({ ...base, hasApprovedVersion: true, latestVersionStatus: 'APPROVED' }),
    ).toBe('APPROVED');
    expect(
      strategyDisplayStatus({
        ...base,
        isCurrent: true,
        hasApprovedVersion: true,
        latestVersionStatus: 'APPROVED',
      }),
    ).toBe('CURRENT');
    expect(
      strategyDisplayStatus({
        ...base,
        strategyStatus: 'ARCHIVED',
        hasApprovedVersion: true,
        latestVersionStatus: 'APPROVED',
      }),
    ).toBe('ARCHIVED');
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
