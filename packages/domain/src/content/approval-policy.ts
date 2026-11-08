import type { ApprovalPolicy } from './states';

/** Map the workspace setting value (none | optional | required | multi_level) to a policy. */
export function workspaceModeToPolicy(mode: string | null | undefined): ApprovalPolicy {
  const m = (mode ?? '').toLowerCase();
  if (m === 'none') return 'NONE';
  if (m === 'required' || m === 'multi_level') return 'REQUIRED';
  return 'OPTIONAL';
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
