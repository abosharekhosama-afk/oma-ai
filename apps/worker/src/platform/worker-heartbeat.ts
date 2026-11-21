import { workerHeartbeatRedisKey, workerHeartbeatTtlSeconds } from '@oma/domain';
import type IORedis from 'ioredis';
import { createLogger } from '@oma/observability';

const log = createLogger('worker-heartbeat');

export function startWorkerHeartbeat(connection: IORedis): void {
  const intervalMs = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? '30000');
  const tick = async () => {
    try {
      const at = new Date().toISOString();
      await connection.set(workerHeartbeatRedisKey(), at, 'EX', workerHeartbeatTtlSeconds());
    } catch (err) {
      log.warn({ err: String(err) }, 'heartbeat write failed');
    }
  };
  void tick();
  setInterval(
    () => void tick(),
    Number.isFinite(intervalMs) && intervalMs > 5000 ? intervalMs : 30000,
  );
}
