import { describe, expect, it } from 'vitest';
import {
  workerHeartbeatAgeSeconds,
  workerHeartbeatRedisKey,
  workerHeartbeatStale,
} from '@oma/domain';

describe('worker heartbeat helpers', () => {
  it('builds default redis key from prefix', () => {
    const prev = process.env.BULLMQ_PREFIX;
    const custom = process.env.WORKER_HEARTBEAT_REDIS_KEY;
    delete process.env.WORKER_HEARTBEAT_REDIS_KEY;
    process.env.BULLMQ_PREFIX = 'oma-test';
    expect(workerHeartbeatRedisKey()).toBe('oma-test:worker:heartbeat');
    process.env.BULLMQ_PREFIX = prev;
    if (custom) process.env.WORKER_HEARTBEAT_REDIS_KEY = custom;
    else delete process.env.WORKER_HEARTBEAT_REDIS_KEY;
  });

  it('detects stale heartbeat', () => {
    const now = Date.parse('2026-01-01T12:00:00.000Z');
    const fresh = '2026-01-01T11:59:30.000Z';
    const old = '2026-01-01T11:58:00.000Z';
    expect(workerHeartbeatStale(fresh, now)).toBe(false);
    expect(workerHeartbeatStale(old, now)).toBe(true);
    expect(workerHeartbeatAgeSeconds(fresh, now)).toBe(30);
  });
});
