-- Deterministic JobRun correlation: unique idempotency keys; queue/status lookup index.
CREATE UNIQUE INDEX "JobRun_idempotencyKey_key" ON "JobRun"("idempotencyKey");

CREATE INDEX "JobRun_queue_status_createdAt_idx" ON "JobRun"("queue", "status", "createdAt");
