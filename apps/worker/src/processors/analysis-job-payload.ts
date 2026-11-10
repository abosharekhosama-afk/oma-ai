export type AnalysisJobPayload = {
  job_run_id: string;
  outbox_id?: string;
  tenant_id: string | null;
  brand_id: string;
  scan_attempt_id: string;
  profile_version_id: string;
  actor_user_id: string | null;
  correlation_id: string | null;
  idempotency_key?: string | null;
};

export function bullAnalysisJobId(jobRunId: string): string {
  return `analysis-${jobRunId}`;
}

export function buildAnalysisJobData(input: {
  jobRunId: string;
  outboxId?: string;
  tenantId: string | null;
  brandId: string;
  scanAttemptId: string;
  profileVersionId: string;
  actorUserId?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
}): AnalysisJobPayload {
  return {
    job_run_id: input.jobRunId,
    outbox_id: input.outboxId,
    tenant_id: input.tenantId,
    brand_id: input.brandId,
    scan_attempt_id: input.scanAttemptId,
    profile_version_id: input.profileVersionId,
    actor_user_id: input.actorUserId ?? null,
    correlation_id: input.correlationId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
  };
}
