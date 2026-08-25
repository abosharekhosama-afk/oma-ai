# Ops runbook (vendor-neutral)

## Backup

- Take logical backups of PostgreSQL (`pg_dump`) before migrations.
- Redis is ephemeral for queues/cache; durable job state lives in Postgres `JobRun`/`OutboxEvent`.

## Restore

1. Stop API/worker.
2. Restore Postgres dump.
3. Run `pnpm db:migrate:deploy`.
4. Start API/worker; verify `/api/v1/health/ready`.

## Rollback

- Prefer forward-fix migrations.
- Application rollback: deploy previous image/commit; only migrate down when a tested down migration exists.
