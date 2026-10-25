import type { ApprovalPolicy, ApprovalState, PublishDisplay, ScheduleState } from './states';
import { DomainError } from '../errors';

export type WorkflowSource = {
  status: string;
  scheduledAt: string | null;
  plannedAt?: string | null;
  scheduleState?: ScheduleState;
  approvalState?: ApprovalState | string;
  approverApproved?: number;
  approverRequired?: number;
  publishSample?: 'PUBLISHED_SAMPLE' | 'FAILED_SAMPLE';
  /** Archived content is never shown or treated as scheduled. */
  archivedAt?: string | null;
};

export type ScheduleBlockedReason = 'APPROVAL_REQUIRED' | 'REJECTED' | 'ARCHIVED';

export type ContentWorkflow = {
  authoring: 'DRAFT';
  plannedAt: string | null;
  scheduleState: ScheduleState;
  approvalState: ApprovalState;
  policy: ApprovalPolicy;
  approverApproved: number;
  approverRequired: number;
  scheduleBlocked: boolean;
  /** Why Schedule is disabled; null when allowed. */
  scheduleBlockedReason: ScheduleBlockedReason | null;
  publishDisplay: PublishDisplay;
  /** Always false until channel integrations exist */
  publishingConnected: false;
};

function asApprovalState(value: string | ApprovalState | undefined): ApprovalState {
  const allowed: ApprovalState[] = [
    'NOT_REQUESTED',
    'PENDING',
    'PARTIALLY_APPROVED',
    'APPROVED',
    'CHANGES_REQUESTED',
    'REJECTED',
  ];
  if (value && (allowed as string[]).includes(value)) return value as ApprovalState;
  return 'NOT_REQUESTED';
}

export function resolveContentWorkflow(
  item: WorkflowSource,
  policy: ApprovalPolicy = 'OPTIONAL',
): ContentWorkflow {
  const plannedAt = item.plannedAt !== undefined ? item.plannedAt : item.scheduledAt;
  const scheduleState: ScheduleState = item.archivedAt
    ? 'UNSCHEDULED'
    : (item.scheduleState ?? (item.status === 'SCHEDULED' ? 'SCHEDULED' : 'UNSCHEDULED'));

  let approvalState: ApprovalState = asApprovalState(item.approvalState);
  if (!item.approvalState) {
    if (item.status === 'APPROVED') approvalState = 'APPROVED';
    else if (item.status === 'IN_REVIEW') approvalState = 'PENDING';
    else approvalState = 'NOT_REQUESTED';
  }

  const wasRejected = approvalState === 'REJECTED';
  if (policy === 'NONE') {
    approvalState = 'NOT_REQUESTED';
  } else if (item.approverRequired != null && item.approverRequired > 0) {
    const approved = item.approverApproved ?? 0;
    if (approvalState !== 'CHANGES_REQUESTED' && approvalState !== 'REJECTED') {
      if (approved <= 0) {
        approvalState =
          approvalState === 'NOT_REQUESTED' || approvalState === 'PENDING'
            ? approvalState
            : approvalState === 'APPROVED'
              ? 'APPROVED'
              : 'PENDING';
        if (item.approvalState === 'PENDING' || item.status === 'IN_REVIEW') {
          approvalState = approved <= 0 ? 'PENDING' : approvalState;
        }
      } else if (approved < item.approverRequired) {
        approvalState = 'PARTIALLY_APPROVED';
      } else {
        approvalState = 'APPROVED';
      }
    }
  }

  const approverRequired = item.approverRequired ?? 1;
  const approverApproved =
    item.approverApproved ??
    (approvalState === 'APPROVED'
      ? approverRequired
      : approvalState === 'PARTIALLY_APPROVED'
        ? Math.max(1, Math.min(approverRequired - 1, 1))
        : 0);

  const scheduleBlockedReason: ScheduleBlockedReason | null = item.archivedAt
    ? 'ARCHIVED'
    : wasRejected
      ? 'REJECTED'
      : policy === 'REQUIRED' && approvalState !== 'APPROVED'
        ? 'APPROVAL_REQUIRED'
        : null;
  const scheduleBlocked = scheduleBlockedReason !== null;

  let publishDisplay: PublishDisplay = 'DRAFT';
  if (item.publishSample === 'PUBLISHED_SAMPLE') publishDisplay = 'PUBLISHED_SAMPLE';
  else if (item.publishSample === 'FAILED_SAMPLE') publishDisplay = 'FAILED_SAMPLE';
  else if (scheduleState === 'SCHEDULED') publishDisplay = 'SCHEDULED_LOCAL';
  else if (plannedAt) publishDisplay = 'PLANNED_DATE';
  else if (approvalState === 'APPROVED') publishDisplay = 'APPROVED';
  else if (approvalState === 'PARTIALLY_APPROVED') publishDisplay = 'PARTIALLY_APPROVED';
  else if (approvalState === 'PENDING') publishDisplay = 'APPROVAL_PENDING';
  else publishDisplay = 'DRAFT';

  return {
    authoring: 'DRAFT',
    plannedAt: plannedAt ?? null,
    scheduleState,
    approvalState,
    policy,
    approverApproved,
    approverRequired,
    scheduleBlocked,
    scheduleBlockedReason,
    publishDisplay,
    publishingConnected: false,
  };
}

export function assertCanSchedule(item: WorkflowSource, policy: ApprovalPolicy = 'OPTIONAL'): void {
  const wf = resolveContentWorkflow(item, policy);
  if (wf.scheduleBlockedReason === 'ARCHIVED') {
    throw new DomainError('CONFLICT_STATE', 'Archived content cannot be scheduled', 409, 'error.content_archived');
  }
  if (wf.scheduleBlockedReason === 'REJECTED') {
    throw new DomainError('CONTENT_REJECTED', 'Rejected content cannot be scheduled', 409, 'error.content_rejected');
  }
  if (wf.scheduleBlocked) {
    throw new DomainError(
      'SCHEDULE_BLOCKED',
      'Scheduling is blocked until content is fully approved',
      409,
      'error.schedule_blocked',
      [{ policy, approvalState: wf.approvalState, approved: wf.approverApproved, required: wf.approverRequired }],
    );
  }
}

/** Marking as published follows the same gate as scheduling (rejected/archived/unapproved under REQUIRED). */
export function assertCanPublish(item: WorkflowSource, policy: ApprovalPolicy = 'OPTIONAL'): void {
  assertCanSchedule(item, policy);
}

export function canSchedule(item: WorkflowSource, policy: ApprovalPolicy = 'OPTIONAL'): boolean {
  try {
    assertCanSchedule(item, policy);
    return true;
  } catch {
    return false;
  }
}
