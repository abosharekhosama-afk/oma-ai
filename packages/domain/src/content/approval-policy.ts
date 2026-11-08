import type { ApprovalPolicy } from './states';

export type ApprovalModeId = 'none' | 'optional' | 'required' | 'multi_level';

export type ApprovalSettingsSource = {
  approvalMode?: string | null;
  approvalPolicy?: ApprovalPolicy | null;
  requiredApprovers?: number | null;
  scheduleOnApproval?: boolean | null;
  lockAfterApproval?: boolean | null;
  reminderPendingApprovals?: boolean | null;
};

export type ResolvedApprovalSettings = {
  mode: ApprovalModeId;
  policy: ApprovalPolicy;
  requiredApprovers: number;
  scheduleOnApproval: boolean;
  lockAfterApproval: boolean;
  reminderPendingApprovals: boolean;
  source: 'brand' | 'workspace';
};

/** Map the workspace setting value (none | optional | required | multi_level) to a policy. */
export function workspaceModeToPolicy(mode: string | null | undefined): ApprovalPolicy {
  const m = (mode ?? '').toLowerCase();
  if (m === 'none') return 'NONE';
  if (m === 'required' || m === 'multi_level') return 'REQUIRED';
  return 'OPTIONAL';
}

export function parseApprovalMode(mode: string | null | undefined): ApprovalModeId | null {
  const m = (mode ?? '').toLowerCase();
  if (m === 'none' || m === 'optional' || m === 'required' || m === 'multi_level') return m;
  return null;
}

export function policyToApprovalMode(policy: ApprovalPolicy): ApprovalModeId {
  if (policy === 'NONE') return 'none';
  if (policy === 'REQUIRED') return 'required';
  return 'optional';
}

/**
 * Explicit per-brand policy wins; otherwise inherit the workspace mode.
 * `null` / `undefined` on the brand means "no override" (not the same as OPTIONAL).
 */
export function effectiveApprovalPolicy(
  workspaceMode: string | null | undefined,
  brandPolicy: ApprovalPolicy | null | undefined,
): ApprovalPolicy {
  if (brandPolicy === 'NONE' || brandPolicy === 'OPTIONAL' || brandPolicy === 'REQUIRED') {
    return brandPolicy;
  }
  return workspaceModeToPolicy(workspaceMode);
}

export function brandApprovalOverrideMode(
  brand?: ApprovalSettingsSource | null,
): ApprovalModeId | null {
  const fromMode = parseApprovalMode(brand?.approvalMode);
  if (fromMode) return fromMode;
  const policy = brand?.approvalPolicy;
  if (policy === 'NONE' || policy === 'OPTIONAL' || policy === 'REQUIRED') {
    return policyToApprovalMode(policy);
  }
  return null;
}

/**
 * Resolve the settings that apply to a brand: an explicit brand override
 * (approvalMode or legacy approvalPolicy) wins; otherwise the workspace defaults.
 */
export function resolveApprovalSettings(
  workspace?: ApprovalSettingsSource | null,
  brand?: ApprovalSettingsSource | null,
): ResolvedApprovalSettings {
  const brandMode = brandApprovalOverrideMode(brand);
  const source: 'brand' | 'workspace' = brandMode ? 'brand' : 'workspace';
  const mode = brandMode ?? parseApprovalMode(workspace?.approvalMode) ?? 'optional';
  const policy = workspaceModeToPolicy(mode);
  const requiredInput =
    source === 'brand' && brand?.requiredApprovers != null
      ? brand.requiredApprovers
      : workspace?.requiredApprovers;
  const pickBool = (brandVal: boolean | null | undefined, wsVal: boolean | null | undefined) =>
    source === 'brand' && brandVal != null ? brandVal : Boolean(wsVal);
  return {
    mode,
    policy,
    requiredApprovers: requiredApproverCount(policy, mode, requiredInput),
    scheduleOnApproval: pickBool(brand?.scheduleOnApproval, workspace?.scheduleOnApproval),
    lockAfterApproval: pickBool(brand?.lockAfterApproval, workspace?.lockAfterApproval),
    reminderPendingApprovals: pickBool(
      brand?.reminderPendingApprovals,
      workspace?.reminderPendingApprovals,
    ),
    source,
  };
}

export function requiredApproverCount(
  policy: ApprovalPolicy,
  workspaceMode: string | null | undefined,
  workspaceRequired: number | null | undefined,
): number {
  if (policy !== 'REQUIRED') return 1;
  const minApprovers = (workspaceMode ?? '').toLowerCase() === 'multi_level' ? 2 : 1;
  const n = workspaceRequired ?? minApprovers;
  return Math.min(5, Math.max(minApprovers, n));
}
