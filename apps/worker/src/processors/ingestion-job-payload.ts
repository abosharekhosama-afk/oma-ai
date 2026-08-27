/** BullMQ ingestion job payload — contract fields use snake_case */

export type IngestionJobPayload = {
  job_run_id: string;
  outbox_id?: string;
  tenant_id: string | null;
  brand_id: string;
  scan_attempt_id: string;
  actor_user_id: string | null;
  correlation_id: string | null;
  idempotency_key?: string | null;
  config?: {
    max_pages?: number;
    max_depth?: number;
    max_duration_seconds?: number;
  };
};

export function bullIngestionJobId(jobRunId: string): string {
  return `ingestion-${jobRunId}`;
}

export function buildIngestionJobData(input: {
  jobRunId: string;
  outboxId?: string;
  tenantId: string | null;
  brandId: string;
  scanAttemptId: string;
  actorUserId?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  config?: IngestionJobPayload['config'];
}): IngestionJobPayload {
  return {
    job_run_id: input.jobRunId,
    outbox_id: input.outboxId,
    tenant_id: input.tenantId,
    brand_id: input.brandId,
    scan_attempt_id: input.scanAttemptId,
    actor_user_id: input.actorUserId ?? null,
    correlation_id: input.correlationId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    config: input.config,
  };
}
