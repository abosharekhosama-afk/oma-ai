import { describe, expect, it } from 'vitest';
import { evaluateApprovalEligibility } from './approval-eligibility';

describe('approval-eligibility', () => {
  const base = {
    profileStatus: 'NEEDS_REVIEW',
    scanStatus: 'PARTIAL' as const,
    requiredFieldsPresent: ['brand.name', 'brand.source_url'],
    requiredFieldsMissing: [],
    claimsWithoutEvidence: [],
    unresolvedAiInferred: [],
    acknowledgeIncomplete: true,
    confirmSummary: true,
    isPartialScan: true,
  };

  it('approves when eligible', () => {
    const r = evaluateApprovalEligibility(base);
    expect(r.approvable).toBe(true);
  });

  it('blocks partial without ack', () => {
    const r = evaluateApprovalEligibility({ ...base, acknowledgeIncomplete: false });
    expect(r.approvable).toBe(false);
    expect(r.blockingReasons).toContain('PARTIAL_ACK_REQUIRED');
  });

  it('blocks cancelled scan', () => {
    const r = evaluateApprovalEligibility({ ...base, scanStatus: 'CANCELLED' });
    expect(r.blockingReasons).toContain('SCAN_CANCELLED');
  });
});
