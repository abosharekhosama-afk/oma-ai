export type ApprovalPolicy = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export type ScheduleState = 'UNSCHEDULED' | 'SCHEDULED';
export type ApprovalState = 'NOT_REQUESTED' | 'PENDING' | 'PARTIALLY_APPROVED' | 'APPROVED';
export type PublishDisplay =
  | 'DRAFT'
  | 'APPROVAL_PENDING'
  | 'PARTIALLY_APPROVED'
  | 'APPROVED'
  | 'PLANNED_DATE'
  | 'SCHEDULED_LOCAL'
  | 'PUBLISHING_NOT_CONNECTED'
  | 'PUBLISHED_SAMPLE'
  | 'FAILED_SAMPLE';

export type WorkflowSource = {
  status: string;
  scheduledAt: string | null;
  plannedAt?: string | null;
  scheduleState?: ScheduleState;
  approvalState?: ApprovalState;
  approverApproved?: number;
  approverRequired?: number;
  publishSample?: 'PUBLISHED_SAMPLE' | 'FAILED_SAMPLE';
};

export type ContentWorkflow = {
  authoring: 'DRAFT';
  plannedAt: string | null;
  scheduleState: ScheduleState;
  approvalState: ApprovalState;
  policy: ApprovalPolicy;
  approverApproved: number;
  approverRequired: number;
  scheduleBlocked: boolean;
  publishDisplay: PublishDisplay;
  publishingConnected: false;
};

export function resolveContentWorkflow(
  item: WorkflowSource,
  policy: ApprovalPolicy = 'OPTIONAL',
): ContentWorkflow {
  const plannedAt = item.plannedAt !== undefined ? item.plannedAt : item.scheduledAt;
  const scheduleState: ScheduleState =
    item.scheduleState ?? (item.status === 'SCHEDULED' ? 'SCHEDULED' : 'UNSCHEDULED');
  let approvalState: ApprovalState =
    item.approvalState ??
    (item.status === 'APPROVED'
      ? 'APPROVED'
      : item.status === 'IN_REVIEW'
        ? 'PENDING'
        : 'NOT_REQUESTED');
  if (policy === 'NONE') approvalState = 'NOT_REQUESTED';
  else if (item.approverRequired != null && item.approverRequired > 0) {
    const approved = item.approverApproved ?? 0;
    if (approved <= 0) {
      approvalState = approvalState === 'NOT_REQUESTED' ? 'NOT_REQUESTED' : 'PENDING';
    } else if (approved < item.approverRequired) approvalState = 'PARTIALLY_APPROVED';
    else approvalState = 'APPROVED';
  }
  const approverRequired = item.approverRequired ?? (approvalState === 'APPROVED' ? 1 : 1);
  const approverApproved =
    item.approverApproved ??
    (approvalState === 'APPROVED'
      ? approverRequired
      : approvalState === 'PARTIALLY_APPROVED'
        ? 1
        : 0);
  const scheduleBlockedFinal = policy === 'REQUIRED' && approvalState !== 'APPROVED';
  let publishDisplay: PublishDisplay = 'DRAFT';
  if (item.publishSample === 'FAILED_SAMPLE') publishDisplay = 'FAILED_SAMPLE';
  else if (item.publishSample === 'PUBLISHED_SAMPLE' || item.status === 'PUBLISHED_DEMO') {
    publishDisplay = 'PUBLISHED_SAMPLE';
  } else if (scheduleState === 'SCHEDULED') publishDisplay = 'SCHEDULED_LOCAL';
  else if (approvalState === 'PARTIALLY_APPROVED') publishDisplay = 'PARTIALLY_APPROVED';
  else if (approvalState === 'PENDING') publishDisplay = 'APPROVAL_PENDING';
  else if (approvalState === 'APPROVED') publishDisplay = 'APPROVED';
  else if (plannedAt) publishDisplay = 'PLANNED_DATE';
  return {
    authoring: 'DRAFT',
    plannedAt,
    scheduleState,
    approvalState,
    policy,
    approverApproved,
    approverRequired,
    scheduleBlocked: scheduleBlockedFinal,
    publishDisplay,
    publishingConnected: false,
  };
}

export function assertCanSchedule(
  workflow: ContentWorkflow,
): 'OK' | 'DATE_REQUIRED' | 'APPROVAL_REQUIRED' {
  if (!workflow.plannedAt) return 'DATE_REQUIRED';
  if (workflow.scheduleBlocked) return 'APPROVAL_REQUIRED';
  return 'OK';
}
