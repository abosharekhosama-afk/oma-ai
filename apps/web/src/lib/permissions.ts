/**
 * Client-side Planable-aligned permission helpers.
 * Capabilities come from membership grants (auth/me or members list).
 */

import { hasCapability as domainHas } from './capability-codes';

export { PLANABLE_ROLES, CAPABILITY_LABELS } from './capability-codes';

export function can(grants: readonly string[] | undefined | null, required: string | string[], mode: 'any' | 'all' = 'all'): boolean {
  if (!grants || grants.length === 0) return false;
  return domainHas(grants, required, mode);
}

export function canInvite(grants: readonly string[] | undefined) {
  return can(grants, 'membership.invite');
}

export function canManageMembers(grants: readonly string[] | undefined) {
  return can(grants, 'membership.manage');
}

export function canAssignCapabilities(grants: readonly string[] | undefined) {
  return can(grants, 'capability.assign');
}

export function canApproveContent(grants: readonly string[] | undefined) {
  return can(grants, 'content.approve');
}

export function canScheduleContent(grants: readonly string[] | undefined) {
  return can(grants, 'content.schedule');
}

export function canCreateContent(grants: readonly string[] | undefined) {
  return can(grants, ['content.create', 'content.update'], 'any');
}

export function canManageTenant(grants: readonly string[] | undefined) {
  return can(grants, 'tenant.manage');
}
