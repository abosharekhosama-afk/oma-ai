/**
 * Demo surface re-exports production content workflow (@oma/domain).
 */
export {
  resolveContentWorkflow,
  assertCanSchedule,
  canSchedule,
  type WorkflowSource,
  type ContentWorkflow,
} from '@oma/domain';

export type {
  ApprovalPolicy,
  ScheduleState,
  PublishDisplay,
  ApprovalState,
} from '@oma/domain';
