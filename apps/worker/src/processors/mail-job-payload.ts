/** BullMQ mail job payload — contract fields use snake_case per jobs-outbox.md */

export type MailJobPayload = {
  job_run_id: string;
  outbox_id: string;
  tenant_id: string | null;
  actor_user_id: string | null;
  correlation_id: string | null;
  idempotency_key?: string | null;
  payload: {
    to?: string;
    token?: string;
    membershipId?: string;
    subject?: string;
    text?: string;
    html?: string;
  };
};

export function bullMailJobId(jobRunId: string): string {
  // BullMQ forbids ':' in custom job ids.
  return `mail-${jobRunId}`;
}

export function buildMailJobData(input: {
  jobRunId: string;
  outboxId: string;
  tenantId: string | null;
  actorUserId?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  payload: MailJobPayload['payload'];
}): MailJobPayload {
  return {
    job_run_id: input.jobRunId,
    outbox_id: input.outboxId,
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId ?? null,
    correlation_id: input.correlationId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    payload: input.payload,
  };
}
