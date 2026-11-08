import { describe, expect, it } from 'vitest';
import {
  effectiveApprovalPolicy,
  requiredApproverCount,
  resolveApprovalSettings,
  workspaceModeToPolicy,
} from './approval-policy';

describe('workspace approval policy resolution', () => {
  it('maps workspace modes to content policies', () => {
    expect(workspaceModeToPolicy('none')).toBe('NONE');
    expect(workspaceModeToPolicy('optional')).toBe('OPTIONAL');
    expect(workspaceModeToPolicy('required')).toBe('REQUIRED');
    expect(workspaceModeToPolicy('multi_level')).toBe('REQUIRED');
    expect(workspaceModeToPolicy(undefined)).toBe('OPTIONAL');
  });

  it('inherits the workspace mode when the brand has no explicit override', () => {
    expect(effectiveApprovalPolicy('required', null)).toBe('REQUIRED');
    expect(effectiveApprovalPolicy('none', undefined)).toBe('NONE');
    expect(effectiveApprovalPolicy('multi_level', null)).toBe('REQUIRED');
    expect(effectiveApprovalPolicy('optional', null)).toBe('OPTIONAL');
  });

  it('lets an explicit brand policy override the workspace', () => {
    expect(effectiveApprovalPolicy('required', 'NONE')).toBe('NONE');
    expect(effectiveApprovalPolicy('none', 'REQUIRED')).toBe('REQUIRED');
    expect(effectiveApprovalPolicy('required', 'OPTIONAL')).toBe('OPTIONAL');
  });

  it('uses workspace required-approver counts only when the effective policy is REQUIRED', () => {
    expect(requiredApproverCount('OPTIONAL', 'optional', 3)).toBe(1);
    expect(requiredApproverCount('NONE', 'none', 3)).toBe(1);
    expect(requiredApproverCount('REQUIRED', 'required', 3)).toBe(3);
    expect(requiredApproverCount('REQUIRED', 'multi_level', 1)).toBe(2);
    expect(requiredApproverCount('REQUIRED', 'required', 9)).toBe(5);
  });

  it('resolves a complete brand override and inherits missing toggle fields', () => {
    const inherited = resolveApprovalSettings(
      {
        approvalMode: 'required',
        requiredApprovers: 3,
        scheduleOnApproval: true,
        lockAfterApproval: true,
        reminderPendingApprovals: true,
      },
      null,
    );
    expect(inherited).toMatchObject({
      mode: 'required',
      policy: 'REQUIRED',
      requiredApprovers: 3,
      scheduleOnApproval: true,
      lockAfterApproval: true,
      reminderPendingApprovals: true,
      source: 'workspace',
    });

    const overridden = resolveApprovalSettings(
      {
        approvalMode: 'required',
        requiredApprovers: 3,
        scheduleOnApproval: true,
        lockAfterApproval: true,
        reminderPendingApprovals: true,
      },
      {
        approvalMode: 'none',
        requiredApprovers: 1,
        scheduleOnApproval: false,
        lockAfterApproval: false,
        reminderPendingApprovals: false,
      },
    );
    expect(overridden).toMatchObject({
      mode: 'none',
      policy: 'NONE',
      requiredApprovers: 1,
      scheduleOnApproval: false,
      lockAfterApproval: false,
      reminderPendingApprovals: false,
      source: 'brand',
    });

    const optionalBrand = resolveApprovalSettings(
      { approvalMode: 'required', requiredApprovers: 2, scheduleOnApproval: false },
      { approvalPolicy: 'OPTIONAL' },
    );
    expect(optionalBrand.policy).toBe('OPTIONAL');
    expect(optionalBrand.source).toBe('brand');
    expect(optionalBrand.scheduleOnApproval).toBe(false);
  });
});
