export type ApprovalPolicy = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export type ScheduleState = 'UNSCHEDULED' | 'SCHEDULED';
export type ApprovalState = 'NOT_REQUESTED' | 'PENDING' | 'APPROVED';
export type PublishDisplay =
  | 'DRAFT'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'SCHEDULED_LOCAL'
  | 'PUBLISHED_SAMPLE'
  | 'FAILED_SAMPLE';

export type WorkflowSource = {
  status: string;
  scheduledAt: string | null;
  plannedAt?: string | null;
  scheduleState?: ScheduleState;
  approvalState?: ApprovalState;
  publishSample?: 'PUBLISHED_SAMPLE' | 'FAILED_SAMPLE';
};

export type ContentWorkflow = {
  authoring: 'DRAFT';
  plannedAt: string | null;
  scheduleState: ScheduleState;
  approvalState: ApprovalState;
  policy: ApprovalPolicy;
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
  const approvalState: ApprovalState =
    item.approvalState ??
    (item.status === 'APPROVED'
      ? 'APPROVED'
      : item.status === 'IN_REVIEW'
        ? 'PENDING'
        : 'NOT_REQUESTED');
  const scheduleBlocked = policy === 'REQUIRED' && approvalState !== 'APPROVED';
  let publishDisplay: PublishDisplay = 'DRAFT';
  if (item.publishSample === 'FAILED_SAMPLE') publishDisplay = 'FAILED_SAMPLE';
  else if (item.publishSample === 'PUBLISHED_SAMPLE' || item.status === 'PUBLISHED_DEMO') {
    publishDisplay = 'PUBLISHED_SAMPLE';
  } else if (scheduleState === 'SCHEDULED') publishDisplay = 'SCHEDULED_LOCAL';
  else if (approvalState === 'PENDING') publishDisplay = 'APPROVAL_PENDING';
  else if (approvalState === 'APPROVED') publishDisplay = 'APPROVED';
  return {
    authoring: 'DRAFT',
    plannedAt,
    scheduleState,
    approvalState,
    policy,
    scheduleBlocked,
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
