import {
  workerHeartbeatRedisKey,
  workerHeartbeatAgeSeconds,
  workerHeartbeatStale,
} from '@oma/domain';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const MONITORED_QUEUES = ['ingestion', 'analysis', 'catalog'] as const;

@Controller('api/v1/platform/health')
export class PlatformHealthController {
  @Get('queues')
  async queues() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    const prefix = process.env.BULLMQ_PREFIX || 'oma';
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await redis.connect();
      await redis.ping();
    } catch (e) {
      throw new ServiceUnavailableException({
        status: 'redis_unavailable',
        detail: String(e),
      });
    }

    const queues: Array<{
      name: string;
      waiting: number;
      active: number;
      delayed: number;
      failed: number;
      consumer_heartbeat: string | null;
    }> = [];

    let workerHeartbeat: string | null = null;
    try {
      workerHeartbeat = await redis.get(workerHeartbeatRedisKey());
    } catch {
      workerHeartbeat = null;
    }

    try {
      for (const name of MONITORED_QUEUES) {
        const q = new Queue(name, { connection: redis, prefix });
        try {
          const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
          queues.push({
            name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
            consumer_heartbeat: null,
          });
        } finally {
          await q.close().catch(() => undefined);
        }
      }
    } finally {
      await redis.quit().catch(() => undefined);
    }

    const ageSeconds = workerHeartbeatAgeSeconds(workerHeartbeat);
    return {
      data: {
        prefix,
        queues,
        worker_heartbeat: workerHeartbeat,
        worker_heartbeat_age_seconds: ageSeconds,
        worker_alive: workerHeartbeat ? !workerHeartbeatStale(workerHeartbeat) : false,
        note: workerHeartbeat
          ? 'Worker heartbeat from Redis; ingestion may still backlog if scans are heavy.'
          : 'No worker heartbeat in Redis — confirm Worker is running and shares REDIS_URL + BULLMQ_PREFIX with API.',
      },
    };
  }
}
