/**
 * Shared Redis key for Worker liveness (ops probes, CHK010).
 * Value: ISO-8601 timestamp string (UTC).
 */
export function workerHeartbeatRedisKey(): string {
  return (
    process.env.WORKER_HEARTBEAT_REDIS_KEY?.trim() ||
    `${process.env.BULLMQ_PREFIX || 'oma'}:worker:heartbeat`
  );
}

export function workerHeartbeatTtlSeconds(): number {
  const n = Number(process.env.WORKER_HEARTBEAT_TTL_SECONDS ?? '120');
  return Number.isFinite(n) && n > 0 ? n : 120;
}

export function workerHeartbeatMaxAgeSeconds(): number {
  const n = Number(process.env.WORKER_HEARTBEAT_MAX_AGE_SECONDS ?? '90');
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export function workerHeartbeatAgeSeconds(
  iso: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 1000));
}

export function workerHeartbeatStale(iso: string | null | undefined, now = Date.now()): boolean {
  const age = workerHeartbeatAgeSeconds(iso, now);
  if (age === null) return true;
  return age > workerHeartbeatMaxAgeSeconds();
}
