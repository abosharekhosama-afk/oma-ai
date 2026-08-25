# Contract: Jobs & Transactional Outbox

**Status:** `DRAFT FOR APPROVAL`
**Owner:** OMA Platform

## Transactional outbox

1. Domain command opens DB transaction.
2. Mutate aggregate(s).
3. Insert `OutboxEvent` row(s).
4. Commit.
5. Worker/publisher reads unpublished outbox, dispatches to BullMQ or consumers, marks published.
6. At-least-once delivery; consumers idempotent.

## Job handler contract

Every job payload includes:

- `job_run_id`, `tenant_id`, `actor_user_id` (nullable for system), `correlation_id`, `idempotency_key` (optional)

Handler steps:

1. Load JobRun; skip if terminal success (idempotent).
2. Re-resolve tenant + actor capabilities (confused-deputy prevention).
3. Execute; update JobRun status; emit domain events via outbox as needed.
4. On failure: classify retryable vs dead; sanitize errors.

## Queue naming

Foundation queues: `outbox`, `mail`, `system`.
Future: `ingestion`, `ai`, `workdrive`, `meta` — created when slices authorize.

## API (operator/user visibility)

- `GET /api/v1/jobs/{id}` — tenant-scoped; capability `job.read` or owner
- Cancel only when safe: `POST /api/v1/jobs/{id}/cancel`
